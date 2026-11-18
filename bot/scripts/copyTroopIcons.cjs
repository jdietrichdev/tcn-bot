const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const sourceDirectory = path.resolve(
  __dirname,
  "../../ui/public/clashking-assets/troops"
);
const outputDirectory = path.resolve(__dirname, "../dist/clashking-troops");
const iconSize = 24;

const copyTroopIcons = async () => {
  const troopDirectories = await fs.readdir(sourceDirectory, {
    withFileTypes: true,
  });
  await fs.rm(outputDirectory, { recursive: true, force: true });
  await fs.mkdir(outputDirectory, { recursive: true });

  let iconCount = 0;
  for (const troopDirectory of troopDirectories) {
    if (!troopDirectory.isDirectory()) {
      continue;
    }

    const troopDirectoryPath = path.join(
      sourceDirectory,
      troopDirectory.name
    );
    const files = await fs.readdir(troopDirectoryPath);
    if (!files.includes("icon.webp")) {
      continue;
    }

    await sharp(path.join(troopDirectoryPath, "icon.webp"))
      .resize(iconSize, iconSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(outputDirectory, `${troopDirectory.name}.png`));
    iconCount += 1;
  }

  if (iconCount === 0) {
    throw new Error(`No troop icons were found in ${sourceDirectory}.`);
  }

  console.log(`Copied ${iconCount} ClashKing PNG icons into bot/dist.`);
};

copyTroopIcons().catch((error) => {
  console.error("Failed to prepare ClashKing troop icons.", error);
  process.exitCode = 1;
});
