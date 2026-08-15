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
  console.log("Checking job logs for 47bb60bc-89fa-4a40-b963-cfa383477e97...");
  const { data: logs, error: lErr } = await supabase
    .from("render_job_logs")
    .select("*")
    .eq("render_job_id", "47bb60bc-89fa-4a40-b963-cfa383477e97")
    .order("created_at", { ascending: true });

  if (lErr) {
    console.error(lErr);
  } else {
    console.log("Logs:", JSON.stringify(logs, null, 2));
  }

  console.log("\nChecking shop details for this job...");
  const { data: job } = await supabase
    .from("render_jobs")
    .select("shop_id")
    .eq("id", "47bb60bc-89fa-4a40-b963-cfa383477e97")
    .single();

  if (job && job.shop_id) {
    const { data: shop } = await supabase
      .from("shops")
      .select("name, logo_url")
      .eq("id", job.shop_id)
      .single();
    console.log("Shop Info:", JSON.stringify(shop, null, 2));
  }
}

run();
