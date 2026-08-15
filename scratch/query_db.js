const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
});

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = env["SUPABASE_SERVICE_ROLE_KEY"];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("--- Querying 5 Recent Render Jobs ---");
    const { data: jobs, error: errJobs } = await supabase
      .from("render_jobs")
      .select("id, job_number, status, created_at, error_message, worker_id")
      .order("created_at", { ascending: false })
      .limit(5);

    if (errJobs) throw errJobs;
    console.log("Recent Jobs:", JSON.stringify(jobs, null, 2));

    if (jobs && jobs.length > 0) {
      const latestJobId = jobs[0].id;
      console.log(`\n--- Logs for Latest Job ID: ${latestJobId} ---`);
      const { data: logs, error: errLogs } = await supabase
        .from("render_job_logs")
        .select("created_at, log_level, message")
        .eq("render_job_id", latestJobId)
        .order("created_at", { ascending: true });

      if (errLogs) throw errLogs;
      console.log(JSON.stringify(logs, null, 2));
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
