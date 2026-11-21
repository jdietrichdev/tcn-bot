const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const API_BASE_URL = "https://discord.com/api/v10";
const SOURCE_DIRECTORY = path.resolve(
  __dirname,
  "../../ui/public/clashking-assets/troops"
);
const LEAGUE_SOURCE_DIRECTORY = path.resolve(
  __dirname,
  "../../ui/public/clashking-assets/leagues"
);
const TOWN_HALL_SOURCE_DIRECTORY = path.resolve(
  __dirname,
  "../../ui/public/clashking-assets/buildings/home-village/town_hall"
);
const TROOP_OUTPUT_PATH = path.resolve(
  __dirname,
  "../dist/clashking-troop-emojis.json"
);
const LEAGUE_OUTPUT_PATH = path.resolve(
  __dirname,
  "../dist/clashking-league-emojis.json"
);
const TOWN_HALL_OUTPUT_PATH = path.resolve(
  __dirname,
  "../dist/clashking-town-hall-emojis.json"
);
const LEAGUE_EMOJI_ASSETS = {
  legends_1: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "league-tier",
    "legend_league_1.png"
  ),
  legends_2: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "league-tier",
    "legend_league_2.png"
  ),
  legends_3: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "league-tier",
    "legend_league_3.png"
  ),
  legends_2_3: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "league-tier",
    "legend_league.png"
  ),
  cwl: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "cwl",
    "champion_league_1.png"
  ),
  titan_1_cwl: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "cwl",
    "titan_league_1.png"
  ),
  titan_2_cwl: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "cwl",
    "titan_league_2.png"
  ),
  titan_3_cwl: path.join(
    LEAGUE_SOURCE_DIRECTORY,
    "cwl",
    "titan_league_3.png"
  ),
};
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

const syncEmoji = async (
  emojiEndpoint,
  emojiName,
  sourcePath,
  existingEmojis
) => {
  let emojiId = existingEmojis.get(emojiName);
  if (emojiId) {
    return emojiId;
  }

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
  return emojiId;
};

const syncBasePostEmojis = async () => {
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

    const emojiName = `cc_${troopDirectory.name}`;
    emojiIds[troopDirectory.name] = await syncEmoji(
      emojiEndpoint,
      emojiName,
      path.join(troopDirectoryPath, "icon.webp"),
      existingEmojis
    );
  }

  if (!Object.keys(emojiIds).length) {
    throw new Error(`No troop icons were found in ${SOURCE_DIRECTORY}.`);
  }

  const leagueEmojiIds = {};
  for (const [emojiKey, sourcePath] of Object.entries(LEAGUE_EMOJI_ASSETS)) {
    leagueEmojiIds[emojiKey] = await syncEmoji(
      emojiEndpoint,
      `league_${emojiKey}`,
      sourcePath,
      existingEmojis
    );
  }

  const townHallEmojiIds = {};
  for (let level = 1; level <= 19; level += 1) {
    townHallEmojiIds[level] = await syncEmoji(
      emojiEndpoint,
      `town_hall_${level}`,
      path.join(TOWN_HALL_SOURCE_DIRECTORY, `level_${level}.webp`),
      existingEmojis
    );
  }

  await fs.mkdir(path.dirname(TROOP_OUTPUT_PATH), { recursive: true });
  await Promise.all([
    fs.writeFile(
      TROOP_OUTPUT_PATH,
      `${JSON.stringify(emojiIds, null, 2)}\n`,
      "utf8"
    ),
    fs.writeFile(
      LEAGUE_OUTPUT_PATH,
      `${JSON.stringify(leagueEmojiIds, null, 2)}\n`,
      "utf8"
    ),
    fs.writeFile(
      TOWN_HALL_OUTPUT_PATH,
      `${JSON.stringify(townHallEmojiIds, null, 2)}\n`,
      "utf8"
    ),
  ]);
  console.log(
    `Synced ${Object.keys(emojiIds).length} troop, ${Object.keys(leagueEmojiIds).length} league, and ${Object.keys(townHallEmojiIds).length} Town Hall application emojis.`
  );
};

syncBasePostEmojis().catch((error) => {
  console.error("Failed to sync ClashKing application emojis.", error);
  process.exitCode = 1;
});
