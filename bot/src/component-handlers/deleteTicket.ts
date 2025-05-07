import {
  APIMessageComponentInteraction,
  ComponentType,
} from "discord-api-types/v10";
import {
  deleteResponse,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { isActorRecruiter } from "./utils";
import { ServerConfig } from "../util/serverConfig";
import { BUTTONS } from "./buttons";

export const deleteTicket = async (
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
      await updateResponse(interaction.application_id, interaction.token, {
        content: "Are you sure you want to delete this ticket?",
        components: [
          {
            type: ComponentType.ActionRow,
            components: [BUTTONS.CONFIRM_DELETE, BUTTONS.REJECT_DELETE],
          },
        ],
      });
    } else {
      await sendMessage(
        {
          content: `You do not have permissions to delete this ticket <@${interaction.member?.user.id}>`,
        },
        interaction.channel.id
      );
      await deleteResponse(interaction.application_id, interaction.token);
    }
  } catch (err) {
    console.error(`Failed to delete ticket: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue initializing deletion of this ticket, please try again or reach out to admins",
    });
  }
};
