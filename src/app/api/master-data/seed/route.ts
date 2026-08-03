import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();

  // Verify authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Seed States & Union Territories
    const statesData = [
      { name: "Andhra Pradesh", code: "AP" },
      { name: "Arunachal Pradesh", code: "AR" },
      { name: "Assam", code: "AS" },
      { name: "Bihar", code: "BR" },
      { name: "Chhattisgarh", code: "CG" },
      { name: "Goa", code: "GA" },
      { name: "Gujarat", code: "GJ" },
      { name: "Haryana", code: "HR" },
      { name: "Himachal Pradesh", code: "HP" },
      { name: "Jharkhand", code: "JH" },
      { name: "Karnataka", code: "KA" },
      { name: "Kerala", code: "KL" },
      { name: "Madhya Pradesh", code: "MP" },
      { name: "Maharashtra", code: "MH" },
      { name: "Manipur", code: "MN" },
      { name: "Meghalaya", code: "ML" },
      { name: "Mizoram", code: "MZ" },
      { name: "Nagaland", code: "NL" },
      { name: "Odisha", code: "OD" },
      { name: "Punjab", code: "PB" },
      { name: "Rajasthan", code: "RJ" },
      { name: "Sikkim", code: "SK" },
      { name: "Tamil Nadu", code: "TN" },
      { name: "Telangana", code: "TG" },
      { name: "Tripura", code: "TR" },
      { name: "Uttar Pradesh", code: "UP" },
      { name: "Uttarakhand", code: "UK" },
      { name: "West Bengal", code: "WB" },
      { name: "Andaman and Nicobar Islands", code: "AN" },
      { name: "Chandigarh", code: "CH" },
      { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DN" },
      { name: "Delhi", code: "DL" },
      { name: "Jammu and Kashmir", code: "JK" },
      { name: "Ladakh", code: "LA" },
      { name: "Lakshadweep", code: "LD" },
      { name: "Puducherry", code: "PY" }
    ];

    const { error: statesError } = await supabase
      .from("states")
      .upsert(statesData, { onConflict: "name" });

    if (statesError) throw statesError;

    // Fetch Tamil Nadu ID to link districts
    const { data: tnState } = await supabase
      .from("states")
      .select("id")
      .eq("code", "TN")
      .single();

    if (tnState) {
      // 2. Seed Tamil Nadu Districts
      const tnDistricts = [
        { state_id: tnState.id, name: "Chennai" },
        { state_id: tnState.id, name: "Coimbatore" },
        { state_id: tnState.id, name: "Madurai" },
        { state_id: tnState.id, name: "Salem" },
        { state_id: tnState.id, name: "Tiruchirappalli" },
        { state_id: tnState.id, name: "Tirunelveli" },
        { state_id: tnState.id, name: "Vellore" },
        { state_id: tnState.id, name: "Erode" },
        { state_id: tnState.id, name: "Thanjavur" },
        { state_id: tnState.id, name: "Dindigul" }
      ];

      const { error: distError } = await supabase
        .from("districts")
        .upsert(tnDistricts, { onConflict: "state_id,name" });

      if (distError) throw distError;
    }

    // 3. Seed Languages
    const languagesData = [
      { language_name: "English", locale: "en-IN" },
      { language_name: "Tamil", locale: "ta-IN" },
      { language_name: "Hindi", locale: "hi-IN" }
    ];

    const { error: langError } = await supabase
      .from("languages")
      .upsert(languagesData, { onConflict: "language_name" });

    if (langError) throw langError;

    // 4. Seed System Settings defaults
    const defaultSettings = [
      { setting_key: "scheduler_window_days", value: 30, description: "Number of days in advance to pre-generate content" },
      { setting_key: "render_retention_hours", value: 24, description: "Hours to retain rendered files before automatic deletion" },
      { setting_key: "default_language", value: "en-IN", description: "Default regional language locale for new stores" },
      { setting_key: "default_subscription_plan", value: "Standard", description: "Default plan duration tier on onboarding" },
      { setting_key: "default_template", value: "Classic Gold Layout", description: "Default video alignment layout template" },
      { setting_key: "max_downloads_per_day", value: 5, description: "Download request limit per client per day" },
      { setting_key: "gold_rate_source", value: "manual", description: "Central gold price parsing mode (manual/api)" },
      { setting_key: "maintenance_mode", value: false, description: "Toggles maintenance mode status across dashboards" }
    ];

    const { error: settingsError } = await supabase
      .from("system_settings")
      .upsert(defaultSettings, { onConflict: "setting_key" });

    if (settingsError) throw settingsError;

    return NextResponse.json({ success: true, message: "Database tables successfully seeded!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Seeding failed." }, { status: 500 });
  }
}
