import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isSuperAdminPath = path.startsWith("/super-admin");
  const isAdminPath = path.startsWith("/admin");
  const isShopPath = path.startsWith("/shop");
  const isLoginPath = path.startsWith("/login");

  // Protected route check
  if (!user && (isSuperAdminPath || isAdminPath || isShopPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Determine role: check auth metadata first, then fallback to profiles database table
    let role = user.app_metadata?.role || user.user_metadata?.role || null;

    if (!role) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role) {
          role = profile.role;
        }
      } catch (err) {
        console.error("Middleware profile fetch error:", err);
      }
    }

    role = role || "shop_user";

    // If user is accessing /login while already authenticated, redirect to role dashboard
    if (isLoginPath) {
      const url = request.nextUrl.clone();
      if (role === "super_admin") url.pathname = "/super-admin";
      else if (role === "admin") url.pathname = "/admin";
      else if (role === "sales") url.pathname = "/sales";
      else url.pathname = "/shop";
      return NextResponse.redirect(url);
    }

    // Role access enforcement
    if (isSuperAdminPath && role !== "super_admin" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/shop";
      return NextResponse.redirect(url);
    }

    if (isAdminPath && role !== "admin" && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/shop";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
