import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Helper check
async function checkSuperAdmin(supabaseUser: any) {
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return false;
  
  const supabaseAdmin = getAdminSupabase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile && (profile.role === "super_admin" || profile.role === "admin");
}

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  const startTime = performance.now();

  try {
    // 1. Fetch metadata needed for simulation dropdowns and KPI counts
    const [
      { data: shops },
      { data: videos },
      { data: templates },
      { data: occasions },
      { data: settings },
      { data: goldRates }
    ] = await Promise.all([
      supabaseAdmin.from("shops").select("id, name, state_id, district_id, status, language_id"),
      supabaseAdmin.from("videos").select("id, title, category, cloudflare_url, is_active, usage_count"),
      supabaseAdmin.from("templates").select("id, name, template_type, status, version, config"),
      supabaseAdmin.from("occasions").select("id, name, priority, start_date, end_date, greetings, states, languages, status"),
      supabaseAdmin.from("system_settings").select("setting_key, value"),
      supabaseAdmin.from("gold_rates").select("id, rate_22k, rate_24k, rate_silver, rate_date").order("rate_date", { ascending: false }).limit(1)
    ]);

    const duration = performance.now() - startTime;

    // Map database properties (name -> shop_name) for frontend dropdowns compatibility
    const mappedShops = (shops || []).map(s => ({
      ...s,
      shop_name: s.name
    }));

    const mappedVideos = (videos || []).map(v => ({
      ...v,
      status: v.is_active ? "active" : "inactive"
    }));

    return NextResponse.json({
      shops: mappedShops,
      videos: mappedVideos,
      templates: templates || [],
      occasions: occasions || [],
      settings: settings || [],
      goldRate: goldRates?.[0] || null,
      dbQueryTimeMs: Math.round(duration)
    });
  } catch (err: any) {
    console.error("GET /api/scheduler-sim error:", err);
    return NextResponse.json({ error: err.message || "Sim fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();
  const startTime = performance.now();

  if (!(await checkSuperAdmin(supabaseUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      shopId, 
      simDate, 
      templateOverrideId, 
      occasionOverrideId, 
      goldRateOverride, 
      videoOverrideId 
    } = body;

    if (!shopId || !simDate) {
      return NextResponse.json({ error: "Missing required fields (shopId, simDate)" }, { status: 400 });
    }

    // Step 1: Fetch specified shop details
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select("id, name, state_id, district_id, status, language_id, selected_rates")
      .eq("id", shopId)
      .single();

    if (shopErr || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 400 });
    }

    // Step 2: Query candidate options
    const [
      { data: videos },
      { data: templates },
      { data: occasions },
      { data: systemSettings },
      { data: goldRates }
    ] = await Promise.all([
      supabaseAdmin.from("videos").select("id, title, category, cloudflare_url, is_active, usage_count"),
      supabaseAdmin.from("templates").select("id, name, template_type, status, version, config, occasion_id, placeholder_count"),
      supabaseAdmin.from("occasions").select("id, name, priority, start_date, end_date, greetings, states, languages, status"),
      supabaseAdmin.from("system_settings").select("setting_key, value"),
      supabaseAdmin.from("gold_rates").select("id, rate_22k, rate_24k, rate_silver, rate_date").eq("rate_date", simDate).maybeSingle()
    ]);

    const targetDate = new Date(simDate);
    const traceLogs: string[] = [];
    const videoEvaluations: any[] = [];
    const templateEvaluations: any[] = [];
    const warnings: string[] = [];

    // Rule 1: Shop active status verification
    traceLogs.push(`Evaluating Shop subscription status: "${shop.status}"`);
    if (shop.status !== "active") {
      warnings.push(`Shop "${shop.name}" is currently in "${shop.status}" status.`);
    }

    // Rule 2: Occasion Matching logic
    let selectedOccasion = null;
    let selectedGreeting = "";

    if (occasionOverrideId) {
      selectedOccasion = occasions?.find(o => o.id === occasionOverrideId) || null;
      traceLogs.push(`Occasion manually overridden to: "${selectedOccasion?.name}"`);
    } else {
      // Find active occasions matching date range
      const candidates = (occasions || []).filter(occ => {
        if (occ.status !== "active") return false;
        const start = new Date(occ.start_date);
        const end = new Date(occ.end_date);
        return targetDate >= start && targetDate <= end;
      });

      // Filter by state applicability if states are configured
      const stateFiltered = candidates.filter(occ => {
        if (!occ.states || occ.states.length === 0) return true;
        return occ.states.includes(shop.state_id);
      });

      if (stateFiltered.length > 0) {
        // Sort by priority descending
        stateFiltered.sort((a, b) => b.priority - a.priority);
        selectedOccasion = stateFiltered[0];
        traceLogs.push(`Occasion winning selection: "${selectedOccasion.name}" (Priority ${selectedOccasion.priority})`);
      } else {
        traceLogs.push("No active occasions mapped for target location and date range.");
      }
    }

    // Map greetings
    const locale = "en-IN";
    if (selectedOccasion) {
      selectedGreeting = selectedOccasion.greetings?.[locale] || Object.values(selectedOccasion.greetings)?.[0] || "";
      traceLogs.push(`Selected localized greeting for locale [${locale}]: "${selectedGreeting}"`);
    } else {
      selectedGreeting = "Special Jewelry Promotion Campaign!";
      traceLogs.push(`Using fallback default campaign greeting: "${selectedGreeting}"`);
    }

    // Rule 3: Gold Rate retrieval
    let finalGoldRate = goldRateOverride ? parseFloat(goldRateOverride) : null;
    if (goldRateOverride) {
      traceLogs.push(`Gold rate manually overridden to: ₹${goldRateOverride}`);
    } else if (goldRates) {
      finalGoldRate = goldRates.rate_22k;
      traceLogs.push(`Gold rate loaded from rates sheet for ${simDate}: ₹${finalGoldRate}`);
    } else {
      const defaultSetting = systemSettings?.find(s => s.setting_key === "gold_rate_source")?.value || "manual";
      traceLogs.push(`Gold rate missing for ${simDate}. Fallback system behavior: ${defaultSetting}`);
      warnings.push(`No database gold rate registered for date ${simDate}.`);
    }

    // Rule 4: Video Selection
    let selectedVideo = null;
    if (videoOverrideId) {
      selectedVideo = videos?.find(v => v.id === videoOverrideId) || null;
      traceLogs.push(`Video selection manually overridden to: "${selectedVideo?.title}"`);
    } else {
      for (const vid of (videos || [])) {
        let isEligible = vid.is_active;
        let rejectReason = isEligible ? "" : "Asset status is archived/inactive";

        videoEvaluations.push({
          id: vid.id,
          title: vid.title,
          category: vid.category,
          usage_count: vid.usage_count,
          eligible: isEligible,
          reason: rejectReason
        });
      }

      // Sort eligible candidates by usage count ascending to load balance usage
      const eligibleVideos = videoEvaluations.filter(v => v.eligible);
      if (eligibleVideos.length > 0) {
        eligibleVideos.sort((a, b) => a.usage_count - b.usage_count);
        const bestVideoMeta = eligibleVideos[0];
        selectedVideo = videos?.find(v => v.id === bestVideoMeta.id);
        traceLogs.push(`Selected Video: "${selectedVideo?.title || "Unknown"}" (Usage count: ${selectedVideo?.usage_count ?? 0})`);
      } else {
        traceLogs.push("No eligible video assets matching state/language rules exist.");
        warnings.push("No eligible video assets found for this shop's constraints.");
      }
    }

    // Rule 5: Template Selection
    let selectedTemplate = null;
    if (templateOverrideId) {
      selectedTemplate = templates?.find(t => t.id === templateOverrideId) || null;
      traceLogs.push(`Template manually overridden to: "${selectedTemplate?.name}"`);
    } else {
      const shopRatesCount = (shop.selected_rates && shop.selected_rates.length > 0) ? shop.selected_rates.length : 3;
      traceLogs.push(`Shop selected rates count: ${shopRatesCount} (${JSON.stringify(shop.selected_rates || [])})`);

      for (const temp of (templates || [])) {
        let isEligible = temp.status === "active";
        let rejectReason = "";

        if (!isEligible) {
          rejectReason = "Template status is archived/inactive";
        } else if (temp.placeholder_count !== shopRatesCount) {
          isEligible = false;
          rejectReason = `Placeholder count mismatch (template has ${temp.placeholder_count}, shop needs ${shopRatesCount})`;
        } else if (selectedOccasion && temp.occasion_id && temp.occasion_id !== selectedOccasion.id) {
          isEligible = false;
          rejectReason = `Occasion mismatch (template linked to different occasion: ${temp.occasion_id})`;
        }

        templateEvaluations.push({
          id: temp.id,
          name: temp.name,
          template_type: temp.template_type,
          eligible: isEligible,
          reason: rejectReason,
          placeholder_count: temp.placeholder_count,
          occasion_id: temp.occasion_id
        });
      }

      // Filter eligible templates
      let eligibleTemps = templateEvaluations.filter(t => t.eligible);

      // If an occasion is active, prioritize templates linked to this occasion.
      // If none exist, fallback to general templates (occasion_id is null) that match placeholder count
      if (selectedOccasion) {
        const occasionSpecific = eligibleTemps.filter(t => t.occasion_id === selectedOccasion.id);
        if (occasionSpecific.length > 0) {
          eligibleTemps = occasionSpecific;
          traceLogs.push(`Found templates specifically matching occasion "${selectedOccasion.name}"`);
        } else {
          eligibleTemps = eligibleTemps.filter(t => !t.occasion_id);
          traceLogs.push(`No templates specifically linked to occasion "${selectedOccasion.name}". Falling back to generic templates.`);
        }
      } else {
        // No occasion: only use general templates (occasion_id is null)
        eligibleTemps = eligibleTemps.filter(t => !t.occasion_id);
      }

      if (eligibleTemps.length > 0) {
        selectedTemplate = templates?.find(t => t.id === eligibleTemps[0].id);
        traceLogs.push(`Selected Template: "${selectedTemplate?.name || "Unknown"}" (Slots: ${selectedTemplate?.placeholder_count}, Style: ${selectedTemplate?.template_type})`);
      } else {
        traceLogs.push(`No active templates matching the shop's placeholder count (${shopRatesCount}) and occasion constraints exist.`);
        warnings.push(`No matching active template found for ${shopRatesCount} placeholders.`);
      }
    }

    const duration = performance.now() - startTime;

    return NextResponse.json({
      success: true,
      shop: {
        id: shop.id,
        name: shop.name,
        state: shop.state_id,
        language: "English"
      },
      winningSelections: {
        video: selectedVideo ? { id: selectedVideo.id, title: selectedVideo.title, category: selectedVideo.category } : null,
        template: selectedTemplate ? { id: selectedTemplate.id, name: selectedTemplate.name, config: selectedTemplate.config } : null,
        occasion: selectedOccasion ? { id: selectedOccasion.id, name: selectedOccasion.name } : null,
        greeting: selectedGreeting,
        goldRate: finalGoldRate
      },
      videoEvaluations,
      templateEvaluations,
      traceLogs,
      warnings,
      executionTimeMs: Math.round(duration)
    });
  } catch (err: any) {
    console.error("POST /api/scheduler-sim error:", err);
    return NextResponse.json({ error: err.message || "Simulation failed" }, { status: 500 });
  }
}
