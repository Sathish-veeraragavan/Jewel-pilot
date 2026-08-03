import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

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

  let role = user.app_metadata?.role || user.user_metadata?.role;
  if (!role) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role;
  }

  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    let { shopId, subscriptionId, startDate, endDate, subStatus, shopStatus, name, phone, address, owner_phone } = body;

    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    // If caller is sub-admin (role === admin), do not allow modifying dates or statuses
    if (role === "admin") {
      const { data: existingShop } = await supabaseAdmin
        .from("shops")
        .select("status")
        .eq("id", shopId)
        .single();

      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("start_date, end_date, status")
        .eq("shop_id", shopId)
        .maybeSingle();

      shopStatus = existingShop?.status || "pending";
      subStatus = existingSub?.status || "pending_approval";
      startDate = existingSub?.start_date || new Date().toISOString().split("T")[0];
      endDate = existingSub?.end_date || new Date().toISOString().split("T")[0];
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Determine effective statuses based on expiration date
    let effectiveSubStatus = subStatus || "active";
    let effectiveShopStatus = shopStatus || "active";

    if (endDate && endDate < todayStr) {
      effectiveSubStatus = "expired";
      effectiveShopStatus = "inactive";
    }

    // 1. Update shop status and metadata fields if provided
    const shopUpdatePayload: any = { status: effectiveShopStatus, updated_at: new Date() };
    if (name !== undefined) shopUpdatePayload.name = name;
    if (phone !== undefined) shopUpdatePayload.phone = phone;
    if (owner_phone !== undefined) shopUpdatePayload.owner_phone = owner_phone;
    if (address !== undefined) shopUpdatePayload.address = address;

    const { error: shopErr } = await supabaseAdmin
      .from("shops")
      .update(shopUpdatePayload)
      .eq("id", shopId);

    if (shopErr) throw shopErr;

    // 2. Check if existing subscription row exists for this shop
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("shop_id", shopId)
      .maybeSingle();

    if (existingSub) {
      const { error: subErr } = await supabaseAdmin
        .from("subscriptions")
        .update({
          start_date: startDate || todayStr,
          end_date: endDate || todayStr,
          status: effectiveSubStatus,
          approved_by: effectiveSubStatus === "active" ? user.id : null,
          updated_at: new Date()
        })
        .eq("id", existingSub.id);

      if (subErr) throw subErr;
    } else {
      const { error: subErr } = await supabaseAdmin
        .from("subscriptions")
        .insert([{
          shop_id: shopId,
          status: effectiveSubStatus,
          plan: "Standard",
          start_date: startDate || todayStr,
          end_date: endDate || todayStr,
          created_by: user.id,
          approved_by: effectiveSubStatus === "active" ? user.id : null
        }]);

      if (subErr) throw subErr;
    }

    return NextResponse.json({ 
      success: true, 
      shopStatus: effectiveShopStatus, 
      subStatus: effectiveSubStatus 
    });
  } catch (err: any) {
    console.error("PUT /api/shops/subscriptions error:", err);
    return NextResponse.json({ error: err.message || "Failed to update subscription" }, { status: 500 });
  }
}
