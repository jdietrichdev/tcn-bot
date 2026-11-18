import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { updateResponseWithAttachment } from "../adapters/discord-adapter";

const TOKEN_GUIDE_IMAGES = [
  {
    filename: "api-token-more-settings.png",
    title: "1. Open More Settings",
    description: "Tap your profile in the top-left, open Settings, then tap More Settings.",
  },
  {
    filename: "api-token-show.png",
    title: "2. Show your API token",
    description: "Scroll to API Token, tap Show, then copy your token.",
  },
] as const;

export const handleApiTokenHelp = async (
  interaction: APIChatInputApplicationCommandInteraction
): Promise<void> => {
  const formData = new FormData();
  const embeds = TOKEN_GUIDE_IMAGES.map(({ filename, title, description }, index) => {
    const imagePath = getGuideImagePath(filename);
    const imageBuffer = readFileSync(imagePath);
    const imageArrayBuffer = new ArrayBuffer(imageBuffer.byteLength);
    new Uint8Array(imageArrayBuffer).set(imageBuffer);
    formData.append(
      `files[${index}]`,
      new Blob([imageArrayBuffer], { type: "image/png" }),
      filename
    );

    return {
      title,
      description,
      image: { url: `attachment://${filename}` },
      color: 0x551a8b,
    };
  });

  formData.append(
    "payload_json",
    JSON.stringify({
      content:
        "In Clash of Clans, tap your profile (top-left) > Settings > More Settings > API Token > Show, then copy it. Keep your token private.",
      embeds,
    })
  );
  await updateResponseWithAttachment(
    interaction.application_id,
    interaction.token,
    formData
  );
};

const getGuideImagePath = (filename: string): string => {
  const candidates = [
    path.join(process.cwd(), "api-token-help", filename),
    path.join(process.cwd(), "assets", "api-token-help", filename),
    path.join(process.cwd(), "dist", "api-token-help", filename),
    path.join(process.cwd(), "bot", "dist", "api-token-help", filename),
  ];
  const imagePath = candidates.find(existsSync);
  if (!imagePath) {
    throw new Error(
      `Missing ${filename}; rebuild the bot package to include API-token help images.`
    );
  }
  return imagePath;
};
