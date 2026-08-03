import { NextResponse } from "next/server";
import { uploadToR2 } from "@/utils/r2";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds duration for large uploads

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentTypeHeader = request.headers.get("content-type") || "";
    const url = new URL(request.url);

    let fileBuffer: Buffer | null = null;
    let filename = "";
    let mimeType = "video/mp4";
    let prefix = "ASSET";

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const shopCode = (formData.get("shopCode") as string) || (formData.get("prefix") as string) || "SHOP";

      if (!file) {
        return NextResponse.json({ error: "No file provided in form data" }, { status: 400 });
      }

      filename = file.name || "logo.webp";
      mimeType = file.type || "image/webp";
      prefix = shopCode;

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      prefix = url.searchParams.get("prefix") || request.headers.get("x-prefix") || "ASSET";
      filename = url.searchParams.get("filename") || request.headers.get("x-filename") || `${prefix}.mp4`;
      mimeType = contentTypeHeader || "video/mp4";

      const arrayBuffer = await request.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: "Empty file payload received" }, { status: 400 });
    }

    const publicUrl = await uploadToR2(fileBuffer, filename, mimeType, prefix);

    return NextResponse.json({ 
      success: true, 
      url: publicUrl, 
      key: publicUrl, 
      bytesReceived: fileBuffer.length 
    });
  } catch (err: any) {
    console.error("POST /api/upload/r2 error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file to Cloudflare R2" }, { status: 500 });
  }
}
