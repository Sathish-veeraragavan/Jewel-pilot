import { createClient } from "@supabase/supabase-js";
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || "",
  env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function run() {
  try {
    // Let's call /api/media to see if both exist, or we can check the R2 bucket directly
    // Wait, let's just make a fetch request to both local paths using processes or http requests.
    // Or we can check if they exist in R2 bucket using S3 Client if configured.
    console.log("Checking R2 storage configuration...");
    console.log("R2 Bucket:", env.CLOUDFLARE_R2_BUCKET_NAME);
  } catch (err) {
    console.error(err);
  }
}

run();
