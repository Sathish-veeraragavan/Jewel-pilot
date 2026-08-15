const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Manual env parser
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Checking active render jobs...");
  const { data: processingJobs, error: err } = await supabase
    .from("render_jobs")
    .select("id, status, error_message, created_at, shop_id, video_library_id, is_demo, demo_metadata")
    .eq("status", "Processing");

  if (err) {
    console.error("Error fetching jobs:", err);
    return;
  }

  console.log(`Found ${processingJobs.length} processing jobs:`);
  console.log(JSON.stringify(processingJobs, null, 2));

  if (processingJobs.length > 0) {
    console.log("Resetting processing jobs to 'Failed' so pending jobs can start...");
    for (const job of processingJobs) {
      // Update job status to Failed
      const { error: updErr } = await supabase
        .from("render_jobs")
        .update({ 
          status: "Failed", 
          error_message: "Stuck in processing - auto reset by admin script." 
        })
        .eq("id", job.id);

      if (updErr) {
        console.error(`Failed to reset job ${job.id}:`, updErr);
      } else {
        console.log(`Job ${job.id} reset to Failed successfully.`);
      }

      // Also reset queue status
      const { error: qErr } = await supabase
        .from("render_queue")
        .update({ status: "Failed" })
        .eq("render_job_id", job.id);

      if (qErr) {
        console.error(`Failed to reset queue status for job ${job.id}:`, qErr);
      }
    }
  } else {
    console.log("No stuck jobs found.");
  }
}

run();
