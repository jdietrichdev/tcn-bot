import { APIChatInputApplicationCommandInteraction, APITextChannel } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { deleteChannel, updateResponse } from "../adapters/discord-adapter";

export const handleDeleteEvent = async (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        const eventId = (interaction.channel as APITextChannel).topic;
        
        const eventData = (
            await dynamoDbClient.send(
                new GetCommand({
                    TableName: "BotTable",
                    Key: {
                        pk: interaction.guild_id!,
                        sk: `event#${eventId}`,
                    },
                })
            )
        ).Item;
    
        if (!eventData) {
            throw new Error("No event found for this channel");
        }

        await Promise.all([
            dynamoDbClient.send(new DeleteCommand({
                TableName: "BotTable",
                Key: {
                    pk: interaction.guild_id!,
                    sk: `event#${eventId}`,
                }
            })),
            deleteChannel(interaction.channel.id),
        ]);
    } catch (err) {
        console.log("Failure while deleting event", err);
        await updateResponse(interaction.application_id, interaction.token, {
            content: "There was a failure deleting this event, please reach out to admin for assistance"
        });
    }
    
}