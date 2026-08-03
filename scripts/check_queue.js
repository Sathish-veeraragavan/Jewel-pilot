const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envContent = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
    envVars[key] = value;
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: job } = await supabase
    .from("render_jobs")
    .select("template_id")
    .eq("id", "6f501381-1e1d-4276-904e-6e522e3081ff")
    .single();

  if (job) {
    const { data: template } = await supabase
      .from("templates")
      .select("*")
      .eq("id", job.template_id)
      .single();
    
    console.log("TEMPLATE CONFIG FOR THE JOB:", JSON.stringify(template.config, null, 2));
  } else {
    console.log("JOB NOT FOUND");
  }
}

check();
