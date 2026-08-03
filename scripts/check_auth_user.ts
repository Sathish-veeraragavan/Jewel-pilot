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
  const userId = "368d9f0f-cb40-4249-8b2a-14d9e91e81b9"; // Sankar
  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.error(error);
    } else {
      console.log("Auth User Details:", user);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
