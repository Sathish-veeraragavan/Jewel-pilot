import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function GET(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stateId = searchParams.get("state_id");

  try {
    let query = supabaseAdmin.from("associations").select(`
      id,
      name,
      state_id,
      allowed_metals,
      created_at,
      states(name)
    `).order("name", { ascending: true });

    if (stateId) {
      query = query.eq("state_id", stateId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  // Only allow admin or super_admin roles to create associations
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  try {
    const { name, state_id, allowed_metals } = await request.json();
    if (!name || !state_id) {
      return NextResponse.json({ error: "Missing required fields (name, state_id)" }, { status: 400 });
    }

    const insertPayload: any = { name, state_id };
    if (allowed_metals !== undefined) {
      insertPayload.allowed_metals = allowed_metals;
    }

    const { data, error } = await supabaseAdmin
      .from("associations")
      .insert([insertPayload])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create association" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseUser = await createClient();
  const supabaseAdmin = getAdminSupabase();

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  try {
    const { id, name, state_id, allowed_metals } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing association id" }, { status: 400 });
    }

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (state_id !== undefined) updatePayload.state_id = state_id;
    if (allowed_metals !== undefined) updatePayload.allowed_metals = allowed_metals;

    const { data, error } = await supabaseAdmin
      .from("associations")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update association" }, { status: 500 });
  }
}
