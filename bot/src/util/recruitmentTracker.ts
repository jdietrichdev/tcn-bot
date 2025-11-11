import { dynamoDbClient } from "../clients/dynamodb-client";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const TRACKER_STATE_KEY = "recruitmentTrackerState";
const POINTS_PREFIX = "recruitmentPoints#";
const TICKET_STATS_PREFIX = "ticketStats#";

export interface RecruitmentTrackerState {
  lastFcMessageId?: string;
}

interface RecruitmentTrackerStateItem extends RecruitmentTrackerState {
  pk: string;
  sk: string;
  updatedAt?: string;
}

export interface RecruitmentPointsIncrements {
  ticketMessages?: number;
  fcPosts?: number;
  points?: number;
}

export interface TicketRecruiterMessage {
  userId: string;
  username: string;
  count: number;
}

export interface TicketStatsRecord {
  ticketChannelId: string;
  ticketChannelName?: string;
  transcriptId: string;
  applicantId: string;
  applicantUsername: string;
  recruiterMessages: TicketRecruiterMessage[];
  totalParticipantMessages: number;
  closedBy: string;
  closedByUsername: string;
  closedAt: string;
  ticketNumber?: string;
}

export interface RecruitmentPointsItem {
  pk: string;
  sk: string;
  userId: string;
  username?: string;
  points?: number;
  ticketMessages?: number;
  fcPosts?: number;
  updatedAt?: string;
}

interface TicketStatsItem extends TicketStatsRecord {
  pk: string;
  sk: string;
}

export const getRecruitmentTrackerState = async (
  guildId: string
): Promise<RecruitmentTrackerState> => {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: TRACKER_STATE_KEY,
      },
    })
  );

  if (!response.Item) {
    return {};
  }

  const { lastFcMessageId } = response.Item as RecruitmentTrackerStateItem;
  return {
    lastFcMessageId,
  };
};

export const upsertRecruitmentTrackerState = async (
  guildId: string,
  updates: Partial<RecruitmentTrackerState>
): Promise<void> => {
  const current = await getRecruitmentTrackerState(guildId);
  const item: RecruitmentTrackerStateItem = {
    pk: guildId,
    sk: TRACKER_STATE_KEY,
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: item,
    })
  );
};

export const incrementRecruitmentPoints = async (
  guildId: string,
  userId: string,
  username: string | undefined,
  increments: RecruitmentPointsIncrements
): Promise<void> => {
  const ticketMessagesInc = increments.ticketMessages ?? 0;
  const fcPostsInc = increments.fcPosts ?? 0;
  const pointsInc =
    increments.points ?? ticketMessagesInc + fcPostsInc;

  if (pointsInc === 0 && ticketMessagesInc === 0 && fcPostsInc === 0) {
    return;
  }

  const expressionParts = [
    "#points = if_not_exists(#points, :zero) + :pointsInc",
    "ticketMessages = if_not_exists(ticketMessages, :zero) + :ticketMessagesInc",
    "fcPosts = if_not_exists(fcPosts, :zero) + :fcPostsInc",
    "updatedAt = :updatedAt",
    "#userId = if_not_exists(#userId, :userId)",
  ];

  const expressionAttributeNames: Record<string, string> = {
    "#points": "points",
    "#userId": "userId",
  };

  const expressionAttributeValues: Record<string, any> = {
    ":zero": 0,
    ":pointsInc": pointsInc,
    ":ticketMessagesInc": ticketMessagesInc,
    ":fcPostsInc": fcPostsInc,
    ":updatedAt": new Date().toISOString(),
    ":userId": userId,
  };

  if (username) {
    expressionParts.push("#username = :username");
    expressionAttributeNames["#username"] = "username";
    expressionAttributeValues[":username"] = username;
  }

  await dynamoDbClient.send(
    new UpdateCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: `${POINTS_PREFIX}${userId}`,
      },
      UpdateExpression: `SET ${expressionParts.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
};

export const recordTicketRecruiterStats = async (
  guildId: string,
  record: TicketStatsRecord
): Promise<void> => {
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: {
        pk: guildId,
        sk: `${TICKET_STATS_PREFIX}${record.ticketChannelId}`,
        ...record,
      },
    })
  );
};

export const fetchRecruitmentPoints = async (
  guildId: string
): Promise<RecruitmentPointsItem[]> => {
  const items: RecruitmentPointsItem[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const response = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":prefix": POINTS_PREFIX,
        },
        ExclusiveStartKey,
      })
    );

    if (response.Items) {
      items.push(...(response.Items as RecruitmentPointsItem[]));
    }

    ExclusiveStartKey = response.LastEvaluatedKey as
      | Record<string, any>
      | undefined;
  } while (ExclusiveStartKey);

  return items;
};

export const fetchTicketRecruiterStats = async (
  guildId: string,
  since: Date
): Promise<TicketStatsRecord[]> => {
  const items: TicketStatsRecord[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  const sinceIso = since.toISOString();

  do {
    const response = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "closedAt >= :since",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":prefix": TICKET_STATS_PREFIX,
          ":since": sinceIso,
        },
        ExclusiveStartKey,
      })
    );

    if (response.Items) {
      items.push(...(response.Items as TicketStatsItem[]));
    }

    ExclusiveStartKey = response.LastEvaluatedKey as
      | Record<string, any>
      | undefined;
  } while (ExclusiveStartKey);

  return items;
};
