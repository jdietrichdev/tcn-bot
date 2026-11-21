import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { CwlSignupRecord, isCwlSignupRecord } from "./cwlSignup";

export const getCwlSignupById = async (
  guildId: string,
  signupId: string
): Promise<CwlSignupRecord | undefined> => {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: `signup#${signupId}`,
      },
    })
  );
  const signup: unknown = response.Item;
  return isCwlSignupRecord(signup) ? signup : undefined;
};

export const listCwlSignups = async (
  guildId: string
): Promise<CwlSignupRecord[]> => {
  const signups: unknown[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":prefix": "signup#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    const page: unknown = response.Items ?? [];
    if (!Array.isArray(page)) {
      throw new Error("Could not read the CWL signups.");
    }
    signups.push(...page);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return signups.filter(isCwlSignupRecord);
};

export const findCwlSignupByName = async (
  guildId: string,
  signupName: string
): Promise<CwlSignupRecord | undefined> => {
  const signups = await listCwlSignups(guildId);
  return signups.find((signup) => signup.signupName === signupName);
};

export const saveCwlSignup = async (signup: CwlSignupRecord) => {
  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: signup,
    })
  );
};
