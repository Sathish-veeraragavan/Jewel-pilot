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
  const targetEmail = "sankarsrs2000@gmail.com";
  try {
    // 1. Search in profiles table
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", targetEmail)
      .maybeSingle();

    if (profErr) {
      console.error("Error querying profile:", profErr);
    } else if (profile) {
      console.log("Found profile:", profile);
    } else {
      console.log("No profile found for email:", targetEmail);
    }

    // 2. List all admins to see roles
    const { data: admins } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["admin", "super_admin"]);

    console.log("Existing admins in system:", admins);
  } catch (err) {
    console.error(err);
  }
}

run();
