const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const { data: jobs, error } = await supabase
      .from("render_jobs")
      .select(`
        id, shop_id, status, error_message, created_at,
        templates(id, name, config)
      `)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Error fetching jobs:", error);
      return;
    }

    console.log("Recent Render Jobs:");
    for (const job of jobs) {
      console.log(`\n-------------------------------------`);
      console.log(`Job ID: ${job.id}`);
      console.log(`Status: ${job.status}`);
      console.log(`Error: ${job.error_message}`);
      console.log(`Template Name: ${job.templates?.name}`);
      console.log(`Config elements count: ${job.templates?.config?.elements?.length || 0}`);
      
      const { data: logs, error: logsErr } = await supabase
        .from("render_job_logs")
        .select("created_at, message")
        .eq("render_job_id", job.id)
        .order("created_at", { ascending: true });

      if (logsErr) {
        console.error("Error fetching logs for job:", logsErr);
      } else {
        console.log("Logs:");
        logs.forEach(l => console.log(`  [${l.created_at}] ${l.message}`));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
