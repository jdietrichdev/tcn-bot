import { APIMessageComponentInteraction, APIEmbed, ComponentType, ButtonStyle, InteractionResponseType } from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { updateMessage } from '../adapters/discord-adapter';
import { WAR_LEAGUE } from '../constants/emojis/coc/cwlLeague';

interface RosterShowCacheData {
  rosterName: string;
  clanRank: string;
  sortedPlayers: Array<{ playerName: string }>;
  playerDetailsMap: Array<[string, any]>;
  cwlLeagueMap: Array<[string, string]>;
  hitRateMap: Array<[string, string]>;
  channelId: string;
  messageId: string;
}

export const storeCacheInDynamoDB = async (interactionId: string, data: RosterShowCacheData) => {
  const ttl = Math.floor(Date.now() / 1000) + 900;
  
  await dynamoDbClient.send(
    new PutCommand({
      TableName: 'BotTable',
      Item: {
        pk: 'roster-show-cache',
        sk: interactionId,
        data,
        ttl
      }
    })
  );
  
  console.log(`Stored roster show cache for interaction ${interactionId}`);
};

export const getCacheFromDynamoDB = async (interactionId: string): Promise<RosterShowCacheData | null> => {
  const result = await dynamoDbClient.send(
    new GetCommand({
      TableName: 'BotTable',
      Key: {
        pk: 'roster-show-cache',
        sk: interactionId
      }
    })
  );
  
  if (!result.Item) {
    console.log(`No cache found for interaction ${interactionId}`);
    return null;
  }
  
  return result.Item.data as RosterShowCacheData;
};

export const handleRosterShowPagination = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  const [, , action, interactionId] = customId.split('_');
  
  console.log(`Roster show pagination: ${action} for interaction ${interactionId}`);
  
  const cacheData = await getCacheFromDynamoDB(interactionId);
  
  if (!cacheData) {
    return {
      type: InteractionResponseType.UpdateMessage,
      data: {
        content: '⚠️ This pagination has expired. Please run `/roster-show` again.',
        embeds: [],
        components: []
      }
    };
  }
  
  const playersPerPage = 6;
  const { sortedPlayers, playerDetailsMap, cwlLeagueMap, hitRateMap, rosterName, clanRank } = cacheData;
  
  const detailsMap = new Map(playerDetailsMap);
  const leagueMap = new Map(cwlLeagueMap);
  const rateMap = new Map(hitRateMap);
  
  const pages: any[][] = [];
  for (let i = 0; i < sortedPlayers.length; i += playersPerPage) {
    pages.push(sortedPlayers.slice(i, i + playersPerPage));
  }
  
  const currentFooter = interaction.message.embeds[0]?.footer?.text || '';
  const pageMatch = currentFooter.match(/Page (\d+)\/(\d+)/);
  let currentPage = pageMatch ? parseInt(pageMatch[1]) - 1 : 0;
  
  switch (action) {
    case 'first':
      currentPage = 0;
      break;
    case 'prev':
      currentPage = Math.max(0, currentPage - 1);
      break;
    case 'next':
      currentPage = Math.min(pages.length - 1, currentPage + 1);
      break;
    case 'last':
      currentPage = pages.length - 1;
      break;
  }
  
  const formatPlayer = (p: { playerName: string }, index: number) => {
    const playerName = p.playerName.replace(/_/g, "\\_");
    const details = detailsMap.get(p.playerName.toLowerCase().trim());
    const cwlLeague = leagueMap.get(p.playerName.toLowerCase().trim()) || 'Unknown';
    const leagueEmoji = cwlLeague !== 'Unknown' && cwlLeague in WAR_LEAGUE ? WAR_LEAGUE[cwlLeague as keyof typeof WAR_LEAGUE] : '🏆';
    const hitRate = rateMap.get(p.playerName.toLowerCase().trim()) || '—';
    
    if (details) {
      const discord = details.discord ? `@${details.discord.replace(/_/g, "\\_")}` : '*Not Set*';
      
      const cwlStars = details.totalCwlStars || '—';
      const stars = details.avgStars || '—';
      const attacks = details.totalAttacks || '—';
      const defStars = details.defenseAvgStars || '—';
      const destruction = details.destruction || '—';
      const missed = details.missed || '—';
      const townHall = details.townHall || '—';
      const heroes = details.combinedHeroes || '—';
      
      return [
        `### ${index + 1}. ${playerName}`,
        `> **Discord:** ${discord}`,
        `> **CWL:** ${leagueEmoji} \`${cwlLeague}\``,
        `> **CWL Attack:** ⚔️ \`${attacks}\` attacks  •  ⭐ \`${cwlStars}\` stars  •  ⭐ \`${stars}\` avg  •  💥 \`${destruction}%\` dest`,
        `> **CWL Defense:** 🛡️ \`${defStars}\` avg`,
        `> **War Attack:** 🎯 \`${hitRate}\` 3★`,
        `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
      ].join('\n');
    }
    
    return [
      `### ${index + 1}. ${playerName}`,
      `> **Discord:** *Unknown*`,
      `> **CWL:** ${leagueEmoji} \`${cwlLeague}\``,
      `> **War Attack:** � \`${hitRate}\` 3★`,
      `> *No stats available from signup sheet*`
    ].join('\n');
  };
  
  const startIndex = currentPage * playersPerPage;
  const playerList = pages[currentPage]
    ? pages[currentPage].map((p: { playerName: string }, i: number) => formatPlayer(p, startIndex + i)).join("\n\n")
    : "*No players yet*";
  
  const embed: APIEmbed = {
    title: `🏆 ${rosterName}`,
    description: `> **Rank ${clanRank}**  •  **${sortedPlayers?.length || 0} Players**\n\n${playerList}`,
    color: 0x5865F2,
    footer: {
      text: pages.length > 1 
        ? `Page ${currentPage + 1}/${pages.length} • ${sortedPlayers?.length || 0} player${sortedPlayers?.length !== 1 ? 's' : ''} in roster`
        : `${sortedPlayers?.length || 0} player${sortedPlayers?.length !== 1 ? 's' : ''} in roster`
    },
    timestamp: new Date().toISOString()
  };
  
  const components = pages.length > 1 ? [{
    type: ComponentType.ActionRow as ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `roster_show_first_${interactionId}`,
        emoji: { name: '⏮️' },
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        disabled: currentPage === 0
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `roster_show_prev_${interactionId}`,
        emoji: { name: '◀️' },
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        disabled: currentPage === 0
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `roster_show_page_${interactionId}`,
        label: `${currentPage + 1}/${pages.length}`,
        style: ButtonStyle.Primary as ButtonStyle.Primary,
        disabled: true
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `roster_show_next_${interactionId}`,
        emoji: { name: '▶️' },
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        disabled: currentPage === pages.length - 1
      },
      {
        type: ComponentType.Button as ComponentType.Button,
        custom_id: `roster_show_last_${interactionId}`,
        emoji: { name: '⏭️' },
        style: ButtonStyle.Secondary as ButtonStyle.Secondary,
        disabled: currentPage === pages.length - 1
      }
    ]
  }] : [];
  
  return {
    type: InteractionResponseType.UpdateMessage,
    data: {
      embeds: [embed],
      components
    }
  };
};
