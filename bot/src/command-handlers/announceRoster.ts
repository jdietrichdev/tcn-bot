import axios from "axios";
import { parse } from "csv-parse/sync";
import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";

const ROSTER_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRckzbRnsega-kND3dWkpaeMe78An7gD6Z3YM-vkaxTyXf1KMXDIgNB917_sJ5zyhNT7LKwK6fWstnJ/pub?gid=914552917&single=true&output=csv";

export const handleAnnounceRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const response = await axios.get(ROSTER_URL);
    const rosterData = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(JSON.stringify(rosterData));
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Roster has been announced",
    });
  } catch (err) {
    console.error(err);
  }
};
