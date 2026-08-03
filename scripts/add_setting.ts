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
    const { error } = await supabase
      .from("system_settings")
      .upsert([
        { 
          setting_key: "vps_cleanup_time", 
          value: "21:00", 
          description: "Daily time in IST (HH:MM) to run VPS downloads purge" 
        }
      ], { onConflict: "setting_key" });
    
    if (error) console.error("Error adding setting:", error);
    else console.log("Successfully seeded vps_cleanup_time in system_settings!");
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
