import {
  APIMessageComponentInteraction,
  APITextChannel,
  ComponentType,
  OverwriteType,
} from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  deleteResponse,
  moveChannel,
  sendMessage,
  updateChannel,
  updateChannelPermissions,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { determineRolesButton, isActorAdmin, isActorRecruiter } from "./utils";
import { BUTTONS } from "./buttons";
import { ensureArchiveCapacity } from "../util/ticketDeletion";

export const closeTicket = async (
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
      const channelTopic = (interaction.channel as APITextChannel).topic;
      if (typeof channelTopic !== "string") {
        throw new Error("Could not identify the ticket owner.");
      }
      const userId = channelTopic.split(":")[1];
      if (!userId) {
        throw new Error("Could not identify the ticket owner.");
      }
      if (config.ARCHIVE_CATEGORY) {
        await ensureArchiveCapacity(interaction.guild_id!, config, {
          triggeredById: interaction.member?.user.id,
        });
        await moveChannel(channelId, config.ARCHIVE_CATEGORY);
      } else if (channelTopic.startsWith("CWL tryout for ")) {
        await updateChannel(
          { topic: `Closed ${channelTopic}` },
          channelId
        );
      } else {
        throw new Error("No archive category is configured for this server.");
      }
      await updateChannelPermissions(channelId, userId, {
        type: OverwriteType.Member,
        allow: "0",
        deny: "0",
      });
      await sendMessage(
        {
          content: `${interaction.member?.user.username} has closed the ticket`,
        },
        channelId
      );
      await updateMessage(interaction.channel.id, interaction.message.id, {
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              BUTTONS.REOPEN_TICKET,
              BUTTONS.DELETE_TICKET,
              await determineRolesButton(
                interaction.guild_id!,
                userId,
                config
              ),
            ],
          },
        ],
      });
      if (config.ARCHIVE_CATEGORY) {
        await ensureArchiveCapacity(interaction.guild_id!, config, {
          triggeredById: interaction.member?.user.id,
        });
      }
    } else {
      await sendMessage(
        {
          content: `You do not have permission to close this ticket <@${interaction.member?.user.id}>`,
        },
        interaction.channel.id
      );
    }
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error("Failed to close ticket:", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue closing this ticket, please try again or reach out to admins",
    });
  }
};
