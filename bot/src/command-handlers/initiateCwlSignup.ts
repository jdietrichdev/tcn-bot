import { APIApplicationCommandInteractionDataStringOption, APIChatInputApplicationCommandInteraction, ComponentType } from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { updateResponse } from "../adapters/discord-adapter";
import { BUTTONS } from "../component-handlers/buttons";

export const handleInitiateCwlSignup = async (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        const signupName = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
            interaction,
            'name'
        ).value;

        await updateResponse(interaction.application_id, interaction.token, {
            embeds: [{
                title: signupName,
                fields: [],
                footer: {
                    text: 'Total accounts: 0\nSignup is **open**'
                }
            }],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        BUTTONS.SIGNUP_CWL,
                        BUTTONS.CLOSE_CWL_SIGNUP,
                    ]
                }
            ],
        });
    } catch (err) {
        console.log(`Failed to initiate CWL signup: ${err}`);
        throw err;
    }
}