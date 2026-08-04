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
  const { data, error } = await supabase.from("videos").select("category");
  if (error) {
    console.error("Error:", error);
  } else {
    const cats = Array.from(new Set(data.map(v => v.category)));
    console.log("Categories in DB:", cats);
  }
}

run();
