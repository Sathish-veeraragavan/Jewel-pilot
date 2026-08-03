import Link from "next/link";
import { Store, UserCheck, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 items-center justify-center font-sans px-6 py-12">
      <div className="max-w-xl w-full text-center space-y-8 bg-white p-10 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="font-bold text-3xl tracking-wider text-primary">Aurum</span>
          <span className="font-semibold text-3xl text-accent ml-1">Flow</span>
          <p className="text-muted-foreground mt-3">
            Jewellery Video Automation SaaS Platform - Development Portal
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
            Select Dashboard Perspective
          </p>
          <div className="grid grid-cols-1 gap-4">
            <Link
              href="/super-admin"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-accent hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center space-x-3 text-left">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="font-semibold text-primary">Super Admin Panel</h3>
                  <p className="text-xs text-muted-foreground">Manage templates, schedulers, occasions</p>
                </div>
              </div>
              <span className="text-xs font-bold text-accent group-hover:underline">Enter &rarr;</span>
            </Link>

            <Link
              href="/admin"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-accent hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center space-x-3 text-left">
                <UserCheck className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-primary">Sales Admin Panel</h3>
                  <p className="text-xs text-muted-foreground">Register new stores and manage subscriptions</p>
                </div>
              </div>
              <span className="text-xs font-bold text-accent group-hover:underline">Enter &rarr;</span>
            </Link>

            <Link
              href="/shop"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-accent hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center space-x-3 text-left">
                <Store className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="font-semibold text-primary">Shop Dashboard</h3>
                  <p className="text-xs text-muted-foreground">View and download daily promotional videos</p>
                </div>
              </div>
              <span className="text-xs font-bold text-accent group-hover:underline">Enter &rarr;</span>
            </Link>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 text-xs text-slate-400">
          Base Next.js template successfully configured with White, Deep Blue, and Gold accents.
        </div>
      </div>
    </div>
  );
}
