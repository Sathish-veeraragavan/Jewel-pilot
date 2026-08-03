import { uploadToR2 } from "../src/utils/r2";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
});

// Set process.env variables so src/utils/r2.ts can read them
Object.keys(env).forEach((k) => {
  process.env[k] = env[k];
});

async function run() {
  const presetsDir = path.resolve(process.cwd(), "public/presets");
  const filesToUpload = [
    { filePath: path.resolve(process.cwd(), "public/916_bis_huid_badge.png"), name: "916_bis_huid_badge.png" },
    { filePath: path.resolve(presetsDir, "circle_blue_gold_border.png"), name: "circle_blue_gold_border.png" },
    { filePath: path.resolve(presetsDir, "circle_green_gold_border.png"), name: "circle_green_gold_border.png" },
    { filePath: path.resolve(presetsDir, "circle_red_gold_border.png"), name: "circle_red_gold_border.png" },
    { filePath: path.resolve(presetsDir, "rect_blue_gold_border.png"), name: "rect_blue_gold_border.png" },
    { filePath: path.resolve(presetsDir, "rect_green_gold_border.png"), name: "rect_green_gold_border.png" },
    { filePath: path.resolve(presetsDir, "rect_maroon_gold_border.png"), name: "rect_maroon_gold_border.png" },
    { filePath: path.resolve(presetsDir, "pill_blue_gold_border.png"), name: "pill_blue_gold_border.png" },
    { filePath: path.resolve(presetsDir, "pill_pink_gold_border.png"), name: "pill_pink_gold_border.png" },
    { filePath: path.resolve(presetsDir, "pill_purple_gold_border.png"), name: "pill_purple_gold_border.png" },
    { filePath: path.resolve(presetsDir, "pill_green_gold_border.png"), name: "pill_green_gold_border.png" },
    { filePath: path.resolve(presetsDir, "bracket_blue_gold.png"), name: "bracket_blue_gold.png" },
    { filePath: path.resolve(presetsDir, "bracket_pink_gold.png"), name: "bracket_pink_gold.png" },
    { filePath: path.resolve(presetsDir, "bracket_purple_gold.png"), name: "bracket_purple_gold.png" },
    { filePath: path.resolve(presetsDir, "bracket_green_gold.png"), name: "bracket_green_gold.png" },
    { filePath: path.resolve(presetsDir, "bracket_maroon_gold.png"), name: "bracket_maroon_gold.png" },
    { filePath: path.resolve(presetsDir, "gold_purity_banner.png"), name: "gold_purity_banner.png" },
    { filePath: path.resolve(presetsDir, "elegant_gold_divider.png"), name: "elegant_gold_divider.png" }
  ];

  console.log("Seeding preset icons/shapes into R2 bucket...");
  
  for (const file of filesToUpload) {
    if (!fs.existsSync(file.filePath)) {
      console.warn(`File does not exist: ${file.filePath}`);
      continue;
    }

    try {
      const buffer = fs.readFileSync(file.filePath);
      const url = await uploadToR2(buffer, file.name, "image/png", "template-icons");
      console.log(`Uploaded preset ${file.name} successfully -> ${url}`);
    } catch (err) {
      console.error(`Failed to upload ${file.name}:`, err);
    }
  }

  console.log("Presets seeding finished!");
}

run();
