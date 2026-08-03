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
  const targetId = "108ee97d-1b49-43e4-b0d9-7d2703412093";
  try {
    // Check schedules
    const { data: sched } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();

    if (sched) {
      console.log("Found in schedules table:", sched);
    } else {
      console.log("Not found in schedules.");
    }

    // Check render_jobs
    const { data: job } = await supabase
      .from("render_jobs")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();

    if (job) {
      console.log("Found in render_jobs table:", job);
    } else {
      console.log("Not found in render_jobs.");
    }
  } catch (err) {
    console.error(err);
  }
}

run();
