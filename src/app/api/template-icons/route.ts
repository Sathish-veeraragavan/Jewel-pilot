import { NextResponse } from "next/server";
import { uploadToR2, listR2Objects, deleteFromR2 } from "@/utils/r2";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const icons = await listR2Objects("template-icons/");
    return NextResponse.json(icons);
  } catch (err: any) {
    console.error("GET /api/template-icons error:", err);
    return NextResponse.json({ error: err.message || "Failed to list template icons" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const originalName = (formData.get("name") as string) || file?.name || "element.png";

    if (!file) {
      return NextResponse.json({ error: "No icon file provided" }, { status: 400 });
    }

    // Generate unique name by appending timestamp + random string
    const dotIndex = originalName.lastIndexOf(".");
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex) : ".png";
    const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    const randSuffix = Math.random().toString(36).substring(2, 6);
    const uniqueIconName = `${baseName}_${Date.now()}_${randSuffix}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const publicUrl = await uploadToR2(
      fileBuffer, 
      uniqueIconName, 
      file.type || "image/png", 
      "template-icons"
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      name: uniqueIconName
    });
  } catch (err: any) {
    console.error("POST /api/template-icons error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload template icon" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    await deleteFromR2(key);

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error("DELETE /api/template-icons error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete template icon" }, { status: 500 });
  }
}
