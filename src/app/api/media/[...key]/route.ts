import { NextResponse } from "next/server";
import { getR2Client } from "@/utils/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const keyPath = resolvedParams.key.join("/");

    const r2 = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME || "jewelry-assets";

    if (!r2) {
      return NextResponse.json({ error: "R2 client not configured" }, { status: 500 });
    }

    const rangeHeader = request.headers.get("range");

    // 1. Fetch object metadata / size first if range requested
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: keyPath,
      Range: rangeHeader || undefined,
    });

    const response = await r2.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const byteArray = await response.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get("download") === "true";

    const contentType = response.ContentType || (keyPath.endsWith(".mp4") ? "video/mp4" : "image/webp");

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Cache-Control": keyPath.startsWith("logos/")
        ? "public, max-age=60, must-revalidate"
        : "public, max-age=31536000, immutable",
    };

    if (isDownload) {
      const filename = keyPath.split("/").pop() || "download.mp4";
      responseHeaders["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    if (rangeHeader && response.ContentRange) {
      responseHeaders["Content-Range"] = response.ContentRange;
      responseHeaders["Content-Length"] = buffer.length.toString();
      return new NextResponse(buffer, {
        status: 206,
        headers: responseHeaders,
      });
    }

    responseHeaders["Content-Length"] = buffer.length.toString();
    return new NextResponse(buffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("GET /api/media error:", err);
    return NextResponse.json({ error: "Failed to fetch file from Cloudflare R2" }, { status: 404 });
  }
}
