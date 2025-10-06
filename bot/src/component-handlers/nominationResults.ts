import {
  APIEmbed,
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { updateResponse } from "../adapters/discord-adapter";
import { isActorAdmin } from "./utils";
import { getConfig } from "../util/serverConfig";

export const nominationResults = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    if (
      await isActorAdmin(
        interaction.guild_id!,
        interaction.member!.user.id,
        getConfig(interaction.guild_id!)
      )
    ) {
      const message = interaction.message.id;
      const proposalData = (
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

      const proposal = proposalData.proposals.find(
        (proposal: Record<string, any>) => proposal.message === message
      );

      const resultEmbed = createResultsEmbed(proposal);

      await updateResponse(interaction.application_id, interaction.token, {
        embeds: [resultEmbed],
      });
    } else {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Talk to admins if you'd like to see detailed results`,
      });
    }
  } catch (err) {
    console.error(`Failure displaying nomination results: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "There was an issue displaying results, please try again",
    });
  }
};

const createResultsEmbed = (proposal: Record<string, any>) => {
  return {
    title: `Current Results for ${proposal.username}`,
    description: proposal.reason,
    fields: proposal.votes.map((vote: Record<string, any>) => {
      return { name: vote.user, value: vote.type };
    }),
  } as APIEmbed;
};
