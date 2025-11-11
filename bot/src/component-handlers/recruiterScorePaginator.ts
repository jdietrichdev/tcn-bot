import {
  APIMessageComponentInteraction,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  RecruiterScoreRow,
  ScoreTotals,
} from "../util/recruiterScoreShared";
import {
  RecruiterScoreDisplayContext,
  SCORE_PAGE_SIZE,
  buildRecruiterScorePageEmbed,
  buildRecruiterTotalsEmbed,
  createRecruiterScoreComponents,
} from "../util/recruiterScoreDisplay";

interface RecruiterScoreCacheData {
  scores: RecruiterScoreRow[];
  totals: ScoreTotals;
  context: RecruiterScoreDisplayContext;
  pageSize: number;
  totalPages: number;
  channelId: string;
  messageId: string;
}

const CACHE_TABLE_PK = "recruiter-score-cache";
const CACHE_TTL_SECONDS = 15 * 60;

export const storeRecruiterScoreCache = async (
  sessionId: string,
  data: RecruiterScoreCacheData
) => {
  const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS;

  await dynamoDbClient.send(
    new PutCommand({
      TableName: "BotTable",
      Item: {
        pk: CACHE_TABLE_PK,
        sk: sessionId,
        data,
        ttl,
      },
    })
  );

  console.log(
    `Stored recruiter score cache in DynamoDB for session ${sessionId} (message ${data.messageId})`
  );
};

const getRecruiterScoreCache = async (
  sessionId: string
): Promise<RecruiterScoreCacheData | null> => {
  try {
    const result = await dynamoDbClient.send(
      new GetCommand({
        TableName: "BotTable",
        Key: {
          pk: CACHE_TABLE_PK,
          sk: sessionId,
        },
      })
    );

    if (result.Item?.data) {
      return result.Item.data as RecruiterScoreCacheData;
    }

    return null;
  } catch (error) {
    console.error(
      `Failed to retrieve recruiter score cache for session ${sessionId}:`,
      error
    );
    return null;
  }
};

export const handleRecruiterScorePagination = async (
  interaction: APIMessageComponentInteraction,
  customId: string
) => {
  const parts = customId.split("_");
  if (parts.length < 4) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "⚠️ Unable to process this pagination click.",
        flags: 64,
      },
    };
  }

  const action = parts[2];
  const sessionId = parts[3];

  const cache = await getRecruiterScoreCache(sessionId);
  if (!cache) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "⚠️ This scoreboard session expired. Please run `/recruiter-score` again.",
        flags: 64,
      },
    };
  }

  const footerText = interaction.message.embeds?.[0]?.footer?.text ?? "";
  const footerMatch = footerText.match(/Page (\d+) of (\d+)/i);
  const currentPage = footerMatch ? parseInt(footerMatch[1], 10) - 1 : 0;
  const totalPages = cache.totalPages ?? Math.max(
    2,
    Math.ceil(cache.scores.length / (cache.pageSize || SCORE_PAGE_SIZE)) + 1
  );

  let newPage = currentPage;
  switch (action) {
    case "first":
      newPage = 0;
      break;
    case "prev":
      newPage = Math.max(0, currentPage - 1);
      break;
    case "next":
      newPage = Math.min(totalPages - 1, currentPage + 1);
      break;
    case "last":
      newPage = totalPages - 1;
      break;
    default:
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "⚠️ Unknown pagination action.",
          flags: 64,
        },
      };
  }

  const pageSize = cache.pageSize || SCORE_PAGE_SIZE;
  const embed =
    newPage === totalPages - 1
      ? buildRecruiterTotalsEmbed(cache.totals, cache.context, newPage, totalPages)
      : buildRecruiterScorePageEmbed(
          cache.scores,
          cache.totals,
          cache.context,
          newPage,
          totalPages,
          pageSize
        );

  const components = createRecruiterScoreComponents(
    sessionId,
    totalPages,
    newPage
  );

  return {
    type: InteractionResponseType.UpdateMessage,
    data: {
      embeds: [embed],
      components,
    },
  };
};
