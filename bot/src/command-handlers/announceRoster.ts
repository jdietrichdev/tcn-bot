import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";

const ROSTER_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRckzbRnsega-kND3dWkpaeMe78An7gD6Z3YM-vkaxTyXf1KMXDIgNB917_sJ5zyhNT7LKwK6fWstnJ/pub?gid=914552917&single=true&output=csv";

export const handleAnnounceRoster = (interaction: APIChatInputApplicationCommandInteraction) => {
    try {
        console.log(interaction);
        console.log(ROSTER_URL);
    } catch (err) {
        console.error(err);
    }
}