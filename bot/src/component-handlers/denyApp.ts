import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { sendMessage, updateMessage } from "../adapters/discord-adapter";

export const denyApp = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        await sendMessage(
            {
            content: `<@${
                interaction.message.embeds![0].fields![6].value
            }> thank you for your application, but your account does not currently meet our criteria, feel free to reapply at a later time`,
            },
            config.GUEST_CHAT_CHANNEL
        );
        await updateMessage(interaction.application_id, interaction.token, {
            content: `Denied by ${interaction.member?.user.username}`,
            components: [],
        });
    } catch (err) {
        console.error(`Failure denying app: ${err}`);
    }
}