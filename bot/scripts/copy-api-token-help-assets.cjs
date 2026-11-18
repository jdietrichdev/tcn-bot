const fs = require("node:fs");
const path = require("node:path");

const sourceDirectory = path.join(__dirname, "..", "assets", "api-token-help");
const outputDirectory = path.join(__dirname, "..", "dist", "api-token-help");

fs.mkdirSync(outputDirectory, { recursive: true });

for (const filename of [
  "api-token-more-settings.png",
  "api-token-show.png",
]) {
  const sourcePath = path.join(sourceDirectory, filename);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing API-token help image: ${sourcePath}`);
  }
  fs.copyFileSync(sourcePath, path.join(outputDirectory, filename));
}
