import { APIChatInputApplicationCommandInteraction, APIEmbed, APITextChannel } from "discord-api-types/v10";
import { deleteResponse, sendMessage, updateResponse } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const handleEventLeaderboard = async (interaction: APIChatInputApplicationCommandInteraction) => {
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

        if (eventData.scoreboard) {
            const scoreboard = new Map<string, number>(eventData.scoreboard);
            console.log(JSON.stringify(scoreboard));
            const embed = {
                title: `${eventData.name} Leaderboard`,
                description: Array.from(scoreboard, ([id, score]) => {
                    return `**<@${id}>**: ${score}`
                }).join('\n'),
            } as APIEmbed;
            await sendMessage({ embeds: [embed]}, interaction.channel.id );
            await deleteResponse(interaction.application_id, interaction.token);
        } else {
            await updateResponse(interaction.application_id, interaction.token, {
                content: "There is no score defined for this event, create and answer some questions to create a scoreboard"
            });
        }
    } catch (err) {
        console.log("Failure generating event leaderboard", err);
        await updateResponse(interaction.application_id, interaction.token, {
            content: "Failed generating event leaderboard, please try again"
        });
    }
}