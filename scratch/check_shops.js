const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://sxbnspiypppekllswqey.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Ym5zcGl5cHBwZWtsbHN3cWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM2MTMyNywiZXhwIjoyMDk5OTM3MzI3fQ.fjlzYMuXxTfe2GauvbG9kzwL1ttucZVKohYJGBfRV3A"
);

async function check() {
  try {
    const { data: shops, error: errShops } = await supabase
      .from("shops")
      .select("id, name, deleted_at");
    
    if (errShops) throw errShops;
    console.log("Shops found in database:", shops);
  } catch (e) {
    console.error("Error fetching shops:", e);
  }
}

check();
