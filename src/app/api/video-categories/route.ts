import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { createR2FolderPlaceholder } from "@/utils/r2";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function GET() {
  const supabaseAdmin = getAdminSupabase();

  try {
    const { data: categories, error } = await supabaseAdmin
      .from("video_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json(categories || []);
  } catch (err: any) {
    console.error("GET /api/video-categories error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Double check authorization (RBAC) - must be super_admin or admin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden: Administrative access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json({ error: "Category name and prefix code are required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    if (cleanCode.length < 2 || cleanCode.length > 5) {
      return NextResponse.json({ error: "Prefix code must be between 2 and 5 characters long" }, { status: 400 });
    }

    // 1. Insert into database
    const { data: category, error: insertError } = await supabaseAdmin
      .from("video_categories")
      .insert([{ name: cleanName, code: cleanCode }])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "A category with this name or prefix code already exists." }, { status: 409 });
      }
      throw insertError;
    }

    // 2. Create the virtual folder/placeholder in Cloudflare R2
    const folderCreated = await createR2FolderPlaceholder(cleanName);
    if (!folderCreated) {
      console.warn(`[POST /api/video-categories] Warning: R2 virtual folder placeholder videos/${cleanName}/ could not be created.`);
    }

    return NextResponse.json({ success: true, category });
  } catch (err: any) {
    console.error("POST /api/video-categories error:", err);
    return NextResponse.json({ error: err.message || "Failed to create category" }, { status: 500 });
  }
}
