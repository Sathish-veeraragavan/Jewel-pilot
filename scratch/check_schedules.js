const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

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
  env.NEXT_PUBLIC_SUPABASE_URL || "",
  env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function run() {
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name")
    .eq("name", "SHASTHAVU JEWELLERY")
    .single();

  if (!shop) {
    console.log("Shop not found");
    return;
  }

  console.log("Shop:", shop);

  const { data: schedules } = await supabase
    .from("schedules")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("scheduled_date", "2026-08-04");

  console.log("Schedules on 2026-08-04:", schedules);
}

run();
