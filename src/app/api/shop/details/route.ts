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

    // 1. Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, shop_id, email, name, role")
      .eq("id", user.id)
      .maybeSingle();

    let shopId = profile?.shop_id;

    // Support shop_id impersonation/viewing for super_admin and managing admin
    const url = new URL(request.url);
    const paramShopId = url.searchParams.get("shop_id");
    const callerRole = profile?.role || "shop_user";

    if (paramShopId) {
      if (callerRole === "super_admin") {
        shopId = paramShopId;
      } else if (callerRole === "admin") {
        const { data: checkShop } = await supabaseAdmin
          .from("shops")
          .select("id, assigned_sales_admin_id, created_by")
          .eq("id", paramShopId)
          .maybeSingle();

        if (checkShop && (checkShop.assigned_sales_admin_id === user.id || checkShop.created_by === user.id)) {
          shopId = paramShopId;
        }
      }
    }

    // Fallback resolution: Find shop by matching owner_name, email, or linked IDs
    if (!shopId) {
      // Check if any shop matches profile name or email or created_by
      const { data: matchedShops } = await supabaseAdmin
        .from("shops")
        .select("id, name, owner_name")
        .order("created_at", { ascending: false });

      if (matchedShops && matchedShops.length > 0) {
        // Try matching by owner name
        const matchByName = matchedShops.find(
          s => profile?.name && s.owner_name?.toLowerCase().includes(profile.name.toLowerCase().split(" ")[0])
        );
        
        if (matchByName) {
          shopId = matchByName.id;
        } else {
          // Default to latest shop if single shop user
          shopId = matchedShops[0].id;
        }

        // Permanently link shop_id in profiles table
        if (shopId) {
          await supabaseAdmin
            .from("profiles")
            .update({ shop_id: shopId })
            .eq("id", user.id);
        }
      }
    }

    if (!shopId) {
      return NextResponse.json({ error: "No retail shop profile linked to this account." }, { status: 404 });
    }

    // 2. Fetch Shop details with location, language, and subscription
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select(`
        *,
        states(name),
        districts(name),
        languages(language_name, locale),
        subscriptions(*),
        associations(allowed_metals)
      `)
      .eq("id", shopId)
      .single();

    if (shopErr || !shop) {
      return NextResponse.json({ error: "Shop details not found" }, { status: 404 });
    }

    // 3. Fetch sales agent / admin name
    let agentName = "Sales Representative";
    const agentId = shop.created_by || shop.assigned_sales_admin_id;
    if (agentId) {
      const { data: agent } = await supabaseAdmin
        .from("profiles")
        .select("name, email")
        .eq("id", agentId)
        .maybeSingle();
      if (agent) {
        agentName = agent.name && agent.name !== "New User" ? agent.name : agent.email;
      }
    }

    // 4. Calculate subscription status dynamically
    const sub = Array.isArray(shop.subscriptions) ? shop.subscriptions[0] : shop.subscriptions;
    let isExpired = false;
    let subStatus = sub?.status || shop.status || "active";
    let endDate = sub?.end_date || "N/A";
    let startDate = sub?.start_date || "N/A";

    if (endDate !== "N/A" && endDate < todayStr) {
      isExpired = true;
      subStatus = "expired";
    }

    // 5. Fetch today's schedule video record
    const { data: schedule } = await supabaseAdmin
      .from("schedules")
      .select(`
        id,
        scheduled_date,
        status,
        download_status,
        video_id,
        template_id,
        audio_track_id,
        videos(title)
      `)
      .eq("shop_id", shopId)
      .eq("scheduled_date", todayStr)
      .maybeSingle();

    let todayVideo = null;
    if (schedule) {
      // 1. Fetch latest render job matching the CURRENT active schedule
      let { data: currentScheduleJob } = await supabaseAdmin
        .from("render_jobs")
        .select("id, status, priority, rendered_video_url, videos:video_library_id(title)")
        .eq("shop_id", shopId)
        .eq("template_id", schedule.template_id)
        .eq("video_library_id", schedule.video_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let renderJob: any = currentScheduleJob;

      if (!renderJob && shop.pricing_mode !== "custom_manual") {
        // Automatically cancel any obsolete pending/processing jobs for the same shop and scheduled date
        const targetScheduledAt = `${schedule.scheduled_date}T00:00:00.000Z`;
        const { data: obsoleteJobs } = await supabaseAdmin
          .from("render_jobs")
          .select("id")
          .eq("shop_id", shopId)
          .eq("scheduled_at", targetScheduledAt)
          .in("status", ["Pending", "Processing", "Retrying"]);

        if (obsoleteJobs && obsoleteJobs.length > 0) {
          const obsoleteIds = obsoleteJobs.map(j => j.id);
          await supabaseAdmin
            .from("render_jobs")
            .update({ status: "Cancelled", error_message: "Superceded by a new schedule configuration." })
            .in("id", obsoleteIds);

          await supabaseAdmin
            .from("render_queue")
            .update({ status: "Cancelled" })
            .in("render_job_id", obsoleteIds);
        }

        // Automatically create a High priority render job for auto-priced shops
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
          // Push to render queue with High priority (50)
          await supabaseAdmin
            .from("render_queue")
            .insert([{
              render_job_id: newJob.id,
              priority: 50,
              status: "Pending"
            }]);

          // Log
          await supabaseAdmin
            .from("render_job_logs")
            .insert([{
              render_job_id: newJob.id,
              log_level: "Info",
              message: "Render job auto-initiated by shop dashboard login/visit with High priority."
            }]);

          renderJob = {
            id: newJob.id,
            status: "Pending",
            priority: "High",
            rendered_video_url: null,
            videos: { title: (schedule.videos as any)?.title || "Daily Jewellery Reel" }
          };
          currentScheduleJob = renderJob;
        }
      } else if (renderJob?.status === "Pending" && renderJob?.priority !== "High" && renderJob?.priority !== "Critical") {
        // Upgrade existing pending job priority to High because the user logged in
        await supabaseAdmin
          .from("render_jobs")
          .update({ priority: "High" })
          .eq("id", renderJob.id);

        await supabaseAdmin
          .from("render_queue")
          .update({ priority: 50 })
          .eq("render_job_id", renderJob.id);

        await supabaseAdmin
          .from("render_job_logs")
          .insert([{
            render_job_id: renderJob.id,
            log_level: "Info",
            message: "Render job priority upgraded to High by shop dashboard login/visit."
          }]);
      }

      // 3. Prioritize displaying a completed render job if one exists for today
      // This ensures that if the current job is pending, processing, or cancelled,
      // but a previous version of today's video was successfully rendered, the user can still download/view it.
      let displayJob = renderJob;
      const startOfDay = `${schedule.scheduled_date}T00:00:00.000Z`;

      const { data: completedTodayJobs } = await supabaseAdmin
        .from("render_jobs")
        .select("id, status, priority, rendered_video_url, template_id, video_library_id, videos:video_library_id(title)")
        .eq("shop_id", shopId)
        .eq("status", "Completed")
        .gte("created_at", startOfDay)
        .order("created_at", { ascending: false });

      if (completedTodayJobs && completedTodayJobs.length > 0) {
        // First priority: A completed job that matches the CURRENT schedule
        const currentMatch = completedTodayJobs.find(
          j => j.template_id === schedule.template_id && j.video_library_id === schedule.video_id
        );
        if (currentMatch) {
          displayJob = currentMatch;
        } else {
          // Second priority: The latest completed job of any video/template for today (fallback)
          if (!renderJob || renderJob.status !== "Completed") {
            displayJob = completedTodayJobs[0];
          }
        }
      }

      todayVideo = {
        id: schedule.id,
        scheduleId: schedule.id,
        jobId: displayJob?.id || null,
        videoTitle: (displayJob?.videos as any)?.title || (schedule.videos as any)?.title || "Daily Jewellery Reel",
        renderStatus: displayJob?.status === "Completed" ? "completed" : (displayJob?.status === "Processing" ? "processing" : "pending"),
        videoUrl: displayJob?.rendered_video_url || null,
        downloadStatus: (schedule as any)?.download_status || "pending"
      };
    }

    // 6. Fetch today's manual render count to enforce limit of 2 renders/day
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayStartISO = todayStart.toISOString();

    const { count: renderCount } = await supabaseAdmin
      .from("render_jobs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .gte("created_at", todayStartISO);

    const todayManualRenderCount = renderCount || 0;

    return NextResponse.json({
      shopId: shop.id,
      shopCode: shop.shop_code,
      shopName: shop.name,
      ownerName: shop.owner_name,
      phone: shop.phone || "",
      ownerPhone: shop.owner_phone || "",
      address: shop.address || "",
      logoUrl: shop.logo_url || "",
      qrCodeUrl: shop.qr_code_url || "",
      email: user.email || profile?.email || "",
      city: shop.city || "",
      district: shop.district || shop.districts?.name || "District",
      state: shop.state || shop.states?.name || "State",
      stateId: shop.state_id || null,
      associationId: shop.association_id || null,
      language: shop.language || shop.languages?.language_name || "English",
      selectedRates: shop.selected_rates || ["rate_22k_1g", "rate_22k_8g", "rate_silver_1g"],
      allowedMetals: shop.allowed_metals || shop.associations?.allowed_metals || ["24k", "22k", "18k", "9k", "silver"],
      pricingMode: shop.pricing_mode || "default",
      discountType: shop.discount_type || "percentage",
      discountValue: shop.discount_value || 0,
      metalDiscounts: shop.metal_discounts || {},
      customRates: shop.custom_rates || {},
      useRegionalRateLabels: !!shop.use_regional_rate_labels,
      todayManualRenderCount,
      subscription: {
        status: subStatus,
        isExpired,
        startDate,
        endDate,
        plan: sub?.plan || "Standard",
        agentName
      },
      todayVideo
    });
  } catch (err: any) {
    console.error("GET /api/shop/details error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch shop details" }, { status: 500 });
  }
}
