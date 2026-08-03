import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Simple env parser
function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join("=").trim();
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.error("Error loading env:", e);
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Env keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplates() {
  const { data: templates, error } = await supabase
    .from("templates")
    .select("id, name, config, template_type")
    .limit(5);

  if (error) {
    console.error("Error fetching templates:", error);
    return;
  }

  console.log("Found Templates:");
  for (const t of templates) {
    console.log(`\n========================================`);
    console.log(`ID: ${t.id}`);
    console.log(`Name: ${t.name}`);
    console.log(`Type: ${t.template_type}`);
    console.log(`Elements:`);
    const elements = t.config?.elements || [];
    for (const el of elements) {
      console.log(`  - Type: ${el.type}, Name: ${el.name || ''}, Placeholder: ${el.placeholder || ''}`);
    }
  }
}

checkTemplates();
