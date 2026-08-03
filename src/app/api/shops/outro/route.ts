import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { deleteFromR2 } from "@/utils/r2";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shopId");

  if (!shopId) {
    return NextResponse.json({ error: "Missing shopId parameter" }, { status: 400 });
  }

  try {
    // 1. Check system_settings
    const { data: setting } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("setting_key", `outro_video_${shopId}`)
      .maybeSingle();

    if (setting?.value) {
      return NextResponse.json({ outro_video_url: setting.value });
    }

    // 2. Check shops table column
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("*")
      .eq("id", shopId)
      .maybeSingle();

    return NextResponse.json({ outro_video_url: shop?.outro_video_url || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { shopId, shopCode, outro_video_url } = body;

    if (!shopId || !outro_video_url) {
      return NextResponse.json({ error: "Missing required fields (shopId, outro_video_url)" }, { status: 400 });
    }

    // 1. Store in system_settings
    const settingKey = `outro_video_${shopId}`;
    const { data: existingSetting } = await supabaseAdmin
      .from("system_settings")
      .select("setting_key")
      .eq("setting_key", settingKey)
      .maybeSingle();

    if (existingSetting) {
      await supabaseAdmin
        .from("system_settings")
        .update({ value: outro_video_url, updated_at: new Date() })
        .eq("setting_key", settingKey);
    } else {
      await supabaseAdmin
        .from("system_settings")
        .insert([{
          setting_key: settingKey,
          value: outro_video_url,
          description: `Custom Outro Video for shop ${shopCode || shopId}`
        }]);
    }

    // 2. Try updating shops table if column exists
    try {
      await supabaseAdmin
        .from("shops")
        .update({ outro_video_url })
        .eq("id", shopId);
    } catch (e) {
      // ignore if column doesn't exist
    }

    return NextResponse.json({ success: true, outro_video_url });
  } catch (err: any) {
    console.error("POST /api/shops/outro error:", err);
    return NextResponse.json({ error: err.message || "Failed to update shop outro video" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");
    const outroUrl = searchParams.get("outroUrl");

    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId parameter" }, { status: 400 });
    }

    if (outroUrl) {
      await deleteFromR2(outroUrl);
    }

    // Delete from system_settings
    await supabaseAdmin
      .from("system_settings")
      .delete()
      .eq("setting_key", `outro_video_${shopId}`);

    // Update shops table if column exists
    try {
      await supabaseAdmin
        .from("shops")
        .update({ outro_video_url: null })
        .eq("id", shopId);
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/shops/outro error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete shop outro video" }, { status: 500 });
  }
}
