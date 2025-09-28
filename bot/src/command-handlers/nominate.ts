import { APIApplicationCommandInteractionDataStringOption, APIApplicationCommandInteractionDataUserOption, APIChatInputApplicationCommandInteraction, APIEmbed } from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import { updateResponse } from "../adapters/discord-adapter";
// import { getConfig } from "../util/serverConfig";

export const handleNominate = async (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        // const config = getConfig(interaction.guild_id!);
        const user = getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(interaction, "user").value;
        const type = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "type").value;
        const rank = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(interaction, "rank").value;

        const embed = createNominationEmbed(interaction, user, type, rank);
        await updateResponse(interaction.application_id, interaction.token, {
            embeds: [embed]
        })
    } catch (err) {
        console.log("Failure handling nominate command", err);
        throw err;
    }
}

const createNominationEmbed = (interaction: APIChatInputApplicationCommandInteraction, user: string, type: string, rank: string) => {
    return {
        title: `${rank} ${type} for <@${user}>`,
        description: `${interaction.user!.username}: Yes`
    } as APIEmbed
}