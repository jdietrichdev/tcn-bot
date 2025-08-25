import { APIMessageComponentInteraction, ChannelType, OverwriteType, PermissionFlagsBits } from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { createChannel, sendMessage, updateMessage, updateResponse } from "../adapters/discord-adapter";

export const claimEvent = async (interaction: APIMessageComponentInteraction) => {
    try {
        const [, guildId, eventId] = interaction.data.custom_id.split("_");
        const config = getConfig(guildId);
        const eventData = (await dynamoDbClient.send(new GetCommand({
            TableName: "BotTable",
            Key: {
                pk: guildId,
                sk: `event#${eventId}`
            }
        }))).Item!;

        const channel = await createChannel({
            name: `claim-${interaction.user!.username}`,
            topic: `Claim prize from ${eventData.name}`,
            type: ChannelType.GuildText,
            parent_id: config.EVENTS_CATEGORY,
            permission_overwrites: [
                {
                    id: interaction.guild_id!,
                    type: OverwriteType.Role,
                    allow: "0",
                    deny: PermissionFlagsBits.ViewChannel.toString(),
                },
                {
                    id: config.BOT_ID,
                    type: OverwriteType.Member,
                    allow: (
                        PermissionFlagsBits.ViewChannel |
                        PermissionFlagsBits.AddReactions |
                        PermissionFlagsBits.SendMessages
                    ).toString(),
                    deny: "0",
                },
                {
                    id: interaction.user!.id,
                    type: OverwriteType.Member,
                    allow: (
                        PermissionFlagsBits.ViewChannel |
                        PermissionFlagsBits.AddReactions |
                        PermissionFlagsBits.SendMessages
                    ).toString(),
                    deny: "0",
                },
                {
                    id: eventData.sponsor,
                    type: OverwriteType.Member,
                    allow: (
                        PermissionFlagsBits.ViewChannel |
                        PermissionFlagsBits.AddReactions |
                        PermissionFlagsBits.SendMessages
                    ).toString(),
                    deny: "0",
                }
            ]
        }, guildId);

        await sendMessage({
            content: `Congrats again on winning a prize in our event <@${interaction.user!.id}>! Please coordinate with <@${eventData.sponsor}> to claim your prize.`
        }, channel.id);

        await updateMessage(interaction.channel.id, interaction.message.id, {
            components: []
        });

        await updateResponse(interaction.application_id, interaction.token, {
            content: "Your claim process has begun!"
        });
    } catch (err) {
        console.error(`Failed to claim prize: ${err}`);
        await updateResponse(interaction.application_id, interaction.token, {
            content:
                "There was a failure claiming your prize, please try again or contact admin",
        });
    }
}