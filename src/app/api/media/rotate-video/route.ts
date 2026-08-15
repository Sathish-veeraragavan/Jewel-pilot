import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { uploadToR2, checkR2ObjectExists } from "@/utils/r2";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tempInPath = "";
  let tempOutPath = "";

  try {
    const body = await request.json();
    const { source_video_url, angle, job_id } = body;

    if (!source_video_url || !angle || !job_id) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const suffix = angle === "90_cw" ? "rot90" : "rot270";
    const rotatedKey = `renders/${job_id}_${suffix}.mp4`;
    const publicUrl = `/api/media/${rotatedKey}`;

    // 1. Check if it already exists in R2
    const exists = await checkR2ObjectExists(publicUrl);
    if (exists) {
      return NextResponse.json({ success: true, status: "Completed", url: publicUrl });
    }

    // 2. Perform rotation locally on Vercel using bundled FFmpeg (loaded dynamically to bypass compile-time bundler tracing)
    tempInPath = path.join("/tmp", `${job_id}_in.mp4`);
    tempOutPath = path.join("/tmp", `${job_id}_out.mp4`);

    console.log(`[Rotate Local] Downloading ${source_video_url} to ${tempInPath}`);
    const response = await fetch(source_video_url);
    if (!response.ok) {
      throw new Error(`Failed to download source video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempInPath, buffer);

    let transposeFilter = "transpose=1";
    if (angle === "90_ccw") {
      transposeFilter = "transpose=2";
    }

    const ffmpegPath = ffmpeg.path;

    const cmd = `"${ffmpegPath}" -y -i "${tempInPath}" -vf "${transposeFilter}" -c:a copy "${tempOutPath}"`;
    console.log(`[Rotate Local] Running command: ${cmd}`);
    execSync(cmd);

    // 3. Upload the rotated output to R2
    console.log(`[Rotate Local] Uploading rotated file to R2: ${rotatedKey}`);
    const outBuffer = fs.readFileSync(tempOutPath);
    await uploadToR2(outBuffer, `${job_id}_${suffix}.mp4`, "video/mp4", "renders");

    return NextResponse.json({ success: true, status: "Completed", url: publicUrl });
  } catch (err: any) {
    console.error("Rotate local endpoint error:", err);
    return NextResponse.json({ error: err.message || "Failed to rotate video" }, { status: 500 });
  } finally {
    // Clean up local temp files
    try {
      if (tempInPath && fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
      if (tempOutPath && fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    } catch (e) {
      console.warn("Failed to delete temp files:", e);
    }
  }
}
