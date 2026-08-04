import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get("url");
    const filename = searchParams.get("filename") || "Daily_Gold_Rate_Reel.mp4";

    if (!videoUrl) {
      return NextResponse.json({ error: "Missing video URL parameter" }, { status: 400 });
    }

    // Fetch the file from Cloudflare R2 or the remote URL
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote video file: ${response.statusText}`);
    }

    // Get file contents as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prepare attachment response headers
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set("Content-Length", buffer.length.toString());

    return new NextResponse(buffer, {
      status: 200,
      headers
    });
  } catch (err: any) {
    console.error("Error in download-video proxy API:", err);
    return NextResponse.json({ error: err.message || "Failed to download video" }, { status: 500 });
  }
}
