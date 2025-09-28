import { APIApplicationCommandInteractionDataStringOption, APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { updateResponse } from "../adapters/discord-adapter";

export const handleNominate = async (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        const type = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "type");
        const rank = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "rank");
        await updateResponse(interaction.application_id, interaction.token, {
            content: `Type: ${type}\nRank: ${rank}`
        })
    } catch (err) {
        console.log("Failure handling nominate command", err);
        throw err;
    }
}