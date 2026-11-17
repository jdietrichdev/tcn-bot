import {
  APIApplicationCommandInteractionDataAttachmentOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import { sendMessage, updateResponse } from "../adapters/discord-adapter";
import { getCommandOptionData } from "../util/interaction-util";
import { getConfig } from "../util/serverConfig";

export const handleBasePost = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const baseLink =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "base_link"
    ).value;
  const clanCastle =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "clan_castle"
    ).value;
  const league =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "league"
    ).value;
  const imageId =
    getCommandOptionData<APIApplicationCommandInteractionDataAttachmentOption>(
      interaction,
      "image"
    ).value;
  const notes =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "notes"
    )?.value;

  let linkUrl: URL;
  try {
    linkUrl = new URL(baseLink);
  } catch {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Please provide a valid Clash of Clans base link.",
      flags: 64,
    });
    return;
  }

  if (
    linkUrl.protocol !== "https:" ||
    linkUrl.hostname !== "link.clashofclans.com"
  ) {
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "The base link must be an HTTPS link from link.clashofclans.com.",
      flags: 64,
    });
    return;
  }

  const image = interaction.data.resolved?.attachments?.[imageId];
  if (
    !image ||
    (image.content_type !== "image/png" &&
      !image.filename.toLowerCase().endsWith(".png"))
  ) {
    await updateResponse(interaction.application_id, interaction.token, {
      content: "The base image must be a PNG file.",
      flags: 64,
    });
    return;
  }
  const imageUrl = image.url;

  const username =
    interaction.member?.user.username ?? interaction.user?.username ?? "Builder";
  const embed: APIEmbed = {
    title: "Clash of Clans Base",
    description: `Shared by **${username}**`,
    color: 0x5865f2,
    fields: [
      { name: "Clan Castle", value: clanCastle, inline: true },
      { name: "Recommended League", value: league, inline: true },
      ...(notes ? [{ name: "Builder Notes", value: notes }] : []),
    ],
    image: { url: imageUrl },
  };

  try {
    const channelId = getConfig(interaction.guild_id!).BASE_POST_CHANNEL;
    if (!channelId) {
      throw new Error("No base-post channel is configured for this server.");
    }

    await sendMessage(
      {
        embeds: [embed],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                label: "Open Base Link",
                url: linkUrl.toString(),
              },
            ],
          },
        ],
      },
      channelId
    );
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Your base has been posted.",
      flags: 64,
    });
  } catch (err) {
    console.error("Failed to post base layout", err);
    await updateResponse(interaction.application_id, interaction.token, {
      content: "I couldn't post the base. Please try again or contact an admin.",
      flags: 64,
    });
  }
};
