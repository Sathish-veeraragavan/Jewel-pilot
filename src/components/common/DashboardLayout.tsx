"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { User, Bell, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "super_admin" | "admin" | "shop_user";
  title: string;
}

export default function DashboardLayout({ children, role, title }: DashboardLayoutProps) {
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState<string>("Loading...");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<"super_admin" | "admin" | "shop_user">(role);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        
        // Resolve actual role
        let resolvedRole = user.app_metadata?.role || user.user_metadata?.role;
        if (!resolvedRole) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, name")
            .eq("id", user.id)
            .maybeSingle();
          resolvedRole = profile?.role;
          if (profile?.name) {
            setUserName(profile.name);
          }
        } else {
          const metaName = user.user_metadata?.name || user.user_metadata?.full_name;
          setUserName(metaName || user.email?.split("@")[0] || "User");
        }

        if (resolvedRole) {
          setUserRole(resolvedRole as any);
        }
      } else {
        setUserName("User");
      }
    }
    loadProfile();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar role={userRole} />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Slide-out Sidebar container */}
          <div className="relative w-64 max-w-[80vw] bg-primary h-full z-50 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-lg tracking-wider text-white">Aurum</span>
                <span className="font-semibold text-lg text-accent ml-1">Flow</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" onClick={() => setMobileMenuOpen(false)}>
              <Sidebar role={userRole} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-border px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
          <div className="flex items-center space-x-3">
            {/* 3-Line Hamburger Menu Button for Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-slate-600 hover:text-primary p-2 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-bold text-base sm:text-lg text-primary truncate max-w-[200px] sm:max-w-none">{title}</h1>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-6">
            {/* Notification Bell */}
            <button className="text-slate-400 hover:text-primary transition-colors p-1.5 rounded-full hover:bg-slate-100">
              <Bell className="w-5 h-5" />
            </button>

            {/* Profile Summary */}
            <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-4 border-l border-border">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-primary font-semibold border border-accent/30 flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-semibold text-primary">{userName}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole.replace("_", " ")}</p>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="ml-1 sm:ml-2 p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
