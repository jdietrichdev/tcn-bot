import {
  APIMessageComponentInteraction,
  APITextChannel,
  ComponentType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  deleteResponse,
  moveChannel,
  sendMessage,
  updateChannelPermissions,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { determineRolesButton, isActorAdmin, isActorRecruiter } from "./utils";
import { BUTTONS } from "./buttons";

export const reopenTicket = async (
  interaction: APIMessageComponentInteraction,
  config: ServerConfig
) => {
  try {
    if (
      await isActorRecruiter(
        interaction.guild_id!,
        interaction.member!.user.id,
        config
      ) || await isActorAdmin(interaction.guild_id!, interaction.member!.user.id, config)
    ) {
      const channelId = interaction.message.channel_id;
      const userId = (interaction.channel as APITextChannel).topic!.split(
        ":"
      )[1];
      await moveChannel(channelId, config.APPLICATION_CATEGORY);
      await updateChannelPermissions(channelId, userId, {
        type: OverwriteType.Member,
        allow: (
          PermissionFlagsBits.AddReactions |
          PermissionFlagsBits.ViewChannel |
          PermissionFlagsBits.SendMessages |
          PermissionFlagsBits.ReadMessageHistory
        ).toString(),
        deny: "0",
      });
      await sendMessage(
        {
          content: `${interaction.member?.user.username} has reopened the ticket`,
        },
        channelId
      );
      await updateMessage(interaction.channel.id, interaction.message.id, {
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              BUTTONS.CLOSE_TICKET,
              BUTTONS.DELETE_TICKET,
              await determineRolesButton(interaction.guild_id!, userId, config),
            ],
          },
        ],
      });
    } else {
      await sendMessage(
        {
          content: `You do not have permissions to reopen this ticket <@${interaction.member?.user.id}>`,
        },
        interaction.channel.id
      );
    }
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failed to reopen ticket: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue reopening the ticket, please try again or reach out to admins",
    });
  }
};
