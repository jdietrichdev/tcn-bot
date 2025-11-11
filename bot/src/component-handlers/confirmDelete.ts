import {
  APIGuildTextChannel,
  APIMessageComponentInteraction,
  GuildTextChannelType,
} from "discord-api-types/v10";
import { updateResponse } from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";
import { deleteTicketChannel } from "../util/ticketDeletion";

export const confirmDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    await deleteTicketChannel({
      guildId: interaction.guild_id!,
      channelId: interaction.channel.id,
      channel: interaction.channel as APIGuildTextChannel<GuildTextChannelType>,
      config,
      deletedById: interaction.member!.user.id,
      deletedByUsername:
        interaction.member!.user.username ?? interaction.member!.user.id,
    });
  } catch (err) {
    console.error(`Failed to delete channel: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue deleting the channel, please try again or reach out to admins",
    });
  }
};
