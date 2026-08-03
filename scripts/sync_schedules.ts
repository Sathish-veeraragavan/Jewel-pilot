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
    console.log("Fetching completed render jobs...");
    const { data: jobs, error } = await supabase
      .from("render_jobs")
      .select("*")
      .eq("status", "Completed");

    if (error) {
      console.error("Error fetching jobs:", error);
      return;
    }

    console.log(`Found ${jobs.length} completed render jobs. Syncing to schedules table...`);

    for (const job of jobs) {
      const scheduledDate = job.scheduled_at 
        ? new Date(job.scheduled_at).toISOString().split("T")[0] 
        : new Date().toISOString().split("T")[0];

      console.log(`Syncing Job #${job.job_number} (Shop: ${job.shop_id}, Date: ${scheduledDate})...`);
      
      const { data: updated, error: syncErr } = await supabase
        .from("schedules")
        .update({
          render_status: "completed",
          rendered_video_url: job.rendered_video_url
        })
        .eq("shop_id", job.shop_id)
        .eq("template_id", job.template_id)
        .eq("video_id", job.video_library_id)
        .eq("scheduled_date", scheduledDate)
        .select();

      if (syncErr) {
        console.error(`Sync error for job #${job.job_number}:`, syncErr);
      } else {
        console.log(`Sync success: updated ${updated?.length || 0} schedules rows.`);
      }
    }

    console.log("Sync script finished!");
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
