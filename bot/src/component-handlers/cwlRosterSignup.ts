import {
  APIMessageComponentInteraction,
  APIMessageSelectMenuInteractionData,
  ComponentType,
} from "discord-api-types/v10";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getMessageSender } from "../util/interaction-util";
import {
  buildCwlRosterMessage,
  CwlRosterAccount,
  getCwlRosterCustomId,
  isCwlSignupRecord,
} from "../util/cwlSignup";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePlayerTag = (tag: string) =>
  `#${tag.replace(/^#/, "").toUpperCase()}`;

const parseCustomId = (
  customId: string,
  action: "signup" | "account"
) => {
  const prefix = `cwl_roster_${action}:`;
  if (!customId.startsWith(prefix)) {
    throw new Error("Invalid CWL roster interaction.");
  }
  const details = customId.slice(prefix.length);
  const separator = details.indexOf(":");
  if (separator <= 0 || separator === details.length - 1) {
    throw new Error("CWL roster interaction is missing its signup details.");
  }
  const clanTag = details.slice(0, separator);
  const signupName = details.slice(separator + 1);
  if (!/^[A-Z0-9]{3,15}$/.test(clanTag)) {
    throw new Error("CWL roster interaction contains an invalid clan tag.");
  }
  return { clanTag, signupName };
};

const findLinkedAccounts = async (userId: string) => {
  const response = await dynamoDbClient.send(
    new QueryCommand({
      TableName: "BotTable",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userId,
        ":prefix": "player#",
      },
    })
  );
  const items: unknown = response.Items ?? [];
  if (!Array.isArray(items)) {
    throw new Error("Could not read the user's linked accounts.");
  }
  return items
    .filter(
      (item): item is Record<string, unknown> & { tag: string } =>
        isRecord(item) && typeof item.tag === "string"
    )
    .map((item) => normalizePlayerTag(item.tag));
};

const addAccountToRoster = async (
  interaction: APIMessageComponentInteraction,
  signupName: string,
  clanTag: string,
  selectedTag: string
) => {
  const userId = getMessageSender(interaction).id;
  const canonicalPlayerTag = normalizePlayerTag(selectedTag);
  const linkedAccounts = await findLinkedAccounts(userId);
  if (!linkedAccounts.includes(canonicalPlayerTag)) {
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "That account is no longer linked. Use `/link create` to link it, then try signing up again.",
    });
    return;
  }

  const signupResponse = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: interaction.guild_id!,
        sk: `signup#${signupName}`,
      },
    })
  );
  const signup: unknown = signupResponse.Item;
  if (!isCwlSignupRecord(signup)) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "This CWL roster is no longer available for signup.",
    });
    return;
  }
  const clan = signup.clans.find(
    (candidate) => candidate.tag.toUpperCase() === clanTag
  );
  if (!signup || !clan?.messageId || typeof signup.channelId !== "string") {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "This CWL roster is no longer available for signup.",
    });
    return;
  }

  const accounts: CwlRosterAccount[] = Array.isArray(clan.accounts)
    ? clan.accounts
    : [];
  const alreadySignedUp = accounts.some(
    (account) => normalizePlayerTag(account.playerTag) === canonicalPlayerTag
  );
  if (!alreadySignedUp) {
    accounts.push({ userId, playerTag: canonicalPlayerTag });
    clan.accounts = accounts;
    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: signup,
      })
    );
  }

  await updateMessage(
    signup.channelId,
    clan.messageId,
    buildCwlRosterMessage(signupName, clan)
  );
  await updateResponse(interaction.application_id, interaction.token, {
    content: alreadySignedUp
      ? `${canonicalPlayerTag} is already on the **${clan.name}** roster.`
      : `Added ${canonicalPlayerTag} to the **${clan.name}** roster.`,
  });
};

export const handleCwlRosterSignup = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupName } = parseCustomId(
      interaction.data.custom_id,
      "signup"
    );
    const userId = getMessageSender(interaction).id;
    const linkedAccounts = await findLinkedAccounts(userId);
    if (linkedAccounts.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "You don't have any linked accounts yet. Use `/link create` to link a Clash of Clans account, then click the clan's signup button again.",
      });
      return;
    }
    if (linkedAccounts.length === 1) {
      await addAccountToRoster(
        interaction,
        signupName,
        clanTag,
        linkedAccounts[0]
      );
      return;
    }
    if (linkedAccounts.length > 25) {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "Discord can show up to 25 accounts in the picker. Please unlink unused accounts before signing up.",
      });
      return;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: `Choose an account for the **${signupName}** signup:`,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
              custom_id: getCwlRosterCustomId("account", clanTag, signupName),
              placeholder: "Select a linked account",
              min_values: 1,
              max_values: 1,
              options: linkedAccounts.map((tag) => ({
                label: tag,
                value: tag,
              })),
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("Failed to open CWL roster signup account picker", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Could not load linked accounts for this CWL signup. Please try again.",
    });
    throw err;
  }
};

export const handleCwlRosterAccountSelect = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const { clanTag, signupName } = parseCustomId(
      interaction.data.custom_id,
      "account"
    );
    if (interaction.data.component_type !== ComponentType.StringSelect) {
      throw new Error("Expected an account selection for CWL signup.");
    }
    const selectedTag = (
      interaction.data as APIMessageSelectMenuInteractionData
    ).values[0];
    if (!selectedTag) {
      throw new Error("No linked account was selected.");
    }
    await addAccountToRoster(interaction, signupName, clanTag, selectedTag);
  } catch (err) {
    console.error("Failed to add selected account to CWL roster", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Could not add that account to the CWL roster. Please try again.",
    });
    throw err;
  }
};
