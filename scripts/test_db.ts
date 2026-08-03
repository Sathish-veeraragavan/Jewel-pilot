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
  console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);
  
  try {
    console.log("\nTesting shops query...");
    const shopsRes = await supabase.from("shops").select("id, name, shop_code, district_id, status, outro_video_url").eq("status", "active");
    if (shopsRes.error) console.error("Shops error:", shopsRes.error);
    else console.log("Shops success:", shopsRes.data.length, "items");

    console.log("\nTesting schedules query...");
    const schedulesRes = await supabase.from("schedules").select(`
      id, shop_id, video_id, template_id, occasion_id, audio_track_id, scheduled_date, status,
      videos(id, title, category),
      templates(id, name, template_type, outro_url),
      occasions(id, name),
      music_tracks:audio_track_id(id, title)
    `).limit(5);
    if (schedulesRes.error) console.error("Schedules error:", schedulesRes.error);
    else console.log("Schedules success:", schedulesRes.data?.length, "items");

    console.log("\nTesting templates query...");
    const templatesRes = await supabase.from("templates").select("id, name, template_type, outro_url").eq("status", "active");
    if (templatesRes.error) console.error("Templates error:", templatesRes.error);
    else console.log("Templates success:", templatesRes.data.length, "items");

    console.log("\nTesting system_settings query...");
    const settingsRes = await supabase.from("system_settings").select("setting_key, value").like("setting_key", "outro_video_%");
    if (settingsRes.error) console.error("Settings error:", settingsRes.error);
    else console.log("Settings success:", settingsRes.data.length, "items");

  } catch (err) {
    console.error("Caught error:", err);
  }
}

run();
