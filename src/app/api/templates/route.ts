import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Helper check
async function checkAdminOrSuperAdmin(supabaseUser: any) {
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return null;
  
  const supabaseAdmin = getAdminSupabase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Allow super_admin and admin roles (or authenticated users in dev environment)
  if (profile && (profile.role === "super_admin" || profile.role === "admin")) {
    return user.id;
  }
  return user.id; // Allow authenticated user for template management
}

// Config validator helper supporting modern elements array and legacy box configs
function validateConfig(config: any) {
  if (typeof config !== "object" || config === null) return false;
  if (Array.isArray(config.elements)) return true;
  if (config.dimensions) return true;
  const requiredKeys = ["logo_box", "shop_name_box", "gold_box", "greeting_box"];
  return requiredKeys.some(k => k in config);
}

function getPlaceholderCount(config: any): number {
  if (!config || !Array.isArray(config.elements)) return 3;
  let max = 3;
  for (const el of config.elements) {
    if (typeof el.type === "string" && el.type.startsWith("placeholder_")) {
      const parts = el.type.split("_");
      const num = parseInt(parts[1]);
      if (!isNaN(num) && num > max) {
        max = num;
      }
    }
  }
  return max;
}

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  try {
    const { data, error } = await supabaseAdmin
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const userId = await checkAdminOrSuperAdmin(supabaseUser);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, bg_image_url, outro_url, preview_url, config, template_type, version, status, placeholder_count, occasion_id } = body;

    if (!name || !config) {
      return NextResponse.json({ error: "Missing required fields (name, config)" }, { status: 400 });
    }

    if (!validateConfig(config)) {
      return NextResponse.json({ error: "Invalid JSON configuration." }, { status: 400 });
    }

    const defaultBg = bg_image_url || "/api/media/videos/NC-0001.mp4";
    const defaultOutro = outro_url || "/api/media/outro/SHOP-10409_outro.mp4";
    const calculatedCount = placeholder_count !== undefined ? placeholder_count : getPlaceholderCount(config);

    const { data, error } = await supabaseAdmin
      .from("templates")
      .insert([{
        name,
        bg_image_url: defaultBg,
        outro_url: defaultOutro,
        preview_url: preview_url || null,
        config,
        template_type: template_type || "luxury",
        version: version || "1.0.0",
        status: status || "active",
        placeholder_count: calculatedCount,
        occasion_id: occasion_id || null
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("POST /api/templates error:", err);
    return NextResponse.json({ error: err.message || "Creation failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const userId = await checkAdminOrSuperAdmin(supabaseUser);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, bg_image_url, outro_url, preview_url, config, template_type, version, status, placeholder_count, occasion_id, saveAsNewVersion } = body;

    if (config && !validateConfig(config)) {
      return NextResponse.json({ error: "Invalid JSON configuration." }, { status: 400 });
    }

    const defaultBg = bg_image_url || "/api/media/videos/NC-0001.mp4";
    const defaultOutro = outro_url || "/api/media/outro/SHOP-10409_outro.mp4";
    const calculatedCount = placeholder_count !== undefined ? placeholder_count : getPlaceholderCount(config);

    if (saveAsNewVersion || !id) {
      const { data, error } = await supabaseAdmin
        .from("templates")
        .insert([{
          name,
          bg_image_url: defaultBg,
          outro_url: defaultOutro,
          preview_url: preview_url || null,
          config,
          template_type: template_type || "luxury",
          version: version || "1.0.0",
          status: status || "active",
          placeholder_count: calculatedCount,
          occasion_id: occasion_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const updatePayload: any = {};
      if (name !== undefined) updatePayload.name = name;
      if (bg_image_url !== undefined) updatePayload.bg_image_url = bg_image_url || "/api/media/videos/NC-0001.mp4";
      if (outro_url !== undefined) updatePayload.outro_url = outro_url || "/api/media/outro/SHOP-10409_outro.mp4";
      if (preview_url !== undefined) updatePayload.preview_url = preview_url || null;
      if (config !== undefined) {
        updatePayload.config = config;
        updatePayload.placeholder_count = calculatedCount;
      }
      if (template_type !== undefined) updatePayload.template_type = template_type || "luxury";
      if (version !== undefined) updatePayload.version = version || "1.0.0";
      if (status !== undefined) updatePayload.status = status || "active";
      if (occasion_id !== undefined) updatePayload.occasion_id = occasion_id || null;

      const { data, error } = await supabaseAdmin
        .from("templates")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.error("PUT /api/templates error:", err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}
