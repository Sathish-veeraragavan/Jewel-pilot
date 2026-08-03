import { NextResponse } from "next/server";
import { getR2PresignedUploadUrl } from "@/utils/r2";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { filename, contentType, prefix } = body;

    if (!filename || !prefix) {
      return NextResponse.json({ error: "Missing filename or prefix" }, { status: 400 });
    }

    const data = await getR2PresignedUploadUrl(filename, contentType || "video/mp4", prefix);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("POST /api/upload/r2-presigned error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate presigned upload URL" }, { status: 500 });
  }
}
