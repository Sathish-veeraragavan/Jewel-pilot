"use client";

import React, { useState, useEffect } from "react";
import { 
  Coins, 
  Store, 
  CreditCard, 
  ShieldAlert, 
  Film, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Play
} from "lucide-react";
import { Button, Input, LoadingSpinner } from "@/components/ui/reusable";

export default function SuperAdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Rate Publish Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [gold24k, setGold24k] = useState("");
  const [gold22k, setGold22k] = useState("");
  const [silver, setSilver] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [triggeringQueue, setTriggeringQueue] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const handleTriggerRenderingQueue = async () => {
    setTriggeringQueue(true);
    try {
      const res = await fetch("/api/scheduler-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger_render",
          startDate: todayStr
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to start render queue: ${data.error}`);
      } else {
        alert(`Successfully started today's queue! ${data.count} videos pushed to Hostinger VPS.`);
      }
    } catch (err) {
      alert("Failed to connect to scheduler backend.");
    } finally {
      setTriggeringQueue(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/stats");
      const data = await res.json();
      if (!data.error) {
        setStats(data);
        if (data.todayRates) {
          setGold24k(data.todayRates.rate_24k?.toString() || "");
          setGold22k(data.todayRates.rate_22k?.toString() || "");
          setSilver(data.todayRates.rate_silver?.toString() || "");
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handlePublishRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError(null);
    setPublishFeedback(null);
    setPublishing(true);

    try {
      const res = await fetch("/api/commodity-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate_date: todayStr,
          gold_24k: parseFloat(gold24k),
          gold_22k: parseFloat(gold22k),
          silver: parseFloat(silver),
        }),
      });
      const data = await res.json();

      if (data.error) {
        setPublishError(data.error);
      } else {
        setPublishFeedback(`Rates published! Auto-triggered ${data.triggeredRenders || 0} scheduled video renders for today.`);
        fetchStats();
        setTimeout(() => setIsRateModalOpen(false), 1500);
      }
    } catch (err) {
      setPublishError("Failed to publish gold rates.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const statCards = [
    { name: "Total Shops", value: stats?.totalShops || 0, icon: Store, color: "text-blue-600 bg-blue-50" },
    { name: "Active Subscriptions", value: stats?.activeSubs || 0, icon: CreditCard, color: "text-green-600 bg-green-50" },
    { name: "Pending Approvals", value: stats?.pendingShops || 0, icon: ShieldAlert, color: "text-yellow-600 bg-yellow-50" },
    { name: "Video Library Assets", value: stats?.totalVideos || 0, icon: Film, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">Super Admin Control Panel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time platform performance metrics, shop roster health, and daily commodity rate publishing.
          </p>
        </div>
        <Button 
          onClick={() => setIsRateModalOpen(true)}
          className="bg-accent hover:bg-yellow-400 text-primary font-bold text-xs flex items-center space-x-2 shadow"
        >
          <Coins className="w-4 h-4" />
          <span>Publish Today's Gold & Silver Rates</span>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.name}</p>
              <p className="mt-2 text-2xl font-bold text-primary">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-xl ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Commodity Rates Live Display Card */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Today's Commodity Market Rates ({todayStr})</h3>
          </div>
          <button 
            onClick={() => setIsRateModalOpen(true)}
            className="text-xs font-semibold text-accent hover:underline flex items-center space-x-1"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Update Prices</span>
          </button>
        </div>

        {stats?.todayRates ? (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center flex-grow w-full">
              <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">24K Gold Rate</span>
                <span className="text-2xl font-extrabold text-primary mt-1 block">₹{stats.todayRates.rate_24k} / g</span>
              </div>
              <div className="bg-yellow-50/60 border border-yellow-200 p-4 rounded-xl">
                <span className="text-xs font-bold text-yellow-700 uppercase tracking-wider block">22K Gold Rate</span>
                <span className="text-2xl font-extrabold text-primary mt-1 block">₹{stats.todayRates.rate_22k} / g</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-xs font-bold text-slate-600 tracking-wider block">Silver Rate</span>
                <span className="text-2xl font-extrabold text-primary mt-1 block">₹{stats.todayRates.rate_silver} / g</span>
              </div>
            </div>
            <div className="w-full lg:w-auto flex-shrink-0">
              <Button 
                onClick={handleTriggerRenderingQueue} 
                disabled={triggeringQueue}
                className="w-full bg-accent hover:bg-yellow-400 text-primary font-bold text-xs py-3 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-md"
              >
                <Play className="w-4 h-4 text-primary" />
                <span>{triggeringQueue ? "Queuing..." : "Start Today's Render Queue"}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-center space-y-2">
            <p className="text-xs font-semibold text-slate-500">No commodity prices published yet for today ({todayStr}).</p>
            <Button onClick={() => setIsRateModalOpen(true)} variant="outline" className="text-xs font-bold">
              + Publish Prices Now
            </Button>
          </div>
        )}
      </div>

      {/* Gold & Silver Rate Update Modal */}
      {isRateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePublishRates} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-base text-primary">Publish Today's Commodity Rates</h3>
              </div>
              <button type="button" onClick={() => setIsRateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-muted-foreground">
              Publishing new prices automatically triggers schedule renders for all active shop video queues today ({todayStr}).
            </p>

            {publishFeedback && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
                <span>{publishFeedback}</span>
              </div>
            )}

            {publishError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{publishError}</span>
              </div>
            )}

            <div className="space-y-3">
              <Input 
                label="24K Gold Rate (₹ per gram)"
                type="number"
                required
                placeholder="e.g. 7850"
                value={gold24k}
                onChange={(e) => setGold24k(e.target.value)}
              />
              <Input 
                label="22K Gold Rate (₹ per gram)"
                type="number"
                required
                placeholder="e.g. 7200"
                value={gold22k}
                onChange={(e) => setGold22k(e.target.value)}
              />
              <Input 
                label="Silver Rate (₹ per gram)"
                type="number"
                required
                placeholder="e.g. 95"
                value={silver}
                onChange={(e) => setSilver(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsRateModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={publishing}>
                {publishing ? "Publishing Rates..." : "Publish Prices"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
