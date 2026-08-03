import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Role helper check
async function checkRole(supabaseUser: any) {
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return null;
  
  let role = user.app_metadata?.role || user.user_metadata?.role;
  if (!role) {
    const supabaseAdmin = getAdminSupabase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role;
  }
  return role || null;
}

// Trigger render queue update for today's schedules when gold rates are published
async function triggerScheduleRenders(supabaseAdmin: any, rateDate: string, associationId?: string | null) {
  let shopQuery = supabaseAdmin.from("shops").select("id");
  if (associationId) {
    shopQuery = shopQuery.eq("association_id", associationId);
  } else {
    shopQuery = shopQuery.is("association_id", null);
  }
  const { data: matchedShops } = await shopQuery;
  const shopIds = (matchedShops || []).map((s: any) => s.id);
  if (shopIds.length === 0) return 0;

  const { data: updatedSchedules, error } = await supabaseAdmin
    .from("schedules")
    .update({ render_status: "rendered" })
    .eq("scheduled_date", rateDate)
    .in("shop_id", shopIds)
    .select("id");
  
  if (error) {
    console.error("Failed to trigger schedule renders:", error);
    return 0;
  }
  return updatedSchedules ? updatedSchedules.length : 0;
}

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // 'today' or 'history'
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const associationId = searchParams.get("association_id");

  try {
    if (type === "today") {
      let query = supabaseAdmin
        .from("gold_rates")
        .select("id, rate_date, rate_24k, rate_22k, rate_18k, rate_9k, rate_silver, association_id, created_at, updated_by")
        .eq("rate_date", dateStr);

      if (associationId) {
        query = query.eq("association_id", associationId);
      } else {
        query = query.is("association_id", null);
      }

      const { data: goldData, error } = await query.maybeSingle();

      if (error) throw error;
      return NextResponse.json(goldData || null);
    }

    // Default: fetch history logs
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data: goldLogs, error, count } = await supabaseAdmin
      .from("gold_rates")
      .select("id, rate_date, rate_24k, rate_22k, rate_18k, rate_9k, rate_silver, association_id, associations(name), created_at, updated_by", { count: "exact" })
      .order("rate_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ data: goldLogs || [], total: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const role = await checkRole(supabaseUser);
  const supabaseAdmin = getAdminSupabase();

  if (!role || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ error: "Forbidden - Admin permissions required" }, { status: 403 });
  }

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { rate_date, gold_22k, gold_24k, gold_18k, gold_9k, silver, association_id } = body;

    // Validation
    if (!rate_date || !gold_22k || !gold_24k || !silver) {
      return NextResponse.json({ error: "Missing required fields (rate_date, gold_22k, gold_24k, silver)" }, { status: 400 });
    }

    const rate22k = parseFloat(gold_22k);
    const rate24k = parseFloat(gold_24k);
    const rate18k = parseFloat(gold_18k || "0");
    const rate9k = parseFloat(gold_9k || "0");
    const rateSilver = parseFloat(silver);

    if (rate22k <= 0 || rate24k <= 0 || rateSilver <= 0) {
      return NextResponse.json({ error: "Prices must be positive numbers." }, { status: 400 });
    }

    // Check if record exists for this date and association
    let checkQuery = supabaseAdmin
      .from("gold_rates")
      .select("id")
      .eq("rate_date", rate_date);

    if (association_id) {
      checkQuery = checkQuery.eq("association_id", association_id);
    } else {
      checkQuery = checkQuery.is("association_id", null);
    }

    const { data: existingGold } = await checkQuery.maybeSingle();

    let recordResult = null;

    const ratePayload: any = {
      rate_date,
      rate_22k: rate22k,
      rate_24k: rate24k,
      rate_18k: rate18k,
      rate_9k: rate9k,
      rate_silver: rateSilver,
      association_id: association_id || null,
      updated_by: user.id
    };

    if (existingGold) {
      const { data, error } = await supabaseAdmin
        .from("gold_rates")
        .update(ratePayload)
        .eq("id", existingGold.id)
        .select()
        .single();

      if (error) throw error;
      recordResult = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("gold_rates")
        .insert([ratePayload])
        .select()
        .single();

      if (error) throw error;
      recordResult = data;
    }

    // Trigger render queue for today's scheduled shop videos
    const triggeredCount = await triggerScheduleRenders(supabaseAdmin, rate_date, association_id);

    return NextResponse.json({
      ...recordResult,
      triggeredRenders: triggeredCount,
    });
  } catch (err: any) {
    console.error("POST /api/commodity-rates error:", err);
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}
