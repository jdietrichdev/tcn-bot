import { APIApplicationCommandInteractionDataStringOption, APIApplicationCommandInteractionDataUserOption, APIChatInputApplicationCommandInteraction, APIEmbed } from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { getUser, sendMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../util/serverConfig";

export const handleNominate = async (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        const config = getConfig(interaction.guild_id!);
        const user = getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(interaction, "user").value;
        const type = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "type").value;
        const rank = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "rank").value;
        const reason = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "reason").value;

        const promotions = (await dynamoDbClient.send(new GetCommand({
            TableName: 'BotTable',
            Key: {
                pk: interaction.guild_id!,
                sk: 'rank-proposals'
            }
        }))).Item ?? { pk: interaction.guild_id!, sk: 'rank-proposals', proposals: []};

        if (promotions.proposals.some(
            (proposal: Record<string, any>) => proposal.userId === user && proposal.rank === rank && proposal.type === type
        )) {
            updateResponse(interaction.application_id, interaction.token, {
                content: `<@${user}> has already been proposed for this, check proposal channel for details`
            })
        }

        const embed = createNominationEmbed(interaction, user, type, rank, reason);
        const message = await sendMessage({
            embeds: [embed]
        }, config.RANK_PROPOSAL_CHANNEL);

        const userData = await getUser(user);
        promotions.proposals.push({
            userId: user,
            username: userData.username,
            rank,
            type,
            votes: [],
            proposalTime: new Date().toISOString(),
            proposedBy: interaction.member!.user.username,
            message: message.id
        })
    } catch (err) {
        console.log("Failure handling nominate command", err);
        throw err;
    }
}

const createNominationEmbed = (interaction: APIChatInputApplicationCommandInteraction, user: string, type: string, rank: string, reason: string) => {
    return {
        title: `${rank} ${type} Proposal`,
        description: `Proposal for <@${user}>\nProposed by: ${interaction.member!.user.username}\nReasoning: ${reason}`
    } as APIEmbed
}