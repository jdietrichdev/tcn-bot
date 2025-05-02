import { APIChatInputApplicationCommandInteraction, APIInteractionResponse, InteractionResponseType } from "discord-api-types/payloads/v10";

export const handleApply = async (interaction: APIChatInputApplicationCommandInteraction) => {
    return {
        type: InteractionResponseType.Modal,
        data: {
            custom_id: 'applicationModal',
            title: 'Apply for This Clan Now',
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 4,
                            custom_id: 'tags',
                            label: 'Player tag(s)',
                            style: 1,
                            required: true
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 4,
                            custom_id: 'source',
                            label: 'How did you find us?',
                            style: 2,
                            required: true
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 4,
                            custom_id: 'leaveClan',
                            label: 'Why did you leave your last clan?',
                            style: 2,
                            required: true
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 4,
                            custom_id: 'clanWants',
                            label: 'What do you want in a clan?',
                            style: 2,
                            required: true
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 4,
                            custom_id: 'strategies',
                            label: 'Favorite strategies?',
                            style: 2,
                            required: true
                        }
                    ]
                },
            ]
        }
    } as APIInteractionResponse
}