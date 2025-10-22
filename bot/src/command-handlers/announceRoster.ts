import axios from "axios";
import { parse } from "csv-parse/sync";
import { APIChatInputApplicationCommandInteraction, APIGuildMember, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { getServerMembers, sendMessage, updateMessage, updateResponse } from "../adapters/discord-adapter";
import { getClan } from "../adapters/coc-api-adapter";
import { getConfig } from "../util/serverConfig";

const DEFAULT_ROSTER_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRckzbRnsega-kND3dWkpaeMe78An7gD6Z3YM-vkaxTyXf1KMXDIgNB917_sJ5zyhNT7LKwK6fWstnJ/pub?gid=1984635118&single=true&output=csv";

export const handleAnnounceRoster = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const rosterUrl = process.env.ROSTER_URL || config.ROSTER_URL || DEFAULT_ROSTER_URL;
    const response = await axios.get(rosterUrl);
    const rosterData = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    });

    if (!Array.isArray(rosterData) || rosterData.length === 0) {
      console.error("Roster CSV parsed to empty data", { url: rosterUrl });
      throw new Error("Parsed roster CSV was empty");
    }
    console.log("Roster CSV headers:", Object.keys(rosterData[0]));

    const guildMembers = await getServerMembers(interaction.guild_id!);
    const roster = [];
    let clanRoster: Record<string, any> = { members: []};
    let clanData: Record<string, any>;

  for (const rawRow of rosterData) {
    try {
      const row: Record<string, any> = {};
      for (const k of Object.keys(rawRow)) {
        const v = rawRow[k];
        if (typeof v === 'string') row[k.trim()] = v.trim();
        else row[k.trim()] = v;
      }

      const tagField = row["Tag"] || row["tag"];
      if (!tagField) {
        console.warn("Skipping row without Tag", rawRow);
        continue;
      }

      const tag = String(tagField).replace(/"/g, "").trim();

      if (String(tag).startsWith("https://link.clashofclans.com/en/?action=OpenClanProfile&tag=")) {
        if (clanRoster.members.length !== 0) {
          roster.push(clanRoster);
        }
        let clanTagRaw: string | null = null;
        try {
          const urlStr = String(tag);
          const parsed = new URL(urlStr);
          clanTagRaw = parsed.searchParams.get('tag');
        } catch (urlErr) {
          const parts = String(tag).split("=");
          clanTagRaw = parts[2] || parts[parts.length - 1];
        }
        if (!clanTagRaw) clanTagRaw = String(tag);
        let clanTag = decodeURIComponent(String(clanTagRaw)).replace(/"/g, "").trim();
        if (!clanTag.startsWith('#')) clanTag = `#${clanTag}`;
        try {
          clanData = await getClan(clanTag);
        } catch (err) {
          console.error("Failed to fetch clan data, using tag only", { clanTag, err });
          clanData = { name: clanTag };
        }
        clanRoster = {
          tag: clanTag,
          name: clanData?.name || clanTag,
          members: []
        };
      } else if (String(tag).startsWith("#")) {
        const discordValue = (row["Discord"] || row["discord"] || "").toString().trim();
        const normalized = discordValue.toLowerCase();
        const member = guildMembers.find((member: APIGuildMember) => {
          const uname = (member.user.username || "").toLowerCase().trim();
          return uname === normalized || uname.startsWith(normalized) || normalized === member.user.id;
        });

        const userId = member?.user.id ?? discordValue;
        const playerTag = String(tag).startsWith('#') ? String(tag) : `#${String(tag)}`;
        clanRoster.members.push({
          playerTag,
          playerName: row["Account"] || row["account"] || "",
          userId: userId,
        });
      } else {
        console.warn("Unrecognized tag format, skipping row", { tag });
        continue;
      }
    } catch (rowErr) {
      console.error("Failed processing roster row, skipping", { row: rawRow, err: rowErr });
      continue;
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
