import { APIMessageComponentInteraction, ButtonStyle, ComponentType } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { moveChannel, sendMessage, updateMessage } from "../adapters/discord-adapter";

export const closeTicket = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        const channelId = interaction.message.channel_id;
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
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: "Reopen",
                            custom_id: "reopenTicket",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Danger,
                            label: "Delete",
                            custom_id: "deleteTicket",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Success,
                            label: "Grant Roles",
                            custom_id: "grantRoles",
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Danger,
                            label: "Remove Roles",
                            custom_id: "removeRoles",
                        },
                    ],
                },
            ],
        });
    } catch (err) {
        console.error(`Failed to close ticket: ${err}`);
    }
};