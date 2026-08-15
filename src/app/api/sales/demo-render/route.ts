import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// Initialize Supabase Admin client
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function checkAuth(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const actualRole = user.app_metadata?.role || user.user_metadata?.role;
  if (actualRole === "super_admin" || actualRole === "admin" || actualRole === "sales") {
    return { ...user, role: actualRole };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "sales") {
    return { ...user, role: profile.role };
  }

  return null;
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const user = await checkAuth(supabaseUser);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      shop_name, 
      shop_phone, 
      shop_address, 
      logo_url, 
      video_library_id, 
      template_id,
      association_id,
      selected_rates,
      pricing_mode,
      manual_rates
    } = body;

    if (!shop_name || !video_library_id || !template_id) {
      return NextResponse.json({ error: "Missing required fields (shop_name, video_library_id, template_id)" }, { status: 400 });
    }

    // Resolve rates from association_id if provided
    let rateData = null;
    if (association_id) {
      const { data } = await supabaseAdmin
        .from("gold_rates")
        .select("rate_22k, rate_24k, rate_18k, rate_9k, rate_silver")
        .eq("association_id", association_id)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      rateData = data;
    }

    if (!rateData) {
      const { data } = await supabaseAdmin
        .from("gold_rates")
        .select("rate_22k, rate_24k, rate_18k, rate_9k, rate_silver")
        .is("association_id", null)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      rateData = data;
    }

    const demoRates = {
      rate_22k: pricing_mode === "manual" ? String(manual_rates?.rate_22k || "") : String(rateData?.rate_22k || "6500"),
      rate_24k: pricing_mode === "manual" ? String(manual_rates?.rate_24k || "") : String(rateData?.rate_24k || "7100"),
      rate_18k: pricing_mode === "manual" ? String(manual_rates?.rate_18k || "") : String(rateData?.rate_18k || "5300"),
      rate_9k: pricing_mode === "manual" ? String(manual_rates?.rate_9k || "") : String(rateData?.rate_9k || "2600"),
      rate_silver: pricing_mode === "manual" ? String(manual_rates?.rate_silver || "") : String(rateData?.rate_silver || "90")
    };

    // 1. Create demo render job
    const { data: newJob, error: jobErr } = await supabaseAdmin
      .from("render_jobs")
      .insert([{
        shop_id: null,
        template_id,
        video_library_id,
        priority: "High",
        status: "Pending",
        is_demo: true,
        demo_metadata: {
          shop_name,
          shop_phone: shop_phone || "",
          shop_address: shop_address || "",
          logo_url: logo_url || "",
          rates: demoRates,
          selected_rates: selected_rates || null
        },
        scheduled_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (jobErr || !newJob) {
      console.error("Failed to insert demo render job:", jobErr);
      return NextResponse.json({ error: jobErr?.message || "Failed to initiate render job" }, { status: 400 });
    }

    // 2. Insert into render queue
    await supabaseAdmin
      .from("render_queue")
      .insert([{
        render_job_id: newJob.id,
        priority: 60, // Slightly higher priority for live sales demos!
        status: "Pending"
      }]);

    // 3. Log the action
    await supabaseAdmin
      .from("render_job_logs")
      .insert([{
        render_job_id: newJob.id,
        log_level: "Info",
        message: `Temporary demo render job queued by sales rep: ${user.email}.`
      }]);

    return NextResponse.json({ 
      success: true, 
      jobId: newJob.id,
      status: "Pending"
    });

  } catch (err: any) {
    console.error("Demo render endpoint catch error:", err);
    return NextResponse.json({ error: err.message || "Failed to queue demo video" }, { status: 500 });
  }
}
