"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Mail, Lock, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    let loginEmail = email.trim();
    if (!loginEmail.includes("@")) {
      loginEmail = `${loginEmail}@aurumflow.com`;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Check role from auth metadata first, then fallback to profiles table
      let role = data.user?.app_metadata?.role || data.user?.user_metadata?.role || null;

      if (!role && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.role) {
          role = profile.role;
        }
      }

      role = role || "shop_user";

      if (role === "super_admin") {
        router.push("/super-admin");
      } else if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/shop");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Visual Banner (Deep Blue with Gold accents) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-secondary/35 to-primary"></div>
        <div className="z-10 text-center max-w-lg px-8 space-y-6">
          <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span className="text-xs text-slate-300 font-semibold tracking-wider uppercase">
              Branded Video Automation
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Elevate Your <span className="text-accent">Jewellery Brand</span> Instantly
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Generate and download professionally branded promotional videos for your store every single day.
          </p>
        </div>
      </div>

      {/* Form Area */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <span className="font-bold text-2xl tracking-wider text-primary">Aurum</span>
            <span className="font-semibold text-2xl text-accent ml-1">Flow</span>
            <h2 className="mt-6 text-xl font-bold tracking-tight text-primary">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to manage your promotional content.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
            {errorMsg && (
              <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@jewellerstore.com or 9876543210"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-primary transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-primary transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="flex justify-end mt-1.5">
                  <Link href="/login/forgot-password" className="text-xs font-semibold text-accent hover:underline">
                    Forgot Password?
                  </Link>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
