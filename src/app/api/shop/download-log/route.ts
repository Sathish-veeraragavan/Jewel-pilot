import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

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

    // Update download status and timestamp
    const { error: updateErr } = await supabaseAdmin
      .from("schedules")
      .update({
        download_status: "downloaded",
        downloaded_at: new Date()
      })
      .eq("id", scheduleId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, message: "Download tracked successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to log download" }, { status: 500 });
  }
}
