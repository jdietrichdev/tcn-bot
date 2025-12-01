import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  APIApplicationCommandInteractionDataStringOption,
} from "discord-api-types/v10";
import axios from "axios";
import { updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";

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

    const legendStatsUrl = `${CLASHKING_BASE_URL}/legends/clan/${clanTag}/${date}`;

    console.log(`Fetching legend stats from ${legendStatsUrl}`);

    const response = await axios.get(legendStatsUrl, {
      timeout: 10000,
    });

    let legendData = response.data;

    console.log(`Legend data response:`, JSON.stringify(legendData, null, 2));

    if (!legendData || !Array.isArray(legendData)) {
      console.log(`Response is not an array. Type: ${typeof legendData}, Keys: ${Object.keys(legendData || {})}`);
      
      let dataArray = legendData;
      if (legendData && typeof legendData === 'object' && legendData.members) {
        dataArray = legendData.members;
      } else if (legendData && typeof legendData === 'object' && legendData.data) {
        dataArray = legendData.data;
      } else if (legendData && typeof legendData === 'object' && legendData.items) {
        dataArray = legendData.items;
      }

      if (!Array.isArray(dataArray)) {
        await updateResponse(interaction.application_id, interaction.token, {
          content: `No legend stats found for clan #${clanTag} on ${formattedDate}`,
          flags: 64,
        });
        return;
      }
      legendData = dataArray;
    }

    const sortedMembers = legendData.sort(
      (a: any, b: any) => (b.legends_trophies || 0) - (a.legends_trophies || 0)
    );

    const membersList = sortedMembers
      .map(
        (member: any, index: number) =>
          `${index + 1}. ${member.name} - ${member.legends_trophies || 0} 🏆`
      )
      .join("\n");

    const embed: APIEmbed = {
      title: `Clan Trophy Snapshot - ${formattedDate}`,
      description: `Clan #${clanTag} - Clan members sorted by legend trophies`,
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
