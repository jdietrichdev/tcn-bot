import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getServerUser, sendMessage } from "../adapters/discord-adapter";
import { DiscordError } from "../util/errors";
import { ComponentType } from "discord-api-types/v10";
import { BUTTONS } from "../component-handlers/buttons";

export const handleApplicantLeave = async (eventDetail: Record<string, string>) => {
    try {
        const { guildId } = eventDetail;
        const ticketData = (await dynamoDbClient.send(
            new GetCommand({
                TableName: "BotTable",
                Key: {
                    pk: guildId,
                    sk: 'tickets'
                }
            })
        )).Item!;
        const tickets = ticketData.tickets;

        for (const ticket of tickets) {
            try {
                if (!ticket.applicantLeft) {
                    await getServerUser(guildId, ticket.userId);
                }
            } catch (err) {
                if ((err as DiscordError).statusCode === 404) {
                    await sendMessage({
                        content: `<@${ticket.userId}> has left the server, what would you like to do with this ticket?`,
                        components: [{
                            type: ComponentType.ActionRow,
                            components: [BUTTONS.CLOSE_TICKET, BUTTONS.DELETE_TICKET]
                        }]
                    }, ticket.ticketChannel);
                    ticket.applicantLeft = true;
                }
            }
        }
    } catch (err) {
        console.error("Failed to handle checking for applicants who left server", err);
        throw err;
    }
}