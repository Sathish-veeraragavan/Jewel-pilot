import { NextResponse } from "next/server";
import { initiateR2MultipartUpload, uploadR2Part, completeR2MultipartUpload } from "@/utils/r2";
import { createClient } from "@/utils/supabase/server";
import { DOMParser, Node } from "@xmldom/xmldom";

// Polyfill DOMParser and Node for AWS SDK S3 client XML deserializer in Vercel Edge Runtime
if (typeof (globalThis as any).DOMParser === "undefined") {
  (globalThis as any).DOMParser = DOMParser;
}
if (typeof (globalThis as any).Node === "undefined") {
  (globalThis as any).Node = Node;
}

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "upload_part";

    if (action === "initiate") {
      const filename = url.searchParams.get("filename") || "video.mp4";
      const contentType = url.searchParams.get("contentType") || "video/mp4";
      const prefix = url.searchParams.get("prefix") || "ASSET";
      const category = url.searchParams.get("category") || undefined;

      console.log(`[R2 Multipart Initiate] Initiating upload for: ${filename} (prefix: ${prefix}, contentType: ${contentType}, category: ${category})`);
      const data = await initiateR2MultipartUpload(filename, contentType, prefix, category);
      return NextResponse.json(data);
    }

    if (action === "upload_part") {
      const uploadId = url.searchParams.get("uploadId") || request.headers.get("x-upload-id");
      const key = url.searchParams.get("key") || request.headers.get("x-key");
      const partNumberStr = url.searchParams.get("partNumber") || request.headers.get("x-part-number") || "1";
      const partNumber = parseInt(partNumberStr, 10);

      if (!uploadId || !key) {
        return NextResponse.json({ error: "Missing uploadId or key parameter" }, { status: 400 });
      }

      const arrayBuffer = await request.arrayBuffer();
      const chunkBuffer = new Uint8Array(arrayBuffer);

      if (chunkBuffer.byteLength === 0) {
        return NextResponse.json({ error: "Empty chunk payload received" }, { status: 400 });
      }

      const etag = await uploadR2Part(uploadId, key, partNumber, chunkBuffer);
      return NextResponse.json({ success: true, ETag: etag, PartNumber: partNumber });
    }

    if (action === "complete") {
      const uploadId = url.searchParams.get("uploadId") || request.headers.get("x-upload-id");
      const key = url.searchParams.get("key") || request.headers.get("x-key");
      const body = await request.json();
      const { parts } = body; // Array of { PartNumber, ETag }

      if (!uploadId || !key || !parts || !Array.isArray(parts)) {
        return NextResponse.json({ error: "Missing required complete parameters: uploadId, key, or parts roster" }, { status: 400 });
      }

      console.log(`[R2 Multipart Complete] Completing upload ${uploadId} for key ${key} with ${parts.length} parts`);
      const finalUrl = await completeR2MultipartUpload(uploadId, key, parts);
      return NextResponse.json({ success: true, completed: true, url: finalUrl });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/upload/r2-chunk error:", err);
    return NextResponse.json({ error: err.message || "Failed to process upload chunk" }, { status: 500 });
  }
}
