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
    const { data: jobs } = await supabase
      .from("render_jobs")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(3);

    console.log("Latest 3 Jobs for Thulir Jewellers:", jobs);
  } catch (err) {
    console.error(err);
  }
}

run();
