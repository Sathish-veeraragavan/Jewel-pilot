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
  console.log("Listing recent render jobs...");
  const { data: recentJobs, error: err } = await supabase
    .from("render_jobs")
    .select("id, status, error_message, created_at, shop_id, video_library_id, is_demo, demo_metadata")
    .order("created_at", { ascending: false })
    .limit(10);

  if (err) {
    console.error("Error fetching jobs:", err);
    return;
  }

  console.log(JSON.stringify(recentJobs, null, 2));

  console.log("\nListing queue items...");
  const { data: queueItems, error: qErr } = await supabase
    .from("render_queue")
    .select("*")
    .order("priority", { ascending: false })
    .limit(10);

  if (qErr) {
    console.error("Error fetching queue:", qErr);
    return;
  }

  console.log(JSON.stringify(queueItems, null, 2));
}

run();
