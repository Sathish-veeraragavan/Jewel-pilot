import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStr = new Date().toISOString().split("T")[0];

    const [
      { count: totalShops },
      { count: activeShops },
      { count: pendingShops },
      { count: activeSubs },
      { count: totalVideos },
      { data: todayGold }
    ] = await Promise.all([
      supabaseAdmin.from("shops").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("shops").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("shops").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("videos").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("gold_rates").select("id, rate_date, rate_24k, rate_22k, rate_silver, created_at, updated_by").eq("rate_date", todayStr).maybeSingle()
    ]);

    return NextResponse.json({
      totalShops: totalShops || 0,
      activeShops: activeShops || 0,
      pendingShops: pendingShops || 0,
      activeSubs: activeSubs || 0,
      totalVideos: totalVideos || 0,
      todayRates: todayGold || null
    });
  } catch (err: any) {
    console.error("GET /api/super-admin/stats error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch stats" }, { status: 500 });
  }
}
