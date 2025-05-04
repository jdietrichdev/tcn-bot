import {
  APIMessageComponentInteraction,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import {
  createChannel,
  createDM,
  sendMessage,
  updateMessage,
} from "../adapters/discord-adapter";

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  switch (interaction.data.custom_id) {
    case "approveApp":
      const applicationChannel = await createApplicationChannel(interaction);
      const responses = interaction.message.embeds[0];
      const userId = responses.fields?.splice(5, 1)[0].value;
      delete responses.footer;
      await sendMessage(
        {
          content: `Hey <@${userId}> thanks for applying! We've attached your original responses below for reference, but feel free to tell us more about yourself!`,
          embeds: [responses],
        },
        applicationChannel.id
      );
      await updateMessage(interaction.application_id, interaction.token, {
        content: `Accepted by ${interaction.member?.user.username}`,
        components: [],
      });
    case "denyApp":
      await sendDenialDM(interaction);
      await updateMessage(interaction.application_id, interaction.token, {
        content: `Denied by ${interaction.member?.user.username}`,
        components: [],
      });
    case "claimRecruit":
      const content = interaction.message.content + "\n" + `Claimed by ${interaction.member?.user.username}`;
      await updateMessage(interaction.application_id, interaction.token, {
        content
      });
    case "closeRecruit":
      await updateMessage(interaction.application_id, interaction.token, {
        components: []
      });
  }
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
        {
          id: interaction.message.embeds![0].fields![5].value,
          type: OverwriteType.Member,
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
  return response.data;
};

const sendDenialDM = async (interaction: APIMessageComponentInteraction) => {
  const dmChannel = await createDM({
    recipient_id: interaction.message.embeds![0].fields![5].value,
  });
  await sendMessage(
    {
      content:
        "Thank you for applying! You do not currently meet our family requirements, feel free to apply again at a later time",
    },
    dmChannel.id
  );
};
