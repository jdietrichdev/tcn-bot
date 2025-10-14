import axios from "axios";
import { parse } from "csv-parse/sync";
import { APIChatInputApplicationCommandInteraction, APIGuildMember } from "discord-api-types/v10";
import { getServerMembers, updateResponse } from "../adapters/discord-adapter";
import { getClan } from "../adapters/coc-api-adapter";

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

    const guildMembers = await getServerMembers(interaction.guild_id!);
    const roster = [];
    let clanRoster: Record<string, any> = {};
    let clanData: Record<string, any>;

    for (const row of rosterData) {
        if (row["Tag"].startsWith("https://link.clashofclans.com/en/?action=OpenClanProfile&tag=")) {
            if (clanRoster) {
                roster.push(clanRoster);
            }
            const tag = row["Tag"].split("=")[2];
            clanData = await getClan(tag);
            clanRoster = {
                tag,
                name: clanData.name,
                members: []
            }
        } else if (row["Tag"].startsWith("#")) {
            const userId = guildMembers.find(
                (member: APIGuildMember) =>
                    member.user.username === row["Discord"]
                )?.user.id ?? row["Discord"];
            clanRoster.members.push({
                playerTag: row["Tag"],
                playerName: row["Account"],
                userId: userId,
            });
        }
    }

    console.log(JSON.stringify(roster));
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Roster has been announced",
    });
  } catch (err) {
    console.error(err);
  }
};
