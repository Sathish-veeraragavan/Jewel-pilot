import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Seed default master data if tables are empty
async function ensureMasterData(supabaseAdmin: any) {
  // 1. Seed Organizations
  const { data: orgs } = await supabaseAdmin.from("organizations").select("id").limit(1);
  if (!orgs || orgs.length === 0) {
    await supabaseAdmin.from("organizations").insert([
      { name: "Default Retailers Group" },
      { name: "Premium Retail Chains" }
    ]);
  }

  // 2. Seed Languages
  const { data: langs } = await supabaseAdmin.from("languages").select("id").limit(1);
  if (!langs || langs.length === 0) {
    await supabaseAdmin.from("languages").insert([
      { language_name: "English", locale: "en-IN" },
      { language_name: "Hindi", locale: "hi-IN" },
      { language_name: "Tamil", locale: "ta-IN" },
      { language_name: "Telugu", locale: "te-IN" },
      { language_name: "Kannada", locale: "kn-IN" },
      { language_name: "Malayalam", locale: "ml-IN" },
      { language_name: "Marathi", locale: "mr-IN" },
      { language_name: "Gujarati", locale: "gu-IN" },
      { language_name: "Bengali", locale: "bn-IN" }
    ]);
  }

  // 3. Seed States & Districts
  const { data: states } = await supabaseAdmin.from("states").select("id").limit(1);
  if (!states || states.length === 0) {
    const { data: insertedStates } = await supabaseAdmin.from("states").insert([
      { name: "Tamil Nadu", code: "TN" },
      { name: "Maharashtra", code: "MH" },
      { name: "Karnataka", code: "KA" },
      { name: "Gujarat", code: "GJ" },
      { name: "Telangana", code: "TS" },
      { name: "Delhi", code: "DL" }
    ]).select();

    if (insertedStates && insertedStates.length > 0) {
      const tn = insertedStates.find((s: any) => s.code === "TN");
      const mh = insertedStates.find((s: any) => s.code === "MH");
      const ka = insertedStates.find((s: any) => s.code === "KA");
      const gj = insertedStates.find((s: any) => s.code === "GJ");

      const districtInserts: any[] = [];
      if (tn) {
        districtInserts.push(
          { state_id: tn.id, name: "Chennai" },
          { state_id: tn.id, name: "Coimbatore" },
          { state_id: tn.id, name: "Madurai" },
          { state_id: tn.id, name: "Salem" },
          { state_id: tn.id, name: "Tiruchirappalli" }
        );
      }
      if (mh) {
        districtInserts.push(
          { state_id: mh.id, name: "Mumbai" },
          { state_id: mh.id, name: "Pune" },
          { state_id: mh.id, name: "Nagpur" },
          { state_id: mh.id, name: "Thane" }
        );
      }
      if (ka) {
        districtInserts.push(
          { state_id: ka.id, name: "Bengaluru Urban" },
          { state_id: ka.id, name: "Mysuru" },
          { state_id: ka.id, name: "Mangaluru" }
        );
      }
      if (gj) {
        districtInserts.push(
          { state_id: gj.id, name: "Ahmedabad" },
          { state_id: gj.id, name: "Surat" },
          { state_id: gj.id, name: "Vadodara" }
        );
      }
      if (districtInserts.length > 0) {
        await supabaseAdmin.from("districts").insert(districtInserts);
      }
    }
  }
}

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  await ensureMasterData(supabaseAdmin);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json({ error: "Missing type query parameter" }, { status: 400 });
  }

  try {
    if (type === "organizations") {
      const { data, error } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (type === "states") {
      const { data, error } = await supabaseAdmin
        .from("states")
        .select("id, name, code")
        .order("name", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (type === "districts") {
      const stateId = searchParams.get("state_id");
      let query = supabaseAdmin.from("districts").select("id, name, state_id");
      if (stateId) {
        query = query.eq("state_id", stateId);
      }
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (type === "languages") {
      const { data, error } = await supabaseAdmin
        .from("languages")
        .select("id, language_name, locale")
        .order("language_name", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (type === "occasions") {
      return NextResponse.json([
        { id: "occ-diwali", name: "Diwali & Festival Season" },
        { id: "occ-akshaya", name: "Akshaya Tritiya" },
        { id: "occ-wedding", name: "Bridal & Wedding Collection" },
        { id: "occ-pongal", name: "Pongal & New Year" },
        { id: "occ-daily", name: "Daily Gold Rate Promo" }
      ]);
    }

    if (type === "settings") {
      const { data, error } = await supabaseAdmin
        .from("system_settings")
        .select("*")
        .order("setting_key", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}
