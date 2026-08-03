import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { uploadToR2, deleteFromR2 } from "@/utils/r2";

export const dynamic = "force-dynamic";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function GET() {
  const supabaseAdmin = getAdminSupabase();
  try {
    const { data, error } = await supabaseAdmin
      .from("music_tracks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET /api/music error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch music tracks" }, { status: 500 });
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
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const titleVal = (formData.get("title") as string) || file?.name || "Untitled Track";
    const cleanTitle = titleVal.includes(".") ? titleVal.substring(0, titleVal.lastIndexOf(".")) : titleVal;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Check for title collisions in database to add unique counter suffix
    const { data: existingTracks } = await supabaseAdmin
      .from("music_tracks")
      .select("title")
      .like("title", `${cleanTitle}%`);

    let finalTitle = cleanTitle;
    if (existingTracks && existingTracks.length > 0) {
      const exactMatches = existingTracks.filter(t => {
        const tLower = t.title.toLowerCase();
        const baseLower = cleanTitle.toLowerCase();
        return tLower === baseLower || new RegExp(`^${baseLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s\\(\\d+\\)$`).test(tLower);
      });
      if (exactMatches.length > 0) {
        finalTitle = `${cleanTitle} (${exactMatches.length})`;
      }
    }

    // Generate unique code AU-XXXX by counting existing tracks
    const { count, error: countErr } = await supabaseAdmin
      .from("music_tracks")
      .select("id", { count: "exact", head: true });
    
    if (countErr) throw countErr;

    const trackNumber = (count || 0) + 1;
    const trackCode = `AU-${String(trackNumber).padStart(4, "0")}`;
    const displayTitle = `${trackCode}: ${finalTitle}`;

    // Generate unique name by appending timestamp to trackCode
    const originalName = file.name;
    const dotIndex = originalName.lastIndexOf(".");
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex) : ".mp3";
    const uniqueFileName = `${trackCode}_${Date.now()}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Upload to Cloudflare R2 under music/
    const publicUrl = await uploadToR2(
      fileBuffer, 
      uniqueFileName, 
      file.type || "audio/mpeg", 
      "music"
    );

    // Insert metadata into Supabase
    const { data: track, error: dbError } = await supabaseAdmin
      .from("music_tracks")
      .insert({
        title: displayTitle,
        cloudflare_url: publicUrl,
        file_name: uniqueFileName,
        file_size: file.size,
        is_active: true
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup R2 object on db metadata insert failure
      await deleteFromR2(`music/${uniqueFileName}`);
      throw dbError;
    }

    return NextResponse.json({ success: true, track });
  } catch (err: any) {
    console.error("POST /api/music error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload music track" }, { status: 500 });
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
      return NextResponse.json({ error: "Missing music track ID" }, { status: 400 });
    }

    // Fetch details first to get the R2 key
    const { data: track, error: fetchErr } = await supabaseAdmin
      .from("music_tracks")
      .select("file_name")
      .eq("id", id)
      .single();

    if (fetchErr || !track) {
      return NextResponse.json({ error: "Music track not found" }, { status: 404 });
    }

    // Delete R2 Object
    await deleteFromR2(`music/${track.file_name}`);

    // Delete DB Record
    const { error: dbError } = await supabaseAdmin
      .from("music_tracks")
      .delete()
      .eq("id", id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/music error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete music track" }, { status: 500 });
  }
}
