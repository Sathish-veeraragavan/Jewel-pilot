const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const sivaProfileId = "a088583e-dba2-4e83-bc50-7e50a5b82350";
    const sivaShopId = "9222319f-0df5-4828-ba1b-17d2705d224a";

    const { data, error } = await supabase
      .from("profiles")
      .update({ shop_id: sivaShopId })
      .eq("id", sivaProfileId)
      .select();

    if (error) {
      console.error("Update failed:", error);
    } else {
      console.log("Update succeeded! Profile updated:", data);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
