"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  Select, 
  Modal, 
  LoadingSpinner,
  SearchBar,
  StatusBadge
} from "@/components/ui/reusable";
import DashboardLayout from "@/components/common/DashboardLayout";
import { 
  Building, 
  User, 
  Phone, 
  Plus, 
  Video, 
  Upload, 
  Play, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  FileText
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function SalesDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // User auth state
  const [user, setUser] = useState<any>(null);

  // Master data state
  const [shops, setShops] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // State for associations
  const [associations, setAssociations] = useState<any[]>([]);

  // Demo Video Form State
  const [demoForm, setDemoForm] = useState({
    shop_name: "",
    shop_phone: "",
    shop_address: "",
    logo_url: "",
    video_library_id: "",
    template_id: "",
    association_id: ""
  });

  const [pricingMode, setPricingMode] = useState<"association" | "manual">("association");
  const [manualRates, setManualRates] = useState({
    rate_22k: "6500",
    rate_24k: "7100",
    rate_18k: "5300",
    rate_9k: "2600",
    rate_silver: "90"
  });
  const [selectedRates, setSelectedRates] = useState<string[]>(["rate_22k_1g", "rate_22k_8g", "rate_silver_1g"]);

  // Demo video generation tracking
  const [demoJobId, setDemoJobId] = useState<string | null>(null);
  const [demoJobStatus, setDemoJobStatus] = useState<string | null>(null);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Load basic sales dashboard data
  const loadDashboardData = async (userId: string) => {
    try {
      const supabase = createClient();
      
      // Fetch shops onboarded by this sales rep
      const { data: shopData } = await supabase
        .from("shops")
        .select(`
          id, name, owner_name, phone, city, status, created_at,
          subscriptions(plan, status)
        `)
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      // Fetch active videos, templates and associations for demo renderer
      const [resVideos, resTemplates, resAssoc] = await Promise.all([
        fetch("/api/videos"),
        fetch("/api/templates"),
        fetch("/api/associations")
      ]);

      const vids = await resVideos.json();
      const temps = await resTemplates.json();
      const assocs = await resAssoc.json();

      setShops(shopData || []);
      setVideos(Array.isArray(vids) ? vids : []);
      
      // Filter by status === "active" to resolve active templates correctly!
      const activeTemps = (Array.isArray(temps) ? temps : []).filter(t => t.status === "active");
      setTemplates(activeTemps);
      setAssociations(Array.isArray(assocs) ? assocs : []);

      if (vids.length > 0) {
        setDemoForm(prev => ({ ...prev, video_library_id: prev.video_library_id || vids[0].id }));
      }
      if (activeTemps.length > 0) {
        setDemoForm(prev => ({ ...prev, template_id: prev.template_id || activeTemps[0].id }));
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);
      await loadDashboardData(currentUser.id);
      setLoading(false);
    };
    init();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDemo: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isDemo) {
      setDemoJobStatus("Uploading logo...");
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/r2", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (isDemo) {
        setDemoForm(prev => ({ ...prev, logo_url: data.url }));
        setDemoJobStatus(null);
      }
    } catch (err: any) {
      alert(`Logo upload failed: ${err.message}`);
      setDemoJobStatus(null);
    }
  };

  // Trigger Demo Video Generation
  const handleDemoGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError(null);
    setDemoVideoUrl(null);
    setDemoJobStatus("Queuing...");

    try {
      const res = await fetch("/api/sales/demo-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_name: demoForm.shop_name,
          shop_phone: demoForm.shop_phone,
          shop_address: demoForm.shop_address,
          logo_url: demoForm.logo_url,
          video_library_id: demoForm.video_library_id,
          template_id: demoForm.template_id,
          association_id: pricingMode === "association" ? (demoForm.association_id || null) : null,
          pricing_mode: pricingMode,
          manual_rates: pricingMode === "manual" ? manualRates : null,
          selected_rates: selectedRates
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger demo render");

      setDemoJobId(data.jobId);
      setDemoJobStatus("Rendering (approx 1-2 mins)...");
      pollDemoStatus(data.jobId);
    } catch (err: any) {
      setDemoError(err.message);
      setDemoJobStatus(null);
    }
  };

  // Poll render job status
  const pollDemoStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/renders?job_id=${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (data.status === "Completed") {
          clearInterval(interval);
          setDemoVideoUrl(data.rendered_video_url);
          setDemoJobStatus("Finished!");
        } else if (data.status === "Failed") {
          clearInterval(interval);
          setDemoError(data.error_message || "Video rendering failed on VPS worker.");
          setDemoJobStatus(null);
        } else {
          setDemoJobStatus(`Processing (Status: ${data.status})...`);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 4000);
  };

  return (
    <DashboardLayout role="sales" title="Sales Portal">
      <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <PageHeader 
        title="Sales Partner Portal"
        description="Onboard new stores for validation, and generate dynamic temporary demo videos to show store prospects."
        action={
          <Button onClick={() => router.push("/sales/onboard")} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Onboard New Shop</span>
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Onboarded Shops List (Left 1 col) */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 space-y-4 shadow-sm h-fit">
            <h3 className="text-sm font-bold text-primary flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-slate-500" />
              <span>Your Onboarded Shops</span>
            </h3>

            {shops.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">No shop accounts onboarded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {shops.map((shop) => (
                  <div key={shop.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary truncate max-w-[130px]">{shop.name}</span>
                      <StatusBadge status={shop.status === "active" ? "active" : "pending"} />
                    </div>
                    <p className="text-[10px] text-slate-500">Owner: {shop.owner_name}</p>
                    <p className="text-[10px] text-slate-400">City: {shop.city}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Temporary Video Generator (Right 2 cols) */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-primary flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Video className="w-4 h-4 text-accent-foreground" />
              <span>Instant Quality Demo Video Generator (Temp VPS Files)</span>
            </h3>

            <form onSubmit={handleDemoGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Prospect Shop Name</label>
                  <Input 
                    placeholder="e.g. Sri Varamahalakshmi Jewellers"
                    value={demoForm.shop_name}
                    onChange={(e) => setDemoForm({ ...demoForm, shop_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Phone Number for overlay</label>
                  <Input 
                    placeholder="e.g. 9876543210"
                    value={demoForm.shop_phone}
                    onChange={(e) => setDemoForm({ ...demoForm, shop_phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Store Address for overlay</label>
                  <Input 
                    placeholder="e.g. T-Nagar, Chennai"
                    value={demoForm.shop_address}
                    onChange={(e) => setDemoForm({ ...demoForm, shop_address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Upload Shop Logo (Optional)</label>
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-semibold">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>{demoForm.logo_url ? "Change Logo" : "Upload Logo"}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleLogoUpload(e, true)}
                        className="hidden" 
                      />
                    </label>
                    {demoForm.logo_url && (
                      <span className="text-[10px] text-green-600 font-bold">Uploaded ✓</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Select Overlay Design Template</label>
                  <Select 
                    value={demoForm.template_id}
                    onChange={(e) => setDemoForm({ ...demoForm, template_id: e.target.value })}
                    options={templates.map(t => ({ label: t.name, value: t.id }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Select Base Video Clip</label>
                  <Select 
                    value={demoForm.video_library_id}
                    onChange={(e) => setDemoForm({ ...demoForm, video_library_id: e.target.value })}
                    options={videos.map(v => ({ label: v.title, value: v.id }))}
                  />
                </div>

                {/* Pricing Mode Selection */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Pricing Source</label>
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPricingMode("association")}
                      className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                        pricingMode === "association" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Use Association
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode("manual")}
                      className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                        pricingMode === "manual" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Manual Rates Input
                    </button>
                  </div>
                </div>

                {pricingMode === "association" ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Select Rate Association Group</label>
                    <Select 
                      value={demoForm.association_id}
                      onChange={(e) => setDemoForm({ ...demoForm, association_id: e.target.value })}
                      options={[
                        { label: "-- Global Default Rates (No Association) --", value: "" },
                        ...associations.map(a => ({ label: a.name, value: a.id }))
                      ]}
                    />
                  </div>
                ) : (
                  <div className="space-y-2 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Manual Metal Rates (per gram)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">22K Gold</span>
                        <input
                          type="number"
                          value={manualRates.rate_22k}
                          onChange={(e) => setManualRates({ ...manualRates, rate_22k: e.target.value })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="e.g. 6500"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">24K Gold</span>
                        <input
                          type="number"
                          value={manualRates.rate_24k}
                          onChange={(e) => setManualRates({ ...manualRates, rate_24k: e.target.value })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="e.g. 7100"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">18K Gold</span>
                        <input
                          type="number"
                          value={manualRates.rate_18k}
                          onChange={(e) => setManualRates({ ...manualRates, rate_18k: e.target.value })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="e.g. 5300"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">9K Gold</span>
                        <input
                          type="number"
                          value={manualRates.rate_9k}
                          onChange={(e) => setManualRates({ ...manualRates, rate_9k: e.target.value })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="e.g. 2600"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Silver</span>
                        <input
                          type="number"
                          value={manualRates.rate_silver}
                          onChange={(e) => setManualRates({ ...manualRates, rate_silver: e.target.value })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="e.g. 90"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Display Slots Selection */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Display slots (Max 4, click to select in order)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "rate_22k_1g", label: "22K Gold (1G)" },
                      { id: "rate_22k_8g", label: "22K Gold (8G / 1 Sov)" },
                      { id: "rate_24k_1g", label: "24K Gold (1G)" },
                      { id: "rate_18k_1g", label: "18K Gold (1G)" },
                      { id: "rate_18k_8g", label: "18K Gold (8G / 1 Sov)" },
                      { id: "rate_9k_1g", label: "9K Gold (1G)" },
                      { id: "rate_silver_1g", label: "Silver (1G)" }
                    ].map((opt) => {
                      const idx = selectedRates.indexOf(opt.id);
                      const isSel = idx !== -1;
                      return (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() => {
                            if (isSel) {
                              setSelectedRates(selectedRates.filter(r => r !== opt.id));
                            } else {
                              if (selectedRates.length >= 4) {
                                alert("Maximum 4 rate slots can be selected.");
                                return;
                              }
                              setSelectedRates([...selectedRates, opt.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl text-left text-xs font-bold border transition-all ${
                            isSel 
                              ? "bg-amber-50/70 border-accent text-primary" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSel && (
                            <span className="bg-accent text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={!!demoJobStatus} className="w-full flex items-center justify-center space-x-2 py-3">
                    <Play className="w-4 h-4 fill-current" />
                    <span>{demoJobStatus || "Generate Demo Video"}</span>
                  </Button>
                </div>
              </div>
            </form>

            {/* Error alerts */}
            {demoError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{demoError}</span>
              </div>
            )}

            {/* Video preview / download area */}
            {demoVideoUrl && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-primary flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Demo Video Completed Successfully!</span>
                </h4>
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-inner">
                  <video src={demoVideoUrl} controls className="w-full h-full object-contain" />
                </div>
                <div className="flex justify-end">
                  <a 
                    href={demoVideoUrl} 
                    download={`demo_${demoForm.shop_name.replace(/\s+/g, "_")}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-2 bg-accent hover:bg-yellow-400 text-primary font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Demo Video</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
