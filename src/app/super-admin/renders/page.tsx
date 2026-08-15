"use client";

import React, { useState, useEffect } from "react";
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
import { Activity, Play, Pause, RotateCcw, XCircle, FileText, Plus, Search, ShieldAlert, Eye } from "lucide-react";

export default function RendersQueuePage() {
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  // Selection options for manual job creation
  const [shops, setShops] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("Medium");
  const [createError, setCreateError] = useState<string | null>(null);

  // Logs modal state
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsList, setLogsList] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeJobNumber, setActiveJobNumber] = useState<number | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/renders");
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchManualOptions = async () => {
    try {
      const [resS, resT, resV] = await Promise.all([
        fetch("/api/master-data?type=organizations"), // Fetching shops/organizations
        fetch("/api/templates"),
        fetch("/api/videos")
      ]);
      // Mock/load list parameters
      const templatesData = await resT.json();
      const videosData = await resV.json();
      setTemplates(templatesData);
      setVideos(videosData);

      // Load shops directly
      const resShops = await fetch("/api/scheduler-sim");
      const simData = await resShops.json();
      setShops(simData.shops || []);
      if (simData.shops?.length > 0) setSelectedShopId(simData.shops[0].id);
      if (templatesData.length > 0) setSelectedTemplateId(templatesData[0].id);
      if (videosData.length > 0) setSelectedVideoId(videosData[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async (jobId: string, jobNumber: number) => {
    setLogsLoading(true);
    setActiveJobNumber(jobNumber);
    setLogsOpen(true);
    try {
      const res = await fetch(`/api/renders?type=logs&job_id=${jobId}`);
      const data = await res.json();
      setLogsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchJobs();
      await fetchManualOptions();
      setLoading(false);
    };
    init();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setRunningAction(true);

    try {
      const res = await fetch("/api/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: selectedShopId,
          template_id: selectedTemplateId,
          video_library_id: selectedVideoId,
          priority: selectedPriority
        })
      });
      const data = await res.json();
      if (data.error) {
        setCreateError(data.error);
      } else {
        setCreateOpen(false);
        fetchJobs();
      }
    } catch (err) {
      setCreateError("Failed to trigger job creation.");
    } finally {
      setRunningAction(false);
    }
  };

  const handleUpdateStatus = async (jobId: string, targetStatus: string) => {
    setRunningAction(true);
    try {
      const res = await fetch("/api/renders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningAction(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.shops?.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          job.job_number?.toString().includes(searchQuery);
    const matchesStatus = !statusFilter || job.status === statusFilter;
    const matchesPriority = !priorityFilter || job.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Rendering Orchestrator"
        description="Monitor active rendering jobs, configure parameters manually, and inspect FFmpeg worker loops."
        action={
          <Button onClick={() => setCreateOpen(true)} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Render Job</span>
          </Button>
        }
      />

      {/* KPI Counters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Queue</p>
          <p className="text-xl font-bold mt-1 text-primary">{jobs.filter(j => j.status === "Pending" || j.status === "Queued").length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Processing VPS</p>
          <p className="text-xl font-bold mt-1 text-blue-600">{jobs.filter(j => j.status === "Processing").length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed Today</p>
          <p className="text-xl font-bold mt-1 text-green-600">{jobs.filter(j => j.status === "Completed").length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Failures Logs</p>
          <p className="text-xl font-bold mt-1 text-red-600">{jobs.filter(j => j.status === "Failed").length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retrying Rerun</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{jobs.filter(j => j.status === "Retrying").length}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search job # or shop..." />
        <div className="flex gap-3">
          <div className="w-40">
            <Select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: "Status: All", value: "" },
                { label: "Pending", value: "Pending" },
                { label: "Processing", value: "Processing" },
                { label: "Completed", value: "Completed" },
                { label: "Failed", value: "Failed" },
                { label: "Paused", value: "Paused" }
              ]} 
            />
          </div>
          <div className="w-40">
            <Select 
              value={priorityFilter} 
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { label: "Priority: All", value: "" },
                { label: "Low", value: "Low" },
                { label: "Medium", value: "Medium" },
                { label: "High", value: "High" },
                { label: "Critical", value: "Critical" }
              ]} 
            />
          </div>
        </div>
      </div>

      {/* Jobs queue table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <Table headers={["Job #", "Shop Name", "Template Config", "Video Asset", "Priority", "Status", "Worker ID", "Actions"]}>
          {filteredJobs.map((job) => (
            <tr key={job.id} className="hover:bg-slate-50/50">
              <td className="py-4 px-6 font-mono text-xs font-bold text-slate-655">#{job.job_number}</td>
              <td className="py-4 px-6 font-semibold text-primary">{job.shops?.shop_name}</td>
              <td className="py-4 px-6 text-slate-600">{job.templates?.name || "N/A"}</td>
              <td className="py-4 px-6 text-slate-600">{job.videos?.title || "N/A"}</td>
              <td className="py-4 px-6">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  job.priority === "Critical" ? "bg-red-50 text-red-700 border border-red-200" :
                  job.priority === "High" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {job.priority}
                </span>
              </td>
              <td className="py-4 px-6">
                <StatusBadge status={job.status.toLowerCase()} />
              </td>
              <td className="py-4 px-6 font-mono text-xs text-slate-500">{job.worker_id || "Unassigned"}</td>
              <td className="py-4 px-6">
                <div className="flex space-x-2">
                  <button 
                    onClick={() => fetchLogs(job.id, job.job_number)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="View logs audit"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  {job.status === "Completed" && job.rendered_video_url && (
                    <a 
                      href={job.rendered_video_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 p-1"
                      title="Preview rendered video"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  {job.status === "Failed" && (
                    <button 
                      onClick={() => handleUpdateStatus(job.id, "Pending")}
                      className="text-accent hover:text-blue-900 p-1"
                      title="Retry render"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {(job.status === "Pending" || job.status === "Processing" || job.status === "Retrying") && (
                    <button 
                      onClick={() => handleUpdateStatus(job.id, "Cancelled")}
                      className="text-red-550 hover:text-red-700 p-1"
                      title={job.status === "Processing" ? "Force kill/cancel job" : "Cancel job"}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Create Manual Job Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Manually Queue Render Job">
        <form onSubmit={handleCreateJob} className="space-y-4">
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold">
              {createError}
            </div>
          )}

          <Select 
            label="Shop" 
            value={selectedShopId} 
            onChange={(e) => setSelectedShopId(e.target.value)}
            options={shops.map(s => ({ label: s.shop_name, value: s.id }))} 
          />

          <Select 
            label="Template" 
            value={selectedTemplateId} 
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            options={templates.map(t => ({ label: t.name, value: t.id }))} 
          />

          <Select 
            label="Video Asset" 
            value={selectedVideoId} 
            onChange={(e) => setSelectedVideoId(e.target.value)}
            options={videos.map(v => ({ label: v.title, value: v.id }))} 
          />

          <Select 
            label="Priority" 
            value={selectedPriority} 
            onChange={(e) => setSelectedPriority(e.target.value)}
            options={[
              { label: "Low", value: "Low" },
              { label: "Medium", value: "Medium" },
              { label: "High", value: "High" },
              { label: "Critical", value: "Critical" }
            ]} 
          />

          <div className="flex justify-end pt-4 space-x-3">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={runningAction}>
              {runningAction ? "Queueing..." : "Queue Job"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Logs View Modal */}
      <Modal isOpen={logsOpen} onClose={() => setLogsOpen(false)} title={`Audit Logs for Job #${activeJobNumber}`}>
        {logsLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-xl">
            {logsList.length === 0 ? (
              <p className="text-slate-500">No logs captured for this rendering job.</p>
            ) : (
              logsList.map((log) => (
                <div key={log.id} className="border-b border-slate-800 pb-2">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                    <span className={log.log_level === "Error" ? "text-red-400 font-bold" : "text-slate-400"}>[{log.log_level}]</span>
                  </div>
                  <p className="mt-1 text-slate-200">{log.message}</p>
                </div>
              ))
            )}
          </div>
        )}
        <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
          <Button variant="outline" onClick={() => setLogsOpen(false)}>Close Logs</Button>
        </div>
      </Modal>

    </div>
  );
}
