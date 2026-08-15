"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Store, 
  Video, 
  LayoutTemplate, 
  Calendar, 
  Coins, 
  UserPlus, 
  User, 
  LogOut,
  Database,
  Cpu,
  Activity,
  Music,
  DollarSign
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface SidebarProps {
  role: "super_admin" | "admin" | "shop_user" | "sales";
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function checkActualRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const actualRole = user.app_metadata?.role || user.user_metadata?.role;
        if (actualRole === "super_admin") {
          setIsSuperAdmin(true);
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.role === "super_admin") {
            setIsSuperAdmin(true);
          }
        }
      }
    }
    checkActualRole();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const menuItems = {
    super_admin: [
      { name: "Overview", href: "/super-admin", icon: LayoutDashboard },
      { name: "Shops & Approvals", href: "/super-admin/shops", icon: Store },
      { name: "Sales Admins", href: "/super-admin/admins", icon: User },
      { name: "Video Library", href: "/super-admin/videos", icon: Video },
      { name: "Music Library", href: "/super-admin/music", icon: Music },
      { name: "Template Manager", href: "/super-admin/templates", icon: LayoutTemplate },
      { name: "Occasion Manager", href: "/super-admin/occasions", icon: Calendar },
      { name: "Auto Scheduler", href: "/super-admin/scheduler-config", icon: Calendar },
      { name: "Gold Rates", href: "/super-admin/gold-rates", icon: Coins },
      { name: "Master Data", href: "/super-admin/master-data", icon: Database },
      { name: "Render Queue", href: "/super-admin/renders", icon: Activity },
      { name: "Billing & Finance", href: "/super-admin/finance", icon: DollarSign },
    ],
    admin: [
      { name: "My Dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "Onboard Shop", href: "/admin/onboard", icon: UserPlus },
      { name: "Shops List", href: "/super-admin/shops", icon: Store },
      { name: "Video Library", href: "/super-admin/videos", icon: Video },
      { name: "Music Library", href: "/super-admin/music", icon: Music },
      { name: "Template Manager", href: "/super-admin/templates", icon: LayoutTemplate },
      { name: "Occasion Manager", href: "/super-admin/occasions", icon: Calendar },
      { name: "Auto Scheduler", href: "/super-admin/scheduler-config", icon: Calendar },
      { name: "Gold Rates", href: "/super-admin/gold-rates", icon: Coins },
      { name: "Render Queue", href: "/super-admin/renders", icon: Activity },
      { name: "Billing & Finance", href: "/super-admin/finance", icon: DollarSign },
    ],
    sales: [
      { name: "Sales Portal", href: "/sales", icon: LayoutDashboard },
    ],
    shop_user: [
      { name: "Today's Video", href: "/shop", icon: Video },
      { name: "My Profile", href: "/shop/profile", icon: User },
    ],
  };

  const currentMenu = menuItems[role] || [];

  return (
    <aside className="w-64 bg-primary text-white flex flex-col h-full lg:h-screen lg:fixed left-0 top-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="font-bold text-lg tracking-wider text-white">Aurum</span>
          <span className="font-semibold text-lg text-accent ml-1">Flow</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-accent bg-accent/10 px-2 py-1 rounded border border-accent/20">
          {role.replace("_", " ")}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {currentMenu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-accent text-primary font-semibold shadow-md shadow-accent/15"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Back to Super Admin / Logout */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        {isSuperAdmin && pathname?.startsWith("/shop") && (
          <Link
            href="/super-admin/shops"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold text-accent bg-accent/15 border border-accent/25 hover:bg-accent/25 transition-colors duration-205"
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span>Back to Super Admin</span>
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors duration-200 text-left"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
