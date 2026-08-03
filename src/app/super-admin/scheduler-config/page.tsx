"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  Select, 
  LoadingSpinner,
  ConfirmationDialog
} from "@/components/ui/reusable";
import { Settings, Save, Calendar, Play, Trash2, ArrowRight, RotateCcw, AlertTriangle, Eye, CheckCircle2, Store, Film, LayoutTemplate, Edit, Music } from "lucide-react";

// Helper to get local date string YYYY-MM-DD
const getTodayLocalStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function SchedulerConfigPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Loaded Matrix & History
  const [matrixData, setMatrixData] = useState<any>({ 
    shops: [], 
    schedules: [], 
    startDate: "", 
    endDate: "",
    availableVideos: [],
    availableTemplates: [],
    availableMusicTracks: []
  });
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [batchResult, setBatchResult] = useState<any>(null);
  
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [triggeringRender, setTriggeringRender] = useState(false);

  // Filter & Start Date state using local timezone date string
  const [startDate, setStartDate] = useState(getTodayLocalStr());
  const [horizon, setHorizon] = useState<"1_week" | "1_month">("1_week");

  // Manual Editing Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Rollback target confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rollbackBatchId, setRollbackBatchId] = useState<string | null>(null);

  // Failsafe rendering modal
  const [failsafeModalOpen, setFailsafeModalOpen] = useState(false);
  const [selectedFailsafeShops, setSelectedFailsafeShops] = useState<string[]>([]);

  const handleOpenFailsafeModal = () => {
    setSelectedFailsafeShops(matrixData.shops.map((s: any) => s.id));
    setFailsafeModalOpen(true);
  };

  const handleManualTriggerRender = async () => {
    if (selectedFailsafeShops.length === 0) {
      alert("Please select at least one shop to trigger.");
      return;
    }
    if (!confirm(`Are you sure you want to trigger rendering for the ${selectedFailsafeShops.length} selected shops?`)) return;
    setTriggeringRender(true);
    try {
      const res = await fetch("/api/scheduler-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger_render",
          startDate,
          shopIds: selectedFailsafeShops
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(`Trigger error: ${data.error}`);
      } else {
        alert(`Successfully queued ${data.count} render jobs for processing!`);
        setFailsafeModalOpen(false);
        fetchMatrixData();
      }
    } catch (err) {
      alert("Failed to trigger batch render.");
    } finally {
      setTriggeringRender(false);
    }
  };

  const fetchMatrixData = async () => {
    setLoading(true);
    try {
      const [resMatrix, resHistory] = await Promise.all([
        fetch(`/api/scheduler-config?action=get_matrix&startDate=${startDate}&horizon=${horizon}`),
        fetch(`/api/scheduler-config`)
      ]);
      const dataMatrix = await resMatrix.json();
      const dataHistory = await resHistory.json();

      console.log("[fetchMatrixData] dataMatrix:", dataMatrix);
      setMatrixData({
        shops: dataMatrix.shops || [],
        schedules: dataMatrix.schedules || [],
        startDate: dataMatrix.startDate || startDate,
        endDate: dataMatrix.endDate || "",
        availableVideos: dataMatrix.availableVideos || [],
        availableTemplates: dataMatrix.availableTemplates || [],
        availableMusicTracks: dataMatrix.availableMusicTracks || []
      });
      setHistoryLogs(Array.isArray(dataHistory) ? dataHistory : (dataHistory.history || []));
    } catch (err) {
      console.error("Failed to load scheduler matrix:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrixData();
  }, [startDate, horizon]);

  const handleRunAutoScheduler = async () => {
    setGenerating(true);
    setBatchResult(null);

    try {
      const res = await fetch("/api/scheduler-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_schedule",
          horizon,
          startDate
        })
      });
      const data = await res.json();

      if (data.error) {
        alert(`Auto-Scheduler Error: ${data.error}`);
      } else {
        setBatchResult(data);
        fetchMatrixData();
      }
    } catch (err) {
      alert("Failed to generate auto-scheduler batch.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenEditModal = (sched: any, shop: any, dateStr: string) => {
    setSelectedSchedule({ 
      ...sched, 
      shopName: shop.name, 
      shopCode: shop.shop_code, 
      shopId: shop.id, 
      outroVideoUrl: shop.outro_video_url, 
      dateStr 
    });
    setSelectedVideoId(sched.video_id);
    setSelectedTemplateId(sched.template_id);
    setSelectedAudioId(sched.audio_track_id || "");
    setEditModalOpen(true);
  };

  const handleSaveManualEdit = async () => {
    if (!selectedSchedule) return;
    setUpdating(true);

    try {
      const res = await fetch("/api/scheduler-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSchedule.id,
          video_id: selectedVideoId,
          template_id: selectedTemplateId,
          audio_track_id: selectedAudioId || null
        })
      });
      const data = await res.json();

      if (data.error) {
        alert(`Error updating schedule: ${data.error}`);
      } else {
        setEditModalOpen(false);
        fetchMatrixData();
      }
    } catch (err) {
      alert("Failed to update schedule.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRollbackTrigger = (batchId: string) => {
    setRollbackBatchId(batchId);
    setConfirmOpen(true);
  };

  const handleExecuteRollback = async () => {
    if (!rollbackBatchId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/scheduler-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback", batchId: rollbackBatchId })
      });
      const data = await res.json();
      if (data.success) {
        alert("Batch schedules successfully rolled back.");
        fetchMatrixData();
      }
    } catch (err) {
      alert("Rollback failed.");
    } finally {
      setConfirmOpen(false);
      setRollbackBatchId(null);
    }
  };

  const getHorizonDays = () => {
    const days = [];
    const parts = startDate.split("-").map(Number);
    const daysCount = horizon === "1_month" ? 30 : 7;
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${day}`;

      days.push({
        dateStr,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      });
    }
    return days;
  };

  const daysList = getHorizonDays();

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader 
        title="Multi-Shop Auto-Scheduler Control"
        description="Auto-generate weekly/monthly schedules, or click any cell to manually edit dynamic video & template assignments."
        action={
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setHorizon("1_week")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  horizon === "1_week" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setHorizon("1_month")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  horizon === "1_month" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                }`}
              >
                30 Days
              </button>
            </div>
            <Input 
              type="date"
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="!py-1.5 text-xs w-40"
            />
            <Button 
              onClick={handleRunAutoScheduler} 
              disabled={generating}
              className="bg-accent hover:bg-yellow-400 text-primary font-bold text-xs flex items-center space-x-2 shadow"
            >
              <Calendar className="w-4 h-4" />
              <span>{generating ? "Scheduling..." : `Run Auto Scheduler (${horizon === "1_week" ? "7 Days" : "30 Days"})`}</span>
            </Button>

            <Button 
              onClick={handleOpenFailsafeModal} 
              disabled={triggeringRender}
              className="bg-primary hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-2 shadow"
            >
              <Play className="w-4 h-4 text-accent" />
              <span>{triggeringRender ? "Queuing..." : "Trigger Rendering Batch (Fail-Safe)"}</span>
            </Button>
          </div>
        }
      />

      {/* Batch Notification Output */}
      {batchResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-2xl space-y-2 text-xs shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-green-900">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span>Schedule Batch Generated & Stored to Supabase!</span>
          </div>
          <p>Assigned <strong>{batchResult.totalScheduled} video slots</strong> across <strong>{batchResult.shopsProcessed} active shops</strong> from {startDate} to {daysList[daysList.length - 1]?.dateStr}.</p>
          {batchResult.warnings?.length > 0 && (
            <p className="text-amber-700 font-semibold">Warnings: {batchResult.warnings.join("; ")}</p>
          )}
        </div>
      )}

      {/* Stats summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Shops Scheduled</p>
            <p className="text-2xl font-bold text-primary">{matrixData.shops?.length || 0} Outlets</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Film className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Assignments Count</p>
            <p className="text-2xl font-bold text-accent">{matrixData.schedules?.length || 0} Video Slots</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduler Horizon</p>
            <p className="text-2xl font-bold text-primary">{horizon === "1_week" ? "7 Days" : "30 Days"}</p>
          </div>
        </div>
      </div>

      {/* MULTI-SHOP MASTER SCHEDULE MATRIX TABLE */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-base text-primary">Video & Template Assignments Matrix ({horizon === "1_week" ? "7 Days" : "30 Days"})</h3>
            <p className="text-xs text-muted-foreground">Click any card cell to manually update or override the assigned video or layout template styling.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMatrixData} className="flex items-center space-x-1 text-xs">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh Matrix</span>
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : matrixData.shops?.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-semibold">
            No active shops found. Onboard or activate shops to generate schedules.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-48 sticky left-0 bg-slate-50 shadow-xs z-10">Shop / Code</th>
                  {daysList.map((day) => (
                    <th key={day.dateStr} className="py-3 px-3 text-center border-l border-slate-200 min-w-36">
                      <div className="text-[11px] font-extrabold text-primary">{day.dayName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{day.displayDate}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {matrixData.shops.map((shop: any) => (
                  <tr key={shop.id} className="hover:bg-slate-50/50">
                    {/* Shop Name Column */}
                    <td className="py-3 px-4 sticky left-0 bg-white font-semibold text-primary border-r border-slate-200 shadow-xs z-10">
                      <div className="font-bold text-slate-900 truncate max-w-40">{shop.name}</div>
                      <div className="text-[10px] font-mono text-accent font-bold mt-0.5">{shop.shop_code || "SHOP"}</div>
                    </td>

                    {/* Schedule Cell Columns */}
                    {daysList.map((day) => {
                      const sched = matrixData.schedules.find(
                        (s: any) => s.shop_id === shop.id && s.scheduled_date && s.scheduled_date.substring(0, 10) === day.dateStr
                      );

                      return (
                        <td key={day.dateStr} className="py-3 px-3 border-l border-slate-150 align-top text-center">
                          {sched ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(sched, shop, day.displayDate)}
                              className="w-full bg-amber-50/70 border border-amber-200 hover:border-accent hover:bg-amber-100/50 p-2 rounded-xl text-left space-y-1 shadow-2xs group transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-slate-900 truncate text-[11px]" title={sched.videos?.title}>
                                  {sched.videos?.title || "Assigned Video"}
                                </div>
                                <Edit className="w-3 h-3 text-slate-400 group-hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-slate-650 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {sched.templates?.name || "Luxury"}
                                </span>
                                <span className={`text-[9px] font-mono font-bold px-1 rounded border ${
                                  sched.download_status === "downloaded"
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-300"
                                    : "text-green-700 bg-green-50 border-green-200"
                                }`}>
                                  {sched.download_status === "downloaded" ? "Downloaded ✓" : sched.status}
                                </span>
                              </div>
                              {!sched.audio_track_id ? (
                                <div className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate flex items-center space-x-1 justify-center">
                                  <Music className="w-2.5 h-2.5 flex-shrink-0 text-amber-600" />
                                  <span className="truncate">Original Audio</span>
                                </div>
                              ) : sched.music_tracks?.title ? (
                                <div className="text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 truncate flex items-center space-x-1 justify-center">
                                  <Music className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{sched.music_tracks.title}</span>
                                </div>
                              ) : null}
                              {sched.occasions?.name && (
                                <div className="text-[9px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 truncate">
                                  ✨ {sched.occasions.name}
                                </div>
                              )}
                            </button>
                          ) : (
                            <div className="p-2 border border-dashed border-slate-200 rounded-xl text-[10px] text-slate-400 font-medium italic">
                              Unscheduled
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MANUAL ASSIGNMENT EDIT MODAL */}
      {editModalOpen && selectedSchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-primary">Modify Video Schedule</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedSchedule.shopName} — {selectedSchedule.dateStr}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setEditModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <Select 
                label="Select Video Asset"
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                options={(matrixData.availableVideos || []).map((v: any) => {
                  // Check if this shop has already downloaded this video in any past schedule
                  const pastDownloaded = (matrixData.schedules || []).find((s: any) => 
                    s.shop_id === selectedSchedule.shopId && 
                    s.video_id === v.id && 
                    s.download_status === "downloaded"
                  );

                  return {
                    label: pastDownloaded 
                      ? `${v.title} ⚠️ (Already Delivered/Downloaded on ${pastDownloaded.scheduled_date})` 
                      : v.title,
                    value: v.id
                  };
                })}
              />

              <Select 
                label="Select Template Overlay Style"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                options={(matrixData.availableTemplates || []).map((t: any) => ({
                  label: t.name,
                  value: t.id
                }))}
              />

              <Select 
                label="Select Background Music"
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                options={[
                  { label: "-- No Background Music --", value: "" },
                  ...(matrixData.availableMusicTracks || []).map((m: any) => ({
                    label: m.title,
                    value: m.id
                  }))
                ]}
              />

              {/* Assigned Outro Video */}
              <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Assigned Outro Video</label>
                {selectedSchedule.outroVideoUrl ? (
                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs mt-1">
                    <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={selectedSchedule.outroVideoUrl}>
                      🔊 Shop Custom: {selectedSchedule.outroVideoUrl.split("/").pop()}
                    </span>
                    <a 
                      href={selectedSchedule.outroVideoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] font-bold text-amber-500 hover:text-amber-700 hover:underline flex items-center space-x-1"
                    >
                      Preview
                    </a>
                  </div>
                ) : (
                  <div className="bg-white border border-dashed border-slate-200 px-2.5 py-1.5 rounded-xl text-[10px] text-slate-500 italic mt-1">
                    ℹ️ Using default template outro: {
                      (matrixData.availableTemplates || []).find((t: any) => t.id === selectedTemplateId)?.outro_url?.split("/").pop() || "None"
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveManualEdit} disabled={updating}>
                {updating ? "Saving Changes..." : "Save Selection"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Failsafe Shop Selection Modal */}
      {failsafeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-extrabold text-primary flex items-center space-x-2">
                <Play className="w-5 h-5 text-accent animate-pulse" />
                <span>Trigger Fail-Safe Render Batch</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select shops to trigger rendering for date <strong className="text-slate-800">{startDate}</strong>. Shops with Custom Manual Pricing are automatically filtered out.
              </p>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Shops ({selectedFailsafeShops.length} of {matrixData.shops.length} selected)</span>
              <div className="space-x-2">
                <button 
                  type="button"
                  onClick={() => setSelectedFailsafeShops(matrixData.shops.map((s: any) => s.id))}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button 
                  type="button"
                  onClick={() => setSelectedFailsafeShops([])}
                  className="text-[10px] text-slate-500 hover:underline font-bold"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
              {matrixData.shops.map((shop: any) => {
                const isChecked = selectedFailsafeShops.includes(shop.id);
                return (
                  <label key={shop.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setSelectedFailsafeShops(selectedFailsafeShops.filter(id => id !== shop.id));
                        } else {
                          setSelectedFailsafeShops([...selectedFailsafeShops, shop.id]);
                        }
                      }}
                      className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-350"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{shop.name}</div>
                      <div className="text-[10px] font-mono text-accent font-bold mt-0.5">{shop.shop_code || "SHOP"}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setFailsafeModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleManualTriggerRender} 
                disabled={triggeringRender || selectedFailsafeShops.length === 0}
                className="bg-primary text-white font-bold"
              >
                {triggeringRender ? "Queuing..." : `Trigger Render (${selectedFailsafeShops.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Batch History Logs */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-border space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Scheduler Execution History Logs</h3>
          <Table headers={["Batch ID", "Run Date", "Status", "Generated Assignments", "Actions"]}>
            {historyLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">No scheduler batches executed yet.</td>
              </tr>
            ) : (
              historyLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-mono text-xs text-slate-500">{log.id}</td>
                  <td className="py-4 px-6 text-xs">{new Date(log.generated_at).toLocaleString()}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      log.status === "applied" ? "bg-green-50 text-green-700 border-green-200" :
                      log.status === "rolled_back" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold text-primary">{log.total_assignments} slots</td>
                  <td className="py-4 px-6">
                    {log.status === "applied" && (
                      <button 
                        onClick={() => handleRollbackTrigger(log.id)}
                        className="text-red-600 hover:underline flex items-center space-x-1 text-xs font-bold"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rollback Batch</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </Table>
        </div>
      )}

      {/* Rollback batch confirmation */}
      <ConfirmationDialog 
        isOpen={confirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleExecuteRollback} 
        title="Confirm Batch Rollback" 
        message={`Are you sure you want to rollback all schedules generated under this batch? This will delete the schedule rows from Supabase.`}
        confirmText="Confirm Rollback" 
        isDanger 
      />
    </div>
  );
}
