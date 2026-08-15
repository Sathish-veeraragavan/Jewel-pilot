"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Store, Clock, Edit3, UserCheck, Plus, AlertTriangle, Video, Upload, Trash2 } from "lucide-react";
import { Button, Input, Select, LoadingSpinner } from "@/components/ui/reusable";
import { createClient } from "@/utils/supabase/client";

export default function SuperAdminShopsPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let role = user.app_metadata?.role || user.user_metadata?.role;
        if (!role) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          role = profile?.role;
        }
        if (role) {
          setUserRole(role);
        }
      }
    }
    loadRole();
  }, []);

  // Edit Modal State
  const [editingShop, setEditingShop] = useState<any>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shopStatus, setShopStatus] = useState("active");
  const [subStatus, setSubStatus] = useState("active");
  const [shopNameInput, setShopNameInput] = useState("");
  const [shopPhoneInput, setShopPhoneInput] = useState("");
  const [shopOwnerPhoneInput, setShopOwnerPhoneInput] = useState("");
  const [shopAddressInput, setShopAddressInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [associations, setAssociations] = useState<any[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [useCustomAllowedMetals, setUseCustomAllowedMetals] = useState(false);
  const [shopAllowedMetals, setShopAllowedMetals] = useState<string[]>([]);
  const [weeklyCategories, setWeeklyCategories] = useState<{ [key: string]: string }>({
    monday: "none",
    tuesday: "none",
    wednesday: "none",
    thursday: "none",
    friday: "none",
    saturday: "none",
    sunday: "none"
  });

  // Outro Video State
  const [outroUrl, setOutroUrl] = useState<string | null>(null);
  const [uploadingOutro, setUploadingOutro] = useState(false);
  const [outroProgress, setOutroProgress] = useState(0);

  const todayStr = new Date().toISOString().split("T")[0];

  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shops");
      const data = await res.json();
      if (Array.isArray(data)) {
        setShops(data);
      } else {
        console.error("Failed to load shops:", data);
        setShops([]);
      }
    } catch (err) {
      console.error("Failed to fetch shops:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssociations = async () => {
    try {
      const res = await fetch("/api/associations");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAssociations(data);
      }
    } catch (err) {
      console.error("Failed to fetch associations:", err);
    }
  };

  useEffect(() => {
    fetchShops();
    fetchAssociations();
  }, []);

  const handleOpenEdit = async (shop: any) => {
    setEditingShop(shop);
    setOutroUrl(shop.outro_video_url || null);
    setShopNameInput(shop.name || "");
    setShopPhoneInput(shop.phone || "");
    setShopOwnerPhoneInput(shop.owner_phone || "");
    setShopAddressInput(shop.address || "");
    setSelectedAssociationId(shop.association_id || "");
    
    if (shop.allowed_metals) {
      setUseCustomAllowedMetals(true);
      setShopAllowedMetals(shop.allowed_metals);
    } else {
      setUseCustomAllowedMetals(false);
      setShopAllowedMetals(["24k", "22k", "18k", "9k", "silver"]);
    }

    setWeeklyCategories(shop.weekly_categories || {
      monday: "none",
      tuesday: "none",
      wednesday: "none",
      thursday: "none",
      friday: "none",
      saturday: "none",
      sunday: "none"
    });
    
    const sub = shop.subscription || shop.subscriptions?.[0];
    const sDate = sub?.start_date || todayStr;
    const eDate = sub?.end_date || todayStr;

    setStartDate(sDate);
    setEndDate(eDate);

    if (eDate < todayStr) {
      setShopStatus("inactive");
      setSubStatus("expired");
    } else {
      setShopStatus(shop.status || "active");
      setSubStatus(shop.computedSubStatus || sub?.status || "active");
    }

    // Fetch latest outro video URL if available
    try {
      const res = await fetch(`/api/shops/outro?shopId=${shop.id}`);
      const data = await res.json();
      if (data.outro_video_url) {
        setOutroUrl(data.outro_video_url);
      }
    } catch (err) {
      console.error("Failed to fetch shop outro video:", err);
    }
  };

  const hasChanges = () => {
    if (!editingShop) return false;
    const sub = editingShop.subscription || editingShop.subscriptions?.[0];
    const originalStartDate = sub?.start_date || todayStr;
    const originalEndDate = sub?.end_date || todayStr;
    const originalShopStatus = editingShop.status || "active";
    const originalSubStatus = editingShop.computedSubStatus || sub?.status || "active";

    const originalAllowedMetals = editingShop.allowed_metals || null;
    const currentAllowedMetals = useCustomAllowedMetals ? shopAllowedMetals : null;
    const metalsChanged = JSON.stringify(originalAllowedMetals) !== JSON.stringify(currentAllowedMetals);

    const originalWeeklyCategories = editingShop.weekly_categories || {
      monday: "none",
      tuesday: "none",
      wednesday: "none",
      thursday: "none",
      friday: "none",
      saturday: "none",
      sunday: "none"
    };
    const weeklyCategoriesChanged = JSON.stringify(originalWeeklyCategories) !== JSON.stringify(weeklyCategories);

    return (
      shopNameInput !== (editingShop.name || "") ||
      shopPhoneInput !== (editingShop.phone || "") ||
      shopOwnerPhoneInput !== (editingShop.owner_phone || "") ||
      shopAddressInput !== (editingShop.address || "") ||
      startDate !== originalStartDate ||
      endDate !== originalEndDate ||
      shopStatus !== originalShopStatus ||
      subStatus !== originalSubStatus ||
      selectedAssociationId !== (editingShop.association_id || "") ||
      metalsChanged ||
      weeklyCategoriesChanged
    );
  };

  const handleCancelOrClose = () => {
    if (hasChanges()) {
      if (confirm("Discard unsaved changes?")) {
        setEditingShop(null);
      }
    } else {
      setEditingShop(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingShop) return;
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancelOrClose();
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target && target.tagName !== "TEXTAREA" && target.tagName !== "BUTTON" && !target.closest('.border-dashed')) {
          e.preventDefault();
          handleSaveSubscription();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingShop, shopNameInput, shopPhoneInput, shopOwnerPhoneInput, shopAddressInput, startDate, endDate, shopStatus, subStatus, selectedAssociationId, useCustomAllowedMetals, shopAllowedMetals]);

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEndDate(val);
    if (val && val < todayStr) {
      setShopStatus("inactive");
      setSubStatus("expired");
    } else if (val && val >= todayStr && subStatus === "expired") {
      setShopStatus("active");
      setSubStatus("active");
    }
  };

  const handleOutroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingShop) return;

    if (file.size > 50 * 1024 * 1024) {
      alert(`Outro video size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum 50 MB limit.`);
      return;
    }

    setUploadingOutro(true);
    setOutroProgress(0);

    const shopCode = editingShop.shop_code || editingShop.id;
    const prefix = `OUTRO_${shopCode}`;

    let finalUrl = "";
    try {
      // 1. Get presigned upload URL
      const presignedRes = await fetch("/api/upload/r2-presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
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
        // Save to shop outro API endpoint
        await fetch("/api/shops/outro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: editingShop.id,
            shopCode,
            outro_video_url: finalUrl
          })
        });

        setOutroUrl(finalUrl);
        alert(`Custom Outro Video uploaded successfully for ${editingShop.name}!`);
        fetchShops();
      }
    } catch (err: any) {
      console.error("Outro upload error:", err);
      alert(err.message || "Failed to upload shop outro video.");
    } finally {
      setUploadingOutro(false);
      setOutroProgress(0);
    }
  };

  const handleDeleteOutro = async () => {
    if (!editingShop || !outroUrl) return;
    if (!confirm(`Are you sure you want to remove the custom outro video for ${editingShop.name}?`)) return;

    setUploadingOutro(true);
    try {
      await fetch(`/api/shops/outro?shopId=${editingShop.id}&outroUrl=${encodeURIComponent(outroUrl)}`, {
        method: "DELETE"
      });
      setOutroUrl(null);
      alert("Outro video removed successfully.");
      fetchShops();
    } catch (err) {
      alert("Failed to delete outro video.");
    } finally {
      setUploadingOutro(false);
    }
  };

  const handleSaveSubscription = async () => {
    if (!editingShop) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shops/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: editingShop.id,
          startDate,
          endDate,
          shopStatus,
          subStatus,
          name: shopNameInput,
          phone: shopPhoneInput,
          owner_phone: shopOwnerPhoneInput,
          address: shopAddressInput,
          association_id: selectedAssociationId || null,
          allowed_metals: useCustomAllowedMetals ? shopAllowedMetals : null,
          weekly_categories: weeklyCategories
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Shop subscription updated! Status: ${data.shopStatus || shopStatus}`);
        setEditingShop(null);
        fetchShops();
      }
    } catch (err) {
      alert("Failed to update subscription.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveQuick = async (shopId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/shops/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          startDate: todayStr,
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
          shopStatus: "active",
          subStatus: "active",
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert("Shop account approved and activated!");
        fetchShops();
      }
    } catch (err) {
      alert("Approval failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">Shop Accounts & Onboarding Roster</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review store accounts, shop codes, sales admin assignments, custom outro videos (`outro/${"{shopCode}"}_outro.mp4`), and subscriptions.
          </p>
        </div>
        <Link 
          href="/admin/onboard" 
          className="inline-flex items-center space-x-2 bg-accent hover:bg-yellow-400 text-primary font-bold px-4 py-2.5 rounded-xl shadow transition-all text-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Store Outlet</span>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Retailers</p>
            <p className="text-2xl font-bold text-primary">{shops.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Outlets</p>
            <p className="text-2xl font-bold text-primary">
              {shops.filter(s => s.status === "active").length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-bold text-primary">
              {shops.filter(s => s.status === "pending").length}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Store Details</th>
                  <th className="py-4 px-6">Unique Shop Code</th>
                  <th className="py-4 px-6">Outro Video</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-primary">
                {shops.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs font-semibold">
                      No retail store outlets onboarded yet. Click "Register New Store Outlet" to add one.
                    </td>
                  </tr>
                ) : (
                  shops.map((shop: any) => (
                    <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-primary">{shop.name}</span>
                          {shop.pricing_mode === "custom_manual" && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                              Manual Pricing
                            </span>
                          )}
                          {shop.pricing_mode === "discount" && (
                            <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                              Discount Mode
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {shop.owner_name} • Shop Ph: {shop.phone} {shop.owner_phone ? `• Owner Ph: ${shop.owner_phone}` : ""} • {shop.city || shop.district || shop.state}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-extrabold text-accent bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-mono">
                          {shop.shop_code || "SHOP-00000"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {shop.outro_video_url ? (
                          <span className="inline-flex items-center space-x-1 bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                            <Video className="w-3.5 h-3.5 text-purple-600" />
                            <span>Outro Active</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">None</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          shop.status === "active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : shop.status === "inactive" || shop.computedSubStatus === "expired"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }`}>
                          {shop.computedSubStatus === "expired" ? "expired" : shop.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 flex items-center space-x-2">
                        {shop.status === "pending" && userRole === "super_admin" && (
                          <button
                            onClick={() => handleApproveQuick(shop.id)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(shop)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Manage Shop & Outro</span>
                        </button>
                        <Link
                          href={`/shop?shop_id=${shop.id}`}
                          className="px-3 py-1.5 bg-accent hover:bg-yellow-400 text-primary rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>View Dashboard</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Shop Details & Custom Outro Modal */}
      {editingShop && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-primary">Manage {editingShop.name}</h3>
                <p className="text-xs text-muted-foreground">Shop Code: <strong className="font-mono text-accent">{editingShop.shop_code}</strong></p>
              </div>
              <button onClick={handleCancelOrClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {/* Outro Video Upload Card */}
            <div className="bg-purple-50/60 border border-purple-200 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-5 h-5 text-purple-600" />
                  <h4 className="font-bold text-sm text-primary">Shop Custom Outro Video</h4>
                </div>
                <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  outro/{editingShop.shop_code}_outro.mp4
                </span>
              </div>

              {outroUrl ? (
                <div className="space-y-3">
                  <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                    <video src={outroUrl} controls className="w-full h-full object-contain" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-slate-500 truncate max-w-xs">{outroUrl}</span>
                    <Button 
                      variant="outline" 
                      onClick={handleDeleteOutro} 
                      disabled={uploadingOutro}
                      className="text-red-600 border-red-200 hover:bg-red-50 text-xs flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Outro</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-purple-200 rounded-xl p-6 text-center">
                  <Upload className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-primary">Upload Custom Shop Outro (.MP4 / .MOV)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Slices into 4MB chunks for 100% video integrity (Max 50 MB)</p>
                  <input 
                    type="file" 
                    accept="video/mp4,video/quicktime" 
                    onChange={handleOutroFileUpload}
                    className="hidden" 
                    id="outro-file-input"
                    disabled={uploadingOutro}
                  />
                  <label 
                    htmlFor="outro-file-input" 
                    className="mt-3 inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                  >
                    {uploadingOutro ? `Uploading Outro (${outroProgress}%)...` : "Select Outro Video"}
                  </label>
                </div>
              )}
            </div>

            {/* Shop Details Edit Section */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-semibold">Store Information</h4>
              <Input 
                label="Shop Name" 
                value={shopNameInput} 
                onChange={(e) => setShopNameInput(e.target.value)} 
              />
              <Input 
                label="Shop Phone Number (shown on video)" 
                value={shopPhoneInput} 
                onChange={(e) => setShopPhoneInput(e.target.value)} 
              />
              <Input 
                label="Owner Phone Number" 
                value={shopOwnerPhoneInput} 
                onChange={(e) => setShopOwnerPhoneInput(e.target.value)} 
              />
              <Input 
                label="Physical Store Address" 
                value={shopAddressInput} 
                onChange={(e) => setShopAddressInput(e.target.value)} 
              />
              
              {userRole === "super_admin" && (
                <div className="bg-slate-50 p-4 rounded-xl space-y-3 mt-2 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-700">
                    Registered State: <span className="font-extrabold text-slate-900">{editingShop.states?.name || "None"}</span>
                  </div>
                  <Select 
                    label="Rate Association"
                    value={selectedAssociationId}
                    onChange={(e) => setSelectedAssociationId(e.target.value)}
                    options={[
                      { label: "None / Global Fallback", value: "" },
                      ...associations
                        .filter((a: any) => a.state_id === editingShop.state_id)
                        .map((a: any) => ({
                          label: a.name,
                          value: a.id
                        }))
                    ]}
                  />

                  {/* Precious Metals Visibility Configuration */}
                  <div className="border-t border-slate-200/60 pt-3 mt-3 space-y-3">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomAllowedMetals}
                        onChange={(e) => setUseCustomAllowedMetals(e.target.checked)}
                        className="rounded text-accent focus:ring-accent w-4 h-4"
                      />
                      <span>Override Precious Metals (Custom Shop Settings)</span>
                    </label>

                    {useCustomAllowedMetals ? (
                      <div className="space-y-1.5 pl-6">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Allowed Metals for Shop</span>
                        <div className="flex flex-wrap gap-2">
                          {["24k", "22k", "18k", "9k", "silver"].map((m) => {
                            const isChecked = shopAllowedMetals.includes(m);
                            return (
                              <label key={m} className="flex items-center space-x-1.5 text-xs bg-white border border-slate-250 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setShopAllowedMetals(shopAllowedMetals.filter((x) => x !== m));
                                    } else {
                                      setShopAllowedMetals([...shopAllowedMetals, m]);
                                    }
                                  }}
                                  className="rounded text-accent focus:ring-accent w-3.5 h-3.5"
                               />
                                <span className="font-extrabold text-[10px] uppercase text-primary">{m}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 font-medium pl-6 italic">
                        Currently inheriting visibility rules from the selected Association.
                      </div>
                    )}
                  </div>

                  {/* Custom Weekly Video Categories */}
                  <div className="border-t border-slate-200/60 pt-3 mt-3 space-y-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Weekly Category Schedule Override</span>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                        <div key={day} className="flex flex-col space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase capitalize">{day}</label>
                          <select
                            value={weeklyCategories[day] || "none"}
                            onChange={(e) => setWeeklyCategories({ ...weeklyCategories, [day]: e.target.value })}
                            className="w-full text-[11px] bg-white rounded-md border border-slate-200 p-1.5 font-bold text-slate-800 focus:outline-none"
                          >
                            <option value="none">Default (Auto Rotate)</option>
                            <option value="Necklace">Necklace</option>
                            <option value="Rings">Rings</option>
                            <option value="Earrings">Earrings</option>
                            <option value="Ankle Chains">Ankle Chains</option>
                            <option value="Chains">Chains</option>
                            <option value="Bracelets/Bangles">Bracelets/Bangles</option>
                            <option value="Maalai">Maalai</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Manager Form */}
            {userRole === "super_admin" && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Subscription & Activation</h4>
                {endDate < todayStr && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>Selected End Date is in the past. Status will automatically be updated to <strong>Expired / Inactive</strong>.</span>
                  </div>
                )}

                <Select 
                  label="Shop Status"
                  value={shopStatus}
                  onChange={(e) => setShopStatus(e.target.value)}
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Pending Approval", value: "pending" },
                    { label: "Inactive / Suspended", value: "inactive" }
                  ]}
                />

                <Select 
                  label="Subscription Status"
                  value={subStatus}
                  onChange={(e) => setSubStatus(e.target.value)}
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Pending Approval", value: "pending_approval" },
                    { label: "Expired", value: "expired" },
                    { label: "Suspended", value: "suspended" }
                  ]}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input 
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={handleEndDateChange}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={handleCancelOrClose}>Cancel</Button>
              <Button onClick={handleSaveSubscription} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
