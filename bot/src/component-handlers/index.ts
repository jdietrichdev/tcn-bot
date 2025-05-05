import {
  APIMessageComponentInteraction,
  ButtonStyle,
  ChannelType,
  ComponentType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import {
  createChannel,
  sendMessage,
  updateMessage,
} from "../adapters/discord-adapter";
import { getConfig, ServerConfig } from "../util/serverConfig";

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  const config = getConfig(interaction.guild_id!);
  switch (interaction.data.custom_id) {
    case "approveApp":
      const responses = interaction.message.embeds[0];
      const userId = responses.fields?.splice(5, 1)[0].value;
      const applicationChannel = await createApplicationChannel(interaction, userId!, config);
      delete responses.footer;
      await sendMessage(
        {
          content: `Hey <@${userId}> thanks for applying! We've attached your original responses below for reference, but feel free to tell us more about yourself!`,
          embeds: [responses],
        },
        applicationChannel.id
      );
      await updateMessage(interaction.application_id, interaction.token, {
        content: `Accepted by ${interaction.member?.user.username}`,
        components: [],
      });
      break;
    case "denyApp":
      await sendMessage(
        {
          content: `<@${interaction.message.embeds![0].fields![5].value}> thank you for your application, but your account does not currently meet our criteria, feel free to reapply at a later time`
        }, 
        config.GUEST_CHAT_CHANNEL
      );
      await updateMessage(interaction.application_id, interaction.token, {
        content: `Denied by ${interaction.member?.user.username}`,
        components: []
      });
      break;
    case "messageRecruit":
      await updateMessage(interaction.application_id, interaction.token, {
        content: interaction.message.content + "\n" + `Messaged by ${interaction.member?.user.username}`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: "Messaged",
                custom_id: 'messageRecruit'
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label: "Close",
                custom_id: "closeRecruit"
              },
            ]
          }
        ],
      });
      break;
    case "closeRecruit":
      await updateMessage(interaction.application_id, interaction.token, {
        content: interaction.message.content.split('\n').splice(1).join('\n'),
        components: []
      });
      break;
  }
};

const createApplicationChannel = async (
  interaction: APIMessageComponentInteraction,
  userId: string,
  config: ServerConfig
) => {
  const username = interaction.message.embeds[0].title?.split(" ")[2];
  const response = await createChannel(
    {
      name: `ticket-${username}`,
      type: ChannelType.GuildText,
      topic: `Application channel for ${username}`,
      parent_id: config.APPLICATION_CATEGORY,
      permission_overwrites: [
        {
          id: interaction.guild_id!,
          type: OverwriteType.Role,
          allow: "0",
          deny: PermissionFlagsBits.ViewChannel.toString(),
        },
        {
          id: config.RECRUITER_ROLE,
          type: OverwriteType.Role,
          allow: (PermissionFlagsBits.ViewChannel | PermissionFlagsBits.AddReactions | PermissionFlagsBits.SendMessages).toString(),
          deny: "0",
        },
        {
          id: userId,
          type: OverwriteType.Member,
          allow: (PermissionFlagsBits.ViewChannel | PermissionFlagsBits.AddReactions | PermissionFlagsBits.SendMessages).toString(),
          deny: "0",
        },
      ],
    },
    interaction.guild_id!
  );
  return response.data;
};
