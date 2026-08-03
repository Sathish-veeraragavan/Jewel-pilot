"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button, Input } from "@/components/ui/reusable";
import { ShieldAlert, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setMsg("Password reset link has been sent to your email.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="text-center">
          <span className="font-bold text-2xl tracking-wider text-primary">Aurum</span>
          <span className="font-semibold text-2xl text-accent ml-1">Flow</span>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-primary">Reset Password</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your registered email to request a reset link.</p>
        </div>

        {errorMsg && (
          <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {msg && (
          <div className="flex items-start space-x-2 bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-700">
            <span>{msg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@jewellerstore.com"
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending..." : "Request Reset Link"}
          </Button>
        </form>

        <div className="text-center pt-2">
          <Link href="/login" className="text-xs font-semibold text-accent hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
