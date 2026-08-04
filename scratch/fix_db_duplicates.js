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
  console.log("Fetching all downloads to find referenced schedule IDs...");
  const { data: downloads, error: dlErr } = await supabase
    .from("downloads")
    .select("schedule_id");

  if (dlErr) {
    console.error("Error fetching downloads:", dlErr);
    return;
  }

  const referencedIds = new Set((downloads || []).map(dl => dl.schedule_id));
  console.log(`Found ${referencedIds.size} unique schedule IDs referenced in downloads.`);

  console.log("Fetching all schedules...");
  const { data: schedules, error } = await supabase
    .from("schedules")
    .select("id, shop_id, scheduled_date, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching schedules:", error);
    return;
  }

  // Group schedules by shop_id + scheduled_date
  const groups = new Map();
  schedules.forEach((s) => {
    const key = `${s.shop_id}_${s.scheduled_date}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(s);
  });

  const duplicateIds = [];

  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      console.log(`Found ${list.length} duplicates for ${key}`);
      
      // Determine which one to keep:
      // Try to find one that is referenced in downloads
      let keepIndex = list.findIndex(s => referencedIds.has(s.id));
      
      // If none is referenced, keep the newest one (index 0 because we ordered by created_at DESC)
      if (keepIndex === -1) {
        keepIndex = 0;
      }

      console.log(`Keeping schedule ID: ${list[keepIndex].id}`);

      // All others in the list are duplicates to delete
      list.forEach((s, idx) => {
        if (idx !== keepIndex) {
          duplicateIds.push(s.id);
        }
      });
    }
  }

  console.log(`Found ${duplicateIds.length} duplicate schedules to remove.`);

  if (duplicateIds.length > 0) {
    const { data: deleted, error: delErr } = await supabase
      .from("schedules")
      .delete()
      .in("id", duplicateIds)
      .select();

    if (delErr) {
      console.error("Error deleting duplicates:", delErr);
    } else {
      console.log(`Successfully deleted ${deleted ? deleted.length : duplicateIds.length} duplicate schedules.`);
    }
  }

  console.log("Cleanup complete!");
}

run();
