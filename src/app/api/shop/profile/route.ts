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

  try {
    const body = await request.json();
    const { 
      name, 
      owner_name, 
      phone, 
      address, 
      logo_url, 
      qr_code_url,
      email, 
      password,
      selected_rates,
      pricing_mode,
      discount_type,
      discount_value,
      custom_rates,
      owner_phone,
      weekly_categories
    } = body;

    // 1. Resolve shop_id for logged in user
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("shop_id, name")
      .eq("id", user.id)
      .maybeSingle();

    let shopId = profile?.shop_id;

    if (!shopId) {
      const { data: matchedShops } = await supabaseAdmin
        .from("shops")
        .select("id, name, owner_name")
        .order("created_at", { ascending: false });

      if (matchedShops && matchedShops.length > 0) {
        const matchByName = matchedShops.find(
          s => profile?.name && s.owner_name?.toLowerCase().includes(profile.name.toLowerCase().split(" ")[0])
        );
        shopId = matchByName ? matchByName.id : matchedShops[0].id;
        
        if (shopId) {
          await supabaseAdmin
            .from("profiles")
            .update({ shop_id: shopId })
            .eq("id", user.id);
        }
      }
    }

    if (!shopId) {
      return NextResponse.json({ error: "No shop outlet linked to this user account." }, { status: 404 });
    }

    // 2. Update Shop Outlet details
    const shopUpdate: any = { updated_at: new Date() };
    if (name) shopUpdate.name = name;
    if (owner_name) shopUpdate.owner_name = owner_name;
    if (phone) shopUpdate.phone = phone;
    if (owner_phone !== undefined) shopUpdate.owner_phone = owner_phone;
    if (address) shopUpdate.address = address;
    if (logo_url) shopUpdate.logo_url = logo_url;
    if (qr_code_url !== undefined) shopUpdate.qr_code_url = qr_code_url;
    if (selected_rates !== undefined) shopUpdate.selected_rates = selected_rates;
    if (pricing_mode !== undefined) shopUpdate.pricing_mode = pricing_mode;
    if (discount_type !== undefined) shopUpdate.discount_type = discount_type;
    if (discount_value !== undefined) shopUpdate.discount_value = discount_value;
    if (body.metal_discounts !== undefined) shopUpdate.metal_discounts = body.metal_discounts;
    if (custom_rates !== undefined) shopUpdate.custom_rates = custom_rates;
    if (body.use_regional_rate_labels !== undefined) shopUpdate.use_regional_rate_labels = body.use_regional_rate_labels;
    if (weekly_categories !== undefined) shopUpdate.weekly_categories = weekly_categories;

    const { error: shopErr } = await supabaseAdmin
      .from("shops")
      .update(shopUpdate)
      .eq("id", shopId);

    if (shopErr) throw shopErr;

    // 3. Update Auth User Credentials (Email / Password) ONLY if explicitly changed
    const authUpdate: any = {};
    let cleanEmail = email ? email.trim().toLowerCase() : "";
    if (cleanEmail && !cleanEmail.includes("@")) {
      cleanEmail = `${cleanEmail}@aurumflow.com`;
    }

    if (cleanEmail && cleanEmail !== user.email?.toLowerCase()) {
      authUpdate.email = cleanEmail;
    }
    if (password && password.length >= 6) {
      authUpdate.password = password;
    }

    if (owner_name) {
      authUpdate.user_metadata = { ...(user.user_metadata || {}), name: owner_name };
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, authUpdate);
      if (authErr) {
        return NextResponse.json({ error: `Failed to update credentials: ${authErr.message}` }, { status: 400 });
      }
    }

    // 4. Update profiles table
    const profileUpdate: any = { updated_at: new Date() };
    if (owner_name) profileUpdate.name = owner_name;
    if (cleanEmail) profileUpdate.email = cleanEmail;

    await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    // 5. If trigger_render is true (from Manual Price Save & Render button), trigger today's render job
    let triggeredJobId = null;
    if (body.trigger_render) {
      const todayStr = new Date().toISOString().split("T")[0];
      
      // Enforce daily limit of 2 manual renders (or 3 for manual shops after 12 PM local IST time)
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const todayStartISO = todayStart.toISOString();

      const { count: renderCount } = await supabaseAdmin
        .from("render_jobs")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .gte("created_at", todayStartISO);

      // Check pricing mode
      const { data: shopPricing } = await supabaseAdmin
        .from("shops")
        .select("pricing_mode")
        .eq("id", shopId)
        .maybeSingle();

      const isManualPrice = shopPricing?.pricing_mode === "custom_manual";
      let allowedLimit = 2;
      
      if (isManualPrice) {
        const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false } as const;
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const istHour = parseInt(formatter.format(new Date()));
        if (istHour >= 12) {
          allowedLimit = 3;
        }
      }

      if (renderCount && renderCount >= allowedLimit) {
        return NextResponse.json({ 
          error: `The daily limit to generate videos (max ${allowedLimit}/day) has been reached.` 
        }, { status: 429 });
      }

      const { data: schedule } = await supabaseAdmin
        .from("schedules")
        .select("id, scheduled_date, video_id, template_id, audio_track_id")
        .eq("shop_id", shopId)
        .eq("scheduled_date", todayStr)
        .maybeSingle();

      if (schedule) {
        const { data: newJob, error: jobErr } = await supabaseAdmin
          .from("render_jobs")
          .insert([{
            shop_id: shopId,
            template_id: schedule.template_id,
            video_library_id: schedule.video_id,
            priority: "High",
            status: "Pending",
            scheduled_at: `${schedule.scheduled_date}T00:00:00.000Z`
          }])
          .select()
          .single();

        if (!jobErr && newJob) {
          triggeredJobId = newJob.id;
          await supabaseAdmin
            .from("render_queue")
            .insert([{
              render_job_id: newJob.id,
              priority: 50,
              status: "Pending"
            }]);

          await supabaseAdmin
            .from("render_job_logs")
            .insert([{
              render_job_id: newJob.id,
              log_level: "Info",
              message: "Render job manually initiated by shop retailer manual price update."
            }]);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Profile and store details updated successfully!",
      triggeredJobId 
    });
  } catch (err: any) {
    console.error("PUT /api/shop/profile error:", err);
    return NextResponse.json({ error: err.message || "Failed to update profile" }, { status: 500 });
  }
}
