import { APIInteractionResponse, APIMessageComponentInteraction, APIModalSubmitInteraction, ComponentType, InteractionResponseType, TextInputStyle } from "discord-api-types/v10"
import { getConfig } from "../util/serverConfig";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Proposal } from "../util/interfaces";
import { addVote, tallyVotes } from "../util/nomination-util";
import { VoteType } from "../util/enums";
import { updateMessage, updateResponse } from "../adapters/discord-adapter";

export const createVoteNominationModal = (interaction: APIMessageComponentInteraction) => {
    return {
        type: InteractionResponseType.Modal,
        data: {
            custom_id: `${interaction.data.custom_id}Modal`,
            title: `Reason for ${interaction.data.custom_id}`,
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [{
                        type: ComponentType.TextInput,
                        custom_id: "reason",
                        label: "Reason for vote",
                        style: TextInputStyle.Short,
                        required: true,
                    }]
                }
            ]
        }
    } as APIInteractionResponse;
}

export const submitVoteNominationModal = async (interaction: APIModalSubmitInteraction) => {
    try {
        const config = getConfig(interaction.guild_id!);
        const message = interaction.message!.id;

        const proposalData = (await dynamoDbClient.send(new GetCommand({
            TableName: "BotTable",
            Key: {
                pk: interaction.guild_id!,
                sk: "rank-proposals"
            }
        }))).Item!;

        const proposal: Proposal = proposalData.proposals.find((proposal: Proposal) => proposal.message === message);
        const reason = interaction.data.components[0].components[0].value;

        addVote(interaction, proposal.votes, determineVoteType(interaction.data.custom_id), reason);

        const updatedEmbed = interaction.message!.embeds[0];
        const [yes, no] = tallyVotes(proposal.votes);

        updatedEmbed.fields = [
            {
                name: "Current Status",
                value: `Yes: ${yes}, No: ${no}`,
            }
        ];

        await updateMessage(config.RANK_PROPOSAL_CHANNEL, message, {
            embeds: [updatedEmbed],
        });
        await dynamoDbClient.send(new PutCommand({
            TableName: "BotTable",
            Item: proposalData
        }));
        await updateResponse(interaction.application_id, interaction.token, {
            content: "Thank you for your vote!"
        })
    } catch (err) {
        console.error(`Failure handling vote: ${err}`);
        await updateResponse(interaction.application_id, interaction.token, {
            content: "There was an issue processing your vote, please try again or contact admin"
        })
    }
}

const determineVoteType = (customId: string) => {
    const vote = customId.substring(0, customId.length - 5).toUpperCase().replace("_", " ");
    return VoteType[vote as keyof typeof VoteType];
}