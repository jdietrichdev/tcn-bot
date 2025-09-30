import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";

export const opposeNomination = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const message = interaction.message.id;
    const opposer = interaction.member!.user;

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

    proposalData.proposals.forEach((proposal: Record<string, any>) => {
      if (proposal.message === message) {
        proposal.votes.push({
          user: opposer.username,
          type: "OPPOSE",
        });
      }
    });

    const updatedEmbed = interaction.message.embeds[0];
    if (updatedEmbed.fields) {
      updatedEmbed.fields.push({
        name: opposer.username,
        value: "OPPOSE",
      });
    } else {
      updatedEmbed.fields = [
        {
          name: opposer.username,
          value: "OPPOSE",
        },
      ];
    }

    await updateMessage(config.RANK_PROPOSAL_CHANNEL, message, {
      embeds: [updatedEmbed],
    });
    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: proposalData,
      })
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Thank you for your vote!",
    });
  } catch (err) {
    console.error(`Failure vouching for nomination: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue opposing this nomination, if you don't see an update, please try again",
    });
  }
};
