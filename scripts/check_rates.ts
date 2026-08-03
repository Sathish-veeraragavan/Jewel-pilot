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
    const dateStr = "2026-07-25";
    console.log("Checking gold rates for date:", dateStr);
    const { data: rates, error } = await supabase
      .from("gold_rates")
      .select("*")
      .eq("rate_date", dateStr);
    
    if (error) console.error("Rates error:", error);
    else console.log("Rates found:", JSON.stringify(rates, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
