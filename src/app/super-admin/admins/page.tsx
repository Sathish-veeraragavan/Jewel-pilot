"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  LoadingSpinner,
  ConfirmationDialog
} from "@/components/ui/reusable";
import { ShieldAlert, UserPlus, Lock, Key, Shield, Trash2, CheckCircle2, UserCheck, UserX } from "lucide-react";

export default function AdminsRosterPage() {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<any[]>([]);
  
  // Create state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit/Password reset state
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/admins");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAdmins(data);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

   const handleCancelCreate = () => {
    if (name || email || password) {
      if (confirm("Discard unsaved changes?")) {
        setCreateOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("admin");
        setErrorMsg(null);
      }
    } else {
      setCreateOpen(false);
      setRole("admin");
      setErrorMsg(null);
    }
  };

  const handleCancelReset = () => {
    if (newPassword) {
      if (confirm("Discard unsaved changes?")) {
        setResetTarget(null);
        setNewPassword("");
      }
    } else {
      setResetTarget(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (createOpen && e.key === "Escape") {
        e.preventDefault();
        handleCancelCreate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createOpen, name, email, password]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (resetTarget && e.key === "Escape") {
        e.preventDefault();
        handleCancelReset();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetTarget, newPassword]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setCreateOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("admin");
        fetchAdmins();
      }
    } catch (err) {
      setErrorMsg("Failed to create sales admin account.");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);

    try {
      const res = await fetch("/api/super-admin/admins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetTarget.id, password: newPassword })
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else {
        alert("Password updated successfully.");
        setResetTarget(null);
        setNewPassword("");
      }
    } catch (err) {
      alert("Password update failed.");
    } finally {
      setResetting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    if (!confirm(`Are you sure you want to ${nextStatus === "active" ? "reactivate" : "suspend"} this Sales Admin account?`)) return;

    try {
      const res = await fetch("/api/super-admin/admins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchAdmins();
      }
    } catch (err) {
      alert("Status toggle failed.");
    }
  };

  if (errorMsg === "Forbidden" || errorMsg?.includes("Forbidden")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white border border-border rounded-3xl space-y-4 max-w-md mx-auto mt-12">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h3 className="text-xl font-bold text-primary">Access Denied</h3>
        <p className="text-sm text-slate-500">Super Admin privileges are required to manage administrator credentials and roster.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="Sales Admin Accounts Manager"
        description="Provision, monitor, and manage credentials for Sales Admins who onboard retail store outlets."
        action={
          <Button 
            onClick={() => setCreateOpen(true)}
            className="bg-accent hover:bg-yellow-450 text-primary font-bold text-xs flex items-center space-x-2 shadow"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New Sales Admin</span>
          </Button>
        }
      />

      {/* Roster Table list */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
        {loading ? (
          <LoadingSpinner />
        ) : admins.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-12">
            No Sales Admin/Partner accounts created yet. Click "Create New Sales Admin" to register a user.
          </div>
        ) : (
          <Table headers={["Name & Role", "Email Address", "Status", "Created At", "Actions"]}>
            {admins.map((adm) => (
              <tr key={adm.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary">{adm.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{adm.role === "sales" ? "Sales Partner" : "Sales Admin"}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 font-mono text-xs">{adm.email}</td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    adm.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {adm.status || "active"}
                  </span>
                </td>
                <td className="py-4 px-6 text-slate-500">
                  {new Date(adm.created_at || Date.now()).toLocaleDateString()}
                </td>
                <td className="py-4 px-6 space-x-3">
                  <button 
                    onClick={() => setResetTarget(adm)}
                    className="text-amber-600 hover:underline flex items-center space-x-1 text-xs font-bold inline-flex"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Reset Password</span>
                  </button>
                  <button 
                    onClick={() => handleToggleStatus(adm.id, adm.status || "active")}
                    className={`text-xs font-bold inline-flex items-center space-x-1 ${
                      adm.status === "active" ? "text-red-650 hover:underline" : "text-green-650 hover:underline"
                    }`}
                  >
                    {adm.status === "active" ? (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* CREATE NEW ADMIN ACCOUNT MODAL */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAdmin} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-base text-primary">Create Sales Admin</h3>
              </div>
              <button type="button" onClick={handleCancelCreate} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-750 p-3 rounded-xl text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <Input 
                label="Full Name" 
                required 
                placeholder="Sales Admin Name"
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
              <Input 
                label="Login Email Address" 
                type="email"
                required 
                placeholder="admin@aurumflow.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
              <Input 
                label="Login Password" 
                type="password"
                required 
                placeholder="Min 6 characters"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account Access Role</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-primary outline-none focus:border-accent"
                >
                  <option value="admin">Sales Admin (Full Dashboard & Approvals)</option>
                  <option value="sales">Sales Partner (Onboard Shop & Demo Videos Only)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
               <Button type="button" variant="outline" onClick={handleCancelCreate}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating Account..." : "Create Account"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleResetPassword} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-base text-primary">Reset Admin Password</h3>
              </div>
              <button type="button" onClick={handleCancelReset} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-muted-foreground">Reset credentials for <strong className="text-primary">{resetTarget.name}</strong> ({resetTarget.email}).</p>

            <Input 
              label="New Password" 
              type="password"
              required 
              placeholder="Min 6 characters"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
            />

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
               <Button type="button" variant="outline" onClick={handleCancelReset}>Cancel</Button>
              <Button type="submit" disabled={resetting}>
                {resetting ? "Resetting Password..." : "Update Password"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
