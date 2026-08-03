import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

async function checkSuperAdmin(supabaseUser: any) {
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return false;
  
  const supabaseAdmin = getAdminSupabase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile && profile.role === "super_admin";
}

export async function GET(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  if (!(await checkSuperAdmin(supabaseUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data: admins, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, status, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(admins);
  } catch (err: any) {
    console.error("GET /api/super-admin/admins error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch sales admins" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  if (!(await checkSuperAdmin(supabaseUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields (name, email, password)" }, { status: 400 });
    }

    // 1. Create user in Supabase Auth using service role bypass
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "admin" },
      app_metadata: { role: "admin" }
    });

    if (authError || !authUser.user) {
      throw new Error(authError?.message || "Auth user creation failed");
    }

    // 2. Insert into profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.user.id,
        name,
        email,
        role: "admin",
        status: "active"
      })
      .select()
      .single();

    if (profileError) {
      // Cleanup auth user on profile creation failure
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true, admin: profile });
  } catch (err: any) {
    console.error("POST /api/super-admin/admins error:", err);
    return NextResponse.json({ error: err.message || "Failed to create sales admin" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  if (!(await checkSuperAdmin(supabaseUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, password } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing admin ID" }, { status: 400 });
    }

    // If status change (e.g. suspend)
    if (status) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    }

    // If password reset
    if (password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/super-admin/admins error:", err);
    return NextResponse.json({ error: err.message || "Failed to update admin account" }, { status: 500 });
  }
}
