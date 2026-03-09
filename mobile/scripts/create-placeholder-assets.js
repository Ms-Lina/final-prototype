/**
 * Creates minimal valid PNG placeholders for icon, splash, and adaptive-icon
 * so EAS Prebuild can run. Replace these with real assets before release.
 */
const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "..", "assets");
// Minimal valid 1x1 green PNG (Expo/Android may resize)
const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const files = ["icon.png", "splash-icon.png", "adaptive-icon.png"];
for (const name of files) {
  const filePath = path.join(assetsDir, name);
  fs.writeFileSync(filePath, minimalPng);
  console.log("Created", filePath);
}
console.log("Done. Replace with proper 1024x1024 (icon/adaptive) and splash image for production.");
