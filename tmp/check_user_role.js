const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    // 1. Fetch user by email
    const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) {
      console.error(usersErr);
      return;
    }

    const targetUser = users.find(u => u.email === "sankarsrs2000@gmail.com");
    if (!targetUser) {
      console.log("User not found!");
      return;
    }

    console.log("User ID:", targetUser.id);
    console.log("Email:", targetUser.email);
    console.log("App Metadata Role:", targetUser.app_metadata?.role);
    console.log("User Metadata Role:", targetUser.user_metadata?.role);

    // 2. Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetUser.id)
      .maybeSingle();

    if (profErr) {
      console.error(profErr);
    } else {
      console.log("Profile DB Record:", profile);
    }

  } catch (err) {
    console.error(err);
  }
}

run();
