import { APIMessageComponentInteraction, ComponentType, ButtonStyle, APIEmbed } from 'discord-api-types/v10';
import { updateResponse } from '../adapters/discord-adapter';

// This will be populated by the unrostered command
// Key: interaction.id, Value: player data
export const unrosteredDataCache = new Map<string, any[]>();

export const handleUnrosteredPagination = async (
  interaction: APIMessageComponentInteraction,
  customId: string
) => {
  const parts = customId.split('_');
  const action = parts[1]; // first, prev, next, last
  const originalInteractionId = parts[2];

  const data = unrosteredDataCache.get(originalInteractionId);
  if (!data) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: 'This pagination has expired. Please run the command again.',
      embeds: [],
      components: []
    });
    return;
  }

  // Get current page from the message
  const currentMessage = interaction.message;
  const currentPageMatch = currentMessage.embeds?.[0]?.footer?.text?.match(/Page (\d+) of (\d+)/);
  if (!currentPageMatch) {
    return;
  }

  const currentPage = parseInt(currentPageMatch[1]) - 1;
  const totalPages = parseInt(currentPageMatch[2]);

  let newPage = currentPage;
  switch (action) {
    case 'first':
      newPage = 0;
      break;
    case 'prev':
      newPage = Math.max(0, currentPage - 1);
      break;
    case 'next':
      newPage = Math.min(totalPages - 1, currentPage + 1);
      break;
    case 'last':
      newPage = totalPages - 1;
      break;
  }

  const playersPerPage = 10;
  const pages: any[][] = [];
  for (let i = 0; i < data.length; i += playersPerPage) {
    pages.push(data.slice(i, i + playersPerPage));
  }

  const formatPlayer = (p: any) => {
    const name = p.name.replace(/_/g, "\\_");
    const discord = p.discord ? p.discord.replace(/_/g, "\\_") : 'N/A';
    const stars = p.avgStars || 'N/A';
    const defStars = p.defenseAvgStars || 'N/A';
    const heroes = p.combinedHeroes || 'N/A';
    const destruction = p.destruction || 'N/A';
    const missed = p.missed || 'N/A';
    const league = p.cwlLeague || 'Unknown';
    return `**${name}**\n👤 Discord: \`${discord}\`\n⭐ Avg: \`${stars}\` • 🛡️ Def: \`${defStars}\` • 🦸 Heroes: \`${heroes}\`\n💥 Destruction: \`${destruction}\` • ❌ Missed: \`${missed}\`\n🏆 CWL League: \`${league}\``;
  };

  const createEmbed = (pageIndex: number): APIEmbed => {
    const page = pages[pageIndex];
    const totalPlayers = data.length;
    const allPlayers = (currentMessage.embeds?.[0]?.footer?.text?.match(/of (\d+) total/) || [])[1];
    
    return {
      title: `📋 Unrostered Players`,
      description: page.map(formatPlayer).join('\n\n'),
      color: 0x3498db,
      footer: {
        text: `Page ${pageIndex + 1} of ${pages.length} • ${totalPlayers} unrostered of ${allPlayers} total players`
      }
    };
  };

  const createComponents = (currentPage: number) => {
    if (pages.length === 1) return [];
    
    return [
      {
        type: ComponentType.ActionRow as ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `unrostered_first_${originalInteractionId}`,
            label: '⏮️',
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `unrostered_prev_${originalInteractionId}`,
            label: '◀️',
            style: ButtonStyle.Primary as ButtonStyle.Primary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `unrostered_page_${originalInteractionId}`,
            label: `${currentPage + 1}/${pages.length}`,
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: true
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `unrostered_next_${originalInteractionId}`,
            label: '▶️',
            style: ButtonStyle.Primary as ButtonStyle.Primary,
            disabled: currentPage === pages.length - 1
          },
          {
            type: ComponentType.Button as ComponentType.Button,
            custom_id: `unrostered_last_${originalInteractionId}`,
            label: '⏭️',
            style: ButtonStyle.Secondary as ButtonStyle.Secondary,
            disabled: currentPage === pages.length - 1
          }
        ]
      }
    ];
  };

  await updateResponse(interaction.application_id, interaction.token, {
    embeds: [createEmbed(newPage)],
    components: createComponents(newPage)
  });
};
