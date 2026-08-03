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
    console.log("Fetching all profiles...");
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, role, name");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    console.log(`Found ${profiles.length} profiles. Syncing roles to Auth metadata...`);

    for (const profile of profiles) {
      console.log(`Syncing profile: ${profile.email} (Role: ${profile.role})`);
      
      const { data: user, error: userErr } = await supabase.auth.admin.getUserById(profile.id);
      if (userErr || !user) {
        console.error(`Could not find Auth user for ${profile.email}:`, userErr);
        continue;
      }

      // Update both app_metadata and user_metadata to guarantee access
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        profile.id,
        {
          app_metadata: { ...user.user.app_metadata, role: profile.role },
          user_metadata: { ...user.user.user_metadata, role: profile.role }
        }
      );

      if (updateErr) {
        console.error(`Failed to update Auth user for ${profile.email}:`, updateErr);
      } else {
        console.log(`Successfully synced Auth metadata for ${profile.email} ✓`);
      }
    }

    console.log("User metadata synchronization finished!");
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
