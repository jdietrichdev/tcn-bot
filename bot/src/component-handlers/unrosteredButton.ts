import { APIMessageComponentInteraction, ComponentType, ButtonStyle, APIEmbed, InteractionResponseType } from 'discord-api-types/v10';
import { updateMessage } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { WAR_LEAGUE } from '../constants/emojis/coc/cwlLeague';

interface UnrosteredCacheData {
  players: any[];
  channelId: string;
  messageId: string;
  allPlayersCount: number;
}

export const unrosteredDataCache = new Map<string, UnrosteredCacheData>();

export const storeCacheInDynamoDB = async (interactionId: string, data: UnrosteredCacheData) => {
  const ttl = Math.floor(Date.now() / 1000) + (15 * 60);
  
  await dynamoDbClient.send(
    new PutCommand({
      TableName: 'BotTable',
      Item: {
        pk: 'unrostered-cache',
        sk: interactionId,
        data: data,
        ttl: ttl
      }
    })
  );
  console.log(`Stored cache in DynamoDB for interaction ID: ${interactionId}`);
};

export const getCacheFromDynamoDB = async (interactionId: string): Promise<UnrosteredCacheData | null> => {
  try {
    const result = await dynamoDbClient.send(
      new GetCommand({
        TableName: 'BotTable',
        Key: {
          pk: 'unrostered-cache',
          sk: interactionId
        }
      })
    );
    
    if (result.Item && result.Item.data) {
      console.log(`Retrieved cache from DynamoDB for interaction ID: ${interactionId}`);
      return result.Item.data as UnrosteredCacheData;
    }
    return null;
  } catch (error) {
    console.error(`Failed to retrieve cache from DynamoDB:`, error);
    return null;
  }
};

export const handleUnrosteredPagination = async (
  interaction: APIMessageComponentInteraction,
  customId: string
) => {
  const parts = customId.split('_');
  const action = parts[1];
  const originalInteractionId = parts[2];

  console.log(`Pagination click: action=${action}, originalInteractionId=${originalInteractionId}`);

  let data = await getCacheFromDynamoDB(originalInteractionId);
  
  if (!data) {
    console.error(`Cache miss for interaction ID: ${originalInteractionId}`);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: '⚠️ This pagination has expired. Please run `/unrostered` again.',
        flags: 64
      }
    };
  }
  
  console.log(`Cache hit! Data has ${data.players.length} players`);

  const currentMessage = interaction.message;
  const currentPageMatch = currentMessage.embeds?.[0]?.footer?.text?.match(/Page (\d+) of (\d+)/);
  if (!currentPageMatch) {
    return {
      type: InteractionResponseType.UpdateMessage,
      data: {}
    };
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

  const playersPerPage = 6;
  const pages: any[][] = [];
  for (let i = 0; i < data.players.length; i += playersPerPage) {
    pages.push(data.players.slice(i, i + playersPerPage));
  }

  const formatPlayer = (p: any, index: number) => {
    const name = p.name.replace(/_/g, "\\_");
    const discord = p.discord ? `@${p.discord.replace(/_/g, "\\_")}` : '*Not Set*';
    const responseIcon = p.cwlSignedUp ? '✅' : '❌';
    
    const hitRate = p.warHitRate || '—';
    const cwlStars = p.totalCwlStars || '—';
    const league = p.cwlLeague || 'Unknown';
    const leagueEmoji = league !== 'Unknown' && league in WAR_LEAGUE ? WAR_LEAGUE[league as keyof typeof WAR_LEAGUE] : '🏆';
    const stars = p.avgStars || '—';
    const attacks = p.totalAttacks || '—';
    const defStars = p.defenseAvgStars || '—';
    const destruction = p.destruction || '—';
    const missed = p.missed || '—';
    const townHall = p.townHall || '—';
    const heroes = p.combinedHeroes || '—';
    
    return [
      `### ${index + 1}. ${name} ${responseIcon}`,
      `> **Discord:** ${discord}`,
      `> **CWL:** ${leagueEmoji} \`${league}\``,
      `> **CWL Attack:** ⚔️ \`${attacks}\` attacks  •  ⭐ \`${cwlStars}\` stars  •  ⭐ \`${stars}\` avg  •  💥 \`${destruction}%\` dest`,
      `> **CWL Defense:** 🛡️ \`${defStars}\` avg`,
      `> **War Attack:** 🎯 \`${hitRate}\` 3★`,
      `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
    ].join('\n');
  };

  const createEmbed = (pageIndex: number): APIEmbed => {
    const page = pages[pageIndex];
    const totalPlayers = data.players.length;
    const allPlayers = data.allPlayersCount;
    const startIndex = pageIndex * playersPerPage;
    
    return {
      title: '📋 Unrostered Players',
      description: page.map((p, i) => formatPlayer(p, startIndex + i)).join('\n\n'),
      color: 0x5865F2,
      footer: {
        text: `Page ${pageIndex + 1} of ${pages.length}  •  ${totalPlayers} unrostered / ${allPlayers} total players`,
        icon_url: 'https://cdn.discordapp.com/emojis/1234567890.png'
      },
      timestamp: new Date().toISOString()
    };
  };

  const createComponents = (currentPage: number) => {
    if (pages.length === 1) return [];
    
    return [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            custom_id: `unrostered_first_${originalInteractionId}`,
            emoji: { name: '⏮️' },
            style: ButtonStyle.Secondary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button,
            custom_id: `unrostered_prev_${originalInteractionId}`,
            emoji: { name: '◀️' },
            style: ButtonStyle.Primary,
            disabled: currentPage === 0
          },
          {
            type: ComponentType.Button,
            custom_id: `unrostered_page_${originalInteractionId}`,
            label: `${currentPage + 1} / ${pages.length}`,
            style: ButtonStyle.Secondary,
            disabled: true
          },
          {
            type: ComponentType.Button,
            custom_id: `unrostered_next_${originalInteractionId}`,
            emoji: { name: '▶️' },
            style: ButtonStyle.Primary,
            disabled: currentPage === pages.length - 1
          },
          {
            type: ComponentType.Button,
            custom_id: `unrostered_last_${originalInteractionId}`,
            emoji: { name: '⏭️' },
            style: ButtonStyle.Secondary,
            disabled: currentPage === pages.length - 1
          }
        ]
      }
    ];
  };

  return {
    type: InteractionResponseType.UpdateMessage,
    data: {
      embeds: [createEmbed(newPage)],
      components: createComponents(newPage)
    }
  };
};

export const refreshUnrosteredMessages = async (updatedPlayers: any[], allPlayersCount: number) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`Refreshing unrostered messages.`);
  
  const playersPerPage = 6;
  
  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
  const cacheResult = await dynamoDbClient.send(
    new QueryCommand({
      TableName: 'BotTable',
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': 'unrostered-cache'
      }
    })
  );
  
  if (!cacheResult.Items || cacheResult.Items.length === 0) {
    console.log('No cache entries found in DynamoDB');
    return;
  }
  
  console.log(`Found ${cacheResult.Items.length} cache entries to refresh`);
  
  for (const item of cacheResult.Items) {
    const interactionId = item.sk;
    const cacheData = item.data as UnrosteredCacheData;
    
    try {
      console.log(`Processing cache entry: interaction=${interactionId}, messageId=${cacheData.messageId}, channelId=${cacheData.channelId}`);
      
      if (!cacheData.messageId) {
        console.log(`Skipping cache entry ${interactionId} - no messageId yet`);
        continue;
      }
      
      cacheData.players = updatedPlayers;
      cacheData.allPlayersCount = allPlayersCount;
      
      const pages: any[][] = [];
      for (let i = 0; i < updatedPlayers.length; i += playersPerPage) {
        pages.push(updatedPlayers.slice(i, i + playersPerPage));
      }
      
      if (pages.length === 0) {
        await updateMessage(cacheData.channelId, cacheData.messageId, {
          embeds: [{
            title: '📋 Unrostered Players',
            description: '*All players have been rostered!* ✅',
            color: 0x57F287, // Green
            timestamp: new Date().toISOString()
          }],
          components: []
        });
        continue;
      }
      
      const formatPlayer = (p: any, index: number) => {
        const name = p.name.replace(/_/g, "\\_");
        const discord = p.discord ? `@${p.discord.replace(/_/g, "\\_")}` : '*Not Set*';
        const responseIcon = p.cwlSignedUp ? '✅' : '❌';
        
        const hitRate = p.warHitRate || '—';
        const cwlStars = p.totalCwlStars || '—';
        const league = p.cwlLeague || 'Unknown';
        const leagueEmoji = league !== 'Unknown' && league in WAR_LEAGUE ? WAR_LEAGUE[league as keyof typeof WAR_LEAGUE] : '🏆';
        const stars = p.avgStars || '—';
        const attacks = p.totalAttacks || '—';
        const defStars = p.defenseAvgStars || '—';
        const destruction = p.destruction || '—';
        const missed = p.missed || '—';
        const townHall = p.townHall || '—';
        const heroes = p.combinedHeroes || '—';
        
        return [
          `### ${index + 1}. ${name} ${responseIcon}`,
          `> **Discord:** ${discord}`,
          `> **CWL:** ${leagueEmoji} \`${league}\``,
          `> **CWL Attack:** ⚔️ \`${attacks}\` attacks  •  ⭐ \`${cwlStars}\` stars  •  ⭐ \`${stars}\` avg  •  💥 \`${destruction}%\` dest`,
          `> **CWL Defense:** 🛡️ \`${defStars}\` avg`,
          `> **War Attack:** 🎯 \`${hitRate}\` 3★`,
          `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
        ].join('\n');
      };
      
      const createComponents = (currentPage: number) => {
        if (pages.length === 1) return [];
        
        return [
          {
            type: ComponentType.ActionRow as ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_first_${interactionId}`,
                emoji: { name: '⏮️' },
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: currentPage === 0
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_prev_${interactionId}`,
                emoji: { name: '◀️' },
                style: ButtonStyle.Primary as ButtonStyle.Primary,
                disabled: currentPage === 0
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_page_${interactionId}`,
                label: `${currentPage + 1} / ${pages.length}`,
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: true
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_next_${interactionId}`,
                emoji: { name: '▶️' },
                style: ButtonStyle.Primary as ButtonStyle.Primary,
                disabled: currentPage === pages.length - 1
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_last_${interactionId}`,
                emoji: { name: '⏭️' },
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: currentPage === pages.length - 1
              }
            ]
          }
        ];
      };
      
      const embed = {
        title: '📋 Unrostered Players',
        description: pages[0].map((p, i) => formatPlayer(p, i)).join('\n\n'),
        color: 0x5865F2,
        footer: {
          text: `Page 1 of ${pages.length}  •  ${updatedPlayers.length} unrostered / ${allPlayersCount} total players`
        },
        timestamp: new Date().toISOString()
      };
      
      await updateMessage(cacheData.channelId, cacheData.messageId, {
        embeds: [embed],
        components: createComponents(0)
      });
      
      cacheData.players = updatedPlayers;
      cacheData.allPlayersCount = allPlayersCount;
      await storeCacheInDynamoDB(interactionId, cacheData);
      
      console.log(`Updated unrostered message in channel ${cacheData.channelId}`);
    } catch (error) {
      console.error(`Failed to refresh unrostered message for interaction ${interactionId}:`, error);
    }
  }
};

export const refreshUnrosteredMessagesQuick = async (playerNameToRemove: string) => {
  console.log(`Quick refresh: removing player "${playerNameToRemove}"`);
  
  const playersPerPage = 6;
  
  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
  const cacheResult = await dynamoDbClient.send(
    new QueryCommand({
      TableName: 'BotTable',
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': 'unrostered-cache'
      }
    })
  );
  
  if (!cacheResult.Items || cacheResult.Items.length === 0) {
    console.log('No cache entries found for quick refresh');
    return;
  }
  
  console.log(`Found ${cacheResult.Items.length} cache entries for quick refresh`);
  
  for (const item of cacheResult.Items) {
    const interactionId = item.sk;
    const cacheData = item.data as UnrosteredCacheData;
    
    try {
      if (!cacheData.messageId) {
        console.log(`Skipping cache entry ${interactionId} - no messageId`);
        continue;
      }
      
      let removed = false;
      const updatedPlayers = cacheData.players.filter((p) => {
        const nameMatch = p.name.trim().toLowerCase() === playerNameToRemove.trim().toLowerCase();
        if (nameMatch && !removed) {
          removed = true;
          return false;
        }
        return true;
      });
      
      if (updatedPlayers.length === cacheData.players.length) {
        console.log(`Player "${playerNameToRemove}" not found in cache entry ${interactionId}`);
        continue;
      }
      
      console.log(`Removed player from cache entry ${interactionId}: ${cacheData.players.length} -> ${updatedPlayers.length} players`);
      
      const pages: any[][] = [];
      for (let i = 0; i < updatedPlayers.length; i += playersPerPage) {
        pages.push(updatedPlayers.slice(i, i + playersPerPage));
      }
      
      if (pages.length === 0) {
        await updateMessage(cacheData.channelId, cacheData.messageId, {
          embeds: [{
            title: '📋 Unrostered Players',
            description: '*All players have been rostered!* ✅',
            color: 0x57F287,
            timestamp: new Date().toISOString()
          }],
          components: []
        });
        
        cacheData.players = [];
        await storeCacheInDynamoDB(interactionId, cacheData);
        continue;
      }
      
      const formatPlayer = (p: any, index: number) => {
        const name = p.name.replace(/_/g, "\\_");
        const discord = p.discord ? `@${p.discord.replace(/_/g, "\\_")}` : '*Not Set*';
        const responseIcon = p.cwlSignedUp ? '✅' : '❌';
        
        const hitRate = p.warHitRate || '—';
        const cwlStars = p.totalCwlStars || '—';
        const league = p.cwlLeague || 'Unknown';
        const leagueEmoji = league !== 'Unknown' && league in WAR_LEAGUE ? WAR_LEAGUE[league as keyof typeof WAR_LEAGUE] : '🏆';
        const stars = p.avgStars || '—';
        const attacks = p.totalAttacks || '—';
        const defStars = p.defenseAvgStars || '—';
        const destruction = p.destruction || '—';
        const missed = p.missed || '—';
        const townHall = p.townHall || '—';
        const heroes = p.combinedHeroes || '—';
        
        return [
          `### ${index + 1}. ${name} ${responseIcon}`,
          `> **Discord:** ${discord}`,
          `> **CWL:** ${leagueEmoji} \`${league}\``,
          `> **CWL Attack:** ⚔️ \`${attacks}\` attacks  •  ⭐ \`${cwlStars}\` stars  •  ⭐ \`${stars}\` avg  •  💥 \`${destruction}%\` dest`,
          `> **CWL Defense:** 🛡️ \`${defStars}\` avg`,
          `> **War Attack:** 🎯 \`${hitRate}\` 3★`,
          `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
        ].join('\n');
      };
      
      const createComponents = (currentPage: number) => {
        if (pages.length === 1) return [];
        
        return [
          {
            type: ComponentType.ActionRow as ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_first_${interactionId}`,
                emoji: { name: '⏮️' },
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: currentPage === 0
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_prev_${interactionId}`,
                emoji: { name: '◀️' },
                style: ButtonStyle.Primary as ButtonStyle.Primary,
                disabled: currentPage === 0
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_page_${interactionId}`,
                label: `${currentPage + 1} / ${pages.length}`,
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: true
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_next_${interactionId}`,
                emoji: { name: '▶️' },
                style: ButtonStyle.Primary as ButtonStyle.Primary,
                disabled: currentPage === pages.length - 1
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_last_${interactionId}`,
                emoji: { name: '⏭️' },
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: currentPage === pages.length - 1
              }
            ]
          }
        ];
      };
      
      const embed = {
        title: '📋 Unrostered Players',
        description: pages[0].map((p, i) => formatPlayer(p, i)).join('\n\n'),
        color: 0x5865F2,
        footer: {
          text: `Page 1 of ${pages.length}  •  ${updatedPlayers.length} unrostered / ${cacheData.allPlayersCount} total players`
        },
        timestamp: new Date().toISOString()
      };
      
      await updateMessage(cacheData.channelId, cacheData.messageId, {
        embeds: [embed],
        components: createComponents(0)
      });
      
      cacheData.players = updatedPlayers;
      await storeCacheInDynamoDB(interactionId, cacheData);
      
      console.log(`Quick refresh completed for message in channel ${cacheData.channelId}`);
    } catch (error) {
      console.error(`Failed to quick refresh message for interaction ${interactionId}:`, error);
    }
  }
};

export const refreshUnrosteredMessagesAddPlayer = async (playerName: string) => {
  console.log(`Quick refresh: adding player "${playerName}" back to unrostered lists`);
  
  const { fetchPlayersWithDetailsFromCSV } = await import('../util/fetchUnrosteredPlayersCSV');
  const { getPlayerCWLLeague, getPlayerWarHitRate } = await import('../adapters/clashking-adapter');
  const { fetchCWLResponses } = await import('../util/fetchCWLResponses');
  
  try {
    const allPlayers = await fetchPlayersWithDetailsFromCSV();
    const player = allPlayers.find(p => p.name.trim().toLowerCase() === playerName.trim().toLowerCase());
    
    if (!player) {
      console.log(`Player "${playerName}" not found in CSV`);
      return;
    }
    
    let cwlResponses: any[] = [];
    try {
      cwlResponses = await fetchCWLResponses();
    } catch (error) {
      console.error('Failed to fetch CWL responses:', error);
    }
    
    const cwlSignupMap = new Map(
      cwlResponses.map((r: any) => [r.username.toLowerCase(), true])
    );
    
    const cwlSignedUp = cwlSignupMap.has(player.discord.toLowerCase());
    let playerWithData: any = { ...player, cwlSignedUp };
    
    if (player.playerTag && player.playerTag.trim()) {
      try {
        const [cwlLeague, hitRateData] = await Promise.all([
          getPlayerCWLLeague(player.playerTag),
          getPlayerWarHitRate(player.playerTag)
        ]);
        
        const warHitRate = hitRateData 
          ? `${hitRateData.threeStars}/${hitRateData.totalAttacks} (${hitRateData.hitRate}%)`
          : 'N/A';
        
        playerWithData = {
          ...player,
          cwlLeague,
          cwlSignedUp,
          warHitRate,
        };
      } catch (error) {
        playerWithData = {
          ...player,
          cwlLeague: 'Unknown',
          cwlSignedUp,
          warHitRate: 'N/A',
        };
      }
    } else {
      playerWithData.cwlLeague = 'No Tag';
      playerWithData.warHitRate = 'N/A';
    }
    
    const playersPerPage = 6;
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const cacheResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: 'BotTable',
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': 'unrostered-cache'
        }
      })
    );
    
    if (!cacheResult.Items || cacheResult.Items.length === 0) {
      console.log('No cache entries found for quick add refresh');
      return;
    }
    
    console.log(`Found ${cacheResult.Items.length} cache entries for quick add refresh`);
    
    for (const item of cacheResult.Items) {
      const interactionId = item.sk;
      const cacheData = item.data as UnrosteredCacheData;
      
      try {
        if (!cacheData.messageId) {
          continue;
        }
        
        const updatedPlayers = [...cacheData.players, playerWithData];
        
        const sortedPlayers = updatedPlayers.sort((a, b) => {
          const leagueRank: Record<string, number> = {
            'Champion League I': 1, 'Champion League II': 2, 'Champion League III': 3,
            'Master League I': 4, 'Master League II': 5, 'Master League III': 6,
            'Crystal League I': 7, 'Crystal League II': 8, 'Crystal League III': 9,
            'Gold League I': 10, 'Gold League II': 11, 'Gold League III': 12,
            'Silver League I': 13, 'Silver League II': 14, 'Silver League III': 15,
            'Bronze League I': 16, 'Bronze League II': 17, 'Bronze League III': 18,
            'Unranked': 19, 'Unknown': 20, 'No Tag': 21
          };
          
          const aLeagueRank = leagueRank[a.cwlLeague || 'Unknown'] || 20;
          const bLeagueRank = leagueRank[b.cwlLeague || 'Unknown'] || 20;
          if (aLeagueRank !== bLeagueRank) return aLeagueRank - bLeagueRank;
          
          const aStars = parseFloat(a.avgStars) || 0;
          const bStars = parseFloat(b.avgStars) || 0;
          if (aStars !== bStars) return bStars - aStars;
          
          const aHitRate = a.warHitRate?.match(/\(([0-9.]+)%\)/)?.[1];
          const bHitRate = b.warHitRate?.match(/\(([0-9.]+)%\)/)?.[1];
          const aRate = parseFloat(aHitRate || '0') || 0;
          const bRate = parseFloat(bHitRate || '0') || 0;
          
          return bRate - aRate;
        });
        
        const pages: any[][] = [];
        for (let i = 0; i < sortedPlayers.length; i += playersPerPage) {
          pages.push(sortedPlayers.slice(i, i + playersPerPage));
        }
        
        const formatPlayer = (p: any, index: number) => {
          const name = p.name.replace(/_/g, "\\_");
          const discord = p.discord ? `@${p.discord.replace(/_/g, "\\_")}` : '*Not Set*';
          const responseIcon = p.cwlSignedUp ? '✅' : '❌';
          
          const hitRate = p.warHitRate || '—';
          const cwlStars = p.totalCwlStars || '—';
          const league = p.cwlLeague || 'Unknown';
          const leagueEmoji = league !== 'Unknown' && league in WAR_LEAGUE ? WAR_LEAGUE[league as keyof typeof WAR_LEAGUE] : '🏆';
          const stars = p.avgStars || '—';
          const attacks = p.totalAttacks || '—';
          const defStars = p.defenseAvgStars || '—';
          const destruction = p.destruction || '—';
          const missed = p.missed || '—';
          const townHall = p.townHall || '—';
          const heroes = p.combinedHeroes || '—';
          
          return [
            `### ${index + 1}. ${name} ${responseIcon}`,
            `> **Discord:** ${discord}`,
            `> **CWL:** ${leagueEmoji} \`${league}\``,
            `> **CWL Attack:** ⚔️ \`${attacks}\` attacks  •  ⭐ \`${cwlStars}\` stars  •  ⭐ \`${stars}\` avg  •  💥 \`${destruction}%\` dest`,
            `> **CWL Defense:** 🛡️ \`${defStars}\` avg`,
            `> **War Attack:** 🎯 \`${hitRate}\` 3★`,
            `> **Other:** 🏠 TH\`${townHall}\`  •  🦸 \`${heroes}\` heroes`
          ].join('\n');
        };
        
        const createComponents = (currentPage: number) => {
          if (pages.length === 1) return [];
          return [{
            type: ComponentType.ActionRow as ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_first_${interactionId}`,
                emoji: { name: '⏮️' },
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: currentPage === 0
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_prev_${interactionId}`,
                emoji: { name: '◀️' },
                style: ButtonStyle.Primary as ButtonStyle.Primary,
                disabled: currentPage === 0
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_page_${interactionId}`,
                label: `${currentPage + 1} / ${pages.length}`,
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: true
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_next_${interactionId}`,
                emoji: { name: '▶️' },
                style: ButtonStyle.Primary as ButtonStyle.Primary,
                disabled: currentPage === pages.length - 1
              },
              {
                type: ComponentType.Button as ComponentType.Button,
                custom_id: `unrostered_last_${interactionId}`,
                emoji: { name: '⏭️' },
                style: ButtonStyle.Secondary as ButtonStyle.Secondary,
                disabled: currentPage === pages.length - 1
              }
            ]
          }];
        };
        
        const embed = {
          title: '📋 Unrostered Players',
          description: pages[0].map((p, i) => formatPlayer(p, i)).join('\n\n'),
          color: 0x5865F2,
          footer: {
            text: `Page 1 of ${pages.length}  •  ${sortedPlayers.length} unrostered / ${cacheData.allPlayersCount} total players`
          },
          timestamp: new Date().toISOString()
        };
        
        await updateMessage(cacheData.channelId, cacheData.messageId, {
          embeds: [embed],
          components: createComponents(0)
        });
        
        cacheData.players = sortedPlayers;
        await storeCacheInDynamoDB(interactionId, cacheData);
        
        console.log(`Added player back to message in channel ${cacheData.channelId}`);
      } catch (error) {
        console.error(`Failed to add player to message ${interactionId}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to quick add refresh:', error);
  }
};
