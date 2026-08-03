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
    console.log("--- LATEST RENDER JOBS ---");
    const { data: jobs, error: jobsErr } = await supabase
      .from("render_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (jobsErr) console.error("Jobs error:", jobsErr);
    else console.log(JSON.stringify(jobs, null, 2));

    console.log("\n--- ACTIVE QUEUE ---");
    const { data: queue, error: queueErr } = await supabase
      .from("render_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (queueErr) console.error("Queue error:", queueErr);
    else console.log(JSON.stringify(queue, null, 2));

    console.log("\n--- LATEST LOGS ---");
    const { data: logs, error: logsErr } = await supabase
      .from("render_job_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (logsErr) console.error("Logs error:", logsErr);
    else console.log(JSON.stringify(logs, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
