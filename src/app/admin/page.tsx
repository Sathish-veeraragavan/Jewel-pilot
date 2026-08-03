"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Store, 
  CreditCard, 
  Clock, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Edit, 
  Settings, 
  Lock, 
  User, 
  AlertTriangle,
  Building,
  Sparkles,
  Play
} from "lucide-react";
import { 
  Button, 
  Input, 
  Select, 
  LoadingSpinner, 
  Table 
} from "@/components/ui/reusable";
import LogoCropModal from "@/components/ui/LogoCropModal";
import { createClient } from "@/utils/supabase/client";

export default function SalesAdminDashboard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [salesAdmin, setSalesAdmin] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);

  // Stats
  const [onboardedCount, setOnboardedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Shop management states
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [outroUrl, setOutroUrl] = useState("");
  
  // Crop logo states
  const [cropOpen, setCropOpen] = useState(false);
  const [selectedFileSrc, setSelectedFileSrc] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Outro upload states
  const [uploadingOutro, setUploadingOutro] = useState(false);
  const [outroProgress, setOutroProgress] = useState(0);

  // Profile update states
  const [profileName, setProfileName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setSalesAdmin(user);
      setProfileName(user.user_metadata?.name || "");

      // 2. Fetch shops onboarded by this sales admin
      const res = await fetch("/api/shops");
      const data = await res.json();
      if (Array.isArray(data)) {
        const myShops = data.filter(s => s.assigned_sales_admin_id === user.id || s.created_by === user.id);
        setShops(myShops);

        setOnboardedCount(myShops.length);
        setActiveCount(myShops.filter(s => s.status === "active").length);
        setPendingCount(myShops.filter(s => s.status === "pending").length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Update subscription status triggers (1-Day Trial or Request Approval)
  const handleUpdateSubscription = async (shopId: string, action: "trial_1_day" | "request_approval") => {
    const confirmMsg = action === "trial_1_day" 
      ? "Enable 1-Day Temporary trial access for this shop?" 
      : "Submit subscription activation request to Super Admin for approval?";
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/shops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shopId,
          action
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Subscription status successfully updated.");
        fetchDashboardData();
      }
    } catch (err) {
      alert("Failed to update subscription status.");
    }
  };

  // Manage Shop Modal triggers
  const handleOpenManageModal = (shop: any) => {
    setSelectedShop(shop);
    setLogoUrl(shop.logo_url || "");
    setOutroUrl(shop.outro_video_url || "");
    setManageModalOpen(true);
  };

  // Logo Crop handlers
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const src = URL.createObjectURL(file);
      setSelectedFileSrc(src);
      setCropOpen(true);
    }
  };

  const handleLogoCropped = async (croppedFile: File) => {
    if (!selectedShop) return;
    setUploadingLogo(true);
    setCropOpen(false);

    try {
      const shopCode = selectedShop.shop_code || "SHOP";
      const formData = new FormData();
      const ext = croppedFile.type === "image/png" ? "png" : "webp";
      formData.append("file", croppedFile, `${shopCode}_logo.${ext}`);
      formData.append("shopCode", shopCode);
      formData.append("prefix", "logos");

      const res = await fetch("/api/upload/r2", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.url) {
        const cacheBustedUrl = `${data.url}?v=${Date.now()}`;
        setLogoUrl(cacheBustedUrl);
        
        // Save to shop metadata
        await fetch("/api/shops", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedShop.id,
            action: "update_metadata",
            logo_url: cacheBustedUrl
          })
        });

        fetchDashboardData();
        alert("Cropped logo uploaded and saved successfully!");
      }
    } catch (err) {
      alert("Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      setSelectedFileSrc(null);
    }
  };

  // Chunky Outro Video Upload Pipeline (4MB chunks)
  const handleOutroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShop) return;

    setUploadingOutro(true);
    setOutroProgress(0);

    const shopCode = selectedShop.shop_code || "SHOP";
    const prefix = `OUTRO_${shopCode}`;
    const filename = `${shopCode}_outro.mp4`;

    let finalUrl = "";
    try {
      // 1. Get presigned upload URL
      const presignedRes = await fetch("/api/upload/r2-presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: filename,
          contentType: file.type || "video/mp4",
          prefix: prefix
        })
      });
      const presignedData = await presignedRes.json();
      if (presignedData.error) throw new Error(presignedData.error);

      const { url: uploadUrl, publicUrl } = presignedData;

      // 2. PUT the file directly to R2 bucket via presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error(`Direct R2 upload failed with status: ${uploadRes.status}`);
      }

      setOutroProgress(100);
      finalUrl = publicUrl;

      if (finalUrl) {
        // Save to shop outro config
        await fetch("/api/shops/outro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: selectedShop.id,
            shopCode,
            outro_video_url: finalUrl
          })
        });

        setOutroUrl(finalUrl);
        fetchDashboardData();
        alert("Outro video uploaded and saved successfully!");
      }
    } catch (err: any) {
      alert(err.message || "Failed to upload outro video.");
    } finally {
      setUploadingOutro(false);
      setOutroProgress(0);
    }
  };

  // Profile Update & Change Password
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileSuccess(null);

    try {
      const updates: any = {};
      if (profileName) updates.data = { name: profileName };
      if (newPassword) updates.password = newPassword;

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      setProfileSuccess("Account profile updated successfully!");
      setNewPassword("");
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">Sales Admin Control Center</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage templates, videos, music, schedules, gold rates, onboard stores, and trigger video renders.</p>
        </div>
        <Link href="/admin/onboard">
          <Button className="bg-accent hover:bg-yellow-450 text-primary font-bold text-xs flex items-center space-x-2 shadow">
            <Store className="w-4 h-4" />
            <span>Onboard New Shop</span>
          </Button>
        </Link>
      </div>

      {/* Sub-Admin Quick Tools Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 mb-3 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sub-Admin Workspace & Creation Tools</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <Link href="/super-admin/templates" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center transition-all text-center group">
            <span className="text-base mb-1 group-hover:scale-110 transition-transform">🎨</span>
            <span className="text-xs font-bold text-white">Templates</span>
            <span className="text-[9px] text-slate-400">Design & Save</span>
          </Link>

          <Link href="/super-admin/videos" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center transition-all text-center group">
            <span className="text-base mb-1 group-hover:scale-110 transition-transform">🎬</span>
            <span className="text-xs font-bold text-white">Videos</span>
            <span className="text-[9px] text-slate-400">Upload to R2</span>
          </Link>

          <Link href="/super-admin/music" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center transition-all text-center group">
            <span className="text-base mb-1 group-hover:scale-110 transition-transform">🎵</span>
            <span className="text-xs font-bold text-white">Music</span>
            <span className="text-[9px] text-slate-400">Tracks Library</span>
          </Link>

          <Link href="/super-admin/occasions" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center transition-all text-center group">
            <span className="text-base mb-1 group-hover:scale-110 transition-transform">🎉</span>
            <span className="text-xs font-bold text-white">Occasions</span>
            <span className="text-[9px] text-slate-400">Festivals & Events</span>
          </Link>

          <Link href="/super-admin/scheduler-sim" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center transition-all text-center group">
            <span className="text-base mb-1 group-hover:scale-110 transition-transform">📅</span>
            <span className="text-xs font-bold text-white">Scheduler</span>
            <span className="text-[9px] text-slate-400">Auto Scheduling</span>
          </Link>

          <Link href="/super-admin/gold-rates" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center transition-all text-center group">
            <span className="text-base mb-1 group-hover:scale-110 transition-transform">💰</span>
            <span className="text-xs font-bold text-white">Gold Rates</span>
            <span className="text-[9px] text-slate-400">Publish & Trigger</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Onboarded Shops</p>
            <p className="mt-2 text-2xl font-bold text-primary">{onboardedCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Outlets</p>
            <p className="mt-2 text-2xl font-bold text-primary">{activeCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-green-50 text-green-600">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Approvals</p>
            <p className="mt-2 text-2xl font-bold text-primary">{pendingCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-yellow-50 text-yellow-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Onboarded shops roster table */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-primary uppercase tracking-wider">My Managed Retail Outlets</h3>

        <Table headers={["Shop Details", "Owner info", "Validity Period", "Status", "Quick Actions", "Manage Branding"]}>
          {shops.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">No onboarded shops found. Click "Onboard New Shop" above.</td>
            </tr>
          ) : (
            shops.map((shop) => (
              <tr key={shop.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6">
                  <div className="font-bold text-primary">{shop.name}</div>
                  <div className="text-[10px] font-mono font-bold text-accent mt-0.5">{shop.shop_code || "SHOP"}</div>
                </td>
                <td className="py-4 px-6">
                  <div className="font-semibold text-slate-700">{shop.owner_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{shop.phone}</div>
                </td>
                <td className="py-4 px-6">
                  {shop.subscription ? (
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-slate-700">{shop.subscription.plan_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{shop.subscription.start_date} to {shop.subscription.end_date}</div>
                    </div>
                  ) : (
                    <span className="text-[11px] italic text-slate-400">No active plan</span>
                  )}
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    shop.status === "active" ? "bg-green-50 text-green-700 border-green-200" :
                    shop.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}>
                    {shop.status}
                  </span>
                </td>
                <td className="py-4 px-6 space-x-3">
                  <button
                    onClick={() => handleUpdateSubscription(shop.id, "trial_1_day")}
                    className="text-blue-600 hover:underline font-bold text-xs"
                  >
                    1-Day Trial
                  </button>
                  <button
                    onClick={() => handleUpdateSubscription(shop.id, "request_approval")}
                    className="text-accent hover:underline font-bold text-xs"
                  >
                    Request Activation
                  </button>
                </td>
                <td className="py-4 px-6">
                  <button 
                    onClick={() => handleOpenManageModal(shop)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Manage Shop</span>
                  </button>
                </td>
              </tr>
            ))
          )}
        </Table>
      </div>

      {/* SALES ADMIN PROFILE & CHANGE PASSWORD SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm max-w-xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <User className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Account Credentials & Profile</h3>
        </div>

        {profileSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs font-semibold">
            {profileSuccess}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
          <Input 
            label="Profile Full Name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />

          <Input 
            label="Change Password"
            type="password"
            placeholder="Enter new password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={updatingProfile}>
              {updatingProfile ? "Updating Account..." : "Save Credentials"}
            </Button>
          </div>
        </form>
      </div>

      {/* MANAGE SHOP MEDIA MODAL */}
      {manageModalOpen && selectedShop && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-primary">Manage Branding: {selectedShop.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Upload logo WebP overlays and custom outros.</p>
              </div>
              <button type="button" onClick={() => setManageModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Crop Upload Block */}
              <div className="border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-between text-center space-y-3 bg-slate-50">
                <span className="text-xs font-bold text-primary">Store Logo Badge (WebP)</span>
                
                <div className="w-24 h-24 bg-white border border-slate-100 rounded-xl flex items-center justify-center overflow-hidden p-2 shadow-inner">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No logo uploaded</span>
                  )}
                </div>

                <label className="w-full cursor-pointer bg-accent hover:bg-yellow-400 text-primary py-2 rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingLogo ? "Uploading..." : "Upload & Crop Logo"}</span>
                  <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" disabled={uploadingLogo} />
                </label>
              </div>

              {/* Custom Outro Video Upload Block */}
              <div className="border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-between text-center space-y-3 bg-slate-50">
                <span className="text-xs font-bold text-primary">Store Brand Outro Video</span>
                
                <div className="w-full flex flex-col items-center justify-center space-y-2 py-4">
                  {outroUrl ? (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                      ✓ Custom Outro Active
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No outro video uploaded</span>
                  )}
                  {uploadingOutro && (
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
                      <div className="bg-accent h-full transition-all duration-300" style={{ width: `${outroProgress}%` }}></div>
                    </div>
                  )}
                </div>

                <label className="w-full cursor-pointer bg-primary hover:bg-slate-900 text-white py-2 rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingOutro ? `Uploading ${outroProgress}%` : "Upload Outro Video"}</span>
                  <input type="file" accept="video/mp4" onChange={handleOutroUpload} className="hidden" disabled={uploadingOutro} />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button onClick={() => setManageModalOpen(false)}>Close Manager</Button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal trigger overlay */}
      {cropOpen && selectedFileSrc && (
        <LogoCropModal 
          isOpen={cropOpen}
          imageSrc={selectedFileSrc}
          shopCode={selectedShop?.shop_code || "SHOP"}
          onClose={() => { setCropOpen(false); setSelectedFileSrc(null); }}
          onCropComplete={handleLogoCropped}
        />
      )}
    </div>
  );
}
