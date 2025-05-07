import { APIMessageComponentInteraction, APITextChannel, ComponentType } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { moveChannel, sendMessage, updateMessage } from "../adapters/discord-adapter";
import { determineRolesButton, isActorRecruiter } from "./utils";
import { BUTTONS } from "./buttons";

export const closeTicket = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        if (await isActorRecruiter(interaction.guild_id!, interaction.member!.user.id, config)) {
            const channelId = interaction.message.channel_id;            
            const userId = (interaction.channel as APITextChannel).topic!.split(":")[1];
            await moveChannel(channelId, config.ARCHIVE_CATEGORY);
            await sendMessage(
                {
                    content: `${interaction.member?.user.username} has closed the ticket`,
                },
                channelId
            );
            await updateMessage(interaction.application_id, interaction.token, {
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            BUTTONS.REOPEN_TICKET,
                            BUTTONS.DELETE_TICKET,
                            await determineRolesButton(interaction.guild_id!, userId!, config)
                        ],
                    },
                ],
            });
        } else {
            await sendMessage(
                {
                    content: `You do not have permission to close this ticket <@${interaction.member?.user.id}>`,
                },
                interaction.channel.id
            );
        }
    } catch (err) {
        console.error(`Failed to close ticket: ${err}`);
    }
};