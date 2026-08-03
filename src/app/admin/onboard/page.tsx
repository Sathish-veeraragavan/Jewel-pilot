"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  PageHeader, 
  Button, 
  Input, 
  Select,
  LoadingSpinner
} from "@/components/ui/reusable";
import { Building, MapPin, Lock, Calendar, CheckCircle2, Sparkles, Upload, ImageIcon, Crop } from "lucide-react";
import LogoCropModal from "@/components/ui/LogoCropModal";

export default function ShopOnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<any>(null);

  // Dropdown lists
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  // Form Fields state
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedLangId, setSelectedLangId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [ownerEmail, setOwnerEmail] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [tempShopCode, setTempShopCode] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [planName, setPlanName] = useState("Standard");

  // Dates state
  const todayStr = new Date().toISOString().split("T")[0];
  const nextYearStr = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextYearStr);
  const [selectedRates, setSelectedRates] = useState<string[]>(["rate_22k_1g", "rate_22k_8g", "rate_silver_1g"]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");

  const fetchDropdowns = async () => {
    setLoading(true);
    try {
      const [resOrg, resState, resLang] = await Promise.all([
        fetch("/api/master-data?type=organizations"),
        fetch("/api/master-data?type=states"),
        fetch("/api/master-data?type=languages")
      ]);

      const orgs = await resOrg.json();
      const sts = await resState.json();
      const langs = await resLang.json();

      const validOrgs = Array.isArray(orgs) ? orgs : [];
      const validSts = Array.isArray(sts) ? sts : [];
      const validLangs = Array.isArray(langs) ? langs : [];

      setOrganizations(validOrgs);
      setStates(validSts);
      setLanguages(validLangs);

      if (validOrgs.length > 0) setSelectedOrgId(validOrgs[0].id);
      if (validSts.length > 0) {
        setSelectedStateId(validSts[0].id);
        fetchDistricts(validSts[0].id);
        fetchAssociations(validSts[0].id);
      }
      if (validLangs.length > 0) setSelectedLangId(validLangs[0].id);
    } catch (err) {
      console.error("Failed to load master dropdowns:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDistricts = async (stateId: string) => {
    if (!stateId) return;
    try {
      const res = await fetch(`/api/master-data?type=districts&state_id=${stateId}`);
      const data = await res.json();
      const validDts = Array.isArray(data) ? data : [];
      setDistricts(validDts);
      if (validDts.length > 0) setSelectedDistrictId(validDts[0].id);
    } catch (err) {
      console.error("Failed to load districts:", err);
    }
  };

  const fetchAssociations = async (stateId: string) => {
    if (!stateId) return;
    try {
      const res = await fetch(`/api/associations?state_id=${stateId}`);
      const data = await res.json();
      const validAssoc = Array.isArray(data) ? data : [];
      setAssociations(validAssoc);
      setSelectedAssociationId(""); // Reset selection
    } catch (err) {
      console.error("Failed to load associations:", err);
    }
  };

  useEffect(() => {
    fetchDropdowns();
    setTempShopCode("onboard_" + Math.random().toString(36).substring(2, 8).toUpperCase());
  }, []);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setFormError(null);
    const objectUrl = URL.createObjectURL(rawFile);
    setSelectedImageSrc(objectUrl);
    setCropModalOpen(true);
    e.target.value = ""; // reset input
  };

  const handleCroppedLogoUpload = async (croppedFile: File) => {
    setUploadingLogo(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("file", croppedFile);
      formData.append("shopCode", tempShopCode);

      const res = await fetch("/api/upload/r2", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.error) {
        setFormError(`Logo Upload Failed: ${data.error}`);
      } else if (data.url) {
        const cacheBustedUrl = data.url.includes("?") ? `${data.url}&v=${Date.now()}` : `${data.url}?v=${Date.now()}`;
        setLogoUrl(cacheBustedUrl);
      }
    } catch (err) {
      setFormError("Failed to upload cropped logo to Cloudflare R2.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedStateId(val);
    fetchDistricts(val);
    fetchAssociations(val);
  };

  const handleQuickDuration = (duration: "1_day" | "1_month" | "1_year") => {
    const s = new Date();
    setStartDate(s.toISOString().split("T")[0]);
    const e = new Date();
    if (duration === "1_day") e.setDate(e.getDate() + 1);
    else if (duration === "1_month") e.setMonth(e.getMonth() + 1);
    else if (duration === "1_year") e.setFullYear(e.getFullYear() + 1);
    setEndDate(e.toISOString().split("T")[0]);
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (selectedRates.length < 3 || selectedRates.length > 4) {
      setFormError("You must select between 3 and 4 precious metal rate displays.");
      return;
    }

    setSubmitting(true);

    const payload = {
      organization_id: selectedOrgId,
      name: shopName,
      owner_name: ownerName,
      address,
      phone,
      owner_phone: ownerPhone,
      state_id: selectedStateId,
      district_id: selectedDistrictId,
      city,
      language_id: selectedLangId,
      logo_url: logoUrl,
      owner_email: ownerEmail,
      owner_password: ownerPassword,
      plan_name: planName,
      start_date: startDate,
      end_date: endDate,
      selected_rates: selectedRates,
      association_id: selectedAssociationId || null
    };

    try {
      const res = await fetch("/api/shops/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        setFormError(data.error);
      } else {
        setCreatedSuccess(data);
      }
    } catch (err) {
      setFormError("Onboarding request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Register Retail Store Outlet"
        description="Onboard new jewellery shops, assign location metadata, and configure subscription dates."
      />

      {/* Success Modal */}
      {createdSuccess && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-border text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-primary">Store Account Created!</h3>
            <p className="text-xs text-muted-foreground">The shop has been registered with an auto-generated unique code.</p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-left text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold uppercase">Auto-Generated Shop Code</span>
                <span className="font-extrabold text-accent text-sm">{createdSuccess.shopCode}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold uppercase">Store Name</span>
                <span className="font-bold text-primary">{shopName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold uppercase">Owner Email</span>
                <span className="font-medium text-slate-700">{ownerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold uppercase">Status</span>
                <span className="font-bold text-green-600 uppercase">{createdSuccess.status}</span>
              </div>
            </div>

            <Button onClick={() => router.push("/super-admin/shops")} className="w-full">
              Done & View All Accounts
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <form onSubmit={handleOnboard} className="max-w-3xl bg-white p-8 rounded-2xl border border-border shadow-sm space-y-6">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-semibold">
              {formError}
            </div>
          )}

          {/* Section 1: Store profile details */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Building className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Outlet Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <Input 
                  label="Shop / Outlet Name" 
                  required 
                  placeholder="e.g. Kalyan Jewellers Chennai"
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)} 
                />
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Shop Code</span>
                <span className="text-xs font-semibold text-slate-600 mt-1 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Auto-Generated (SHOP-XXXXX)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select 
                label="Organization Owner Group" 
                value={selectedOrgId} 
                onChange={(e) => setSelectedOrgId(e.target.value)}
                options={organizations.map(o => ({ label: o.name, value: o.id }))} 
              />
              <Select 
                label="Assigned Display Language" 
                value={selectedLangId} 
                onChange={(e) => setSelectedLangId(e.target.value)}
                options={languages.map(l => ({ label: `${l.language_name} (${l.locale})`, value: l.id }))} 
              />
            </div>
          </div>

          {/* Section 2: Store location tags */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <MapPin className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Location Tags</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Select 
                label="State" 
                value={selectedStateId} 
                onChange={handleStateChange}
                options={states.map(s => ({ label: s.name, value: s.id }))} 
              />
              <Select 
                label="District" 
                value={selectedDistrictId} 
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                options={districts.map(d => ({ label: d.name, value: d.id }))} 
              />
              <Input 
                label="City" 
                placeholder="e.g. Chennai"
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
              />
              <Select 
                label="Rate Association" 
                value={selectedAssociationId} 
                onChange={(e) => setSelectedAssociationId(e.target.value)}
                options={[
                  { label: "Follow Global Rates", value: "" },
                  ...associations.map(a => ({ label: a.name, value: a.id }))
                ]} 
              />
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Store Physical Address" 
                placeholder="e.g. 12, T-Nagar, Chennai"
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                {/* Logo Preview */}
                <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center overflow-hidden relative group mx-auto md:mx-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Store Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="text-center p-1 text-slate-400">
                      <ImageIcon className="w-5 h-5 mx-auto mb-0.5 opacity-50" />
                      <span className="text-[8px] font-semibold">No Logo</span>
                    </div>
                  )}
                </div>

                {/* Upload Action */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">Logo Cropper & Sync</label>
                  <div className="flex items-center space-x-2">
                    <label className="cursor-pointer bg-white hover:bg-slate-100 text-slate-800 font-semibold px-3 py-1.5 rounded-lg border border-slate-350 text-[10px] flex items-center space-x-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-accent" />
                      <span>{uploadingLogo ? "Uploading..." : "Choose Image"}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoFileSelect}
                        disabled={uploadingLogo} 
                      />
                    </label>
                    {logoUrl && (
                      <span className="text-[9px] text-green-600 font-bold flex items-center space-x-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Synced</span>
                      </span>
                    )}
                  </div>
                  <input 
                    type="hidden" 
                    value={logoUrl} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Subscription & Dates */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Subscription Validity</h3>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <button type="button" onClick={() => handleQuickDuration("1_day")} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold">1-Day Trial</button>
                <button type="button" onClick={() => handleQuickDuration("1_month")} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold">1 Month</button>
                <button type="button" onClick={() => handleQuickDuration("1_year")} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold">1 Year</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Select 
                label="Subscription Plan Tier" 
                required 
                value={planName} 
                onChange={(e) => setPlanName(e.target.value)}
                options={[
                  { label: "Standard Plan", value: "Standard" },
                  { label: "Premium Plan", value: "Premium" },
                  { label: "Enterprise Plan", value: "Enterprise" }
                ]} 
              />
              <Input 
                label="Start Date" 
                type="date"
                required
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
              <Input 
                label="End Date" 
                type="date"
                required
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>

          {/* Section 3.5: Precious Metal Rate Displays */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Video Overlay Rates Configuration</h3>
            </div>
            <p className="text-xs text-slate-500">
              Select and order exactly 3 or 4 rates you want to display on the video overlay. Clicking an item adds it to the slots in order; clicking a selected item removes it.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: "rate_22k_1g", label: "22K Gold (1G)" },
                { id: "rate_22k_8g", label: "22K Gold (8G / 1 Sov)" },
                { id: "rate_24k_1g", label: "24K Gold (1G)" },
                { id: "rate_18k_1g", label: "18K Gold (1G)" },
                { id: "rate_18k_8g", label: "18K Gold (8G / 1 Sov)" },
                { id: "rate_9k_1g", label: "9K Gold (1G)" },
                { id: "rate_silver_1g", label: "Silver (1G)" },
              ].map((opt) => {
                const selectedIdx = selectedRates.indexOf(opt.id);
                const isSelected = selectedIdx !== -1;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedRates(selectedRates.filter((r) => r !== opt.id));
                      } else {
                        if (selectedRates.length >= 4) {
                          alert("You can select a maximum of 4 rate displays.");
                          return;
                        }
                        setSelectedRates([...selectedRates, opt.id]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                      isSelected
                        ? "border-accent bg-amber-50/20 ring-1 ring-accent"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-700">{opt.label}</span>
                    {isSelected ? (
                      <span className="text-[10px] bg-accent text-primary px-2 py-0.5 rounded-md font-extrabold self-end">
                        Slot {selectedIdx + 1}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 self-end font-normal">Click to add</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span>Current display order:</span>
              {selectedRates.length === 0 ? (
                <span className="text-red-500 font-bold">None selected (Minimum 3 required)</span>
              ) : (
                <span className="text-accent font-extrabold">
                  {selectedRates.map((r, i) => `${i + 1}. ${r.replace("rate_", "").replace("_", " ").toUpperCase()}`).join("  ➡  ")}
                </span>
              )}
            </div>
          </div>

          {/* Section 4: Credentials */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Lock className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Owner Account Credentials</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Owner Contact Name" 
                required 
                placeholder="Full Name"
                value={ownerName} 
                onChange={(e) => setOwnerName(e.target.value)} 
              />
              <Input 
                label="Shop Phone Number (shown on video)" 
                required
                placeholder="e.g. 9876543210"
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
              />
              <Input 
                label="Owner Phone Number (for notifications)" 
                placeholder="e.g. 9876543210"
                value={ownerPhone} 
                onChange={(e) => setOwnerPhone(e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Login Email or Mobile Number" 
                type="text"
                required 
                placeholder="e.g. name@jewellerstore.com or 9876543210"
                value={ownerEmail} 
                onChange={(e) => setOwnerEmail(e.target.value)} 
              />
              <Input 
                label="Login Password" 
                type="password"
                required 
                placeholder="Min 6 characters"
                value={ownerPassword} 
                onChange={(e) => setOwnerPassword(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 space-x-3">
            <Button variant="outline" type="button" onClick={() => router.push("/admin")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Onboarding Store..." : "Register Outlet"}
            </Button>
          </div>
        </form>
      )}

      {/* Interactive Logo Crop Modal */}
      <LogoCropModal 
        isOpen={cropModalOpen}
        imageSrc={selectedImageSrc}
        shopCode={tempShopCode || "SHOP"}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCroppedLogoUpload}
      />
    </div>
  );
}
