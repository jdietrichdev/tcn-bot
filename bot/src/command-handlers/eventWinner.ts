import { APIApplicationCommandInteractionDataUserOption, APIChatInputApplicationCommandInteraction, APITextChannel, ButtonStyle, ComponentType } from "discord-api-types/v10";
import { createDM, sendMessage, updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const handleEventWinner = async (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        const winner = getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(interaction, "winner").value;
        const eventId = (interaction.channel as APITextChannel).topic;

        const eventData = (await dynamoDbClient.send(new GetCommand({
            TableName: "BotTable",
            Key: {
                pk: interaction.guild_id!,
                sk: `event#${eventId}`
            }
        }))).Item;

        if (!eventData) {
            throw new Error("No event found for this channel");
        }

        const dmChannel = await createDM({
            recipient_id: winner
        });

        await sendMessage({
            content: `Congratulations on winning a prize in our ${eventData.name} event! Click the button below to claim your prize.`,
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [{
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        custom_id: `claim_${interaction.guild_id!}_${eventId}`,
                        label: "Claim"
                    }],
                },
            ]
        }, dmChannel.id);

        await sendMessage({
            content: `Congratulations to <@${winner}> for winning in this event! Check your DMs for further instructions.`
        }, interaction.channel.id);

        await updateResponse(interaction.application_id, interaction.token, {
            content: "Thanks for registering this winner!"
        });
    } catch (err) {
        console.error(`Failed to create winner for event: ${err}`);
        await updateResponse(interaction.application_id, interaction.token, {
            content:
                "There was a failure adding winner for event, verify you are in a valid event channel and try again or contact admins",
        });
    }
}