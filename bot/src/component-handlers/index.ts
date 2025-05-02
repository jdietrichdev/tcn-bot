import {
  APIMessageComponentInteraction,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import {
  createChannel,
  deleteMessage,
  updateMessage,
} from "../adapters/discord-adapter";

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  switch (interaction.message.content) {
    case "New Application!":
      if (interaction.data.custom_id === "yes") {
        await createApplicationChannel(interaction);
        await deleteMessage(interaction.application_id, interaction.token);
      } else {
        // await sendDenialDM();
      }
  }
  await updateMessage(interaction.application_id, interaction.token, {
    content: "Test update for component message",
  });
};

const createApplicationChannel = async (
  interaction: APIMessageComponentInteraction
) => {
  const username = interaction.message.embeds[0].title?.split(" ")[2];
  const response = await createChannel(
    {
      name: `ticket-${username}`,
      type: ChannelType.GuildText,
      topic: `Application channel for ${username}`,
      parent_id: "1367867954577932321",
      permission_overwrites: [
        {
          id: interaction.guild_id!,
          type: OverwriteType.Role,
          allow: "0",
          deny: PermissionFlagsBits.ViewChannel.toString(),
        },
        {
          id: "1367944733204152484",
          type: OverwriteType.Role,
          allow: (
            PermissionFlagsBits.SendMessages ||
            PermissionFlagsBits.AddReactions ||
            PermissionFlagsBits.ViewChannel
          ).toString(),
          deny: "0",
        },
      ],
    },
    interaction.guild_id!
  );
  console.log(response);
};
