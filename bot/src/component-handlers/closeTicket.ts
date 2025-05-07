import {
  APIMessageComponentInteraction,
  APITextChannel,
  ComponentType,
} from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  deleteResponse,
  moveChannel,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { determineRolesButton, isActorRecruiter } from "./utils";
import { BUTTONS } from "./buttons";

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
      )
    ) {
      const channelId = interaction.message.channel_id;
      const userId = (interaction.channel as APITextChannel).topic!.split(
        ":"
      )[1];
      await moveChannel(channelId, config.ARCHIVE_CATEGORY);
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
                userId!,
                config
              ),
            ],
          },
        ],
      });
      await deleteResponse(interaction.application_id, interaction.token);
    } else {
      await sendMessage(
        {
          content: `You do not have permission to close this ticket <@${interaction.member?.user.id}>`,
        },
        interaction.channel.id
      );
    }
  } catch (err) {
    console.error(`Failed to close ticket: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue closing this ticket, please try again or reach out to admins",
    });
  }
};
