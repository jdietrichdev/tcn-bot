import {
  APIMessageComponentInteraction,
  APITextChannel,
  ComponentType,
} from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  deleteResponse,
  grantRole,
  removeRole,
  sendMessage,
  updateChannel,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { determineRolesButton, isActorRecruiter } from "./utils";

export const grantRoles = async (
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
      const userId = (interaction.channel as APITextChannel).topic!.split(
        ":"
      )[1];
      await grantRole(interaction.guild_id!, userId, config.CLAN_ROLE);
      await grantRole(interaction.guild_id!, userId, config.ORES_ROLE);
      await removeRole(interaction.guild_id!, userId, config.VISITOR_ROLE);
      await sendMessage(
        {
          content: `Roles granted by ${interaction.member?.user.username}`,
        },
        interaction.channel.id
      );
      await updateChannel(
        {
          name: interaction.channel.name!.replace("\u{1F39F}", "\u{2705}"),
        },
        interaction.channel.id
      );
      await updateMessage(interaction.channel.id, interaction.message.id, {
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              ...interaction.message.components![0].components.splice(0, 2),
              await determineRolesButton(
                interaction.guild_id!,
                userId!,
                config
              ),
            ],
          },
        ],
      });
    } else {
      await sendMessage(
        {
          content: `You do not have permission to grant roles <@${interaction.member?.user.id}>`,
        },
        interaction.channel.id
      );
    }
    await deleteResponse(interaction.application_id, interaction.token);
  } catch (err) {
    console.error(`Failed to grant roles: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue granting roles, please try again or reach out to admins",
    });
  }
};
