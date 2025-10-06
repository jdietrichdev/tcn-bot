import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Proposal } from "../util/interfaces";
import { VoteType } from "../util/enums";

export const indifferentNomination = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const message = interaction.message.id;
    const voucher = interaction.member!.user;

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

    const proposal: Proposal = proposalData.proposals.find(
      (proposal: Proposal) => proposal.message === message
    );

    proposal.votes.push({
      user: voucher.username,
      type: VoteType.NOT_SURE,
    });

    //Do not update embed

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
        "There was an issue vouching for this nomination, if you don't see an update, please try again",
    });
  }
};
