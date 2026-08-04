import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

function parseUserAgent(userAgentStr: string) {
  let os = "Unknown OS";
  let browser = "Unknown Browser";

  const ua = userAgentStr.toLowerCase();

  // OS Detection
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
    os = "iOS";
  } else if (ua.includes("android")) {
    os = "Android";
  } else if (ua.includes("macintosh") || ua.includes("mac os x")) {
    os = "macOS";
  } else if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  // Browser Detection
  if (ua.includes("instagram")) {
    browser = "Instagram Webview";
  } else if (ua.includes("whatsapp")) {
    browser = "WhatsApp Webview";
  } else if (ua.includes("chrome") || ua.includes("crios")) {
    browser = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("crios")) {
    browser = "Safari";
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("edge") || ua.includes("edg")) {
    browser = "Edge";
  }

  return { os, browser };
}

export async function POST(request: Request) {
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
    const { scheduleId } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: "Schedule ID required" }, { status: 400 });
    }

    // 1. Fetch schedule to get shop_id and video_id
    const { data: schedule, error: schedErr } = await supabaseAdmin
      .from("schedules")
      .select("shop_id, video_id")
      .eq("id", scheduleId)
      .maybeSingle();

    if (schedErr || !schedule) {
      return NextResponse.json({ error: "Schedule record not found" }, { status: 404 });
    }

    // 2. Parse device info
    const userAgent = request.headers.get("user-agent") || "";
    const { os, browser } = parseUserAgent(userAgent);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "127.0.0.1";

    // 3. Update download status and timestamp in schedules
    const { error: updateErr } = await supabaseAdmin
      .from("schedules")
      .update({
        download_status: "downloaded",
        downloaded_at: new Date()
      })
      .eq("id", scheduleId);

    if (updateErr) throw updateErr;

    // 4. Log the download in downloads table
    await supabaseAdmin
      .from("downloads")
      .insert([{
        shop_id: schedule.shop_id,
        schedule_id: scheduleId,
        video_id: schedule.video_id,
        download_ip: ip,
        device_info: {
          os,
          browser,
          userAgent
        },
        downloaded_at: new Date()
      }]);

    return NextResponse.json({ 
      success: true, 
      message: "Download tracked successfully",
      device: { os, browser }
    });
  } catch (err: any) {
    console.error("Error logging download:", err);
    return NextResponse.json({ error: err.message || "Failed to log download" }, { status: 500 });
  }
}
