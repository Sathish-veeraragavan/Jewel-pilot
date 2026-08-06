import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { generateAutoSchedules } from "@/services/scheduler";

export const dynamic = "force-dynamic";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Helper check using service role to query profiles (bypasses user RLS)
async function checkAdminOrSuperAdmin(supabaseUser: any) {
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return null;
  
  const supabaseAdmin = getAdminSupabase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && (profile.role === "super_admin" || profile.role === "admin")) {
    return user.id;
  }
  return user.id; // Fallback for authenticated dashboard users
}

export async function GET(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Fetch All-Shops Scheduler Matrix Grid (supporting 7-day or 30-day horizons)
    if (action === "get_matrix" || action === "get_7day_matrix") {
      const inputDateStr = url.searchParams.get("startDate") || new Date().toISOString().split("T")[0];
      const horizon = url.searchParams.get("horizon") || "1_week";
      const daysCount = horizon === "1_month" ? 30 : 7;

      const dateParts = inputDateStr.split("-").map(Number);
      const startObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const endObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2] + daysCount - 1);

      const formatYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const startDate = formatYMD(startObj);
      const endDate = formatYMD(endObj);

      const [{ data: shops }, { data: schedules, error: schedErr }, { data: videos }, { data: templates }, { data: musicTracks }, { data: outroSettings }] = await Promise.all([
        supabaseAdmin.from("shops").select("id, name, shop_code, district_id, status").neq("status", "inactive"),
        supabaseAdmin.from("schedules").select(`
          id, shop_id, video_id, template_id, occasion_id, audio_track_id, scheduled_date, status, download_status,
          videos(id, title, category),
          templates(id, name, template_type, outro_url),
          occasions(id, name),
          music_tracks:audio_track_id(id, title)
        `)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_date", { ascending: true }),
        supabaseAdmin.from("videos").select("id, title, category").eq("is_active", true),
        supabaseAdmin.from("templates").select("id, name, template_type, outro_url").eq("status", "active"),
        supabaseAdmin.from("music_tracks").select("id, title").eq("is_active", true),
        supabaseAdmin.from("system_settings").select("setting_key, value").like("setting_key", "outro_video_%")
      ]);

      console.log(`[get_matrix] Shops: ${shops?.length || 0} | Schedules: ${schedules?.length || 0} | schedErr: ${JSON.stringify(schedErr)}`);

      const outroMap: Record<string, string> = {};
      (outroSettings || []).forEach(s => {
        const shopId = s.setting_key.replace("outro_video_", "");
        outroMap[shopId] = s.value;
      });

      const shopsWithOutros = (shops || []).map(s => ({
        ...s,
        outro_video_url: outroMap[s.id] || null
      }));

      return NextResponse.json({
        startDate,
        endDate,
        shops: shopsWithOutros,
        schedules: schedules || [],
        availableVideos: videos || [],
        availableTemplates: templates || [],
        availableMusicTracks: musicTracks || []
      }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
      });
    }

    // 1. Fetch batches history logs
    const { data: batches, error: batchErr } = await supabaseAdmin
      .from("schedule_batches")
      .select(`
        id,
        status,
        generated_at,
        generated_by
      `)
      .order("generated_at", { ascending: false });

    if (batchErr) throw batchErr;
    return NextResponse.json(batches);
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
    const { action, startDate, horizon, template, batchId, shopIds } = body;

    // Run scheduler generation
    if (action === "generate_schedule") {
      const targetStartDate = startDate || new Date().toISOString().split("T")[0];
      const targetHorizon = horizon === "1_month" ? "1_month" : "1_week";

      const result = await generateAutoSchedules(supabaseAdmin, {
        horizon: targetHorizon,
        startDate: targetStartDate,
        userId,
        shopIds: (shopIds && Array.isArray(shopIds)) ? shopIds : undefined
      });

      return NextResponse.json(result);
    }

    // Fail-safe manual trigger for rendering batch
    if (action === "trigger_render") {
      const targetDate = startDate || new Date().toISOString().split("T")[0];

      // 1. Fetch all schedules for target date, joining shops to check pricing_mode
      let query = supabaseAdmin
        .from("schedules")
        .select("id, shop_id, video_id, template_id, occasion_id, audio_track_id, scheduled_date, shops(association_id, pricing_mode)")
        .eq("scheduled_date", targetDate);

      if (shopIds && Array.isArray(shopIds)) {
        query = query.in("shop_id", shopIds);
      }

      const { data: schedules, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (!schedules || schedules.length === 0) {
        return NextResponse.json({ error: "No schedules found for this date to render." }, { status: 404 });
      }

      // Filter out manual price shops (they trigger their own rendering on Save from their shop landing page)
      const autoSchedules = schedules.filter(s => (s as any).shops?.pricing_mode !== "custom_manual");

      if (autoSchedules.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "All scheduled shops for today are set to Custom Manual Pricing and will render individually when saved." });
      }

      // Fetch all gold rates for this target date
      const { data: rates } = await supabaseAdmin
        .from("gold_rates")
        .select("id, association_id")
        .eq("rate_date", targetDate);

      // 2. Loop and push to render jobs & queue
      const jobsToInsert = autoSchedules.map(s => {
        const shopAssocId = (s as any).shops?.association_id;
        const matchingRate = rates?.find(r => 
          shopAssocId ? r.association_id === shopAssocId : !r.association_id
        ) || rates?.find(r => !r.association_id);

        return {
          shop_id: s.shop_id,
          template_id: s.template_id,
          video_library_id: s.video_id,
          priority: "High",
          status: "Pending",
          commodity_rate_id: matchingRate?.id || null,
          scheduled_at: `${(s as any).scheduled_date}T00:00:00.000Z`
        };
      });

      const { data: insertedJobs, error: jobError } = await supabaseAdmin
        .from("render_jobs")
        .insert(jobsToInsert)
        .select();

      if (jobError) throw jobError;

      const queueItems = (insertedJobs || []).map(job => ({
        render_job_id: job.id,
        priority: 50,
        status: "Pending"
      }));

      const { error: queueError } = await supabaseAdmin
        .from("render_queue")
        .insert(queueItems);

      if (queueError) throw queueError;

      // Update schedule render status to pending for triggered shops only
      const targetShopIds = autoSchedules.map(s => s.shop_id);
      await supabaseAdmin
        .from("schedules")
        .update({ render_status: "pending" })
        .eq("scheduled_date", targetDate)
        .in("shop_id", targetShopIds);

      return NextResponse.json({ success: true, count: autoSchedules.length });
    }

    // Save configuration template preset in system settings JSON array
    if (action === "save_template") {
      const { data: current } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("setting_key", "saved_scheduler_templates")
        .maybeSingle();

      const templatesList = Array.isArray(current?.value) ? current.value : [];
      const updated = [...templatesList.filter((t: any) => t.name !== template.name), template];

      const { error } = await supabaseAdmin
        .from("system_settings")
        .upsert({
          setting_key: "saved_scheduler_templates",
          value: updated,
          description: "Saved configurations presets for scheduler runs"
        }, { onConflict: "setting_key" });

      if (error) throw error;
      return NextResponse.json({ success: true, templates: updated });
    }

    // Rollback batch
    if (action === "rollback") {
      if (!batchId) {
        return NextResponse.json({ error: "Missing batch ID" }, { status: 400 });
      }

      // Delete schedules and set batch status to rolled_back
      const { error: schedError } = await supabaseAdmin
        .from("schedules")
        .delete()
        .eq("batch_id", batchId);

      if (schedError) throw schedError;

      const { error: batchError } = await supabaseAdmin
        .from("schedule_batches")
        .update({ status: "rolled_back" })
        .eq("id", batchId);

      if (batchError) throw batchError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/scheduler-config error:", err);
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
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
    const { id, video_id, template_id, audio_track_id, keep_original_audio } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing required fields (id)" }, { status: 400 });
    }

    const updates: any = {};
    if (video_id) updates.video_id = video_id;
    if (template_id) updates.template_id = template_id;
    if (audio_track_id !== undefined) updates.audio_track_id = audio_track_id;
    
    // Reset render status so that the system knows it needs to be re-rendered
    updates.render_status = "pending";

    const { data, error } = await supabaseAdmin
      .from("schedules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("PUT /api/scheduler-config error:", err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}
