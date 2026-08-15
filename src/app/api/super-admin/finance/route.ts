import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Check if user is admin or super_admin
async function checkAuth(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const actualRole = user.app_metadata?.role || user.user_metadata?.role;
  if (actualRole === "super_admin" || actualRole === "admin") {
    return { ...user, role: actualRole };
  }

  // Fallback to profiles database check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "super_admin" || profile?.role === "admin") {
    return { ...user, role: profile.role };
  }

  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await checkAuth(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getAdminSupabase();

  try {
    // 1. Fetch all active shops with their subscription plans
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

    // 2. Fetch all collections, expenses, reserves, and settlements
    const [
      { data: collections, error: collErr },
      { data: expenses, error: expErr },
      { data: reserves, error: resErr },
      { data: settlements, error: setErr }
    ] = await Promise.all([
      supabaseAdmin
        .from("finance_collections")
        .select(`*, profiles:profiles!created_by(name)`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("finance_expenses")
        .select(`*, profiles:profiles!created_by(name)`)
        .order("expense_date", { ascending: false }),
      supabaseAdmin
        .from("finance_reserves")
        .select(`*, profiles:profiles!created_by(name)`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("finance_settlements")
        .select(`*, profiles:profiles!created_by(name)`)
        .order("settlement_date", { ascending: false })
    ]);

    if (collErr) throw collErr;
    if (expErr) throw expErr;
    if (resErr) throw resErr;
    if (setErr) throw setErr;

    // 3. Compute Aggregated metrics
    const totalCollected = (collections || [])
      .filter(c => c.payment_status === "Collected")
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

    const totalExpenses = (expenses || [])
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const totalReserves = (reserves || [])
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    const remaining = Math.max(0, totalCollected - totalExpenses - totalReserves);
    const partnerShare = parseFloat((remaining / 3).toFixed(2));

    // 4. Partner Settlements calculation
    const partners = ["Sathish", "Sankar", "Nipin"];
    const partnerBreakdown = partners.map(name => {
      const outOfPocket = (expenses || [])
        .filter(e => e.paid_by.toLowerCase() === name.toLowerCase())
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      const allocated = parseFloat((partnerShare + outOfPocket).toFixed(2));

      const settled = (settlements || [])
        .filter(s => s.partner_name.toLowerCase() === name.toLowerCase())
        .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

      const pending = parseFloat((allocated - settled).toFixed(2));

      return {
        name,
        allocated,
        outOfPocket,
        settled,
        pending
      };
    });

    // 5. Map payment collection status for each shop (look at current month)
    const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-08"

    const mappedShops = (shops || []).map(shop => {
      // Find latest subscription
      const latestSub = shop.subscriptions && shop.subscriptions.length > 0 
        ? shop.subscriptions[0] 
        : null;

      // Find collection record for this shop for current month
      const shopCollections = (collections || []).filter(c => c.shop_id === shop.id);
      
      const currentMonthColl = shopCollections.find(c => {
        const billingMonth = new Date(c.billing_date).toISOString().slice(0, 7);
        return billingMonth === currentMonthStr;
      });

      // Default billed amount to 5000 if not specified (Standard SaaS subscription cost)
      const billedAmount = currentMonthColl ? parseFloat(currentMonthColl.amount) : 5000;
      const paymentStatus = currentMonthColl ? currentMonthColl.payment_status : "Pending";

      const districtName = (shop.districts as any)?.name || (Array.isArray(shop.districts) && (shop.districts[0] as any)?.name) || "";
      const stateName = (shop.states as any)?.name || (Array.isArray(shop.states) && (shop.states[0] as any)?.name) || "";

      return {
        id: shop.id,
        name: shop.name,
        owner_name: shop.owner_name,
        created_at: shop.created_at,
        location: `${shop.city}, ${districtName}, ${stateName}`,
        subscription_plan: latestSub?.plan || "Monthly",
        renewal_date: latestSub?.renewal_date || latestSub?.end_date || null,
        billed_amount: billedAmount,
        payment_status: paymentStatus,
        collections_history: shopCollections
      };
    });

    return NextResponse.json({
      shops: mappedShops,
      expenses: expenses || [],
      reserves: reserves || [],
      settlements: settlements || [],
      summary: {
        totalCollected,
        totalExpenses,
        totalReserves,
        remaining,
        partnerShare
      },
      partnerBreakdown
    });

  } catch (err: any) {
    console.error("GET /api/super-admin/finance error:", err);
    return NextResponse.json({ error: err.message || "Failed to load financial records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await checkAuth(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getAdminSupabase();
  const body = await request.json();
  const { action } = body;

  try {
    if (action === "add_expense") {
      const { amount, description, expense_date, paid_by } = body;
      if (!amount || !description) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from("finance_expenses")
        .insert([{
          amount: parseFloat(amount),
          description,
          expense_date: expense_date || new Date().toISOString().split("T")[0],
          paid_by: paid_by || "Company",
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });

    } else if (action === "edit_expense") {
      const { id, amount, description, expense_date, paid_by } = body;
      if (!id || !amount || !description) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from("finance_expenses")
        .update({
          amount: parseFloat(amount),
          description,
          expense_date: expense_date || new Date().toISOString().split("T")[0],
          paid_by: paid_by || "Company"
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });

    } else if (action === "add_reserve") {
      const { amount, held_by, notes } = body;
      if (!amount || !held_by) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from("finance_reserves")
        .insert([{
          amount: parseFloat(amount),
          held_by,
          notes,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });

    } else if (action === "add_settlement") {
      const { amount, partner_name, notes, settlement_date } = body;
      if (!amount || !partner_name) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const targetDate = settlement_date || new Date().toISOString().split("T")[0];

      const { data, error } = await supabaseAdmin
        .from("finance_settlements")
        .insert([{
          amount: parseFloat(amount),
          partner_name,
          notes,
          settlement_date: targetDate,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });

    } else if (action === "mark_collected") {
      const { shop_id, amount, billing_date, payment_status } = body;
      if (!shop_id || !amount) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const targetBillingDate = billing_date || new Date().toISOString().split("T")[0];

      // Fetch existing collection record to check grace period
      const { data: existingRecord } = await supabaseAdmin
        .from("finance_collections")
        .select("created_at")
        .eq("shop_id", shop_id)
        .eq("billing_date", targetBillingDate)
        .maybeSingle();

      if (existingRecord && user.role !== "super_admin") {
        const timeDiffMs = Date.now() - new Date(existingRecord.created_at).getTime();
        const minutesDiff = timeDiffMs / (1000 * 60);
        if (minutesDiff > 10) {
          return NextResponse.json({ 
            error: "This collection record has already been settled and is locked. The 10-minute edit grace period has expired." 
          }, { status: 400 });
        }
      }

      // Upsert billing collection status
      const { data, error } = await supabaseAdmin
        .from("finance_collections")
        .upsert({
          shop_id,
          amount: parseFloat(amount),
          payment_status: payment_status || "Collected",
          billing_date: targetBillingDate,
          created_by: user.id,
          updated_at: new Date()
        }, {
          onConflict: "shop_id,billing_date"
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });

    } else {
      return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
    }

  } catch (err: any) {
    console.error("POST /api/super-admin/finance error:", err);
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}
