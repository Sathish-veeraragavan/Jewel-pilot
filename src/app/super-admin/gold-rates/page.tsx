"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  Select,
  LoadingSpinner 
} from "@/components/ui/reusable";
import { CheckCircle, Lock, Unlock, Sparkles, Video } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function CommodityRatesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Today's record state
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [todayDate, setTodayDate] = useState("");
  const [gold22k, setGold22k] = useState("");
  const [gold24k, setGold24k] = useState("");
  const [gold18k, setGold18k] = useState("");
  const [gold9k, setGold9k] = useState("");
  const [silver, setSilver] = useState("");
  const [remarks, setRemarks] = useState("");
  const [triggeredRendersCount, setTriggeredRendersCount] = useState<number | null>(null);

  // Associations and States state
  const [associations, setAssociations] = useState<any[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [states, setStates] = useState<any[]>([]);
  const [newAssocName, setNewAssocName] = useState("");
  const [newAssocStateId, setNewAssocStateId] = useState("");
  const [newAssocAllowedMetals, setNewAssocAllowedMetals] = useState<string[]>(["24k", "22k", "18k", "9k", "silver"]);

  // Editing Association state
  const [editingAssocId, setEditingAssocId] = useState("");
  const [editingAssocName, setEditingAssocName] = useState("");
  const [editingAssocStateId, setEditingAssocStateId] = useState("");
  const [editingAssocAllowedMetals, setEditingAssocAllowedMetals] = useState<string[]>([]);
  const [editingAssocSaving, setEditingAssocSaving] = useState(false);

  // History list state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [totalHistory, setTotalHistory] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const historyLimit = 10;

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        setUserRole(profile?.role || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTodayRecord = async (dateStr: string, assocId: string) => {
    setLoading(true);
    try {
      const url = `/api/commodity-rates?type=today&date=${dateStr}${assocId ? `&association_id=${assocId}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setTodayRecord(data);
      if (data && data.rate_22k !== undefined && data.rate_22k !== null) {
        setGold22k(data.rate_22k?.toString() || "");
        setGold24k(data.rate_24k?.toString() || "");
        setGold18k(data.rate_18k?.toString() || "");
        setGold9k(data.rate_9k?.toString() || "");
        setSilver(data.rate_silver?.toString() || "");
        setRemarks(data.remarks || "");
      } else {
        setGold22k("");
        setGold24k("");
        setGold18k("");
        setGold9k("");
        setSilver("");
        setRemarks("");
      }
    } catch (err) {
      console.error(err);
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
      console.error(err);
    }
  };

  const fetchStates = async () => {
    try {
      const res = await fetch("/api/master-data?type=states");
      const data = await res.json();
      if (Array.isArray(data)) {
        setStates(data);
        if (data.length > 0) {
          setNewAssocStateId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async (page: number) => {
    setHistoryLoading(true);
    try {
      const offset = (page - 1) * historyLimit;
      const res = await fetch(`/api/commodity-rates?type=history&limit=${historyLimit}&offset=${offset}`);
      const data = await res.json();
      setHistoryList(data.data || []);
      setTotalHistory(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setTodayDate(todayStr);
    fetchUserProfile();
    fetchStates();
    fetchAssociations();
    fetchTodayRecord(todayStr, "");
    fetchHistory(1);
  }, []);

  const handleSaveDraft = async () => {
    await handleSave("draft");
  };

  const handlePublish = async () => {
    await handleSave("Published");
  };

  const handleSave = async (targetStatus: string) => {
    if (!gold22k || !gold24k || !silver) {
      alert("Please fill all commodity rate values.");
      return;
    }

    setSaving(true);
    setTriggeredRendersCount(null);
    try {
      const res = await fetch("/api/commodity-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate_date: todayDate,
          gold_22k: parseFloat(gold22k),
          gold_24k: parseFloat(gold24k),
          gold_18k: parseFloat(gold18k || "0"),
          gold_9k: parseFloat(gold9k || "0"),
          silver: parseFloat(silver),
          association_id: selectedAssociationId || null,
          remarks,
          status: targetStatus
        })
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else {
        if (data.triggeredRenders !== undefined) {
          setTriggeredRendersCount(data.triggeredRenders);
        }
        alert(`Rates saved successfully as ${targetStatus}!`);
        fetchTodayRecord(todayDate, selectedAssociationId);
        fetchHistory(historyPage);
      }
    } catch (err) {
      alert("Error saving commodity rates.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (statusVal: "Locked" | "Published") => {
    if (!todayRecord) return;
    setSaving(true);
    try {
      const res = await fetch("/api/commodity-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: todayRecord.id, status: statusVal })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Record status changed to ${statusVal}!`);
        fetchTodayRecord(todayDate, selectedAssociationId);
        fetchHistory(historyPage);
      }
    } catch (err) {
      alert("Status update failed.");
    } finally {
      setSaving(false);
    }
  };

  const [assocSubmitting, setAssocSubmitting] = useState(false);

  const handleCreateAssociation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssocName || !newAssocStateId) {
      alert("Please enter a name and select a state for the new association.");
      return;
    }
    setAssocSubmitting(true);
    try {
      const res = await fetch("/api/associations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newAssocName, 
          state_id: newAssocStateId,
          allowed_metals: newAssocAllowedMetals
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Association "${newAssocName}" created successfully!`);
        setNewAssocName("");
        setNewAssocAllowedMetals(["24k", "22k", "18k", "9k", "silver"]);
        fetchAssociations();
      }
    } catch (err) {
      alert("Failed to create association.");
    } finally {
      setAssocSubmitting(false);
    }
  };

  const handleUpdateAssociation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssocId || !editingAssocName || !editingAssocStateId) {
      alert("Please select an association, enter a name, and select a state.");
      return;
    }
    setEditingAssocSaving(true);
    try {
      const res = await fetch("/api/associations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAssocId,
          name: editingAssocName,
          state_id: editingAssocStateId,
          allowed_metals: editingAssocAllowedMetals
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Association "${editingAssocName}" updated successfully!`);
        fetchAssociations();
      }
    } catch (err) {
      alert("Failed to update association.");
    } finally {
      setEditingAssocSaving(false);
    }
  };

  const isLocked = todayRecord?.status === "Locked";
  const isPublished = todayRecord?.status === "Published";

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Commodity Rates & Render Trigger"
        description="Publish daily jewelry prices to automatically trigger render queue for scheduled videos."
      />

      {/* Main Form Block */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Rate Editor Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-border space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Target Date:</span>
                <span className="text-sm font-bold text-primary">{todayDate}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isLocked ? "bg-red-50 text-red-700 border border-red-200" :
                  isPublished ? "bg-green-50 text-green-700 border border-green-200" :
                  "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  {todayRecord?.status || "Draft"}
                </span>
              </div>
            </div>

            {/* Association Filter Select */}
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-150 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-primary uppercase">Select Rate Association</span>
                <span className="text-[10px] text-slate-400 font-medium">Update prices for a specific regional body or global fallback rates.</span>
              </div>
              <div className="w-full md:w-72">
                <select
                  value={selectedAssociationId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAssociationId(val);
                    fetchTodayRecord(todayDate, val);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-750 shadow-sm focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="">-- Global Fallback Rates --</option>
                  {associations.map((assoc) => (
                    <option key={assoc.id} value={assoc.id}>
                      {assoc.name} ({assoc.states?.name || "Local"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input 
                label="Gold 24K (₹/g)" 
                type="number"
                step="0.01"
                disabled={isLocked}
                value={gold24k} 
                onChange={(e) => setGold24k(e.target.value)} 
              />
              <Input 
                label="Gold 22K (₹/g)" 
                type="number"
                step="0.01"
                disabled={isLocked}
                value={gold22k} 
                onChange={(e) => setGold22k(e.target.value)} 
              />
              <Input 
                label="Gold 18K (₹/g)" 
                type="number"
                step="0.01"
                disabled={isLocked}
                value={gold18k} 
                onChange={(e) => setGold18k(e.target.value)} 
              />
              <Input 
                label="Gold 9K (₹/g)" 
                type="number"
                step="0.01"
                disabled={isLocked}
                value={gold9k} 
                onChange={(e) => setGold9k(e.target.value)} 
              />
              <Input 
                label="Silver (₹/g)" 
                type="number"
                step="0.01"
                disabled={isLocked}
                value={silver} 
                onChange={(e) => setSilver(e.target.value)} 
              />
            </div>

            <Input 
              label="Remarks / Notes" 
              disabled={isLocked}
              value={remarks} 
              onChange={(e) => setRemarks(e.target.value)} 
            />

            {triggeredRendersCount !== null && (
              <div className="flex items-center space-x-2 bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold">
                <Video className="w-4 h-4 text-green-600" />
                <span>Publishing trigger activated! {triggeredRendersCount} scheduled shop videos queued for VPS FFmpeg rendering.</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                {todayRecord && `Last updated at: ${new Date(todayRecord.updated_at).toLocaleTimeString()}`}
              </div>
              <div className="flex space-x-3">
                {!isLocked && (
                  <>
                    <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
                      Save Draft
                    </Button>
                    <Button onClick={handlePublish} disabled={saving} className="flex items-center space-x-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>Publish Daily Rate</span>
                    </Button>
                  </>
                )}
                {isLocked && userRole === "super_admin" && (
                  <Button variant="outline" onClick={() => handleToggleLock("Published")} disabled={saving} className="flex items-center space-x-1">
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Daily Rate</span>
                  </Button>
                )}
                {!isLocked && todayRecord && userRole === "super_admin" && (
                  <Button variant="outline" onClick={() => handleToggleLock("Locked")} disabled={saving} className="flex items-center space-x-1">
                    <Lock className="w-4 h-4" />
                    <span>Lock Daily Rate</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Right side widgets column */}
          <div className="space-y-6">
            {/* Today's Rate Display Widget */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-md h-fit space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Commodity Rate Widget</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] capitalize text-accent">{todayRecord?.source || "manual"}</span>
              </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400">Gold 24K:</span>
                  <span className="text-xl font-bold text-white">₹{gold24k || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400">Gold 22K:</span>
                  <span className="text-xl font-bold text-white">₹{gold22k || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400">Gold 18K:</span>
                  <span className="text-xl font-bold text-white">₹{gold18k || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400">Gold 9K:</span>
                  <span className="text-xl font-bold text-white">₹{gold9k || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400">Silver:</span>
                  <span className="text-xl font-bold text-white">₹{silver || "0.00"}</span>
                </div>
              </div>
            
            <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-4 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Ready to overlay automatically during VPS rendering.</span>
            </div>
          </div>

          {/* Create Association Sub-Panel */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="font-bold text-xs text-primary uppercase tracking-wider">Create Rate Association</h4>
              <p className="text-[10px] text-slate-400">Add regional/state association body.</p>
            </div>
            <form onSubmit={handleCreateAssociation} className="space-y-3">
              <Input
                label="Association Name"
                placeholder="e.g. Madurai Jewelers Association"
                value={newAssocName}
                onChange={(e) => setNewAssocName(e.target.value)}
                required
              />
              <Select
                label="Linked State"
                value={newAssocStateId}
                onChange={(e) => setNewAssocStateId(e.target.value)}
                options={states.map((s) => ({ label: s.name, value: s.id }))}
              />
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">Allowed Metal Types</span>
                <div className="flex flex-wrap gap-2">
                  {["24k", "22k", "18k", "9k", "silver"].map((m) => {
                    const isChecked = newAssocAllowedMetals.includes(m);
                    return (
                      <label key={m} className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100/50">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewAssocAllowedMetals(newAssocAllowedMetals.filter((x) => x !== m));
                            } else {
                              setNewAssocAllowedMetals([...newAssocAllowedMetals, m]);
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
              <Button
                type="submit"
                className="w-full justify-center"
                disabled={assocSubmitting}
              >
                {assocSubmitting ? "Creating..." : "Create Association"}
              </Button>
            </form>
          </div>

          {/* Manage Associations Sub-Panel */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="font-bold text-xs text-primary uppercase tracking-wider">Manage Associations</h4>
              <p className="text-[10px] text-slate-400">Edit existing regional/state bodies.</p>
            </div>
            <div className="space-y-3">
              <Select
                label="Select Association to Edit"
                value={editingAssocId}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingAssocId(val);
                  const selected = associations.find((a) => a.id === val);
                  if (selected) {
                    setEditingAssocName(selected.name);
                    setEditingAssocStateId(selected.state_id || "");
                    setEditingAssocAllowedMetals(selected.allowed_metals || ["24k", "22k", "18k", "9k", "silver"]);
                  } else {
                    setEditingAssocName("");
                    setEditingAssocStateId("");
                    setEditingAssocAllowedMetals([]);
                  }
                }}
                options={[{ label: "-- Choose Association --", value: "" }, ...associations.map((a) => ({ label: a.name, value: a.id }))]}
              />

              {editingAssocId && (
                <form onSubmit={handleUpdateAssociation} className="space-y-3 border-t border-slate-100 pt-3">
                  <Input
                    label="Association Name"
                    value={editingAssocName}
                    onChange={(e) => setEditingAssocName(e.target.value)}
                    required
                  />
                  <Select
                    label="Linked State"
                    value={editingAssocStateId}
                    onChange={(e) => setEditingAssocStateId(e.target.value)}
                    options={states.map((s) => ({ label: s.name, value: s.id }))}
                  />
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700">Allowed Metal Types</span>
                    <div className="flex flex-wrap gap-2">
                      {["24k", "22k", "18k", "9k", "silver"].map((m) => {
                        const isChecked = editingAssocAllowedMetals.includes(m);
                        return (
                          <label key={m} className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100/50">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setEditingAssocAllowedMetals(editingAssocAllowedMetals.filter((x) => x !== m));
                                } else {
                                  setEditingAssocAllowedMetals([...editingAssocAllowedMetals, m]);
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
                  <Button
                    type="submit"
                    className="w-full justify-center"
                    disabled={editingAssocSaving}
                  >
                    {editingAssocSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              )}
            </div>
          </div>

          </div>

        </div>
      )}

      {/* Rates History Catalog */}
      <div className="bg-white p-6 rounded-2xl border border-border space-y-4 shadow-sm">
        <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Prices History Logs</h3>
        {historyLoading ? (
          <LoadingSpinner />
        ) : (
          <Table headers={["Rate Date", "Association", "Gold 24K", "Gold 22K", "Gold 18K", "Gold 9K", "Silver", "Status"]}>
            {historyList.map((hist) => (
              <tr key={hist.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold">{hist.rate_date}</td>
                <td className="py-4 px-6 font-semibold text-slate-500">{hist.associations?.name || "Global Fallback"}</td>
                <td className="py-4 px-6 font-mono font-medium">₹{hist.rate_24k}</td>
                <td className="py-4 px-6 font-mono font-medium">₹{hist.rate_22k}</td>
                <td className="py-4 px-6 font-mono font-medium">₹{hist.rate_18k || "0"}</td>
                <td className="py-4 px-6 font-mono font-medium">₹{hist.rate_9k || "0"}</td>
                <td className="py-4 px-6 font-mono font-medium">₹{hist.rate_silver}</td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    hist.status === "Locked" ? "bg-red-50 text-red-700 border-red-250" :
                    hist.status === "Published" ? "bg-green-50 text-green-700 border-green-250" :
                    "bg-slate-50 text-slate-700 border-slate-200"
                  }`}>
                    {hist.status || "Published"}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

    </div>
  );
}
