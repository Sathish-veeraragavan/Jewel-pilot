"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button, Input } from "@/components/ui/reusable";
import { ShieldAlert } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        router.push("/login?message=Password reset successful");
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
          <h2 className="mt-4 text-xl font-bold tracking-tight text-primary">Set New Password</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your new secure password details.</p>
        </div>

        {errorMsg && (
          <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Input
            label="Confirm New Password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
