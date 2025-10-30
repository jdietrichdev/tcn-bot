import { APIMessageComponentInteraction, ComponentType, ButtonStyle, APIEmbed, InteractionResponseType } from 'discord-api-types/v10';
import { updateMessage } from '../adapters/discord-adapter';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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

  const playersPerPage = 8;
  const pages: any[][] = [];
  for (let i = 0; i < data.players.length; i += playersPerPage) {
    pages.push(data.players.slice(i, i + playersPerPage));
  }

  const formatPlayer = (p: any, index: number) => {
    const name = p.name.replace(/_/g, "\\_");
    const discord = p.discord ? `@${p.discord.replace(/_/g, "\\_")}` : '*Not Set*';
    const responseIcon = p.cwlSignedUp ? '✅' : '❌';
    
    const stars = p.avgStars || '—';
    const attacks = p.totalAttacks || '—';
    const defStars = p.defenseAvgStars || '—';
    
    const heroes = p.combinedHeroes || '—';
    const destruction = p.destruction || '—';
    const missed = p.missed || '—';
    
    const hitRate = p.warHitRate || '—';
    const league = p.cwlLeague || 'Unknown';
    
    return [
      `### ${index + 1}. ${name} ${responseIcon}`,
      `> **Discord:** ${discord}`,
      `> **Attack:** ⭐ \`${stars}\` avg  •  ⚔️ \`${attacks}\` total  •  🎯 \`${hitRate}\` 3★`,
      `> **Defense:** 🛡️ \`${defStars}\` avg  •  💥 \`${destruction}%\` dest  •  ❌ \`${missed}\` missed`,
      `> **Other:** 🦸 \`${heroes}\` heroes  •  🏆 \`${league}\``
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
  
  const playersPerPage = 8;
  
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
        
        const stars = p.avgStars || '—';
        const attacks = p.totalAttacks || '—';
        const defStars = p.defenseAvgStars || '—';
        const heroes = p.combinedHeroes || '—';
        const destruction = p.destruction || '—';
        const missed = p.missed || '—';
        const hitRate = p.warHitRate || '—';
        const league = p.cwlLeague || 'Unknown';
        
        return [
          `### ${index + 1}. ${name} ${responseIcon}`,
          `> **Discord:** ${discord}`,
          `> **Attack:** ⭐ \`${stars}\` avg  •  ⚔️ \`${attacks}\` total  •  🎯 \`${hitRate}\` 3★`,
          `> **Defense:** 🛡️ \`${defStars}\` avg  •  💥 \`${destruction}%\` dest  •  ❌ \`${missed}\` missed`,
          `> **Other:** 🦸 \`${heroes}\` heroes  •  🏆 \`${league}\``
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
