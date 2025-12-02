import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  APIApplicationCommandInteractionDataStringOption,
} from "discord-api-types/v10";
import axios from "axios";
import { updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { clashkingLimited } from "../util/rateLimiter";

const CLASHKING_BASE_URL = "https://api.clashk.ing";

const formatDateForAPI = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const fetchPlayerLegendTrophies = clashkingLimited(async (playerTag: string, date: string): Promise<number> => {
  try {
    const url = `${CLASHKING_BASE_URL}/legends/player/${playerTag}/${date}`;
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    console.log(`Fetched trophies for ${playerTag}: ${JSON.stringify(data)}`);
    
    if (Array.isArray(data) && data.length > 0) {
      return data[0].trophies || 0;
    } else if (data && data.trophies) {
      return data.trophies;
    }
    return 0;
  } catch (err) {
    console.error(`Failed to fetch legend trophies for ${playerTag}:`, err);
    return 0;
  }
});

const getClanMembersAtDate = async (clanTag: string, timestamp: number): Promise<Set<string>> => {
  try {
    const url = `${CLASHKING_BASE_URL}/clan/${clanTag}/historical`;
    const response = await axios.get(url, {
      params: {
        timestamp_start: timestamp - 3600,
        timestamp_end: timestamp + 3600,  
        limit: 1000,
      },
      timeout: 30000,
    });
    
    const events = Array.isArray(response.data) ? response.data : [];
    console.log(`Found ${events.length} historical events for clan`);
    
    const memberTags = new Set<string>();
    events.forEach((event: any) => {
      if (event.player_tag) {
        memberTags.add(event.player_tag);
      }
    });
    
    console.log(`Extracted ${memberTags.size} unique player tags from historical data`);
    return memberTags;
  } catch (err) {
    console.error(`Failed to fetch historical data for clan ${clanTag}:`, err);
    return new Set();
  }
};

const getClanLegendSnapshot = clashkingLimited(async (clanTag: string, date: string): Promise<Array<{ name: string; tag: string; trophies: number }>> => {
  try {
    const url = `${CLASHKING_BASE_URL}/legends/clan/${clanTag}/${date}`;
    console.log(`Fetching clan legend snapshot from ${url}`);
    
    const response = await axios.get(url, { timeout: 10000 });
    const clanData = response.data;
    
    console.log(`Clan snapshot response: ${JSON.stringify(clanData)}`);
    
    let memberList = clanData.memberList || clanData.members || [];
    
    if (!Array.isArray(memberList) || memberList.length === 0) {
      console.log(`No members found in clan snapshot`);
      return [];
    }

    console.log(`Found ${memberList.length} members in clan, fetching their trophy counts...`);
    
    // Fetch trophy data for each member
    const membersWithTrophies = await Promise.all(
      memberList.map(async (member: any) => {
        const trophies = await fetchPlayerLegendTrophies(member.tag, date);
        return { 
          name: member.name,
          tag: member.tag,
          trophies
        };
      })
    );
    
    return membersWithTrophies;
  } catch (err) {
    console.error(`Failed to fetch clan legend snapshot for ${clanTag}:`, err);
    return [];
  }
});

export const handleClanSnapshot = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const clanTag = "90PJR8RQ";
    const dateInput =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "date"
      )?.value || "2025-12-01";

    let date: string;
    try {
      date = formatDateForAPI(dateInput);
    } catch (err) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-12-01)`,
        flags: 64,
      });
      return;
    }

    const dateObj = new Date(dateInput);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Get clan snapshot with member list and their names
    const membersWithTrophies = await getClanLegendSnapshot(clanTag, date);

    if (membersWithTrophies.length === 0) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `No clan data found for clan #${clanTag} on ${formattedDate}`,
        flags: 64,
      });
      return;
    }

    const sortedMembers = membersWithTrophies.sort(
      (a: any, b: any) => b.trophies - a.trophies
    );

    const membersList = sortedMembers
      .map(
        (member: any, index: number) =>
          `${index + 1}. ${member.name} - ${member.trophies} 🏆`
      )
      .join("\n");

    const embed: APIEmbed = {
      title: `Clan Trophy Snapshot - ${formattedDate}`,
      description: `Clan #${clanTag} - Members sorted by legend trophies`,
      fields: [
        {
          name: "Members",
          value: membersList || "No data available",
          inline: false,
        },
      ],
      footer: {
        text: `Total Members: ${sortedMembers.length}`,
      },
      color: 0x2f3136,
    };

    await updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed],
    });
  } catch (err) {
    console.error(`Error fetching clan snapshot: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "There was an error fetching the clan snapshot. The data may not be available for that date.",
      flags: 64,
    });
  }
};
