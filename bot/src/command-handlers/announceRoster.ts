import axios from "axios";
import { parse } from "csv-parse/sync";
import { APIChatInputApplicationCommandInteraction, APIGuildMember, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { getServerMembers, sendMessage, updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getClan } from "../adapters/coc-api-adapter";
import { getConfig } from "../util/serverConfig";

const ROSTER_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRckzbRnsega-kND3dWkpaeMe78An7gD6Z3YM-vkaxTyXf1KMXDIgNB917_sJ5zyhNT7LKwK6fWstnJ/pub?gid=914552917&single=true&output=csv";

export const handleAnnounceRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const response = await axios.get(ROSTER_URL);
    const rosterData = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    });

    const guildMembers = await getServerMembers(interaction.guild_id!);
    const roster = [];
    let clanRoster: Record<string, any> = { members: []};
    let clanData: Record<string, any>;

    for (const row of rosterData) {
        if (row["Tag"].startsWith("https://link.clashofclans.com/en/?action=OpenClanProfile&tag=")) {
            if (clanRoster.members.length !== 0) {
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
    roster.push(clanRoster);

    const messages = buildRosterAnnouncement(roster);
    await sendMessage({ content: `<@&${config.CLAN_ROLE}> below is the roster for the coming week, please get to where you need to be!` }, config.ANNOUNCEMENT_CHANNEL);
    for (const message of messages) {
        const { id } = await sendMessage({ content: message.content!.split("\n")[0]}, config.ANNOUNCEMENT_CHANNEL);
        await updateMessage(config.ANNOUNCEMENT_CHANNEL, id, message);
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(JSON.stringify(roster));
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Roster has been announced",
    });
  } catch (err) {
    console.error(`Failed to send roster announcement: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure processing roster announcement, please try again",
    });
  }
};

const buildRosterAnnouncement = (roster: Record<string, any>[]) => {
    const messages: RESTPostAPIWebhookWithTokenJSONBody[] = [];
    for (const clan of roster) {
        let message = `# [${clan.name}](<https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${clan.tag}>)\n`;
        for (const member of clan.members) {
            message += `<@${member.userId}> | ${member.playerName}\n`
        }
        messages.push({ content: message.replace(/_/g, "\\_")});
    }
    return messages;
}
