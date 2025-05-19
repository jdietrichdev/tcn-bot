import { APIInteractionResponse, ComponentType, InteractionResponseType, TextInputStyle } from "discord-api-types/v10"

export const buildModal = (custom_id: string, title: string, fields: Record<string, string>[]) => {
    return {
        type: InteractionResponseType.Modal,
        data: {
            custom_id,
            title,
            components: [
                ...fields.map(field => {
                    return {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                custom_id: field.id,
                                label: field.label,
                                style: TextInputStyle.Paragraph,
                                required: true
                            }
                        ]
                    }
                })
            ]
        }
    } as APIInteractionResponse;
}