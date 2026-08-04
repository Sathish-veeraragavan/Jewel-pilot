import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { deleteFromR2, checkR2ObjectExists } from "@/utils/r2";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Category code prefix mapping
const CATEGORY_PREFIXES: Record<string, string> = {
  "Necklace": "NC",
  "Bracelets/Bangles": "BG",
  "Rings": "RG",
  "Earrings": "ER",
  "Ankle Chains": "AC",
  "Chains": "CH"
};

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  
  try {
    const { data: videos, error } = await supabaseAdmin
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(videos || []);
  } catch (err: any) {
    console.error("GET /api/videos error:", err);
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      action, // 'generate_code', 'save_metadata', or 'sync_r2'
      category,
      title,
      cloudflare_url,
      thumbnail_url,
      state_ids,
      language_ids,
      occasion_ids
    } = body;

    // Action 1: Sync R2 bucket with Supabase DB - purge orphaned records if deleted directly in R2
    if (action === "sync_r2") {
      const { data: allVideos } = await supabaseAdmin.from("videos").select("id, cloudflare_url");
      const purgedIds: string[] = [];

      if (allVideos && allVideos.length > 0) {
        for (const vid of allVideos) {
          if (vid.cloudflare_url) {
            const exists = await checkR2ObjectExists(vid.cloudflare_url);
            if (!exists) {
              // Delete dependent schedules first to avoid foreign key restrict error
              await supabaseAdmin.from("schedules").delete().eq("video_id", vid.id);
              await supabaseAdmin.from("videos").delete().eq("id", vid.id);
              purgedIds.push(vid.id);
            }
          }
        }
      }

      return NextResponse.json({ success: true, purgedCount: purgedIds.length, purgedIds });
    }

    // Action 2: Generate next available unique 2-character video code (e.g. NC-0001)
    if (action === "generate_code") {
      if (!category || !CATEGORY_PREFIXES[category]) {
        return NextResponse.json({ error: "Invalid category. Select from: Necklace, Bracelets/Bangles, Rings, Earrings, Ankle Chains, Chains" }, { status: 400 });
      }

      const prefix = CATEGORY_PREFIXES[category];
      const { data: existingVideos } = await supabaseAdmin
        .from("videos")
        .select("title")
        .eq("category", category);

      const count = (existingVideos || []).length + 1;
      const seqStr = count.toString().padStart(4, "0");
      const videoCode = `${prefix}-${seqStr}`;

      return NextResponse.json({ videoCode, prefix });
    }

    // Action 3: Save Video Metadata to Supabase
    if (action === "save_metadata") {
      if (!title || !category || !cloudflare_url) {
        return NextResponse.json({ error: "Missing required fields (title, category, cloudflare_url)" }, { status: 400 });
      }

      if (!CATEGORY_PREFIXES[category]) {
        return NextResponse.json({ error: "Invalid category. Must be one of: Necklace, Bracelets/Bangles, Rings, Earrings, Ankle Chains, Chains" }, { status: 400 });
      }

      const prefix = CATEGORY_PREFIXES[category];
      const { data: existingVideos } = await supabaseAdmin
        .from("videos")
        .select("id")
        .eq("category", category);

      const seqNum = (existingVideos || []).length + 1;
      const seqStr = seqNum.toString().padStart(4, "0");
      const videoCode = `${prefix}-${seqStr}`;

      const formattedTitle = title.includes(`[${prefix}-`) ? title : `[${videoCode}] ${title}`;

      const { data: video, error: videoError } = await supabaseAdmin
        .from("videos")
        .insert([{ 
          title: formattedTitle, 
          category, 
          cloudflare_url,
          thumbnail_url: thumbnail_url || null,
          state_tags: state_ids || [],
          language_tags: language_ids || [],
          occasion_tags: occasion_ids || [],
          usage_count: 0,
          created_by: user.id
        }])
        .select()
        .single();

      if (videoError) throw videoError;

      return NextResponse.json({ 
        success: true, 
        videoId: video.id, 
        videoCode,
        title: formattedTitle 
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/videos error:", err);
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseAdmin = getAdminSupabase();

  try {
    const body = await request.json();
    const { id, title, category, state_ids, language_ids, occasion_ids } = body;

    const updatePayload: any = { updated_at: new Date() };
    if (title) updatePayload.title = title;
    if (category) updatePayload.category = category;
    if (state_ids) updatePayload.state_tags = state_ids;
    if (language_ids) updatePayload.language_tags = language_ids;
    if (occasion_ids) updatePayload.occasion_tags = occasion_ids;

    const { error: baseError } = await supabaseAdmin
      .from("videos")
      .update(updatePayload)
      .eq("id", id);

    if (baseError) throw baseError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/videos error:", err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing video id parameter" }, { status: 400 });
    }

    // 1. Delete dependent schedules first to avoid foreign key restrict error
    await supabaseAdmin
      .from("schedules")
      .delete()
      .eq("video_id", id);

    // 2. Fetch video details to get cloudflare_url
    const { data: video } = await supabaseAdmin
      .from("videos")
      .select("cloudflare_url")
      .eq("id", id)
      .maybeSingle();

    if (video?.cloudflare_url) {
      // 3. Delete file from Cloudflare R2
      await deleteFromR2(video.cloudflare_url);
    }

    // 4. Delete record from Supabase videos table
    const { error } = await supabaseAdmin
      .from("videos")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/videos error:", err);
    return NextResponse.json({ error: err.message || "Deletion failed" }, { status: 500 });
  }
}
