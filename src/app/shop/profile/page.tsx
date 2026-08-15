"use client";

import React, { useState, useEffect } from "react";
import { 
  Building, 
  User, 
  Phone, 
  MapPin, 
  Upload, 
  Lock, 
  Mail, 
  CheckCircle2, 
  AlertTriangle,
  Image as ImageIcon,
  Sparkles,
  Crop,
  Calendar
} from "lucide-react";
import { Button, Input, Select, PageHeader, LoadingSpinner } from "@/components/ui/reusable";
import LogoCropModal from "@/components/ui/LogoCropModal";

export default function ShopProfilePage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [uploadingQrCode, setUploadingQrCode] = useState(false);
  const [cropTarget, setCropTarget] = useState<"logo" | "qrcode">("logo");

  // Form State
  const [shopName, setShopName] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [allowedMetals, setAllowedMetals] = useState<string[]>(["24k", "22k", "18k", "9k", "silver"]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  // Pricing & Discount State
  const [pricingMode, setPricingMode] = useState<"default" | "discount" | "custom_manual">("default");
  const [discountType, setDiscountType] = useState<"percentage" | "flat_amount">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [metalDiscounts, setMetalDiscounts] = useState<{ [key: string]: { type: "percentage" | "flat_amount"; value: number } }>({});
  const [customRates, setCustomRates] = useState<{ rate_22k?: number; rate_24k?: number; rate_18k?: number; rate_9k?: number; rate_silver?: number }>({});
  const [useRegionalRateLabels, setUseRegionalRateLabels] = useState<boolean>(false);
  const [languageName, setLanguageName] = useState<string>("English");
  const [weeklyCategories, setWeeklyCategories] = useState<{ [key: string]: string }>({
    monday: "none",
    tuesday: "none",
    wednesday: "none",
    thursday: "none",
    friday: "none",
    saturday: "none",
    sunday: "none"
  });

  const fetchAssociations = async (stateId: string) => {
    if (!stateId) return;
    try {
      const res = await fetch(`/api/associations?state_id=${stateId}`);
      const data = await res.json();
      if (data && !data.error) {
        setAssociations(data);
      }
    } catch (err) {
      console.error("Failed to load associations:", err);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const shopId = params.get("shop_id");
      const url = shopId ? `/api/shop/details?shop_id=${shopId}` : "/api/shop/details";
      const res = await fetch(url);
      const data = await res.json();
      if (data && !data.error) {
        setShopName(data.shopName || "");
        setShopCode(data.shopCode || "");
        setOwnerName(data.ownerName || "");
        setPhone(data.phone || "");
        setOwnerPhone(data.ownerPhone || "");
        setAddress(data.address || "");
        setLogoUrl(data.logoUrl || "");
        setQrCodeUrl(data.qrCodeUrl || "");
        setEmail(data.email || "");
        setSelectedRates(data.selectedRates || ["rate_22k_1g", "rate_22k_8g", "rate_silver_1g"]);
        setAllowedMetals(data.allowedMetals || ["24k", "22k", "18k", "9k", "silver"]);
        setSelectedAssociationId(data.associationId || "");
        setPricingMode(data.pricingMode || "default");
        setDiscountType(data.discountType || "percentage");
        setDiscountValue(Number(data.discountValue) || 0);
        setMetalDiscounts(data.metalDiscounts || {});
        setCustomRates(data.customRates || {});
        setUseRegionalRateLabels(!!data.useRegionalRateLabels);
        setLanguageName(data.language || "English");
        setWeeklyCategories(data.weekly_categories || {
          monday: "none",
          tuesday: "none",
          wednesday: "none",
          thursday: "none",
          friday: "none",
          saturday: "none",
          sunday: "none"
        });
        if (data.stateId) {
          fetchAssociations(data.stateId);
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    setSelectedRates(prev => prev.filter(rateKey => {
      const metal = rateKey.replace("rate_", "").replace("_1g", "").replace("_8g", "");
      return allowedMetals.includes(metal);
    }));
  }, [allowedMetals]);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setFormError(null);
    const objectUrl = URL.createObjectURL(rawFile);
    setSelectedImageSrc(objectUrl);
    setCropTarget("logo");
    setCropModalOpen(true);
    e.target.value = ""; // reset input
  };

  const handleQrCodeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setFormError(null);
    const objectUrl = URL.createObjectURL(rawFile);
    setSelectedImageSrc(objectUrl);
    setCropTarget("qrcode");
    setCropModalOpen(true);
    e.target.value = ""; // reset input
  };

  const handleCroppedLogoUpload = async (croppedWebpFile: File) => {
    setUploadingLogo(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("file", croppedWebpFile);
      formData.append("shopCode", shopCode || "SHOP");

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
        setSuccessMsg("Cropped logo saved & synced to Cloudflare R2!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setFormError("Failed to upload cropped logo to Cloudflare R2.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCroppedQrCodeUpload = async (croppedWebpFile: File) => {
    setUploadingQrCode(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("file", croppedWebpFile);
      formData.append("shopCode", `${shopCode || "SHOP"}/qrcodes`);

      const res = await fetch("/api/upload/r2", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.error) {
        setFormError(`QR Code Upload Failed: ${data.error}`);
      } else if (data.url) {
        const cacheBustedUrl = data.url.includes("?") ? `${data.url}&v=${Date.now()}` : `${data.url}?v=${Date.now()}`;
        setQrCodeUrl(cacheBustedUrl);
        setSuccessMsg("Cropped QR Code saved & synced to Cloudflare R2!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setFormError("Failed to upload cropped QR Code to Cloudflare R2.");
    } finally {
      setUploadingQrCode(false);
    }
  };

  const handleCropComplete = async (croppedWebpFile: File) => {
    if (cropTarget === "logo") {
      await handleCroppedLogoUpload(croppedWebpFile);
    } else {
      await handleCroppedQrCodeUpload(croppedWebpFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (selectedRates.length < 2 || selectedRates.length > 4) {
      setFormError("You must select between 2 and 4 precious metal rate displays.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/shop/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: shopName,
          owner_name: ownerName,
          phone,
          owner_phone: ownerPhone,
          address,
          logo_url: logoUrl,
          qr_code_url: qrCodeUrl,
          email,
          password: password || undefined,
          selected_rates: selectedRates,
          selected_rates_keys: selectedRates, // keep both for compatibility
          association_id: selectedAssociationId || null,
          pricing_mode: pricingMode,
          discount_type: discountType,
          discount_value: discountValue,
          metal_discounts: metalDiscounts,
          custom_rates: customRates,
          use_regional_rate_labels: useRegionalRateLabels,
          weekly_categories: weeklyCategories
        })
      });
      const data = await res.json();

      if (data.error) {
        setFormError(data.error);
      } else {
        setSuccessMsg("Store profile and branding updated successfully!");
        setPassword("");
      }
    } catch (err) {
      setFormError("Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Store Profile & Branding"
        description="Update your outlet contact info, physical address, and crop & upload store logos to Cloudflare R2."
      />

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl bg-white p-8 rounded-2xl border border-border shadow-sm space-y-6">
        {/* Section 1: Store Details */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Building className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Store Outlet Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Input 
                label="Shop / Outlet Name" 
                required 
                placeholder="e.g. Kalyan Jewellers"
                value={shopName} 
                onChange={(e) => setShopName(e.target.value)} 
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Shop Code</span>
              <span className="text-sm font-extrabold text-accent mt-1">{shopCode || "SHOP-00000"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input 
              label="Contact Owner Name" 
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Input 
                label="Physical Store Address" 
                required 
                placeholder="e.g. 12, T-Nagar, Main Road, Chennai"
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
              />
            </div>
            <Select 
              label="Precious Metal Rate Association" 
              value={selectedAssociationId} 
              onChange={(e) => setSelectedAssociationId(e.target.value)}
              options={[
                { label: "Follow Global Rates", value: "" },
                ...associations.map(a => ({ label: a.name, value: a.id }))
              ]} 
            />
          </div>
        </div>
        {/* Section 1.5: Precious Metal Rate Displays */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
              <h3 className="font-bold text-xs sm:text-sm text-primary uppercase tracking-wider">Video Overlay Rates Configuration</h3>
            </div>
            
            {/* Regional Language Toggle */}
            <div className="flex items-center justify-between sm:justify-start space-x-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-600">Overlay Language:</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setUseRegionalRateLabels(!useRegionalRateLabels)}
                  className={`relative inline-flex h-6 w-14 items-center rounded-full transition-colors focus:outline-none ${
                    useRegionalRateLabels ? "bg-amber-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useRegionalRateLabels ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded uppercase ${useRegionalRateLabels ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>
                  {useRegionalRateLabels ? `${languageName} (${languageName.substring(0, 2).toUpperCase()})` : "English (EN)"}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Select and order exactly 2, 3, or 4 rates you want to display on the video overlay. Clicking an item adds it to the slots in order; clicking a selected item removes it.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "rate_22k_1g", label: "22K Gold (1G)", metal: "22k", regional: { tamil: "1 கிராம் 22 கேரட்", telugu: "1 గ్రామ్ 22K", kannada: "1 ಗ್ರಾಂ 22K", malayalam: "1 ഗ്രാം 22K", hindi: "1 ग्राम 22K" } },
              { id: "rate_22k_8g", label: "22K Gold (8G / 1 Sov)", metal: "22k", regional: { tamil: "8 கிராம் 22 கேரட்", telugu: "8 గ్రాములు 22K", kannada: "8 ಗ್ರಾಂ 22K", malayalam: "8 ഗ്രാം 22K", hindi: "8 ग्राम 22K" } },
              { id: "rate_24k_1g", label: "24K Gold (1G)", metal: "24k", regional: { tamil: "1 கிராம் 24 கேரட்", telugu: "1 గ్రామ్ 24K", kannada: "1 ಗ್ರಾಂ 24K", malayalam: "1 ഗ്രാം 24K", hindi: "1 gram 24K" } },
              { id: "rate_18k_1g", label: "18K Gold (1G)", metal: "18k", regional: { tamil: "1 கிராம் 18 கேரட்", telugu: "1 గ్రామ్ 18K", kannada: "1 ಗ್ರಾಂ 18K", malayalam: "1 ഗ്രಾಂ 18K", hindi: "1 gram 18K" } },
              { id: "rate_18k_8g", label: "18K Gold (8G / 1 Sov)", metal: "18k", regional: { tamil: "8 கிராம் 18 கேரட்", telugu: "8 గ్రాములు 18K", kannada: "8 ಗ್ರಾಂ 18K", malayalam: "8 ഗ്രಾಂ 18K", hindi: "8 gram 18K" } },
              { id: "rate_9k_1g", label: "9K Gold (1G)", metal: "9k", regional: { tamil: "1 கிராம் 9 கேரட்", telugu: "1 గ్రామ్ 9K", kannada: "1 ಗ್ರಾಂ 9K", malayalam: "1 ഗ്രാം 9K", hindi: "1 gram 9K" } },
              { id: "rate_silver_1g", label: "Silver (1G)", metal: "silver", regional: { tamil: "1 கிராம் வெள்ளி", telugu: "1 గ్రామ్ వెండి", kannada: "1 ಗ್ರಾಂ ಬೆಳ್ಳಿ", malayalam: "1 ഗ്രാം വെള്ളി", hindi: "1 gram चांदी" } },
            ]
            .filter(opt => allowedMetals.includes(opt.metal))
            .map((opt) => {
              const selectedIdx = selectedRates.indexOf(opt.id);
              const isSelected = selectedIdx !== -1;
              const langKey = languageName.toLowerCase();
              const displayLabel = useRegionalRateLabels && opt.regional[langKey as keyof typeof opt.regional]
                ? opt.regional[langKey as keyof typeof opt.regional]
                : opt.label;

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
                  <span className="text-[11px] font-bold text-slate-700">{displayLabel}</span>
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
              <span className="text-red-500 font-bold">None selected (Minimum 2 required)</span>
            ) : (
              <span className="text-accent font-extrabold">
                {selectedRates.map((r, i) => `${i + 1}. ${r.replace("rate_", "").replace("_", " ").toUpperCase()}`).join("  ➡  ")}
              </span>
            )}
          </div>
        </div>

        {/* Section 2: Cloudflare R2 Logo Upload with Interactive WebP Cropping */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Cloudflare R2 Logo Storage</h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md flex items-center space-x-1">
              <Crop className="w-3 h-3 text-accent" />
              <span>Interactive Logo Trimmer</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Logo Preview */}
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden relative group">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-2 text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px] font-semibold">No Logo Uploaded</span>
                </div>
              )}
            </div>

            {/* Upload Action */}
            <div className="md:col-span-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Upload New Logo (Interactive Crop & WebP Optimization)</label>
              <div className="flex items-center space-x-3">
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-300 text-xs flex items-center space-x-2 transition-colors">
                  <Upload className="w-4 h-4 text-accent" />
                  <span>{uploadingLogo ? "Uploading Logo..." : "Choose Image (PNG / JPG / WEBP)"}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoFileSelect}
                    disabled={uploadingLogo} 
                  />
                </label>
                {logoUrl && (
                  <span className="text-[11px] text-green-600 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cloudflare R2 Synced</span>
                  </span>
                )}
              </div>
              <Input 
                label="Direct R2 Image URL" 
                placeholder="https://your-r2-domain.com/logos/SHOP_logo_123.webp"
                value={logoUrl} 
                onChange={(e) => setLogoUrl(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Section 2.2: Cloudflare R2 Digi QR Upload */}
        <div className="space-y-4 pt-2 border-t border-slate-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Digi Gold QR Code Storage</h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md flex items-center space-x-1">
              <Crop className="w-3 h-3 text-accent" />
              <span>QR Code Trimmer</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* QR Code Preview */}
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden relative group">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Store QR Code" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-2 text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px] font-semibold">No QR Code Uploaded</span>
                </div>
              )}
            </div>

            {/* Upload Action */}
            <div className="md:col-span-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Upload Digi QR (Interactive Crop & WebP Optimization)</label>
              <div className="flex items-center space-x-3">
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-300 text-xs flex items-center space-x-2 transition-colors">
                  <Upload className="w-4 h-4 text-accent" />
                  <span>{uploadingQrCode ? "Uploading QR Code..." : "Choose QR Image (PNG / JPG / WEBP)"}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleQrCodeFileSelect}
                    disabled={uploadingQrCode} 
                  />
                </label>
                {qrCodeUrl && (
                  <span className="text-[11px] text-green-600 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cloudflare R2 Synced</span>
                  </span>
                )}
              </div>
              <Input 
                label="Direct R2 QR Code URL" 
                placeholder="https://your-r2-domain.com/qrcodes/SHOP_qr_123.webp"
                value={qrCodeUrl} 
                onChange={(e) => setQrCodeUrl(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Section 2.5: Store Rate & Discount Pricing Configuration */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Video Overlay Rate Pricing</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Configure store discounts or custom rates</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border cursor-pointer transition-all ${pricingMode === "default" ? "bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/20" : "bg-slate-50/50 border-slate-200"}`} onClick={() => setPricingMode("default")}>
              <div className="flex items-center space-x-2">
                <input type="radio" checked={pricingMode === "default"} onChange={() => setPricingMode("default")} className="text-amber-600 focus:ring-amber-500" />
                <span className="font-bold text-xs text-slate-800">Standard Association Rates</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 pl-5">Uses the official daily market rates published by your association.</p>
            </div>

            <div className={`p-4 rounded-xl border cursor-pointer transition-all ${pricingMode === "discount" ? "bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/20" : "bg-slate-50/50 border-slate-200"}`} onClick={() => setPricingMode("discount")}>
              <div className="flex items-center space-x-2">
                <input type="radio" checked={pricingMode === "discount"} onChange={() => setPricingMode("discount")} className="text-amber-600 focus:ring-amber-500" />
                <span className="font-bold text-xs text-slate-800">Store Promotional Discount</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 pl-5">Applies a percentage or flat discount on top of daily rates.</p>
            </div>

            <div className={`p-4 rounded-xl border cursor-pointer transition-all ${pricingMode === "custom_manual" ? "bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/20" : "bg-slate-50/50 border-slate-200"}`} onClick={() => setPricingMode("custom_manual")}>
              <div className="flex items-center space-x-2">
                <input type="radio" checked={pricingMode === "custom_manual"} onChange={() => setPricingMode("custom_manual")} className="text-amber-600 focus:ring-amber-500" />
                <span className="font-bold text-xs text-slate-800">Manual Custom Rates</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 pl-5">Manually input custom rates for your shop overlay.</p>
            </div>
          </div>

          {pricingMode === "discount" && (
            <div className="p-4 bg-amber-50/30 rounded-xl border border-amber-200/60 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200/40 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Promotional Discounts for Selected Video Slots</span>
                <span className="text-[11px] text-slate-500 font-medium">Set custom discount per metal display</span>
              </div>

              {selectedRates.length === 0 ? (
                <p className="text-xs text-red-500 font-semibold">Please select rate displays in Video Overlay Rates Configuration above first.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from(new Set(selectedRates.map(r => r.includes("22k") ? "22k" : r.includes("24k") ? "24k" : r.includes("18k") ? "18k" : r.includes("9k") ? "9k" : r.includes("silver") ? "silver" : ""))).filter(Boolean).map((metalKey) => {
                    const metalLabel = metalKey === "22k" ? "22K Gold" : metalKey === "24k" ? "24K Gold" : metalKey === "18k" ? "18K Gold" : metalKey === "9k" ? "9K Gold" : "Silver";
                    const currentMeta = metalDiscounts[metalKey] || { type: "flat_amount", value: 0 };

                    return (
                      <div key={metalKey} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-primary">{metalLabel} Discount</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            label="Type"
                            value={currentMeta.type || "flat_amount"}
                            onChange={(e) => {
                              const newType = e.target.value as "percentage" | "flat_amount";
                              setMetalDiscounts({
                                ...metalDiscounts,
                                [metalKey]: { type: newType, value: currentMeta.value || 0 }
                              });
                            }}
                            options={[
                              { label: "Flat (₹/g)", value: "flat_amount" },
                              { label: "Percent (%)", value: "percentage" }
                            ]}
                          />
                          <Input
                            label={currentMeta.type === "percentage" ? "Off (%)" : "Off (₹/g)"}
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0"
                            value={currentMeta.value ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setMetalDiscounts({
                                ...metalDiscounts,
                                [metalKey]: { type: currentMeta.type || "flat_amount", value: val }
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

           {pricingMode === "custom_manual" && (
            <div className="p-4 bg-amber-50/30 rounded-xl border border-amber-200/60 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Enter Daily Rates for your Store (₹):</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {allowedMetals.includes("22k") && (
                  <Input
                    label="22K Gold (₹/g)"
                    type="number"
                    placeholder="e.g. 6850"
                    value={customRates.rate_22k || ""}
                    onChange={(e) => setCustomRates({ ...customRates, rate_22k: parseFloat(e.target.value) || 0 })}
                  />
                )}
                {allowedMetals.includes("24k") && (
                  <Input
                    label="24K Gold (₹/g)"
                    type="number"
                    placeholder="e.g. 7450"
                    value={customRates.rate_24k || ""}
                    onChange={(e) => setCustomRates({ ...customRates, rate_24k: parseFloat(e.target.value) || 0 })}
                  />
                )}
                {allowedMetals.includes("18k") && (
                  <Input
                    label="18K Gold (₹/g)"
                    type="number"
                    placeholder="e.g. 5600"
                    value={customRates.rate_18k || ""}
                    onChange={(e) => setCustomRates({ ...customRates, rate_18k: parseFloat(e.target.value) || 0 })}
                  />
                )}
                {allowedMetals.includes("9k") && (
                  <Input
                    label="9K Gold (₹/g)"
                    type="number"
                    placeholder="e.g. 2800"
                    value={customRates.rate_9k || ""}
                    onChange={(e) => setCustomRates({ ...customRates, rate_9k: parseFloat(e.target.value) || 0 })}
                  />
                )}
                {allowedMetals.includes("silver") && (
                  <Input
                    label="Silver (₹/g)"
                    type="number"
                    placeholder="e.g. 92"
                    value={customRates.rate_silver || ""}
                    onChange={(e) => setCustomRates({ ...customRates, rate_silver: parseFloat(e.target.value) || 0 })}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section: Weekly Category Schedule */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Weekly Category Schedule</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Customize jewelry video category by day of the week</span>
          </div>

          <p className="text-xs text-slate-500">
            By default, all stores receive our standard daily rotation of categories. To override the rotation for specific days (e.g. Necklace on Monday, Rings on Tuesday), select them below:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
              <div key={day} className="flex flex-col space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <label className="text-xs font-bold text-slate-700 capitalize">{day}</label>
                <select
                  value={weeklyCategories[day] || "none"}
                  onChange={(e) => setWeeklyCategories({ ...weeklyCategories, [day]: e.target.value })}
                  className="w-full text-xs bg-white rounded-lg border border-slate-200 p-2 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Section 3: Credentials (Optional) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Account Credentials</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">(Optional - Leave password blank to keep current password)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Login Email or Mobile Number" 
              type="text"
              placeholder="e.g. name@store.com or 9876543210"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
            <Input 
              label="New Password (Optional)" 
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving Changes..." : "Save Profile Changes"}
          </Button>
        </div>
      </form>

      {/* Interactive Logo/QR Crop Modal */}
      <LogoCropModal 
        isOpen={cropModalOpen}
        imageSrc={selectedImageSrc || ""}
        shopCode={shopCode || "SHOP"}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
