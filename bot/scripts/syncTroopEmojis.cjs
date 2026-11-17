const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const API_BASE_URL = "https://discord.com/api/v10";
const SOURCE_DIRECTORY = path.resolve(
  __dirname,
  "../../ui/public/clashking-assets/troops"
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../dist/clashking-troop-emojis.json"
);
const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error("BOT_TOKEN is required to sync ClashKing application emojis.");
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const requestDiscord = async (endpoint, options = {}) => {
  let retries = 0;
  while (true) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bot ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 429 && retries < 5) {
      const body = await response.json();
      const retryAfter = Number(
        body.retry_after ?? response.headers.get("retry-after")
      );
      if (!Number.isFinite(retryAfter) || retryAfter < 0) {
        throw new Error("Discord returned an invalid rate-limit delay.");
      }
      retries += 1;
      await sleep(retryAfter * 1000 + 100);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Discord API request failed (${response.status}): ${await response.text()}`
      );
    }
    return response.json();
  }
};

const syncTroopEmojis = async () => {
  const application = await requestDiscord("/users/@me");
  if (!application.id) {
    throw new Error("Discord did not return the bot application ID.");
  }

  const emojiEndpoint = `/applications/${application.id}/emojis`;
  const response = await requestDiscord(emojiEndpoint);
  if (!Array.isArray(response.items)) {
    throw new Error("Discord returned an invalid application emoji list.");
  }
  const existingEmojis = new Map(
    response.items.map(({ name, id }) => [name, id])
  );

  const troopDirectories = await fs.readdir(SOURCE_DIRECTORY, {
    withFileTypes: true,
  });
  const emojiIds = {};
  for (const troopDirectory of troopDirectories) {
    if (!troopDirectory.isDirectory()) {
      continue;
    }

    const troopDirectoryPath = path.join(
      SOURCE_DIRECTORY,
      troopDirectory.name
    );
    const files = await fs.readdir(troopDirectoryPath);
    if (!files.includes("icon.webp")) {
      continue;
    }

    const sourcePath = path.join(troopDirectoryPath, "icon.webp");
    const emojiName = `cc_${troopDirectory.name}`;
    let emojiId = existingEmojis.get(emojiName);
    if (!emojiId) {
      const image = await sharp(sourcePath)
        .resize(128, 128, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      if (image.length > 256 * 1024) {
        throw new Error(`${emojiName} exceeds Discord's 256 KiB emoji limit.`);
      }
      const emoji = await requestDiscord(emojiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emojiName,
          image: `data:image/png;base64,${image.toString("base64")}`,
        }),
      });
      emojiId = emoji.id;
      if (typeof emojiId !== "string") {
        throw new Error(`Discord did not return an ID for ${emojiName}.`);
      }
      existingEmojis.set(emojiName, emojiId);
    }

    emojiIds[troopDirectory.name] = emojiId;
  }

  if (!Object.keys(emojiIds).length) {
    throw new Error(`No troop icons were found in ${SOURCE_DIRECTORY}.`);
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(emojiIds, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `Synced ${Object.keys(emojiIds).length} ClashKing application emojis.`
  );
};

syncTroopEmojis().catch((error) => {
  console.error("Failed to sync ClashKing application emojis.", error);
  process.exitCode = 1;
});
