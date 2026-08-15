const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  "https://sxbnspiypppekllswqey.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Ym5zcGl5cHBwZWtsbHN3cWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM2MTMyNywiZXhwIjoyMDk5OTM3MzI3fQ.fjlzYMuXxTfe2GauvbG9kzwL1ttucZVKohYJGBfRV3A"
);

async function test() {
  try {
    console.log("Fetching shops...");
    const { data: shops, error: shopsErr } = await supabaseAdmin
      .from("shops")
      .select(`
        id,
        name,
        owner_name,
        created_at,
        city,
        states(name),
        districts(name),
        subscriptions(plan, renewal_date, end_date)
      `)
      .is("deleted_at", null);

    if (shopsErr) throw shopsErr;
    console.log("Success! Shops fetched:", shops.length);

    console.log("Fetching collections, expenses, reserves, settlements...");
    const [
      { data: collections, error: collErr },
      { data: expenses, error: expErr },
      { data: reserves, error: resErr },
      { data: settlements, error: setErr }
    ] = await Promise.all([
      supabaseAdmin.from("finance_collections").select(`*, profiles!created_by(name)`),
      supabaseAdmin.from("finance_expenses").select(`*, profiles!created_by(name)`),
      supabaseAdmin.from("finance_reserves").select(`*, profiles!created_by(name)`),
      supabaseAdmin.from("finance_settlements").select(`*, profiles!created_by(name)`)
    ]);

    if (collErr) throw collErr;
    if (expErr) throw expErr;
    if (resErr) throw resErr;
    if (setErr) throw setErr;
    console.log("All finance records fetched successfully!");

  } catch (err) {
    console.error("GET test error:", err);
  }
}

test();
