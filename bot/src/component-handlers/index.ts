import {
  APIMessageComponentInteraction,
  APITextChannel,
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
  moveChannel,
  deleteChannel,
  getServerUser,
  grantRole,
} from "../adapters/discord-adapter";
import { getConfig, ServerConfig } from "../util/serverConfig";

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  const config = getConfig(interaction.guild_id!);
  switch (interaction.data.custom_id) {
    case "approveApp":
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
        break;
      } catch (err) {
        console.error(`Failure approving app: ${err}`);
      }
    case "denyApp":
      try {
        await sendMessage(
          {
            content: `<@${
              interaction.message.embeds![0].fields![5].value
            }> thank you for your application, but your account does not currently meet our criteria, feel free to reapply at a later time`,
          },
          config.GUEST_CHAT_CHANNEL
        );
        await updateMessage(interaction.application_id, interaction.token, {
          content: `Denied by ${interaction.member?.user.username}`,
          components: [],
        });
        break;
      } catch (err) {
        console.error(`Failure denying app: ${err}`);
        break;
      }
    case "messageRecruit":
      try {
        await updateMessage(interaction.application_id, interaction.token, {
          content:
            interaction.message.content +
            "\n" +
            `Messaged by ${interaction.member?.user.username}`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Primary,
                  label: "Messaged",
                  custom_id: "messageRecruit",
                },
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Danger,
                  label: "Close",
                  custom_id: "closeRecruit",
                },
              ],
            },
          ],
        });
        break;
      } catch (err) {
        console.error(`Failure updating recruit message: ${err}`);
        break;
      }
    case "closeRecruit":
      try {
        await updateMessage(interaction.application_id, interaction.token, {
          content: interaction.message.content.split("\n").splice(1).join("\n"),
          components: [],
        });
        break;
      } catch (err) {
        console.error(`Failure closing recruit message: ${err}`);
        break;
      }
    case "closeTicket":
      try {
        const channelId = interaction.message.channel_id;
        await moveChannel(channelId, config.ARCHIVE_CATEGORY);
        await sendMessage(
          {
            content: `${interaction.member?.user.username} has closed the ticket`,
          },
          channelId
        );
        await updateMessage(interaction.application_id, interaction.token, {
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Secondary,
                  label: "Reopen",
                  custom_id: "reopenTicket",
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
              ],
            },
          ],
        });
        break;
      } catch (err) {
        console.error(`Failed to close ticket: ${err}`);
        break;
      }
    case "deleteTicket":
      try {
        const channelId = interaction.message.channel_id;
        await deleteChannel(channelId);
        break;
      } catch (err) {
        console.error(`Failed to delete ticket: ${err}`);
        break;
      }
    case "reopenTicket":
      try {
        const channelId = interaction.message.channel_id;
        await moveChannel(channelId, config.APPLICATION_CATEGORY);
        await sendMessage(
          {
            content: `${interaction.member?.user.username} has reopened the ticket`,
          },
          channelId
        );
        await updateMessage(interaction.application_id, interaction.token, {
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
              ],
            },
          ],
        });
        break;
      } catch (err) {
        console.error(`Failed to reopen ticket: ${err}`);
        break;
      }
    case "grantRoles":
      try {
        const approver = await getServerUser(
          interaction.guild_id!,
          interaction.member!.user.id
        );
        if (approver.roles.includes(config.RECRUITER_ROLE)) {
          const userId = (interaction.channel as APITextChannel).topic!.split(
            ":"
          )[1];
          await grantRole(interaction.guild_id!, userId, config.CLAN_ROLE);
          await sendMessage(
            {
              content: `Roles granted by ${interaction.member?.user.username}`,
            },
            interaction.channel.id
          );
        } else {
          await sendMessage(
            {
              content: `You do not have permission to approve this ticket <@${interaction.member?.user.id}>`,
            },
            interaction.channel.id
          );
        }
      } catch (err) {
        console.error(`Failed to grant roles: ${err}`);
        break;
      }
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
