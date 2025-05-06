import { APIMessageComponentInteraction, ButtonStyle, ChannelType, ComponentType, OverwriteType, PermissionFlagsBits } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import { createChannel, sendMessage, updateMessage } from "../adapters/discord-adapter";

export const approveApp = async (interaction: APIMessageComponentInteraction, config: ServerConfig) => {
    try {
        const responses = interaction.message.embeds[0];
        const userId = responses.fields?.splice(5, 1)[0].value;
        const applicationChannel = await createApplicationChannel(
            interaction,
            userId!,
            config
        );
        delete responses.footer;
        await sendMessage(
            {
            content: `<@&${config.RECRUITER_ROLE}>\nHey <@${userId}> thanks for applying! We've attached your original responses below for reference, but feel free to tell us more about yourself!`,
            embeds: [responses],
            components: [
                {
                type: ComponentType.ActionRow,
                components: [
                    {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: "Close",
                    custom_id: "closeTicket",
                    },
                    {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    label: "Delete",
                    custom_id: "deleteTicket",
                    },
                    {
                    type: ComponentType.Button,
                    style: ButtonStyle.Success,
                    label: "Grant Roles",
                    custom_id: "grantRoles",
                    },
                    {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    label: "Remove Roles",
                    custom_id: "removeRoles",
                    },
                ],
                },
            ],
            },
            applicationChannel.id
        );
        await updateMessage(interaction.application_id, interaction.token, {
            content: `Accepted by ${interaction.member?.user.username}`,
            components: [],
        });
    } catch (err) {
        console.error(`Failure approving app: ${err}`);
    }
}



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
        topic: `Application channel for ${username}:${userId}`,
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
            allow: (
              PermissionFlagsBits.ViewChannel |
              PermissionFlagsBits.AddReactions |
              PermissionFlagsBits.SendMessages
            ).toString(),
            deny: "0",
          },
          {
            id: userId,
            type: OverwriteType.Member,
            allow: (
              PermissionFlagsBits.ViewChannel |
              PermissionFlagsBits.AddReactions |
              PermissionFlagsBits.SendMessages
            ).toString(),
            deny: "0",
          },
        ],
      },
      interaction.guild_id!
    );
    return response.data;
  };
  