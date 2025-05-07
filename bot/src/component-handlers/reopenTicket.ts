import { APIMessageComponentInteraction, ButtonStyle, ComponentType } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { moveChannel, sendMessage, updateMessage } from "../adapters/discord-adapter";
import { isActorRecruiter } from "./utils";

export const reopenTicket = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        if (await isActorRecruiter(interaction.guild_id!, interaction.member!.user.id, config)) {
            const channelId = interaction.message.channel_id;
            await moveChannel(channelId, config.APPLICATION_CATEGORY);
            await sendMessage({
                content: `${interaction.member?.user.username} has reopened the ticket`,
            }, channelId
            );
            await updateMessage(interaction.application_id, interaction.token, {
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label: "Close",
                                custom_id: "closeTicket",
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
                ]
            });
        } else {
            await sendMessage(
                {
                    content: `You do not have permissions to reopen this ticket <@${interaction.member?.user.id}`,
                },
                interaction.channel.id
            )
        }
    } catch (err) {
        console.error(`Failed to reopen ticket: ${err}`);
    }
}