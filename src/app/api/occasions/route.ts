import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// Helper check
async function checkAdminOrSuperAdmin(supabase: any) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) return `Auth error: ${userErr.message}`;
  if (!user) return "No authenticated user in session";
  
  // Extract role directly from the cryptographically verified JWT token
  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role) {
    if (role !== "super_admin" && role !== "admin") {
      return `User JWT role is '${role}' (needs super_admin or admin)`;
    }
    return true;
  }
  
  // Fallback to database query (with RLS) using maybeSingle() to avoid coercion errors
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr) return `Profile fetch error: ${profErr.message}`;
  if (!profile) return `Profile record not found for user ${user.id}`;
  
  if (profile.role !== "super_admin" && profile.role !== "admin") {
    return `User database role is '${profile.role}' (needs super_admin or admin)`;
  }
  return true;
}

export async function GET(request: Request) {
  const supabaseAdmin = getAdminSupabase();
  try {
    const { data, error } = await supabaseAdmin
      .from("occasions")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const authStatus = await checkAdminOrSuperAdmin(supabase);
  if (authStatus !== true) {
    return NextResponse.json({ error: `Forbidden: ${authStatus}` }, { status: 403 });
  }

  const supabaseAdmin = getAdminSupabase();

  try {
    const body = await request.json();
    const { name, greetings, states, languages, start_date, end_date, priority, overlay_url, status } = body;

    // Validations
    if (!name || !start_date || !end_date) {
      return NextResponse.json({ error: "Missing required fields (name, start_date, end_date)" }, { status: 400 });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ error: "End Date must be after Start Date." }, { status: 400 });
    }

    if (priority <= 0) {
      return NextResponse.json({ error: "Priority must be a positive integer." }, { status: 400 });
    }

    if (!greetings || Object.keys(greetings).length === 0) {
      return NextResponse.json({ error: "At least one greeting message is required." }, { status: 400 });
    }

    // Check unique name (case-insensitive)
    const { data: dupOcc } = await supabaseAdmin
      .from("occasions")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (dupOcc) {
      return NextResponse.json({ error: "An occasion with this name already exists." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("occasions")
      .insert([{
        name,
        greetings,
        states: states || [],
        languages: languages || [],
        start_date,
        end_date,
        priority,
        overlay_url: overlay_url || "",
        status: status || "active"
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Creation failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const authStatus = await checkAdminOrSuperAdmin(supabase);
  if (authStatus !== true) {
    return NextResponse.json({ error: `Forbidden: ${authStatus}` }, { status: 403 });
  }

  const supabaseAdmin = getAdminSupabase();

  try {
    const body = await request.json();
    const { id, name, greetings, states, languages, start_date, end_date, priority, overlay_url, status } = body;

    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ error: "End Date must be after Start Date." }, { status: 400 });
    }

    if (priority && priority <= 0) {
      return NextResponse.json({ error: "Priority must be a positive integer." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("occasions")
      .update({
        name,
        greetings,
        states,
        languages,
        start_date,
        end_date,
        priority,
        overlay_url: overlay_url !== undefined ? (overlay_url || "") : undefined,
        status
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}
