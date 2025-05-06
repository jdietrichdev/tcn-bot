import { APIMessageComponentInteraction, ButtonStyle, ComponentType } from "discord-api-types/v10";
import { updateMessage } from "../adapters/discord-adapter";

export const messageRecruit = async (interaction: APIMessageComponentInteraction) => {
    try {
        await updateMessage(interaction.application_id, interaction.token, {
            content:
            interaction.message.content +
            "\n" +
            `Messaged by ${interaction.member?.user.username}`,
            components: [
            {
                type: ComponentType.ActionRow,
                components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: "Messaged",
                    custom_id: "messageRecruit",
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    label: "Close",
                    custom_id: "closeRecruit",
                },
                ],
            },
            ],
        });
    } catch (err) {
        console.error(`Failure updating recruit message: ${err}`);
    }
}