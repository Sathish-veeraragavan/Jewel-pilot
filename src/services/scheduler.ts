import { SupabaseClient } from "@supabase/supabase-js";

export interface ScheduleGenerationOptions {
  horizon: "1_week" | "1_month";
  startDate: string; // YYYY-MM-DD
  userId?: string;
}

export interface ScheduleGenerationResult {
  success: boolean;
  batchId: string;
  totalScheduled: number;
  daysCount: number;
  shopsProcessed: number;
  logs: string[];
  warnings: string[];
}

export async function generateAutoSchedules(
  supabase: SupabaseClient,
  options: ScheduleGenerationOptions
): Promise<ScheduleGenerationResult> {
  const logs: string[] = [];
  const warnings: string[] = [];

  const daysCount = options.horizon === "1_week" ? 7 : 30;
  logs.push(`Starting Auto-Scheduler generation: Horizon = ${options.horizon} (${daysCount} days) starting from ${options.startDate}`);

  // 1. Fetch active shops
  const { data: shops, error: shopsErr } = await supabase
    .from("shops")
    .select("id, name, shop_code, district_id, state_id, status, language_id, selected_rates");

  const activeShops = (shops || []).filter(s => s.status !== "inactive" && s.status !== "suspended");

  if (shopsErr || activeShops.length === 0) {
    return {
      success: false,
      batchId: "",
      totalScheduled: 0,
      daysCount,
      shopsProcessed: 0,
      logs,
      warnings: ["No active shops found for scheduling."],
    };
  }

  logs.push(`Found ${activeShops.length} active shops across districts.`);

  // 2. Fetch available videos, templates, occasions, and music tracks
  const [{ data: videos }, { data: templates }, { data: occasions }, { data: musicTracks }] = await Promise.all([
    supabase.from("videos").select("id, title, usage_count, cloudflare_url, category"),
    supabase.from("templates").select("id, name, template_type, version, placeholder_count"),
    supabase.from("occasions").select("id, name, start_date, end_date"),
    supabase.from("music_tracks").select("id, title").eq("is_active", true),
  ]);

  const activeVideos = videos || [];
  let availableTemplates = templates || [];

  if (activeVideos.length === 0) {
    return {
      success: false,
      batchId: "",
      totalScheduled: 0,
      daysCount,
      shopsProcessed: activeShops.length,
      logs,
      warnings: ["No base videos available in pool."],
    };
  }

  // Create default fallback template if templates array is empty
  if (availableTemplates.length === 0) {
    const { data: createdTemp } = await supabase
      .from("templates")
      .insert([{
        name: "Standard Luxury Template v1.0",
        template_type: "luxury",
        version: "1.0.0",
        status: "active",
        bg_image_url: "/api/media/videos/NC-0001.mp4",
        outro_url: "/api/media/outro/SHOP-10409_outro.mp4",
        config: { dimensions: { width: 1080, height: 1920 } }
      }])
      .select()
      .single();

    if (createdTemp) {
      availableTemplates = [createdTemp];
    }
  }

  if (availableTemplates.length === 0) {
    return {
      success: false,
      batchId: "",
      totalScheduled: 0,
      daysCount,
      shopsProcessed: activeShops.length,
      logs,
      warnings: ["No valid templates available for scheduling."],
    };
  }

  // 3. Create schedule batch
  const { data: batch, error: batchErr } = await supabase
    .from("schedule_batches")
    .insert({
      status: "applied",
      generated_by: options.userId || null,
    })
    .select()
    .single();

  if (batchErr || !batch) {
    throw new Error(`Failed to create schedule batch: ${batchErr?.message}`);
  }

  const batchId = batch.id;
  logs.push(`Created schedule batch: ${batchId}`);

  // 4. Load ALL past assignments and downloads to enforce strict lockout
  const [{ data: existingSchedules }, { data: existingDownloads }] = await Promise.all([
    supabase.from("schedules").select("id, shop_id, video_id, scheduled_date"),
    supabase.from("downloads").select("shop_id, video_id")
  ]);

  const shopVideoHistory = new Map<string, Set<string>>();
  const districtWeekVideoMap = new Map<string, Set<string>>();
  
  // Track previous day's video category for each shop to prevent consecutive categories
  const shopLastCategoryMap = new Map<string, string>();

  (existingSchedules || []).forEach((s) => {
    if (!shopVideoHistory.has(s.shop_id)) {
      shopVideoHistory.set(s.shop_id, new Set());
    }
    shopVideoHistory.get(s.shop_id)!.add(s.video_id);
  });

  (existingDownloads || []).forEach((dl) => {
    if (dl.video_id) {
      if (!shopVideoHistory.has(dl.shop_id)) {
        shopVideoHistory.set(dl.shop_id, new Set());
      }
      shopVideoHistory.get(dl.shop_id)!.add(dl.video_id);
    }
  });

  const availableCategories = Array.from(new Set(activeVideos.map(v => v.category)));
  const shopCategoryRotations = new Map<string, string[]>();
  activeShops.forEach((shop) => {
    shopCategoryRotations.set(shop.id, shuffleArray(availableCategories));
  });

  const newScheduleRecords: any[] = [];
  const startMs = new Date(options.startDate).getTime();

  // Helper to format Date as YYYY-MM-DD in local time
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Iterate date-by-date for next 7 or 30 days
  for (let d = 0; d < daysCount; d++) {
    // Clear district week maps every 7 days to reset week-level isolation
    if (d > 0 && d % 7 === 0) {
      districtWeekVideoMap.clear();
    }

    const parts = options.startDate.split("-").map(Number);
    const currentDateObj = new Date(parts[0], parts[1] - 1, parts[2] + d);
    const currentDateStr = formatLocalDate(currentDateObj);

    // Find active festival/occasion for date
    const activeOccasion = (occasions || []).find((occ) => {
      return currentDateStr >= occ.start_date && currentDateStr <= occ.end_date;
    });

    for (const shop of activeShops) {
      const shopIdx = activeShops.indexOf(shop);
      
      // Match template placeholder count with shop's selection (default to 3)
      const shopRequiredCount = (shop.selected_rates && Array.isArray(shop.selected_rates)) 
        ? shop.selected_rates.length 
        : 3;
      
      const matchedTemplates = availableTemplates.filter(t => 
        t.placeholder_count === shopRequiredCount || 
        (!t.placeholder_count && shopRequiredCount === 3)
      );

      const templatesToChooseFrom = matchedTemplates.length > 0 ? matchedTemplates : availableTemplates;
      const dayTemplate = templatesToChooseFrom[(d + shopIdx) % templatesToChooseFrom.length];

      const shopHistory = shopVideoHistory.get(shop.id) || new Set();
      const districtId = shop.district_id || "DIST";
      const lastCategory = shopLastCategoryMap.get(shop.id);
      
      const rotation = shopCategoryRotations.get(shop.id) || availableCategories;
      const targetCategory = rotation[d % rotation.length];
      
      if (!districtWeekVideoMap.has(districtId)) {
        districtWeekVideoMap.set(districtId, new Set());
      }
      const districtUsedVideos = districtWeekVideoMap.get(districtId)!;

      // Smart Weighted Penalty Scoring for video selection:
      // Rotated offset based on shop Index ensures referral/nearby shops get completely different videos on the same day
      const shopOffset = (shopIdx * 7) % Math.max(1, activeVideos.length);

      let candidates = activeVideos.filter((v) => {
        if (shopHistory.has(v.id)) return false;
        if (districtUsedVideos.has(v.id)) return false;
        return true;
      });

      let chosenVideo = null;
      if (candidates.length > 0) {
        // Sort candidates:
        // - Heavy Penalty (+10000) if category matches the previous day's category
        // - Heavy Bonus (-5000) if category matches the target category for this day in the shuffled rotation
        // - Plus rotated shop offset to diversify referral shops on the same date
        candidates.sort((a, b) => {
          const aIndex = activeVideos.findIndex(v => v.id === a.id);
          const bIndex = activeVideos.findIndex(v => v.id === b.id);
          const aDist = (aIndex + shopOffset) % activeVideos.length;
          const bDist = (bIndex + shopOffset) % activeVideos.length;

          const aPenalty = (lastCategory && lastCategory === a.category) ? 10000 : 0;
          const bPenalty = (lastCategory && lastCategory === b.category) ? 10000 : 0;
          
          const aTargetBonus = (a.category === targetCategory) ? -5000 : 0;
          const bTargetBonus = (b.category === targetCategory) ? -5000 : 0;
          
          return (aPenalty + aTargetBonus + aDist + (a.usage_count || 0) * 10) - (bPenalty + bTargetBonus + bDist + (b.usage_count || 0) * 10);
        });
        chosenVideo = candidates[0];
      } else {
        // Fallback 1: Relax history lockout but preserve district week isolation
        const districtOnlyFiltered = activeVideos.filter((v) => !districtUsedVideos.has(v.id));
        if (districtOnlyFiltered.length > 0) {
          districtOnlyFiltered.sort((a, b) => {
            const aPenalty = (lastCategory && lastCategory === a.category) ? 10000 : 0;
            const bPenalty = (lastCategory && lastCategory === b.category) ? 10000 : 0;
            
            const aTargetBonus = (a.category === targetCategory) ? -5000 : 0;
            const bTargetBonus = (b.category === targetCategory) ? -5000 : 0;
            
            return (aPenalty + aTargetBonus + (a.usage_count || 0)) - (bPenalty + bTargetBonus + (b.usage_count || 0));
          });
          chosenVideo = districtOnlyFiltered[0];
          logs.push(`Relaxed history lockout for shop "${shop.name}" to prevent lockup.`);
        } else {
          // Fallback 2: Worst case, select lowest overall usage video
          const allSorted = [...activeVideos];
          allSorted.sort((a, b) => {
            const aPenalty = (lastCategory && lastCategory === a.category) ? 10000 : 0;
            const bPenalty = (lastCategory && lastCategory === b.category) ? 10000 : 0;
            
            const aTargetBonus = (a.category === targetCategory) ? -5000 : 0;
            const bTargetBonus = (b.category === targetCategory) ? -5000 : 0;
            
            return (aPenalty + aTargetBonus + (a.usage_count || 0)) - (bPenalty + bTargetBonus + (b.usage_count || 0));
          });
          chosenVideo = allSorted[0];
          logs.push(`Relaxed district isolation for shop "${shop.name}" on ${currentDateStr} due to pool exhaustion.`);
        }
      }

      // Record selection in history, district map, and category tracker
      shopHistory.add(chosenVideo.id);
      shopVideoHistory.set(shop.id, shopHistory);
      districtUsedVideos.add(chosenVideo.id);
      shopLastCategoryMap.set(shop.id, chosenVideo.category);

      // Randomly assign background music track for this schedule slot
      let assignedAudioId = null;
      if (musicTracks && musicTracks.length > 0) {
        const randomIdx = Math.floor(Math.random() * musicTracks.length);
        assignedAudioId = musicTracks[randomIdx].id;
      }

      newScheduleRecords.push({
        shop_id: shop.id,
        video_id: chosenVideo.id,
        template_id: dayTemplate.id,
        audio_track_id: assignedAudioId,
        occasion_id: activeOccasion ? activeOccasion.id : null,
        scheduled_date: currentDateStr,
        status: "scheduled",
        download_status: "pending",
        render_status: "pending",
        batch_id: batchId,
        assigned_by: options.userId || null,
      });
    }
  }

  // Insert records into schedules table (purging old schedule slots for target dates first)
  if (newScheduleRecords.length > 0) {
    const targetDates = Array.from(new Set(newScheduleRecords.map(r => r.scheduled_date)));
    const shopIds = Array.from(new Set(newScheduleRecords.map(r => r.shop_id)));

    await supabase
      .from("schedules")
      .delete()
      .in("shop_id", shopIds)
      .in("scheduled_date", targetDates);

    const { error: insertErr } = await supabase
      .from("schedules")
      .insert(newScheduleRecords);

    if (insertErr) {
      throw new Error(`Failed to insert schedules: ${insertErr.message}`);
    }
  }

  logs.push(`Successfully scheduled ${newScheduleRecords.length} daily videos across ${activeShops.length} shops.`);

  return {
    success: true,
    batchId,
    totalScheduled: newScheduleRecords.length,
    daysCount,
    shopsProcessed: activeShops.length,
    logs,
    warnings,
  };
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
