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

    // Fetch all shops using service role client
    const [
      { data: shops, error },
      { data: outroSettings }
    ] = await Promise.all([
      supabaseAdmin.from("shops").select(`*, subscriptions(*), states(name), associations(name)`).order("created_at", { ascending: false }),
      supabaseAdmin.from("system_settings").select("setting_key, value").like("setting_key", "outro_video_%")
    ]);

    if (error) throw error;

    const outroMap: Record<string, string> = {};
    (outroSettings || []).forEach(s => {
      const shopId = s.setting_key.replace("outro_video_", "");
      outroMap[shopId] = s.value;
    });

    // Fetch creator and assigned sales admin profiles
    const creatorIds = Array.from(new Set(
      (shops || []).flatMap(s => [s.created_by, s.assigned_sales_admin_id]).filter(Boolean)
    ));

    let creatorsMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: creatorProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email")
        .in("id", creatorIds);
      
      (creatorProfiles || []).forEach(p => {
        creatorsMap[p.id] = p.name && p.name !== "New User" ? p.name : p.email;
      });
    }

    // Auto-check and mark expired subscriptions
    const formatted = (shops || []).map(s => {
      const subList = s.subscriptions;
      const sub = Array.isArray(subList) ? subList[0] : subList;
      let computedStatus = s.status;
      let computedSubStatus = sub?.status || "active";

      if (sub?.end_date && sub.end_date < todayStr) {
        computedStatus = "inactive";
        computedSubStatus = "expired";
      }

      return {
        ...s,
        outro_video_url: outroMap[s.id] || s.outro_video_url || null,
        status: computedStatus,
        computedSubStatus,
        subscription: sub,
        onboardedBy: creatorsMap[s.created_by] || creatorsMap[s.assigned_sales_admin_id] || "Sales Admin"
      };
    });

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("GET /api/shops error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch shops" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const body = await request.json();
    const { id, action, logo_url, outro_video_url, selected_rates, association_id, plan_name, start_date, end_date, allowed_metals, weekly_categories } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing shop ID" }, { status: 400 });
    }

    if (action === "update_metadata") {
      const updates: any = {};
      if (logo_url !== undefined) updates.logo_url = logo_url;
      if (outro_video_url !== undefined) updates.outro_video_url = outro_video_url;
      if (selected_rates !== undefined) updates.selected_rates = selected_rates;
      if (association_id !== undefined) updates.association_id = association_id;
      if (allowed_metals !== undefined) updates.allowed_metals = allowed_metals;
      if (weekly_categories !== undefined) updates.weekly_categories = weekly_categories;

      const { data, error } = await supabaseAdmin
        .from("shops")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === "request_approval" || action === "trial_1_day") {
      const targetStartDate = start_date || new Date().toISOString().split("T")[0];
      const targetEndDate = end_date || (action === "trial_1_day" 
        ? new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

      const plan = plan_name || "Standard";

      // Delete active subscription if any
      await supabaseAdmin.from("subscriptions").delete().eq("shop_id", id);

      const { data: sub, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          shop_id: id,
          plan_name: plan,
          start_date: targetStartDate,
          end_date: targetEndDate,
          status: "pending_approval"
        })
        .select()
        .single();

      if (subError) throw subError;

      // Update shop status to pending
      await supabaseAdmin.from("shops").update({ status: "pending" }).eq("id", id);

      return NextResponse.json({ success: true, subscription: sub });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    console.error("PUT /api/shops error:", err);
    return NextResponse.json({ error: err.message || "Failed to update shop" }, { status: 500 });
  }
}
