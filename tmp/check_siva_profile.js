const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    // 1. Fetch Siva's profile
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .ilike("name", "%siva%");
      
    if (profErr) {
      console.error(profErr);
      return;
    }
    
    console.log("Profiles matching 'siva':", profiles);
    
    if (profiles.length === 0) return;
    
    const sivaProfile = profiles[0];
    
    // 2. Fetch shops matching siva's email or name
    const { data: shopsByEmail, error: shopEmailErr } = await supabase
      .from("shops")
      .select("*")
      .ilike("owner_name", "%siva%");
      
    if (shopEmailErr) {
      console.error(shopEmailErr);
    } else {
      console.log("Shops matching owner name 'siva':", shopsByEmail);
    }

    // 3. Let's check if there's any shop created by/assigned to a user with email siva
    // Wait, let's list all shops to see if there is any shop that doesn't have an owner but should
    const { data: allShops, error: allShopsErr } = await supabase
      .from("shops")
      .select("id, name, owner_name, shop_code, status");
      
    if (allShopsErr) {
      console.error(allShopsErr);
    } else {
      console.log("All Shops:", allShops);
    }

  } catch (err) {
    console.error(err);
  }
}

run();
