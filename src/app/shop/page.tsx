"use client";

import React, { useEffect, useState } from "react";
import { Download, AlertTriangle, CheckCircle2, Store, Clock, Share2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/reusable";

export default function ShopPage() {
  const [loading, setLoading] = useState(true);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual pricing state
  const [manualRates, setManualRates] = useState<{ [key: string]: number }>({});
  const [savingManual, setSavingManual] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      setCanShare(true);
    }
  }, []);

  const handleShareVideo = async () => {
    const videoUrl = shopDetails?.todayVideo?.videoUrl;
    if (!videoUrl) return;

    // Log share/download log to DB
    if (shopDetails.todayVideo.scheduleId) {
      fetch("/api/shop/download-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: shopDetails.todayVideo.scheduleId })
      }).catch(() => {});
    }

    try {
      const absoluteUrl = window.location.origin + videoUrl + "?download=true";
      const nav = navigator as any;
      if (nav.share) {
        await nav.share({
          url: absoluteUrl,
          title: "Daily Gold Rate Video",
          text: `Download today's Daily Gold Rate video for ${shopDetails.shopName}!`
        });
      }
    } catch (shareErr) {
      console.error("Sharing failed:", shareErr);
    }
  };

  const fetchShopDetails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const shopId = params.get("shop_id");
      const url = shopId ? `/api/shop/details?shop_id=${shopId}` : "/api/shop/details";
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setShopDetails(data);
        if (data.customRates) {
          setManualRates(data.customRates);
        }
      }
    } catch (err) {
      setError("Failed to load shop account details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopDetails();
  }, []);

  const handleSaveAndRender = async () => {
    setSavingManual(true);
    setSaveMessage(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const shopId = params.get("shop_id");
      const url = shopId ? `/api/shop/profile?shop_id=${shopId}` : "/api/shop/profile";

      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_rates: manualRates,
          trigger_render: true
        })
      });

      const data = await res.json();
      if (data.error) {
        setSaveMessage(`Error: ${data.error}`);
      } else {
        setSaveMessage("Rates updated & video render job submitted! Rendering in progress...");
        fetchShopDetails();
      }
    } catch (err) {
      setSaveMessage("Failed to submit manual rates render job.");
    } finally {
      setSavingManual(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !shopDetails) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 md:p-6 rounded-2xl max-w-xl mx-auto text-center space-y-3 my-4">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
        <h3 className="font-bold text-base">Account Configuration Required</h3>
        <p className="text-xs">{error || "No retail store profile linked to this account."}</p>
      </div>
    );
  }

  const { subscription, selectedRates, pricingMode } = shopDetails;
  const isExpired = subscription?.isExpired || subscription?.status === "expired";
  const isCustomManual = pricingMode === "custom_manual";

  const rateLabels: Record<string, { label: string; key: string }> = {
    rate_22k_1g: { label: "22K Gold (1G)", key: "rate_22k" },
    rate_22k_8g: { label: "22K Gold (8G)", key: "rate_22k" },
    rate_24k_1g: { label: "24K Gold (1G)", key: "rate_24k" },
    rate_18k_1g: { label: "18K Gold (1G)", key: "rate_18k" },
    rate_18k_8g: { label: "18K Gold (8G)", key: "rate_18k" },
    rate_9k_1g: { label: "9K Gold (1G)", key: "rate_9k" },
    rate_silver_1g: { label: "Silver (1G)", key: "rate_silver" },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2">
      {/* Expiry Alert Banner */}
      {isExpired && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-xl text-red-600 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Subscription Expired</h4>
              <p className="text-xs text-red-700 mt-0.5">
                Your store subscription expired on <strong>{subscription.endDate}</strong>. Please contact your account representative to reactivate daily video rendering.
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg flex-shrink-0 self-end sm:self-center">
            LOCKED
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Today's Video & Manual Rates Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Manual Pricing Rate Entry Form (Only for Custom Manual Pricing Mode) */}
          {isCustomManual && !isExpired && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4 bg-gradient-to-r from-amber-50/30 to-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
                <div>
                  <h3 className="font-bold text-base text-primary flex items-center gap-2">
                    <span>Manual Daily Rates</span>
                    <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">Manual Mode Active</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter today's manual prices for your selected overlay slots. Click Save & Render to stamp and generate today's video.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(selectedRates || ["rate_22k_1g", "rate_22k_8g", "rate_silver_1g"]).map((slotKey: string) => {
                  const meta = rateLabels[slotKey];
                  if (!meta) return null;
                  const rateKey = meta.key;

                  return (
                    <div key={slotKey} className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <label className="text-xs font-semibold text-slate-700 block">{meta.label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          placeholder="Enter price"
                          value={manualRates[rateKey as keyof typeof manualRates] || ""}
                          onChange={(e) => setManualRates({ ...manualRates, [rateKey]: Number(e.target.value) })}
                          className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent font-semibold"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {saveMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${saveMessage.startsWith("Error") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                  {saveMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveAndRender}
                disabled={savingManual}
                className="w-full sm:w-auto bg-accent hover:bg-yellow-400 text-primary font-bold py-2.5 px-6 rounded-xl shadow-md transition-all text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {savingManual ? (
                  <span>Submitting Render Job...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save & Render Video</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Today's Video Display */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-primary">Today's Video</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Generated for <strong>{shopDetails.shopName}</strong> ({shopDetails.shopCode}). Cleaned from server logs after download.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-50 text-accent border border-amber-200 px-2.5 py-1 rounded-md self-start sm:self-auto">
                {shopDetails.shopCode}
              </span>
            </div>

            {/* Video Box */}
            <div className="mt-6 aspect-[9/16] w-full max-w-[340px] sm:max-w-sm mx-auto bg-slate-50 rounded-2xl overflow-hidden shadow-inner border border-slate-200 flex flex-col items-center justify-center text-center">
              {isExpired ? (
                <div className="p-6 space-y-4 bg-slate-50 h-full w-full flex flex-col justify-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-primary text-base">Rendering Suspended</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Subscription validity ended on {subscription.endDate}. Daily automated layering is paused.
                  </p>
                </div>
              ) : !shopDetails.todayVideo ? (
                <div className="p-6 space-y-4 bg-slate-50 h-full w-full flex flex-col justify-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-primary text-base">
                    {isCustomManual ? "Awaiting Manual Rates" : "No Video Scheduled Today"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {isCustomManual 
                      ? "Enter your rates above and click Save & Render Video to generate today's promotional video." 
                      : "Please contact super-admin to run the schedule grid."}
                  </p>
                </div>
              ) : shopDetails.todayVideo.renderStatus !== "completed" && !shopDetails.todayVideo.videoUrl ? (
                <div className="p-6 space-y-4 bg-slate-50 h-full w-full flex flex-col justify-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-2 animate-bounce">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-primary text-base">Rendering in Progress...</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Our Hostinger VPS is currently stamping today's rate overlays onto your video. Ready shortly!
                  </p>
                </div>
              ) : (
                <video 
                  src={shopDetails.todayVideo.videoUrl} 
                  className="w-full h-full object-cover bg-black"
                  controls 
                  playsInline
                />
              )}
            </div>

            {/* Buttons Area (Moved outside of the fixed aspect ratio container to prevent cut off) */}
            {!isExpired && shopDetails.todayVideo && shopDetails.todayVideo.videoUrl && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center w-full max-w-[340px] sm:max-w-sm mx-auto">
                <a 
                  href={`${shopDetails.todayVideo.videoUrl}?download=true`}
                  download={`${shopDetails.shopCode}_Daily_Rates_Reel.mp4`}
                  onClick={() => {
                    // Log download to database
                    if (shopDetails.todayVideo.scheduleId) {
                      fetch("/api/shop/download-log", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ scheduleId: shopDetails.todayVideo.scheduleId })
                      }).catch(() => {});
                    }
                  }}
                  className="bg-accent hover:bg-yellow-400 text-primary font-extrabold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all text-xs w-full sm:w-auto cursor-pointer border border-yellow-300/40"
                >
                  <Download className="w-4 h-4 animate-pulse" />
                  <span>Save Today's Reel</span>
                </a>

                {canShare && (
                  <button 
                    type="button"
                    onClick={handleShareVideo}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all text-xs w-full sm:w-auto cursor-pointer border border-slate-700"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share Video Link</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar panel */}
        <div className="space-y-6">
          {/* Status card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <h3 className="font-semibold text-primary text-base">Subscription Status</h3>
            
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
              isExpired 
                ? "bg-red-50 text-red-700 border-red-200" 
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isExpired ? "bg-red-500" : "bg-green-500"}`}></span>
              <span className="capitalize">{isExpired ? "Subscription Expired" : `${subscription.status} Subscription`}</span>
            </div>

            <div className="text-xs text-muted-foreground space-y-2 pt-1">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Plan Tier:</span>
                <span className="font-bold text-primary">{subscription.plan}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Pricing Mode:</span>
                <span className="font-bold text-amber-700 capitalize">{pricingMode.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Start Date:</span>
                <span className="font-medium text-slate-700">{subscription.startDate}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Expires On:</span>
                <span className={`font-bold ${isExpired ? "text-red-600" : "text-primary"}`}>
                  {subscription.endDate}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Assigned Agent:</span>
                <span className="font-medium text-slate-700">{subscription.agentName}</span>
              </div>
            </div>
          </div>

          {/* Configured Details card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <h3 className="font-semibold text-primary text-base">Configured Details</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <p className="text-xs text-muted-foreground">Preferred Language</p>
                <p className="font-medium text-primary mt-0.5">{shopDetails.language} (Regional Overlay)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location Tag</p>
                <p className="font-medium text-primary mt-0.5">{shopDetails.city}, {shopDetails.district}, {shopDetails.state}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
