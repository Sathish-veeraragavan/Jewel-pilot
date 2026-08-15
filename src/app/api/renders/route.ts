import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getR2PresignedUploadUrl, deleteFromR2 } from "@/utils/r2";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Role helper check
async function checkRole(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const supabaseAdmin = getAdminSupabase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role || null;
}

function formatShopPhone(phoneStr: string): string {
  if (!phoneStr) return "";
  const parts = phoneStr.split(/[,/;]|\s{2,}/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `PH: ${parts[0]}`;
  return `PH: ${parts.join(" / ")}`;
}

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // 'jobs' or 'logs'
  const jobId = searchParams.get("job_id");

  try {
    if (type === "logs" && jobId) {
      const { data: logs, error: logsErr } = await supabaseAdmin
        .from("render_job_logs")
        .select("id, log_level, message, created_at")
        .eq("render_job_id", jobId)
        .order("created_at", { ascending: true });

      if (logsErr) throw logsErr;
      return NextResponse.json(logs);
    }

    if (jobId) {
      const { data: job, error: jobErr } = await supabaseAdmin
        .from("render_jobs")
        .select(`
          id, job_number, status, priority, scheduled_at, started_at, completed_at, 
          rendered_video_url, worker_id, retry_count, error_message, is_demo, demo_metadata,
          shops(name),
          templates(name),
          videos(title)
        `)
        .eq("id", jobId)
        .maybeSingle();

      if (jobErr) throw jobErr;
      return NextResponse.json(job);
    }

    // Default: fetch all jobs with joins (limit fields)
    const { data: jobs, error: jobsErr } = await supabaseAdmin
      .from("render_jobs")
      .select(`
        id, job_number, status, priority, scheduled_at, started_at, completed_at, 
        rendered_video_url, worker_id, retry_count, error_message,
        shops(name),
        templates(name),
        videos(title)
      `)
      .order("created_at", { ascending: false });

    if (jobsErr) throw jobsErr;

    const mappedJobs = (jobs || []).map((job: any) => ({
      ...job,
      shops: job.shops ? {
        name: job.shops.name,
        shop_name: job.shops.name
      } : null
    }));

    return NextResponse.json(mappedJobs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();
  const body = await request.json();
  const { action, worker_id, shop_id, template_id, video_library_id, priority } = body;

  try {
    // 1. Worker checkout / polling: POST with action 'dequeue'
    if (action === "dequeue") {
      if (!worker_id) {
        return NextResponse.json({ error: "Missing worker_id" }, { status: 400 });
      }
 
      // Perform automated R2 cleanup of expired render outputs
      try {
        const { data: retentionSetting } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("setting_key", "render_retention_hours")
          .maybeSingle();
        
        const retentionHours = Number(retentionSetting?.value || 24);
        const retentionLimit = new Date();
        retentionLimit.setHours(retentionLimit.getHours() - retentionHours);
 
        const { data: expiredJobs } = await supabaseAdmin
          .from("render_jobs")
          .select("id, rendered_video_url")
          .eq("status", "Completed")
          .not("rendered_video_url", "is", null)
          .lt("completed_at", retentionLimit.toISOString())
          .limit(5);
 
        if (expiredJobs && expiredJobs.length > 0) {
          for (const job of expiredJobs) {
            if (job.rendered_video_url) {
              await deleteFromR2(job.rendered_video_url);
              await supabaseAdmin
                .from("render_jobs")
                .update({ rendered_video_url: null })
                .eq("id", job.id);
            }
          }
        }
      } catch (cleanupErr) {
        console.error("Automated R2 retention cleanup error:", cleanupErr);
      }

      // Fetch top Pending/Queued/Retrying job from queue table (sorted by priority desc, position asc)
      const { data: queueItem, error: queueErr } = await supabaseAdmin
        .from("render_queue")
        .select("id, render_job_id")
        .in("status", ["Pending", "Retrying"])
        .order("priority", { ascending: false })
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Fetch system settings for cleanup config
      const { data: vpsSettings } = await supabaseAdmin
        .from("system_settings")
        .select("setting_key, value")
        .in("setting_key", ["vps_cleanup_time", "render_retention_hours"]);

      const cleanupTime = vpsSettings?.find(s => s.setting_key === "vps_cleanup_time")?.value || "21:00";
      const retentionHours = Number(vpsSettings?.find(s => s.setting_key === "render_retention_hours")?.value || 24);

      if (queueErr) throw queueErr;
      if (!queueItem) {
        return NextResponse.json({ 
          message: "No pending jobs in queue",
          vps_cleanup_time: cleanupTime,
          render_retention_hours: retentionHours
        });
      }

      const jobId = queueItem.render_job_id;

      // Verify gold rates are published for this job's scheduled date before letting worker process
      const { data: jobCheck } = await supabaseAdmin
        .from("render_jobs")
        .select("shop_id, template_id, video_library_id, commodity_rate_id, scheduled_at")
        .eq("id", jobId)
        .single();

      if (jobCheck) {
        let rate = null;
        let scheduledDate = null;

        if (jobCheck.commodity_rate_id) {
          const { data: directRate } = await supabaseAdmin
            .from("gold_rates")
            .select("id, rate_date")
            .eq("id", jobCheck.commodity_rate_id)
            .maybeSingle();
          if (directRate) {
            rate = directRate;
            scheduledDate = directRate.rate_date;
          }
        }

        if (!rate) {
          // Fallback to schedules mapping
          let targetDateStr = null;
          if (jobCheck.scheduled_at) {
            targetDateStr = jobCheck.scheduled_at.split("T")[0];
          }

          let scheduleQuery = supabaseAdmin
            .from("schedules")
            .select("scheduled_date")
            .eq("shop_id", jobCheck.shop_id)
            .eq("video_id", jobCheck.video_library_id)
            .eq("template_id", jobCheck.template_id);

          if (targetDateStr) {
            scheduleQuery = scheduleQuery.eq("scheduled_date", targetDateStr);
          } else {
            scheduleQuery = scheduleQuery.order("scheduled_date", { ascending: false });
          }

          const { data: schedule } = await scheduleQuery
            .limit(1)
            .maybeSingle();

          scheduledDate = schedule?.scheduled_date || new Date().toISOString().split("T")[0];

          let { data: fallbackRate } = await supabaseAdmin
            .from("gold_rates")
            .select("id, rate_date")
            .eq("rate_date", scheduledDate)
            .maybeSingle();

          if (!fallbackRate) {
            // Fallback to most recent published rate
            const { data: latestRate } = await supabaseAdmin
              .from("gold_rates")
              .select("id, rate_date")
              .order("rate_date", { ascending: false })
              .limit(1)
              .maybeSingle();
            fallbackRate = latestRate;
          }

          rate = fallbackRate;
        }
      }

      // Lock the job to the worker
      const { error: lockErr } = await supabaseAdmin
        .from("render_jobs")
        .update({
          status: "Processing",
          worker_id: worker_id,
          started_at: new Date()
        })
        .eq("id", jobId);

      if (lockErr) throw lockErr;

      // Update queue status
      await supabaseAdmin
        .from("render_queue")
        .update({ status: "Processing", worker_assigned: worker_id })
        .eq("id", queueItem.id);

      // Log progress
      await supabaseAdmin
        .from("render_job_logs")
        .insert([{
          render_job_id: jobId,
          log_level: "Info",
          message: `Job checkout by worker: ${worker_id}. Transitioning status to Processing.`
        }]);

      // Retrieve full parameter details to return to worker
      const { data: jobDetails } = await supabaseAdmin
        .from("render_jobs")
        .select(`
          id, shop_id, template_id, video_library_id, occasion_id, commodity_rate_id, scheduled_at, is_demo, demo_metadata
        `)
        .eq("id", jobId)
        .single();
 
      if (!jobDetails) {
        return NextResponse.json({ error: "Failed to load job details" }, { status: 500 });
      }
 
      // 1. Resolve demo vs normal details
      if (jobDetails.is_demo && (jobDetails.demo_metadata as any)?.is_rotation) {
        const demoMeta: any = jobDetails.demo_metadata || {};
        let presignedUploadUrl = "";
        let r2PublicUrl = "";
        try {
          const presignedData = await getR2PresignedUploadUrl(`${jobDetails.id}_final.mp4`, "video/mp4", "renders");
          if (presignedData) {
            presignedUploadUrl = presignedData.url;
            r2PublicUrl = presignedData.publicUrl;
          }
        } catch (presignedErr) {
          console.error("Failed to generate presigned R2 upload URL for rotation:", presignedErr);
        }

        return NextResponse.json({
          id: jobDetails.id,
          is_rotation: true,
          angle: demoMeta.angle || "90_cw",
          source_video_url: demoMeta.source_video_url,
          presigned_upload_url: presignedUploadUrl,
          r2_public_url: r2PublicUrl,
          vps_cleanup_time: cleanupTime,
          render_retention_hours: retentionHours
        });
      }

      let shop: any = null;
      let goldRate: any = null;
      let scheduledDate = new Date().toISOString().split("T")[0];
      let languageName = "english";
      let schedule: any = null;
      let shopAssocId = null;

      if (jobDetails.is_demo) {
        const demoMeta: any = jobDetails.demo_metadata || {};
        shop = {
          name: demoMeta.shop_name || "Demo Shop",
          phone: demoMeta.shop_phone || "9999999999",
          address: demoMeta.shop_address || "Demo Address",
          city: "Demo City",
          logo_url: demoMeta.logo_url || "",
          qr_code_url: demoMeta.qr_code_url || null,
          language_id: null,
          selected_rates: demoMeta.selected_rates || ["rate_22k_1g", "rate_22k_8g", "rate_silver_1g"],
          association_id: null,
          pricing_mode: "custom_manual",
          discount_type: null,
          discount_value: null,
          metal_discounts: null,
          custom_rates: demoMeta.rates || {},
          use_regional_rate_labels: false
        };

        goldRate = {
          rate_22k: demoMeta.rates?.rate_22k || "6500",
          rate_24k: demoMeta.rates?.rate_24k || "7100",
          rate_18k: demoMeta.rates?.rate_18k || "5300",
          rate_9k: demoMeta.rates?.rate_9k || "2600",
          rate_silver: demoMeta.rates?.rate_silver || "90"
        };
      } else {
        // Normal Flow
        let targetDateStr = null;
        if (jobDetails.scheduled_at) {
          targetDateStr = jobDetails.scheduled_at.split("T")[0];
        }
 
        let scheduleQuery = supabaseAdmin
          .from("schedules")
          .select(`
            scheduled_date,
            audio_track_id,
            music_tracks:audio_track_id(cloudflare_url),
            occasions(name)
          `)
          .eq("shop_id", jobDetails.shop_id)
          .eq("video_id", jobDetails.video_library_id)
          .eq("template_id", jobDetails.template_id);
 
        if (targetDateStr) {
          scheduleQuery = scheduleQuery.eq("scheduled_date", targetDateStr);
        } else {
          scheduleQuery = scheduleQuery.order("scheduled_date", { ascending: false });
        }
 
        const { data: scheduleData } = await scheduleQuery
          .limit(1)
          .maybeSingle();
 
        schedule = scheduleData;
        scheduledDate = schedule?.scheduled_date || new Date().toISOString().split("T")[0];
 
        // Sync schedule status to processing
        if (jobCheck) {
          await supabaseAdmin
            .from("schedules")
            .update({ render_status: "processing" })
            .eq("shop_id", jobCheck.shop_id)
            .eq("template_id", jobCheck.template_id)
            .eq("video_id", jobCheck.video_library_id)
            .eq("scheduled_date", scheduledDate);
        }
 
        // 2. Fetch shop info first to resolve rate association
        const { data: shopData } = await supabaseAdmin
          .from("shops")
          .select("name, phone, address, city, logo_url, qr_code_url, language_id, selected_rates, association_id, pricing_mode, discount_type, discount_value, metal_discounts, custom_rates, use_regional_rate_labels")
          .eq("id", jobDetails.shop_id)
          .single();
        
        shop = shopData;
        shopAssocId = shop?.association_id;
      }
 
      goldRate = null;
 
      if (jobDetails.is_demo) {
        const demoMeta: any = jobDetails.demo_metadata || {};
        goldRate = {
          rate_22k: demoMeta.rates?.rate_22k || "6500",
          rate_24k: demoMeta.rates?.rate_24k || "7100",
          rate_18k: demoMeta.rates?.rate_18k || "5300",
          rate_9k: demoMeta.rates?.rate_9k || "2600",
          rate_silver: demoMeta.rates?.rate_silver || "90"
        };
      }
 
      // Primary: Check if job is directly linked to a specific published commodity rate record
      if (!goldRate && jobDetails.commodity_rate_id) {
        const { data: directRate } = await supabaseAdmin
          .from("gold_rates")
          .select("rate_22k, rate_24k, rate_18k, rate_9k, rate_silver")
          .eq("id", jobDetails.commodity_rate_id)
          .maybeSingle();
        if (directRate) {
          goldRate = directRate;
        }
      }

      // Secondary: Fetch daily precious metal rates for this association on scheduledDate
      if (!goldRate) {
        let goldRateQuery = supabaseAdmin
          .from("gold_rates")
          .select("rate_22k, rate_24k, rate_18k, rate_9k, rate_silver")
          .eq("rate_date", scheduledDate);

        if (shopAssocId) {
          goldRateQuery = goldRateQuery.eq("association_id", shopAssocId);
        } else {
          goldRateQuery = goldRateQuery.is("association_id", null);
        }
        
        const { data: assocRate } = await goldRateQuery.maybeSingle();
        goldRate = assocRate;
      }

      // Tertiary: Fallback if no rate is found for this specific association on this date
      if (!goldRate && shopAssocId) {
        const { data: fallbackRate } = await supabaseAdmin
          .from("gold_rates")
          .select("rate_22k, rate_24k, rate_18k, rate_9k, rate_silver")
          .eq("rate_date", scheduledDate)
          .is("association_id", null)
          .maybeSingle();
        if (fallbackRate) {
          goldRate = fallbackRate;
        }
      }

      // Quaternary: Ultimate fallback to the most recently published gold rate overall
      if (!goldRate) {
        let latestQuery = supabaseAdmin
          .from("gold_rates")
          .select("rate_22k, rate_24k, rate_18k, rate_9k, rate_silver")
          .order("rate_date", { ascending: false })
          .limit(1);
        if (shopAssocId) {
          latestQuery = latestQuery.eq("association_id", shopAssocId);
        }
        const { data: latestRate } = await latestQuery.maybeSingle();
        goldRate = latestRate;
      }

      // Fetch previous day's rate for trend comparison
      let prevQuery = supabaseAdmin
        .from("gold_rates")
        .select("rate_22k")
        .lt("rate_date", scheduledDate)
        .order("rate_date", { ascending: false })
        .limit(1);

      if (shopAssocId) {
        prevQuery = prevQuery.eq("association_id", shopAssocId);
      } else {
        prevQuery = prevQuery.is("association_id", null);
      }

      let { data: prevGoldRate } = await prevQuery.maybeSingle();
      if (!prevGoldRate && shopAssocId) {
        const { data: fallbackPrev } = await supabaseAdmin
          .from("gold_rates")
          .select("rate_22k")
          .lt("rate_date", scheduledDate)
          .is("association_id", null)
          .order("rate_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallbackPrev) {
          prevGoldRate = fallbackPrev;
        }
      }

      // Resolve shop language
      languageName = "English";
      if (shop?.language_id) {
        const { data: langData } = await supabaseAdmin
          .from("languages")
          .select("language_name")
          .eq("id", shop.language_id)
          .maybeSingle();
        if (langData) {
          languageName = langData.language_name;
        }
      }

      const today22k = goldRate?.rate_22k ? Number(goldRate.rate_22k) : 0;
      const prev22k = prevGoldRate?.rate_22k ? Number(prevGoldRate.rate_22k) : 0;
      const diff22k = today22k - prev22k;

      // Generate trend comparison text in their selected locale language
      let trendText = "Gold Rate Unchanged";
      if (diff22k > 0) {
        switch (languageName.toLowerCase()) {
          case "tamil": trendText = `தங்க விலை ₹${diff22k} உயர்ந்துள்ளது`; break;
          case "hindi": trendText = `सोना ₹${diff22k} महंगा हुआ`; break;
          case "telugu": trendText = `బంగారం ధర ₹${diff22k} పెరిగింది`; break;
          case "kannada": trendText = `ಚಿನ್ನದ ದರ ₹${diff22k} ಹೆಚ್ಚಾಗಿದೆ`; break;
          case "malayalam": trendText = `സ്വർണ്ണവില ₹${diff22k} വർദ്ധിച്ചു`; break;
          case "marathi": trendText = `सोने ₹${diff22k} महागले`; break;
          case "gujarati": trendText = `સોનાના ભાવમાં ₹${diff22k} નો વધારો`; break;
          case "bengali": trendText = `সোনার দাম ₹${diff22k} বেড়েছে`; break;
          default: trendText = `Increased by ₹${diff22k}`;
        }
      } else if (diff22k < 0) {
        const absDiff = Math.abs(diff22k);
        switch (languageName.toLowerCase()) {
          case "tamil": trendText = `தங்க விலை ₹${absDiff} குறைந்துள்ளது`; break;
          case "hindi": trendText = `सोना ₹${absDiff} सस्ता हुआ`; break;
          case "telugu": trendText = `బంగారం ధర ₹${absDiff} తగ్గింది`; break;
          case "kannada": trendText = `ಚಿನ್ನದ ದರ ₹${absDiff} ಕಡಿಮೆಯಾಗಿದೆ`; break;
          case "malayalam": trendText = `സ്വർണ്ണവില ₹${absDiff} കുറഞ്ഞു`; break;
          case "marathi": trendText = `सोने ₹${absDiff} स्वस्त झाले`; break;
          case "gujarati": trendText = `સોનાના ભાવમાં ₹${absDiff} નો ઘટાડો`; break;
          case "bengali": trendText = `সোনার দাম ₹${absDiff} কমেছে`; break;
          default: trendText = `Decreased by ₹${absDiff}`;
        }
      } else {
        switch (languageName.toLowerCase()) {
          case "tamil": trendText = `தங்க விலையில் மாற்றமில்லை`; break;
          case "hindi": trendText = `सोने के भाव में कोई बदलाव नहीं`; break;
          case "telugu": trendText = `బంగారం ధరలో మార్పు లేదు`; break;
          case "kannada": trendText = `ಚಿನ್ನದ ದರದಲ್ಲಿ ಬದಲಾವणे ಇಲ್ಲ`; break;
          case "malayalam": trendText = `സ്വർണ്ണവിലയിൽ മാറ്റമില്ല`; break;
          case "marathi": trendText = `सोन्याच्या दरात कोणताही बदल नाही`; break;
          case "gujarati": trendText = `સોનાના ભાવમાં કોઈ ફેરફાર નથી`; break;
          case "bengali": trendText = `সোনার দামে কোনো পরিবর্তন নেই`; break;
          default: trendText = `Gold Rate Unchanged`;
        }
      }

      // Check system_settings for custom shop outro override
      const { data: outroSetting } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("setting_key", `outro_video_${jobDetails.shop_id}`)
        .maybeSingle();

      const shopOutroUrl = outroSetting?.value || null;

      // 4. Fetch template info
      const { data: template } = await supabaseAdmin
        .from("templates")
        .select("bg_image_url, outro_url, config")
        .eq("id", jobDetails.template_id)
        .single();

      // 5. Fetch video info
      const { data: video } = await supabaseAdmin
        .from("videos")
        .select("cloudflare_url")
        .eq("id", jobDetails.video_library_id)
        .single();

      let audioTrackUrl = null;
      let stripOriginalAudio = true;
 
      if (jobDetails.is_demo) {
        const { data: tracks } = await supabaseAdmin
          .from("music_tracks")
          .select("cloudflare_url")
          .eq("is_active", true);
        if (tracks && tracks.length > 0) {
          audioTrackUrl = tracks[0].cloudflare_url;
        }
      } else if (!schedule || !schedule.audio_track_id) {
        stripOriginalAudio = false;
        audioTrackUrl = null;
      } else {
        audioTrackUrl = (schedule as any)?.music_tracks?.cloudflare_url || null;

        // If audio_track_id is assigned but not resolved, fallback to random active track
        if (!audioTrackUrl && schedule?.audio_track_id) {
          const { data: tracks } = await supabaseAdmin
            .from("music_tracks")
            .select("cloudflare_url")
            .eq("is_active", true);

          if (tracks && tracks.length > 0) {
            const randomIndex = Math.floor(Math.random() * tracks.length);
            audioTrackUrl = tracks[randomIndex].cloudflare_url;
          }
        }
      }

      const selectedRates = shop?.selected_rates || ['rate_22k_1g', 'rate_22k_8g', 'rate_silver_1g'];
      const placeholders: Record<string, string> = {};

      for (let i = 1; i <= 4; i++) {
        placeholders[`placeholder_${i}_title`] = "";
        placeholders[`placeholder_${i}_price`] = "";
      }

      // Apply Shop Pricing Mode (Default vs Promotional Discount vs Custom Manual Rates)
      const shopPricingMode = shop?.pricing_mode || "default";
      const shopDiscountType = shop?.discount_type || "percentage";
      const shopDiscountValue = Number(shop?.discount_value) || 0;
      const shopCustomRates = shop?.custom_rates || {};

      let effectiveGoldRate = { ...goldRate };
      if (shopPricingMode === "custom_manual" && shopCustomRates) {
        if (shopCustomRates.rate_22k) effectiveGoldRate.rate_22k = shopCustomRates.rate_22k;
        if (shopCustomRates.rate_24k) effectiveGoldRate.rate_24k = shopCustomRates.rate_24k;
        if (shopCustomRates.rate_18k) effectiveGoldRate.rate_18k = shopCustomRates.rate_18k;
        if (shopCustomRates.rate_9k) effectiveGoldRate.rate_9k = shopCustomRates.rate_9k;
        if (shopCustomRates.rate_silver) effectiveGoldRate.rate_silver = shopCustomRates.rate_silver;
      } else if (shopPricingMode === "discount") {
        const metalDiscountsObj = shop?.metal_discounts || {};

        const getDiscountForMetal = (metalKey: string) => {
          const itemConfig = metalDiscountsObj[metalKey];
          if (itemConfig && itemConfig.value > 0) {
            return itemConfig;
          }
          if (shopDiscountValue > 0) {
            return { type: shopDiscountType, value: shopDiscountValue };
          }
          return null;
        };

        const applyMetalDiscount = (baseVal: number, metalKey: string) => {
          if (!baseVal || baseVal <= 0) return baseVal;
          const discountCfg = getDiscountForMetal(metalKey);
          if (!discountCfg) return baseVal;

          if (discountCfg.type === "percentage") {
            return Math.max(0, Math.round(baseVal - (baseVal * discountCfg.value / 100)));
          } else {
            return Math.max(0, Math.round(baseVal - discountCfg.value));
          }
        };

        if (effectiveGoldRate.rate_22k) effectiveGoldRate.rate_22k = applyMetalDiscount(Number(effectiveGoldRate.rate_22k), "22k");
        if (effectiveGoldRate.rate_24k) effectiveGoldRate.rate_24k = applyMetalDiscount(Number(effectiveGoldRate.rate_24k), "24k");
        if (effectiveGoldRate.rate_18k) effectiveGoldRate.rate_18k = applyMetalDiscount(Number(effectiveGoldRate.rate_18k), "18k");
        if (effectiveGoldRate.rate_9k) effectiveGoldRate.rate_9k = applyMetalDiscount(Number(effectiveGoldRate.rate_9k), "9k");
        if (effectiveGoldRate.rate_silver) effectiveGoldRate.rate_silver = applyMetalDiscount(Number(effectiveGoldRate.rate_silver), "silver");
      }

      const isRegional = !!shop?.use_regional_rate_labels;
      const langLower = languageName.toLowerCase();

      selectedRates.forEach((rateKey: string, idx: number) => {
        const slotNum = idx + 1;
        if (slotNum > 4) return;

        let title = "";
        let priceVal = 0;

        switch (rateKey) {
          case "rate_22k_1g":
            if (isRegional && langLower === "tamil") title = "1 கிராம் 22 கேரட்";
            else if (isRegional && langLower === "telugu") title = "1 గ్రామ్ 22K";
            else if (isRegional && langLower === "kannada") title = "1 ಗ್ರಾಂ 22K";
            else if (isRegional && langLower === "malayalam") title = "1 ഗ്രാം 22K";
            else if (isRegional && langLower === "hindi") title = "1 ग्राम 22K";
            else title = "1GM 22K";
            priceVal = effectiveGoldRate?.rate_22k ? Number(effectiveGoldRate.rate_22k) : 0;
            break;
          case "rate_22k_8g":
            if (isRegional && langLower === "tamil") title = "8 கிராம் 22 கேரட்";
            else if (isRegional && langLower === "telugu") title = "8 గ్రాములు 22K";
            else if (isRegional && langLower === "kannada") title = "8 ಗ್ರಾಂ 22K";
            else if (isRegional && langLower === "malayalam") title = "8 ഗ്രാം 22K";
            else if (isRegional && langLower === "hindi") title = "8 ग्राम 22K";
            else title = "8GM 22K";
            priceVal = effectiveGoldRate?.rate_22k ? Number(effectiveGoldRate.rate_22k) * 8 : 0;
            break;
          case "rate_24k_1g":
            if (isRegional && langLower === "tamil") title = "1 கிராம் 24 கேரட்";
            else if (isRegional && langLower === "telugu") title = "1 గ్రామ్ 24K";
            else if (isRegional && langLower === "kannada") title = "1 ಗ್ರಾಂ 24K";
            else if (isRegional && langLower === "malayalam") title = "1 ഗ്രാം 24K";
            else if (isRegional && langLower === "hindi") title = "1 ग्राम 24K";
            else title = "1GM 24K";
            priceVal = effectiveGoldRate?.rate_24k ? Number(effectiveGoldRate.rate_24k) : 0;
            break;
          case "rate_18k_1g":
            if (isRegional && langLower === "tamil") title = "1 கிராம் 18 கேரட்";
            else if (isRegional && langLower === "telugu") title = "1 గ్రామ్ 18K";
            else if (isRegional && langLower === "kannada") title = "1 ಗ್ರಾಂ 18K";
            else if (isRegional && langLower === "malayalam") title = "1 ഗ്രാം 18K";
            else if (isRegional && langLower === "hindi") title = "1 ग्राम 18K";
            else title = "1GM 18K";
            priceVal = effectiveGoldRate?.rate_18k ? Number(effectiveGoldRate.rate_18k) : 0;
            break;
          case "rate_18k_8g":
            if (isRegional && langLower === "tamil") title = "8 கிராம் 18 கேரட்";
            else if (isRegional && langLower === "telugu") title = "8 గ్రాములు 18K";
            else if (isRegional && langLower === "kannada") title = "8 ಗ್ರಾಂ 18K";
            else if (isRegional && langLower === "malayalam") title = "8 ഗ്രാം 18K";
            else if (isRegional && langLower === "hindi") title = "8 ग्राम 18K";
            else title = "8GM 18K";
            priceVal = effectiveGoldRate?.rate_18k ? Number(effectiveGoldRate.rate_18k) * 8 : 0;
            break;
          case "rate_9k_1g":
            if (isRegional && langLower === "tamil") title = "1 கிராம் 9 கேரட்";
            else if (isRegional && langLower === "telugu") title = "1 గ్రామ్ 9K";
            else if (isRegional && langLower === "kannada") title = "1 ಗ್ರಾಂ 9K";
            else if (isRegional && langLower === "malayalam") title = "1 ഗ്രാം 9K";
            else if (isRegional && langLower === "hindi") title = "1 ग्राम 9K";
            else title = "1GM 9K";
            priceVal = effectiveGoldRate?.rate_9k ? Number(effectiveGoldRate.rate_9k) : 0;
            break;
          case "rate_silver_1g":
            if (isRegional && langLower === "tamil") title = "1 கிராம் வெள்ளி";
            else if (isRegional && langLower === "telugu") title = "1 గ్రామ్ వెండి";
            else if (isRegional && langLower === "kannada") title = "1 ಗ್ರಾಂ ಬೆಳ್ಳಿ";
            else if (isRegional && langLower === "malayalam") title = "1 ഗ്രാം വെള്ളി";
            else if (isRegional && langLower === "hindi") title = "1 ग्राम चांदी";
            else title = "1GM SILVER";
            priceVal = effectiveGoldRate?.rate_silver ? Number(effectiveGoldRate.rate_silver) : 0;
            break;
        }

        placeholders[`placeholder_${slotNum}_title`] = title;
        placeholders[`placeholder_${slotNum}_price`] = priceVal > 0 ? priceVal.toString() : "";
      });

      // Format scheduledDate (YYYY-MM-DD) to "DD - MMMM - YYYY"
      const dateParts = scheduledDate.split("-");
      let formattedDate = scheduledDate;
      if (dateParts.length === 3) {
        const monthNames = [
          "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
          "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
        ];
        const day = dateParts[2];
        const monthIdx = parseInt(dateParts[1], 10) - 1;
        const year = dateParts[0];
        if (monthIdx >= 0 && monthIdx < 12) {
          formattedDate = `${day} - ${monthNames[monthIdx]} - ${year}`;
        }
      }

      let presignedUploadUrl = "";
      let r2PublicUrl = "";
      try {
        const presignedData = await getR2PresignedUploadUrl(`${jobDetails.id}_final.mp4`, "video/mp4", "renders");
        if (presignedData) {
          presignedUploadUrl = presignedData.url;
          r2PublicUrl = presignedData.publicUrl;
        }
      } catch (presignedErr) {
        console.error("Failed to generate presigned R2 upload URL for worker:", presignedErr);
      }

      return NextResponse.json({
        presigned_upload_url: presignedUploadUrl,
        r2_public_url: r2PublicUrl,
        id: jobDetails.id,
        shop_id: jobDetails.shop_id,
        template_id: jobDetails.template_id,
        video_library_id: jobDetails.video_library_id,
        video_url: video?.cloudflare_url || null,
        logo_url: shop?.logo_url || null,
        qr_code_url: shop?.qr_code_url || null,
        bg_image_url: template?.bg_image_url || null,
        outro_url: shopOutroUrl || template?.outro_url || null,
        audio_track_url: audioTrackUrl || null,
        template_config: template?.config || null,
        
        shop_name: shop?.name || "",
        shop_phone: shop?.phone ? formatShopPhone(shop.phone) : "",
        shop_address: shop?.address || "",
        scheduled_date: scheduledDate,
        formatted_date: formattedDate,
        festival_text: (schedule?.occasions as any)?.name || "",
        
        // Rates
        rate_22k: goldRate?.rate_22k || "",
        rate_24k: goldRate?.rate_24k || "",
        rate_22k_8gm: goldRate?.rate_22k ? (Number(goldRate.rate_22k) * 8).toString() : "",
        rate_24k_8gm: goldRate?.rate_24k ? (Number(goldRate.rate_24k) * 8).toString() : "",
        silver_rate: goldRate?.rate_silver || "",
        rate_change_text: trendText,
        
        // Dynamic placeholders
        ...placeholders,
        
        strip_original_audio: stripOriginalAudio,
        vps_cleanup_time: cleanupTime,
        render_retention_hours: retentionHours
      });
    }

    // 2. Manual creation of Render Job
    const role = await checkRole(supabaseUser);
    if (!role || (role !== "super_admin" && role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!shop_id || !template_id || !video_library_id) {
      return NextResponse.json({ error: "Missing required references" }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("association_id")
      .eq("id", shop_id)
      .single();

    let rateQuery = supabaseAdmin
      .from("gold_rates")
      .select("id")
      .eq("rate_date", todayStr);

    if (shop?.association_id) {
      rateQuery = rateQuery.eq("association_id", shop.association_id);
    } else {
      rateQuery = rateQuery.is("association_id", null);
    }

    const { data: todayRate } = await rateQuery.maybeSingle();

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("render_jobs")
      .insert([{
        shop_id,
        template_id,
        video_library_id,
        priority: priority || "Medium",
        status: "Pending",
        commodity_rate_id: todayRate?.id || null
      }])
      .select()
      .single();

    if (jobErr) throw jobErr;

    // Map priority string value to queue priority integer
    const priorityInt = priority === "Critical" ? 100 : priority === "High" ? 50 : priority === "Low" ? 0 : 25;

    // Add to queue
    await supabaseAdmin
      .from("render_queue")
      .insert([{
        render_job_id: job.id,
        priority: priorityInt,
        status: "Pending"
      }]);

    // Initial logs insert
    await supabaseAdmin
      .from("render_job_logs")
      .insert([{
        render_job_id: job.id,
        log_level: "Info",
        message: "Render job manually created and pushed to queues."
      }]);

    return NextResponse.json(job);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  const body = await request.json();
  const { id, status, error_message, rendered_video_url, thumbnail_url } = body;

  try {
    const { data: currentJob } = await supabaseAdmin
      .from("render_jobs")
      .select("status, retry_count, max_retry, shop_id, template_id, video_library_id, scheduled_at")
      .eq("id", id)
      .single();

    if (!currentJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const updatePayload: any = { status, updated_at: new Date() };

    if (status === "Completed") {
      updatePayload.completed_at = new Date();
      updatePayload.rendered_video_url = rendered_video_url;
      updatePayload.thumbnail_url = thumbnail_url;

      // Sync completed video URL to schedules table
      if (currentJob) {
        const scheduledDate = currentJob.scheduled_at 
          ? new Date(currentJob.scheduled_at).toISOString().split("T")[0] 
          : new Date().toISOString().split("T")[0];

        await supabaseAdmin
          .from("schedules")
          .update({
            render_status: "completed",
            rendered_video_url: rendered_video_url
          })
          .eq("shop_id", currentJob.shop_id)
          .eq("template_id", currentJob.template_id)
          .eq("video_id", currentJob.video_library_id)
          .eq("scheduled_date", scheduledDate);
      }
    } else if (status === "Failed") {
      updatePayload.failed_at = new Date();
      updatePayload.error_message = error_message;

      // Handle retries
      if (currentJob && currentJob.retry_count < currentJob.max_retry) {
        updatePayload.status = "Retrying";
        updatePayload.retry_count = currentJob.retry_count + 1;
      }

      // Sync failed/retrying status to schedules table
      if (currentJob) {
        const scheduledDate = currentJob.scheduled_at 
          ? new Date(currentJob.scheduled_at).toISOString().split("T")[0] 
          : new Date().toISOString().split("T")[0];

        await supabaseAdmin
          .from("schedules")
          .update({
            render_status: updatePayload.status === "Retrying" ? "processing" : "failed"
          })
          .eq("shop_id", currentJob.shop_id)
          .eq("template_id", currentJob.template_id)
          .eq("video_id", currentJob.video_library_id)
          .eq("scheduled_date", scheduledDate);
      }
    } else if (status === "Cancelled") {
      updatePayload.error_message = error_message || "Cancelled by administrator.";

      // Sync cancelled status to schedules table
      if (currentJob) {
        const scheduledDate = currentJob.scheduled_at 
          ? new Date(currentJob.scheduled_at).toISOString().split("T")[0] 
          : new Date().toISOString().split("T")[0];

        await supabaseAdmin
          .from("schedules")
          .update({
            render_status: "failed"
          })
          .eq("shop_id", currentJob.shop_id)
          .eq("template_id", currentJob.template_id)
          .eq("video_id", currentJob.video_library_id)
          .eq("scheduled_date", scheduledDate);
      }
    }

    const { error: jobErr } = await supabaseAdmin
      .from("render_jobs")
      .update(updatePayload)
      .eq("id", id);

    if (jobErr) throw jobErr;

    // Sync queue item status (Delete if Completed, Failed permanently, or Cancelled)
    if (status === "Completed" || (status === "Failed" && updatePayload.status !== "Retrying") || status === "Cancelled") {
      await supabaseAdmin.from("render_queue").delete().eq("render_job_id", id);
    } else {
      await supabaseAdmin
        .from("render_queue")
        .update({ status: updatePayload.status })
        .eq("render_job_id", id);
    }

    // Insert execution log
    await supabaseAdmin
      .from("render_job_logs")
      .insert([{
        render_job_id: id,
        log_level: status === "Completed" ? "Info" : status === "Cancelled" ? "Warn" : "Error",
        message: status === "Completed" 
          ? `Render completed successfully! Output: ${rendered_video_url}`
          : status === "Cancelled"
            ? `Render cancelled by administrator.`
            : `Render failed. Error: ${error_message}. ${updatePayload.status === "Retrying" ? `Retrying (${updatePayload.retry_count}/${currentJob.max_retry})` : "Max retries reached."}`
      }]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}
