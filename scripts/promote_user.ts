import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valParts] = trimmed.split("=");
        if (key && valParts.length > 0) {
          process.env[key.trim()] = valParts.join("=").trim();
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env credentials in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function promoteToSuperAdmin(email: string) {
  console.log(`Promoting ${email} to super_admin...`);

  // 1. Find profile in DB
  const { data: profiles, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .ilike("email", email.trim());

  if (profileErr) {
    console.error("Error querying profiles:", profileErr);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log(`No profile found matching email "${email}".`);
    process.exit(1);
  }

  const userProfile = profiles[0];

  // 2. Update DB profile role
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ role: "super_admin" })
    .eq("id", userProfile.id);

  if (updateErr) {
    console.error("Failed to update profile role:", updateErr);
    process.exit(1);
  }

  // 3. Update Auth User metadata & app_metadata
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userProfile.id, {
    user_metadata: { role: "super_admin" },
    app_metadata: { role: "super_admin" }
  });

  if (authErr) {
    console.error("Auth metadata update failed:", authErr);
  }

  console.log(`🎉 Successfully promoted ${userProfile.email} (ID: ${userProfile.id}) to super_admin in both Profiles DB & Auth Metadata!`);
}

const targetEmail = process.argv[2];
if (targetEmail) {
  promoteToSuperAdmin(targetEmail);
}
