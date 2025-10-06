import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Proposal } from "../util/interfaces";
import { VoteType } from "../util/enums";
import { addVote, tallyVotes } from "../util/nomination-util";
import { getConfig } from "../util/serverConfig";

export const indifferentNomination = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
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

    const proposal: Proposal = proposalData.proposals.find(
      (proposal: Proposal) => proposal.message === message
    );

    addVote(interaction, proposal.votes, VoteType.NOT_SURE);

    const updatedEmbed = interaction.message.embeds[0];
    const [yes, no] = tallyVotes(proposal.votes);

    updatedEmbed.fields = [
      ...((yes ||
        no && [
          {
            name: "Current Status",
            value: `Yes: ${yes}, No: ${no}`,
          },
        ]) ||
        []),
    ];
    console.log(updatedEmbed);

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
        "There was an issue vouching for this nomination, if you don't see an update, please try again",
    });
  }
};
