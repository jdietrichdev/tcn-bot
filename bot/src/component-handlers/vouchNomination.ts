import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const vouchNomination = async (interaction: APIMessageComponentInteraction) => {
    try {
        const config = getConfig(interaction.guild_id!);
        const message = interaction.message.id;
        const voucher = interaction.member!.user;

        const proposalData = (await dynamoDbClient.send(new GetCommand({
            TableName: 'BotTable',
            Key: {
                pk: interaction.guild_id!,
                sk: 'rank-proposals'
            }
        }))).Item!;

        const proposal = proposalData.proposals.find((proposal: Record<string, any>) => proposal.message = message)!;
        proposalData.proposals.forEach((proposal: Record<string, any>) => {
            if (proposal.message === message) {
                proposal.votes.push({
                    user: voucher.username,
                    type: 'VOUCH'
                })
            }
        })

        console.log(proposalData);

        const updatedEmbed = interaction.message.embeds[0];
        if (updatedEmbed.fields) {
            updatedEmbed.fields.push({
                name: voucher.username,
                value: 'VOUCH'
            });
        } else {
            updatedEmbed.fields = [{
                name: voucher.username,
                value: 'VOUCH'
            }];
        }

        console.log(updatedEmbed);

        await updateMessage(config.RANK_PROPOSAL_CHANNEL, message, {
            embeds: [updatedEmbed]
        });
        await dynamoDbClient.send(new PutCommand({
            TableName: 'BotTable',
            Item: proposalData
        }));
        await updateResponse(interaction.application_id, interaction.token, {
            content: "Thank you for your vote!"
        });
    } catch (err) {
        console.error(`Failure vouching for nomination: ${err}`);
        await updateResponse(interaction.application_id, interaction.token, {
            content: "There was an issue vouching for this nomination, if you don't see an update, please try again"
        })
    }
}