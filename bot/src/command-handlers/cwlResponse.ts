import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption, APIEmbed } from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { fetchCWLResponses } from "../util/fetchCWLResponses";

export const handleCwlResponseCommand = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const userOption = interaction.data.options?.find(
    (opt) => opt.name === "user"
  ) as APIApplicationCommandInteractionDataStringOption;
  
  const username = userOption?.value;

  if (!username) {
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ Please provide a username.",
    });
  }

  try {
    const cwlResponses = await fetchCWLResponses();
    
    const response = cwlResponses.find(
      r => r.username.toLowerCase() === username.toLowerCase()
    );

    if (!response) {
      return updateResponse(interaction.application_id, interaction.token, {
        content: `❌ No CWL response found for user \`${username}\`.`,
      });
    }

    const embed: APIEmbed = {
      title: `CWL Response - ${response.username}`,
      color: 0x3498db,
      fields: [
        {
          name: "League Preference",
          value: response.league || "Not specified",
          inline: false
        },
        {
          name: "Availability",
          value: response.availability || "Not specified",
          inline: true
        },
        {
          name: "Competitiveness",
          value: response.competitiveness || "Not specified",
          inline: true
        },
        {
          name: "Other Notes",
          value: response.otherNotes || "None",
          inline: false
        }
      ],
      footer: {
        text: `Discord ID: ${response.discordId}`
      }
    };

    return updateResponse(interaction.application_id, interaction.token, {
      embeds: [embed]
    });
  } catch (error) {
    console.error("Error fetching CWL response:", error);
    return updateResponse(interaction.application_id, interaction.token, {
      content: "❌ An error occurred while fetching CWL responses.",
    });
  }
};
