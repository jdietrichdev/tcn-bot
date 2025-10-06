import {
  APIApplicationCommandInteractionDataRoleOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ComponentType,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  deleteResponse,
  grantRole,
  removeRole,
  updateMessage,
} from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";
import { BUTTONS } from "../component-handlers/buttons";

export const handleNominationResult = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const id =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "proposal"
      ).value;
    const result =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "result"
      ).value;
    const role =
      getCommandOptionData<APIApplicationCommandInteractionDataRoleOption>(
        interaction,
        "role"
      )?.value;

    const proposals = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: "rank-proposals",
          },
        })
      )
    ).Item!;

    const proposalData = proposals.proposals.find(
      (proposal: Record<string, any>) => proposal.message === id
    );

    proposals.proposals = proposals.proposals.filter(
      (proposal: Record<string, any>) => proposal.message !== id
    );

    if (result === "Approve" && role) {
      if (proposalData.type === "Promotion") {
        await grantRole(interaction.guild_id!, proposalData.userId, role);
      } else {
        await removeRole(interaction.guild_id!, proposalData.userId, role);
      }
    }

    await updateMessage(config.RANK_PROPOSAL_CHANNEL, proposalData.message, {
      content: `Proposal ${result === "Approve" ? "Approved" : "Denied"}`,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [BUTTONS.NOMINATION_RESULTS],
        },
      ],
    });

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: proposals,
      })
    );

    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.log("Failure handling nomination result", err);
    throw err;
  }
};
