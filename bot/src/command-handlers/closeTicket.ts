import {
    APIApplicationCommandInteraction,
  APITextChannel,
  OverwriteType,
} from "discord-api-types/v10";
import { getConfig } from "../util/serverConfig";
import {
  deleteResponse,
  moveChannel,
  sendMessage,
  updateChannelPermissions,
  updateResponse,
} from "../adapters/discord-adapter";
import { isActorRecruiter } from "../component-handlers/utils";

export const closeTicket = async (
  interaction: APIApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    if (isTicketChannel(interaction.channel.name!)) {
        if (
        await isActorRecruiter(
            interaction.guild_id!,
            interaction.member!.user.id,
            config
        )
        ) {
        const channelId = interaction.channel.id;
        const userId = (interaction.channel as APITextChannel).topic!.split(
            ":"
        )[1];
        await moveChannel(channelId, config.ARCHIVE_CATEGORY);
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
        } else {
            await sendMessage(
                {
                content: `You do not have permission to close this ticket <@${interaction.member?.user.id}>`,
                },
                interaction.channel.id
            );
        }
    } else {
        await sendMessage(
            { content: `This is not an application channel <@${interaction.member!.user.id}>`}, 
            interaction.channel.id
        );
    }
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failed to close ticket: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue closing this ticket, please try again or reach out to admins",
    });
  }
};

const isTicketChannel = (channelName: string) => {
    return channelName.includes('\u{1F39F}');
}
