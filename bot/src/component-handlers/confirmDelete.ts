// import { APIEmbed, APIGuildTextChannel, APIMessage, APIMessageComponentInteraction, GuildTextChannelType } from "discord-api-types/v10";
// import { deleteChannel, getChannelMessages, getUser, updateResponse } from "../adapters/discord-adapter";
import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { deleteChannel, updateResponse } from "../adapters/discord-adapter";

export const confirmDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    // const messages = await getChannelMessages(interaction.channel.id);
    // const transcript = createTranscript(interaction, messages);
    await deleteChannel(interaction.channel.id);
  } catch (err) {
    console.error(`Failed to delete channel: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue deleting the channel, please try again or reach out to admins",
    });
  }
};

// const createTranscript = async (interaction: APIMessageComponentInteraction, messages: APIMessage[]): Promise<APIEmbed> => {
//   const applicationChannel = interaction.channel as APIGuildTextChannel<GuildTextChannelType>;
//   const applicantUsername = applicationChannel.name.split('-')[1];
//   const applicantId = applicationChannel.topic!.split(':')[1];
//   const participantMap = new Map<string, number>();
//   for (const message of messages) {
//     const author = message.author.id;
//     const score = participantMap.get(author) ?? 0;
//     participantMap.set(author, score+1);
//   }
//   return {
//     author: {
//       name: applicantUsername
//     },
//     title: `Clan application for ${applicantUsername}`,
//     fields: [
//       {
//         name: "Created by",
//         value: `<@${applicantId}>`,
//         inline: false,
//       },
//       {
//         name: "Deleted by",
//         value: `<@${interaction.member!.user.id}>`,
//         inline: false,
//       }
//     ]
//   }
// }