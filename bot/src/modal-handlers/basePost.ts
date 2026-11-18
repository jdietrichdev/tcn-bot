import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  APIAttachment,
  APIInteractionResponse,
  APIModalInteractionResponseCallbackComponent,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  ModalSubmitComponent,
  TextInputStyle,
} from "discord-api-types/v10";
import {
  updateMessage,
  updateMessageWithAttachment,
  updateResponse,
} from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import {
  BASE_POST_IMAGE_FILENAME,
  BASE_POST_IMAGE_JPEG_FILENAME,
  BasePostRecord,
  buildBasePostPayload,
  canEditBasePost,
  loadBasePostLeagueEmojiMap,
  getRecommendedLeagueEmojiKey,
  isBasePostRecord,
} from "../util/basePost";
import {
  ClanCastleTroop,
  ClanCastleTroopInputError,
  loadClanCastleTroopEmojiMap,
  parseClanCastleTroops,
} from "../util/clanCastleTroops";
import { getConfig } from "../util/serverConfig";

const RECOMMENDED_LEAGUES = [
  "Legends 1",
  "Legends 2",
  "Legends 3",
  "Legends 2/3",
  "CWL",
  "Titan I CWL",
  "Titan II CWL",
  "Titan III CWL",
];
const MAX_BASE_IMAGE_SIZE = 20 * 1024 * 1024;
const DISCORD_ATTACHMENT_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
]);

export const createBasePostSettingsModal = async (
  interaction: APIMessageComponentInteraction
): Promise<APIInteractionResponse> => {
  try {
    const guildId = interaction.guild_id;
    const userId =
      interaction.member?.user?.id ?? interaction.user?.id;
    if (!guildId || !userId) {
      return ephemeralResponse("Base settings can only be opened in a server.");
    }

    const basePost = await getBasePost(guildId, interaction.message.id);
    if (!basePost) {
      return ephemeralResponse("This base post is no longer available.");
    }

    const config = getConfig(guildId);
    if (
      !canEditBasePost(
        basePost,
        userId,
        interaction.member?.roles ?? [],
        config.ADMIN_ROLE
      )
    ) {
      return ephemeralResponse(
        "Only the base builder or a server admin can edit this post."
      );
    }

    const components: APIModalInteractionResponseCallbackComponent[] = [
      {
        type: ComponentType.Label,
        label: "Clash of Clans base link",
        component: {
          type: ComponentType.TextInput,
          custom_id: "base_link",
          style: TextInputStyle.Short,
          value: basePost.baseLink,
          max_length: 1000,
          required: true,
        },
      },
      {
        type: ComponentType.Label,
        label: "Clan Castle",
        description: "For example: 2x Ice Golem, 1x Baby Dragon",
        component: {
          type: ComponentType.TextInput,
          custom_id: "clan_castle",
          style: TextInputStyle.Short,
          value: basePost.clanCastle,
          max_length: 400,
          required: true,
        },
      },
      {
        type: ComponentType.Label,
        label: "Recommended league",
        component: {
          type: ComponentType.StringSelect,
          custom_id: "league",
          options: RECOMMENDED_LEAGUES.map((league) => ({
            label: league,
            value: league,
            default: league === basePost.league,
          })),
          min_values: 1,
          max_values: 1,
        },
      },
      {
        type: ComponentType.Label,
        label: "Builder notes",
        component: {
          type: ComponentType.TextInput,
          custom_id: "notes",
          style: TextInputStyle.Paragraph,
          value: basePost.notes,
          max_length: 1000,
          required: false,
        },
      },
      {
        type: ComponentType.Label,
        label: "Replace base image (optional)",
        description: "Upload one PNG or JPEG image.",
        component: {
          type: ComponentType.FileUpload,
          custom_id: "image",
          file_types: [".png", ".jpg", ".jpeg"],
          min_values: 0,
          max_values: 1,
          required: false,
        },
      },
    ];

    return {
      type: InteractionResponseType.Modal,
      data: {
        custom_id: `base_post_edit:${basePost.messageId}`,
        title: `Edit Base #${basePost.baseId}`,
        components,
      },
    };
  } catch (err) {
    console.error("Failed to prepare base-post settings", err);
    return ephemeralResponse(
      "I couldn't load these base settings. Please try again."
    );
  }
};

export const submitBasePostEditModal = async (
  interaction: APIModalSubmitInteraction
): Promise<void> => {
  try {
    const guildId = interaction.guild_id;
    const messageId = interaction.data.custom_id.match(
      /^base_post_edit:(\d+)$/
    )?.[1];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!guildId || !messageId || !userId) {
      throw new BasePostEditInputError(
        "This base edit could not be identified. Please reopen Settings."
      );
    }

    const basePost = await getBasePost(guildId, messageId);
    if (!basePost) {
      throw new BasePostEditInputError("This base post is no longer available.");
    }

    const config = getConfig(guildId);
    if (
      !canEditBasePost(
        basePost,
        userId,
        interaction.member?.roles ?? [],
        config.ADMIN_ROLE
      )
    ) {
      throw new BasePostEditInputError(
        "Only the base builder or a server admin can edit this post."
      );
    }

    const components = interaction.data.components.flatMap((component) => {
      if (component.type === ComponentType.ActionRow) {
        return component.components;
      }
      if (component.type === ComponentType.Label) {
        return [component.component];
      }
      return [];
    });
    const baseLinkValue = getTextInput(components, "base_link");
    const clanCastle = getTextInput(components, "clan_castle");
    const notesInput = getTextInput(components, "notes");
    const selectedLeague = components.find(
      (component) => component.custom_id === "league"
    );
    if (
      !selectedLeague ||
      selectedLeague.type !== ComponentType.StringSelect ||
      !selectedLeague.values[0] ||
      !RECOMMENDED_LEAGUES.includes(selectedLeague.values[0])
    ) {
      throw new BasePostEditInputError("Choose a valid recommended league.");
    }
    const league = selectedLeague.values[0];
    const imageUpload = components.find(
      (component) =>
        component.custom_id === "image" &&
        component.type === ComponentType.FileUpload
    );
    const uploadedImageId =
      imageUpload?.type === ComponentType.FileUpload
        ? imageUpload.values[0]
        : undefined;
    const uploadedImage = uploadedImageId
      ? interaction.data.resolved?.attachments?.[uploadedImageId]
      : undefined;
    if (uploadedImageId && !uploadedImage) {
      throw new BasePostEditInputError(
        "I couldn't read the uploaded image. Please try uploading it again."
      );
    }

    const baseLink = validateBaseLink(baseLinkValue);
    let clanCastleTroops: ClanCastleTroop[];
    try {
      clanCastleTroops = parseClanCastleTroops(clanCastle);
    } catch (err) {
      if (err instanceof ClanCastleTroopInputError) {
        throw new BasePostEditInputError(err.message);
      }
      throw err;
    }

    const troopEmojiMap = loadClanCastleTroopEmojiMap();
    const clanCastleTroopEmojiIds: Record<string, string> = {};
    for (const { slug } of clanCastleTroops) {
      const emojiId = troopEmojiMap[slug];
      if (!emojiId) {
        throw new Error(`Missing ClashKing application emoji for ${slug}.`);
      }
      clanCastleTroopEmojiIds[slug] = emojiId;
    }

    const leagueEmojiId =
      loadBasePostLeagueEmojiMap()[getRecommendedLeagueEmojiKey(league)];
    if (!leagueEmojiId) {
      throw new Error(`Missing ClashKing application emoji for league "${league}".`);
    }

    const redirectBaseUrl = process.env.BASE_POST_REDIRECT_URL;
    if (!redirectBaseUrl) {
      throw new Error("No base-post redirect URL is configured.");
    }

    const updatedPost: BasePostRecord = {
      ...basePost,
      baseLink,
      clanCastle,
      clanCastleTroops,
      clanCastleTroopEmojiIds,
      league,
      leagueEmojiId,
      notes: notesInput.trim() || undefined,
    };
    const image = uploadedImage
      ? await downloadBaseImage(uploadedImage)
      : undefined;
    let messageUpdated = false;

    try {
      if (image) {
        const filename =
          image.extension === "jpg"
            ? BASE_POST_IMAGE_JPEG_FILENAME
            : BASE_POST_IMAGE_FILENAME;
        const postWithImage: BasePostRecord = {
          ...updatedPost,
          imageUrl: `attachment://${filename}`,
          imageAttachment: { id: "0", filename },
        };
        const payload = buildBasePostPayload(postWithImage, redirectBaseUrl);
        const formData = new FormData();
        formData.append("payload_json", JSON.stringify(payload));
        formData.append(
          "files[0]",
          new Blob([Buffer.from(image.bytes)], { type: image.contentType }),
          filename
        );
        const updatedMessage = await updateMessageWithAttachment(
          formData,
          basePost.channelId,
          basePost.messageId
        );
        messageUpdated = true;
        const uploadedAttachment = updatedMessage.attachments.find(
          (attachment) => attachment.filename === filename
        );
        if (!uploadedAttachment) {
          throw new Error("Discord did not return the replacement base image.");
        }
        updatedPost.imageUrl = `attachment://${filename}`;
        updatedPost.imageAttachment = {
          id: uploadedAttachment.id,
          filename,
        };
      } else {
        await updateMessage(
          basePost.channelId,
          basePost.messageId,
          buildBasePostPayload(updatedPost, redirectBaseUrl)
        );
        messageUpdated = true;
      }

      await saveEditableBasePostFields(guildId, updatedPost);
    } catch (err) {
      if (messageUpdated) {
        try {
          await updateMessage(
            basePost.channelId,
            basePost.messageId,
            buildBasePostPayload(basePost, redirectBaseUrl)
          );
        } catch (rollbackError) {
          console.error("Failed to roll back base-post message edit", rollbackError);
        }
      }
      throw err;
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: `Base #${basePost.baseId} has been updated.`,
    });
  } catch (err) {
    if (err instanceof BasePostEditInputError) {
      await respondToModal(interaction, err.message);
      return;
    }

    console.error("Failed to edit base post", err);
    await respondToModal(
      interaction,
      "I couldn't update this base post. Please try again or contact an admin."
    );
  }
};

const getBasePost = async (
  guildId: string,
  messageId: string
): Promise<BasePostRecord | null> => {
  const result = await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: `base-post#${messageId}`,
      },
      ConsistentRead: true,
    })
  );
  return isBasePostRecord(result.Item) ? result.Item : null;
};

const getTextInput = (
  components: ModalSubmitComponent[],
  customId: string
): string => {
  const input = components.find(
    (component) => component.custom_id === customId
  );
  if (!input || input.type !== ComponentType.TextInput) {
    throw new BasePostEditInputError(
      "A required setting was missing. Please reopen Settings."
    );
  }
  return input.value;
};

const validateBaseLink = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BasePostEditInputError(
      "Please provide a valid Clash of Clans base link."
    );
  }
  if (url.protocol !== "https:" || url.hostname !== "link.clashofclans.com") {
    throw new BasePostEditInputError(
      "The base link must be an HTTPS link from link.clashofclans.com."
    );
  }
  return url.toString();
};

const downloadBaseImage = async (
  attachment: APIAttachment
): Promise<{
  bytes: Uint8Array;
  contentType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
}> => {
  if (
    attachment.size > MAX_BASE_IMAGE_SIZE ||
    (!attachment.filename.toLowerCase().endsWith(".png") &&
      !/\.(jpe?g)$/i.test(attachment.filename))
  ) {
    throw new BasePostEditInputError(
      "The replacement image must be a PNG or JPEG no larger than 20 MB."
    );
  }

  const url = new URL(attachment.url);
  if (url.protocol !== "https:" || !DISCORD_ATTACHMENT_HOSTS.has(url.hostname)) {
    throw new Error("Unexpected host for a Discord-uploaded attachment.");
  }

  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) {
    throw new Error(
      `Failed to download the replacement image (HTTP ${response.status}).`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BASE_IMAGE_SIZE) {
    throw new BasePostEditInputError(
      "The replacement image must be no larger than 20 MB."
    );
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { bytes, contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { bytes, contentType: "image/jpeg", extension: "jpg" };
  }
  throw new BasePostEditInputError(
    "The replacement image must be a valid PNG or JPEG."
  );
};

const saveEditableBasePostFields = async (
  guildId: string,
  basePost: BasePostRecord
): Promise<void> => {
  const setExpressions = [
    "#baseLink = :baseLink",
    "#clanCastle = :clanCastle",
    "#clanCastleTroops = :clanCastleTroops",
    "#clanCastleTroopEmojiIds = :clanCastleTroopEmojiIds",
    "#league = :league",
    "#leagueEmojiId = :leagueEmojiId",
    "#imageUrl = :imageUrl",
  ];
  const removeExpressions: string[] = [];
  const names: Record<string, string> = {
    "#baseLink": "baseLink",
    "#clanCastle": "clanCastle",
    "#clanCastleTroops": "clanCastleTroops",
    "#clanCastleTroopEmojiIds": "clanCastleTroopEmojiIds",
    "#league": "league",
    "#leagueEmojiId": "leagueEmojiId",
    "#imageUrl": "imageUrl",
    "#notes": "notes",
  };
  const values: Record<string, unknown> = {
    ":baseLink": basePost.baseLink,
    ":clanCastle": basePost.clanCastle,
    ":clanCastleTroops": basePost.clanCastleTroops,
    ":clanCastleTroopEmojiIds": basePost.clanCastleTroopEmojiIds,
    ":league": basePost.league,
    ":leagueEmojiId": basePost.leagueEmojiId,
    ":imageUrl": basePost.imageUrl,
  };

  if (basePost.imageAttachment) {
    setExpressions.push("#imageAttachment = :imageAttachment");
    names["#imageAttachment"] = "imageAttachment";
    values[":imageAttachment"] = basePost.imageAttachment;
  }
  if (basePost.notes) {
    setExpressions.push("#notes = :notes");
    values[":notes"] = basePost.notes;
  } else {
    removeExpressions.push("#notes");
  }

  await dynamoDbClient.send(
    new UpdateCommand({
      TableName: "BotTable",
      Key: {
        pk: guildId,
        sk: `base-post#${basePost.messageId}`,
      },
      UpdateExpression: [
        `SET ${setExpressions.join(", ")}`,
        ...(removeExpressions.length
          ? [`REMOVE ${removeExpressions.join(", ")}`]
          : []),
      ].join(" "),
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
};

const respondToModal = async (
  interaction: APIModalSubmitInteraction,
  content: string
): Promise<void> => {
  try {
    await updateResponse(interaction.application_id, interaction.token, {
      content,
    });
  } catch (err) {
    console.error("Failed to send base-post edit response", err);
  }
};

const ephemeralResponse = (content: string): APIInteractionResponse => ({
  type: InteractionResponseType.ChannelMessageWithSource,
  data: {
    content,
    flags: MessageFlags.Ephemeral,
  },
});

class BasePostEditInputError extends Error {}
