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
  const shopId = "7437df5f-d70d-47a3-a271-1249fe873497";
  try {
    const newLogoUrl = `/api/media/logos/SHOP-10409_logo.png?v=${Date.now()}`;
    const { data, error } = await supabase
      .from("shops")
      .update({ logo_url: newLogoUrl })
      .eq("id", shopId)
      .select();

    if (error) {
      console.error("Error updating logo_url:", error);
    } else {
      console.log("Successfully updated logo_url to PNG for Thulir Jewellers:", data);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
