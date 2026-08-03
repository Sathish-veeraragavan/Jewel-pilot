"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Input, 
  Select, 
  LoadingSpinner 
} from "@/components/ui/reusable";
import { Cpu, Play, AlertTriangle, Terminal, Calendar, Zap, CheckCircle2 } from "lucide-react";

export default function SchedulerSimulationPage() {
  const [loading, setLoading] = useState(true);
  const [runningSim, setRunningSim] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);

  // Dropdown options loaded once
  const [shops, setShops] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [occasions, setOccasions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [currentGoldRate, setCurrentGoldRate] = useState<any>(null);
  const [dbQueryTimeMs, setDbQueryTimeMs] = useState(0);

  // Auto-Scheduler Generator Controls
  const [horizon, setHorizon] = useState<"1_week" | "1_month">("1_week");
  const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [batchResult, setBatchResult] = useState<any>(null);

  // Form selections for Single Shop Simulation
  const [selectedShopId, setSelectedShopId] = useState("");
  const [simDate, setSimDate] = useState(new Date().toISOString().split("T")[0]);
  const [templateOverrideId, setTemplateOverrideId] = useState("");
  const [occasionOverrideId, setOccasionOverrideId] = useState("");
  const [videoOverrideId, setVideoOverrideId] = useState("");
  const [goldRateOverride, setGoldRateOverride] = useState("");

  // Sim results states
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduler-sim");
      const data = await res.json();
      setShops(data.shops || []);
      setVideos(data.videos || []);
      setTemplates(data.templates || []);
      setOccasions(data.occasions || []);
      setSettings(data.settings || []);
      setCurrentGoldRate(data.goldRate || null);
      setDbQueryTimeMs(data.dbQueryTimeMs || 0);

      if (data.shops?.length > 0) {
        setSelectedShopId(data.shops[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleRunSimulation = async () => {
    setRunningSim(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch("/api/scheduler-sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: selectedShopId,
          simDate,
          templateOverrideId: templateOverrideId || undefined,
          occasionOverrideId: occasionOverrideId || undefined,
          goldRateOverride: goldRateOverride || undefined,
          videoOverrideId: videoOverrideId || undefined
        })
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setErrorMsg("Failed to run rule engine simulation.");
    } finally {
      setRunningSim(false);
    }
  };

  const handleGenerateBatch = async () => {
    setGeneratingBatch(true);
    setErrorMsg(null);
    setBatchResult(null);

    try {
      const res = await fetch("/api/scheduler-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_schedule",
          horizon,
          startDate: batchStartDate,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setBatchResult(data);
      }
    } catch (err) {
      setErrorMsg("Failed to generate schedule batch.");
    } finally {
      setGeneratingBatch(false);
    }
  };

  const schedulerWindow = settings.find(s => s.setting_key === "scheduler_window_days")?.value || "30";

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Smart Scheduler & Rules Validator"
        description="Run automated weekly/monthly video schedules with district isolation and user history deduplication."
      />

      {/* KPI Info cards */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Outlets</p>
            <p className="text-xl font-bold mt-1 text-primary">{shops.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eligible Video Assets</p>
            <p className="text-xl font-bold mt-1 text-primary">{videos.filter(v => v.status === "active").length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rendering Designs</p>
            <p className="text-xl font-bold mt-1 text-primary">{templates.filter(t => t.status === "active").length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Occasions</p>
            <p className="text-xl font-bold mt-1 text-primary">{occasions.filter(o => o.status === "active").length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today's rate (22K)</p>
            <p className="text-xl font-bold mt-1 text-amber-600">₹{currentGoldRate?.rate_22k || "N/A"}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scheduler Horizon</p>
            <p className="text-xl font-bold mt-1 text-accent">{horizon === "1_week" ? "7 Days" : "30 Days"}</p>
          </div>
        </div>
      )}

      {/* Auto-Scheduler Batch Generator Card */}
      <div className="bg-gradient-to-r from-primary to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-accent" />
            <div>
              <h3 className="font-bold text-base text-white">Auto-Scheduler Generator</h3>
              <p className="text-xs text-slate-300">Run deduplicated video slot allocation across all active shops adhering to District Isolation.</p>
            </div>
          </div>
          <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setHorizon("1_week")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                horizon === "1_week" ? "bg-accent text-primary font-bold shadow" : "text-slate-300 hover:text-white"
              }`}
            >
              1 Week (7 Days)
            </button>
            <button
              onClick={() => setHorizon("1_month")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                horizon === "1_month" ? "bg-accent text-primary font-bold shadow" : "text-slate-300 hover:text-white"
              }`}
            >
              1 Month (30 Days)
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4 pt-2">
          <div className="w-64">
            <Input 
              label="Schedule Start Date" 
              type="date"
              value={batchStartDate} 
              onChange={(e) => setBatchStartDate(e.target.value)} 
            />
          </div>
          <div className="flex-1 pt-6">
            <Button
              onClick={handleGenerateBatch}
              disabled={generatingBatch || loading}
              className="bg-accent text-primary hover:bg-yellow-400 font-bold text-sm px-6 py-2.5 rounded-xl shadow flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>{generatingBatch ? "Scheduling Videos..." : `Run Auto-Scheduler (${horizon === "1_week" ? "7 Days" : "30 Days"})`}</span>
            </Button>
          </div>
        </div>

        {batchResult && (
          <div className="bg-white/10 border border-white/20 p-4 rounded-xl text-xs space-y-2">
            <div className="flex items-center space-x-2 font-bold text-accent">
              <CheckCircle2 className="w-4 h-4" />
              <span>Batch Created: {batchResult.batchId}</span>
            </div>
            <p className="text-slate-200">Scheduled <strong>{batchResult.totalScheduled}</strong> video slots across <strong>{batchResult.shopsProcessed}</strong> active shops over <strong>{batchResult.daysCount}</strong> days.</p>
            {batchResult.warnings?.length > 0 && (
              <div className="text-amber-300 font-medium">
                Warnings: {batchResult.warnings.join(", ")}
              </div>
            )}
            <div className="pt-2">
              <a 
                href="/super-admin/scheduler-config"
                className="inline-flex items-center space-x-1.5 bg-accent hover:bg-yellow-400 text-primary font-bold px-3.5 py-2 rounded-xl transition-colors text-[11px]"
              >
                <span>View Scheduled Matrix Grid 🗓️</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Single Shop Simulation Parameters & Trace Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Simulation Form */}
        <div className="bg-white p-6 rounded-2xl border border-border h-fit space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Single Shop Decision Sim</h3>
          
          <Select 
            label="Target Shop" 
            required 
            value={selectedShopId} 
            onChange={(e) => setSelectedShopId(e.target.value)}
            options={shops.map(s => ({ label: `${s.shop_name || s.name} (${s.status})`, value: s.id }))} 
          />

          <Input 
            label="Simulation Target Date" 
            type="date" 
            required 
            value={simDate} 
            onChange={(e) => setSimDate(e.target.value)} 
          />

          <hr className="border-slate-100 my-4" />

          {/* Optional overrides */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Manual Overrides (Optional)</p>
            
            <Select 
              label="Force Specific Template" 
              value={templateOverrideId} 
              onChange={(e) => setTemplateOverrideId(e.target.value)}
              options={[{ label: "No Override", value: "" }, ...templates.map(t => ({ label: t.name, value: t.id }))]} 
            />

            <Select 
              label="Force Specific Occasion" 
              value={occasionOverrideId} 
              onChange={(e) => setOccasionOverrideId(e.target.value)}
              options={[{ label: "No Override", value: "" }, ...occasions.map(o => ({ label: o.name, value: o.id }))]} 
            />

            <Select 
              label="Force Specific Video Asset" 
              value={videoOverrideId} 
              onChange={(e) => setVideoOverrideId(e.target.value)}
              options={[{ label: "No Override", value: "" }, ...videos.map(v => ({ label: v.title, value: v.id }))]} 
            />

            <Input 
              label="Force 22K Gold Rate (₹/g)" 
              type="number"
              placeholder="e.g. 7150"
              value={goldRateOverride} 
              onChange={(e) => setGoldRateOverride(e.target.value)} 
            />
          </div>

          <Button 
            onClick={handleRunSimulation} 
            disabled={runningSim || loading} 
            className="w-full flex items-center justify-center space-x-2 pt-3"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{runningSim ? "Evaluating Rules..." : "Execute Simulation"}</span>
          </Button>
        </div>

        {/* Right Side: Simulation Trace logs Output */}
        <div className="lg:col-span-2 space-y-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {!result && !runningSim && (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-border border-dashed rounded-2xl min-h-96">
              <Cpu className="w-8 h-8 text-slate-350 mb-3" />
              <h3 className="font-semibold text-primary text-base">Awaiting Simulation Target</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">Run single shop simulation to inspect step-by-step deduplication logs.</p>
            </div>
          )}

          {runningSim && (
            <div className="bg-white border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-96">
              <LoadingSpinner />
              <p className="text-xs text-slate-500 font-medium mt-3">Evaluating regional exclusions, district isolation, and history rules...</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {result.warnings?.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 text-orange-850 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-xs text-orange-950">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Dry-run Exclusions & Warnings</span>
                  </div>
                  <ul className="text-xs list-disc pl-5 space-y-0.5">
                    {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Winner Summary */}
              <div className="bg-white p-6 rounded-2xl border border-border space-y-4 shadow-sm">
                <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Simulation Output</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Occasion Match</p>
                    <p className="text-xs font-bold text-primary mt-1">{result.winningSelections.occasion?.name || "Fallback Standard"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Daily Gold Rate</p>
                    <p className="text-xs font-bold text-amber-600 mt-1">₹{result.winningSelections.goldRate || "N/A"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Template Winner</p>
                    <p className="text-xs font-bold text-primary mt-1">{result.winningSelections.template?.name || "None"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Video Winner</p>
                    <p className="text-xs font-bold text-accent mt-1">{result.winningSelections.video?.title || "None"}</p>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                  <p className="text-[10px] text-accent font-bold uppercase">Selected Greeting Text</p>
                  <p className="text-xs font-bold text-primary mt-1">"{result.winningSelections.greeting}"</p>
                </div>
              </div>

              {/* Decision Step Timeline */}
              <div className="bg-white p-6 rounded-2xl border border-border space-y-4 shadow-sm">
                <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Decision Step Timeline</h3>
                
                <div className="space-y-4 pl-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
                  {result.traceLogs.map((log: string, idx: number) => (
                    <div key={idx} className="flex items-start space-x-3 relative">
                      <div className="w-2 h-2 rounded-full bg-accent mt-1.5 border-4 border-white shadow-sm flex-shrink-0 z-10"></div>
                      <div className="text-xs font-medium text-slate-700 leading-relaxed">{log}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
