import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
  APITextChannel,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import {
  createDM,
  getMessage,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { schedulerClient } from "../clients/scheduler-client";
import {
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
} from "@aws-sdk/client-scheduler";
import { getConfig } from "../util/serverConfig";

export const handleEventWinner = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const winner =
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "winner"
      ).value;
    const prize =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "prize"
      ).value;
    const sponsor =
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "sponsor"
      ).value;
    const expiration = Number(
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "expiration"
      )?.value ?? 24
    );
    const eventId = (interaction.channel as APITextChannel).topic;

    const eventData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: `event#${eventId}`,
          },
        })
      )
    ).Item;

    if (!eventData) {
      throw new Error("No event found for this channel");
    }

    const dmChannel = await createDM({
      recipient_id: winner,
    });

    const message = await sendMessage(
      {
        content: `Congratulations on winning a ${prize} in our ${eventData.name} event! Click the button below to claim your prize.`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                custom_id: `claim_${interaction.guild_id!}_${eventId}_${prize}_${sponsor}`,
                label: "Claim",
              },
            ],
          },
        ],
      },
      dmChannel.id
    );

    const statusMessage = await sendMessage({
      content: `Winner: ${winner}\nSponsor: ${sponsor}\nPrize: ${prize}\nStatus: Initiated`
    }, config.REWARD_TRACKING_CHANNEL);

    const rewards = (await dynamoDbClient.send(new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: interaction.guild_id,
        sk: 'event-rewards'
      }
    }))).Item!;

    rewards.rewards.push({ winner, prize, sponsor, status: "Initiated", message: statusMessage.id });

    await dynamoDbClient.send(new PutCommand({
      TableName: "BotTable",
      Item: rewards
    }));

    await schedulerClient.send(
      new CreateScheduleCommand({
        Name: `reward-expiration-${dmChannel.id}-${message.id}`,
        ScheduleExpression: `at(${
          new Date(Date.now() + expiration * 60 * 60 * 1000)
            .toISOString()
            .split(".")[0]
        })`,
        FlexibleTimeWindow: {
          Mode: FlexibleTimeWindowMode.OFF,
        },
        Target: {
          Arn: process.env.SCHEDULED_LAMBDA_ARN,
          RoleArn: process.env.SCHEDULER_ROLE_ARN,
          Input: JSON.stringify({
            "detail-type": "Reward Expiration",
            detail: {
              channelId: dmChannel.id,
              messageId: message.id,
            },
          }),
        },
      })
    );

    await sendMessage(
      {
        content: `Congratulations to <@${winner}> for winning a ${prize} this event! Check your DMs for further instructions.`,
      },
      interaction.channel.id
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: "Thanks for registering this winner!",
    });
  } catch (err) {
    console.error(`Failed to create winner for event: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was a failure adding winner for event, verify you are in a valid event channel and try again or contact admins",
    });
  }
};
