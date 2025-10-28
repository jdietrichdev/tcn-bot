import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from 'discord-api-types/v10';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export const handleRewardClaimed = async (
  interaction: APIApplicationCommandAutocompleteInteraction,
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (
    interaction.data
      .options as APIApplicationCommandInteractionDataStringOption[]
  ).find((option) => option.focused);

  if (focused && focused.name === 'reward') {
    const rewards = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: 'BotTable',
          Key: {
            pk: interaction.guild_id!,
            sk: 'event-rewards',
          },
        }),
      )
    ).Item!.rewards;

    options.choices = rewards
      .filter((reward: Record<string, any>) => reward.status === 'Pending')
      .map((reward: Record<string, any>) => {
        return {
          name: `${reward.eventName}: ${reward.winner} | ${reward.prize}`,
          value: `${reward.eventId}_${reward.winnerId}_${reward.prize}`,
        };
      });

    console.log(options);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
