"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  Select, 
  Modal, 
  ConfirmationDialog, 
  SearchBar, 
  StatusBadge, 
  LoadingSpinner 
} from "@/components/ui/reusable";
import { Calendar as CalendarIcon, Plus, Eye, Award, Globe, Archive, AlertTriangle } from "lucide-react";

export default function OccasionManagerPage() {
  const [loading, setLoading] = useState(false);
  const [occasions, setOccasions] = useState<any[]>([]);
  
  // Master lists for metadata dropdowns
  const [states, setStates] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal / Form states
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formPayload, setFormPayload] = useState<any>({
    name: "",
    priority: 1,
    start_date: "",
    end_date: "",
    overlay_url: "",
    states: [],
    languages: [],
    greetings: {},
    status: "draft"
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Status toggle confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<any>(null);

  // Calendar View month pointer
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(6); // July (0-indexed, so 6)

  const fetchOccasions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/occasions");
      const data = await res.json();
      setOccasions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [resS, resL] = await Promise.all([
        fetch("/api/master-data?type=states"),
        fetch("/api/master-data?type=languages")
      ]);
      setStates(await resS.json());
      setLanguages(await resL.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOccasions();
    fetchMetadata();
  }, []);

  const openCreateModal = () => {
    setFormError(null);
    setFormPayload({
      name: "",
      priority: 1,
      start_date: "",
      end_date: "",
      overlay_url: "",
      states: [],
      languages: [],
      greetings: {},
      status: "draft"
    });
    setFormTitle("Add New Festival/Campaign Occasion");
    setFormOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormError(null);
    setFormPayload(item);
    setFormTitle(`Configure Occasion: ${item.name}`);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Assert that at least one language greeting is not empty
    const greetingsCount = Object.values(formPayload.greetings || {}).filter(val => !!val).length;
    if (greetingsCount === 0) {
      setFormError("At least one localized greeting message must be set.");
      return;
    }

    const isEdit = !!formPayload.id;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch("/api/occasions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload)
      });
      const data = await res.json();

      if (data.error) {
        setFormError(data.error);
      } else {
        setFormOpen(false);
        fetchOccasions();
      }
    } catch (err) {
      setFormError("Operation failed.");
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === "draft" ? "active" : "draft";
    try {
      const res = await fetch("/api/occasions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: statusTarget.id,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchOccasions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmOpen(false);
      setStatusTarget(null);
    }
  };

  // Find overlaps conflicts
  const getOverlaps = () => {
    const overlapsList: string[] = [];
    for (let i = 0; i < occasions.length; i++) {
      for (let j = i + 1; j < occasions.length; j++) {
        const o1 = occasions[i];
        const o2 = occasions[j];
        if (o1.status !== "active" || o2.status !== "active") continue;
        const start1 = new Date(o1.start_date);
        const end1 = new Date(o1.end_date);
        const start2 = new Date(o2.start_date);
        const end2 = new Date(o2.end_date);

        if (start1 <= end2 && start2 <= end1) {
          overlapsList.push(`Conflict: "${o1.name}" overlaps with "${o2.name}" (Priority ${o1.priority} vs ${o2.priority})`);
        }
      }
    }
    return overlapsList;
  };

  const filteredOccasions = occasions.filter((occ) => {
    const matchesSearch = occ.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || occ.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const now = new Date();
  const activeOccasions = occasions.filter(o => o.status === "active" && new Date(o.start_date) <= now && new Date(o.end_date) >= now);
  const upcomingOccasions = occasions.filter(o => new Date(o.start_date) > now);
  const expiredOccasions = occasions.filter(o => new Date(o.end_date) < now);

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Campaign Occasions Manager"
        description="Schedule regional festival windows, prioritize promotional greetings, and coordinate overlays."
        action={
          <Button onClick={openCreateModal} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Occasion</span>
          </Button>
        }
      />

      {/* KPI stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Occasions</p>
          <p className="text-2xl font-bold mt-2 text-primary">{occasions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currently Active</p>
          <p className="text-2xl font-bold mt-2 text-green-600">{activeOccasions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Campaigns</p>
          <p className="text-2xl font-bold mt-2 text-blue-600">{upcomingOccasions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expired Campaigns</p>
          <p className="text-2xl font-bold mt-2 text-slate-500">{expiredOccasions.length}</p>
        </div>
      </div>

      {/* Overlaps Warnings */}
      {getOverlaps().length > 0 && (
        <div className="bg-orange-50 border border-orange-200 text-orange-850 p-4 rounded-2xl space-y-2">
          <div className="flex items-center space-x-2 font-bold text-sm text-orange-900">
            <AlertTriangle className="w-5 h-5" />
            <span>Scheduling Timeline Overlaps Detected</span>
          </div>
          <ul className="text-xs list-disc pl-5 space-y-1">
            {getOverlaps().map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search occasion name..." />
        <div className="w-40">
          <Select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: "Status: All", value: "" },
              { label: "Draft", value: "draft" },
              { label: "Active", value: "active" },
              { label: "Archived", value: "archived" }
            ]} 
          />
        </div>
      </div>

      {/* Table list */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <Table headers={["Occasion Name", "Priority Score", "Active Window", "Applicable States", "Status", "Actions"]}>
          {filteredOccasions.map((occ) => (
            <tr key={occ.id} className="hover:bg-slate-50/50">
              <td className="py-4 px-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 text-secondary rounded-lg border border-blue-100">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-primary">{occ.name}</span>
                </div>
              </td>
              <td className="py-4 px-6">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Award className="w-3 h-3 mr-1" />
                  Priority {occ.priority}
                </span>
              </td>
              <td className="py-4 px-6 text-xs font-medium text-slate-600">
                {new Date(occ.start_date).toLocaleDateString()} - {new Date(occ.end_date).toLocaleDateString()}
              </td>
              <td className="py-4 px-6">
                <span className="text-xs text-slate-500 font-medium">
                  {occ.states?.length > 0 ? `${occ.states.length} states` : "All India"}
                </span>
              </td>
              <td className="py-4 px-6">
                <StatusBadge status={occ.status} />
              </td>
              <td className="py-4 px-6 space-x-2">
                <button 
                  onClick={() => openEditModal(occ)}
                  className="text-accent hover:underline text-xs font-bold"
                >
                  Configure
                </button>
                <button 
                  onClick={() => { setStatusTarget(occ); setConfirmOpen(true); }}
                  className="text-slate-400 hover:text-slate-655 text-xs font-bold"
                >
                  Toggle RLS
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Create / Edit Modal Form */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={formTitle}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          <Input 
            label="Occasion/Campaign Name" 
            required 
            value={formPayload.name} 
            onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} 
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Scheduler Preference Priority" 
              type="number"
              required 
              min={1}
              value={formPayload.priority} 
              onChange={(e) => setFormPayload({ ...formPayload, priority: parseInt(e.target.value) || 1 })} 
            />
            <Select 
              label="Campaign Status" 
              required 
              value={formPayload.status} 
              onChange={(e) => setFormPayload({ ...formPayload, status: e.target.value })}
              options={[
                { label: "Draft", value: "draft" },
                { label: "Active", value: "active" },
                { label: "Archived", value: "archived" }
              ]} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date" 
              type="date"
              required 
              value={formPayload.start_date} 
              onChange={(e) => setFormPayload({ ...formPayload, start_date: e.target.value })} 
            />
            <Input 
              label="End Date" 
              type="date"
              required 
              value={formPayload.end_date} 
              onChange={(e) => setFormPayload({ ...formPayload, end_date: e.target.value })} 
            />
          </div>

          <Input 
            label="Overlay Frame Asset URL (R2) (Optional)" 
            placeholder="https://r2-link.com/overlay.png"
            value={formPayload.overlay_url || ""} 
            onChange={(e) => setFormPayload({ ...formPayload, overlay_url: e.target.value })} 
          />

          {/* Applicable states selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Target States (Optional)</label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-150 p-3 rounded-xl bg-slate-50">
              {states.map(s => (
                <label key={s.id} className="flex items-center space-x-2 text-xs text-slate-700">
                  <input 
                    type="checkbox" 
                    checked={formPayload.states?.includes(s.id)}
                    onChange={(e) => {
                      const selStates = e.target.checked 
                        ? [...(formPayload.states || []), s.id]
                        : (formPayload.states || []).filter((id: string) => id !== s.id);
                      setFormPayload({ ...formPayload, states: selStates });
                    }}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Dynamic Language Greetings Editor */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Campaign Greetings Messages</label>
            <div className="space-y-3">
              {languages.map(l => (
                <div key={l.id} className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-550 w-24 flex-shrink-0">{l.language_name} ({l.locale}):</span>
                  <Input 
                    placeholder={`e.g. Happy ${formPayload.name || "Festivities"}`}
                    value={formPayload.greetings?.[l.locale] || ""}
                    onChange={(e) => {
                      const greets = { ...formPayload.greetings, [l.locale]: e.target.value };
                      setFormPayload({ ...formPayload, greetings: greets });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {formPayload.id ? "Save Occasion" : "Create Occasion"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation box */}
      <ConfirmationDialog 
        isOpen={confirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleToggleStatus} 
        title="Confirm Status Alteration" 
        message="Are you sure you want to toggle the scheduling state for this occasion?"
        confirmText="Toggle" 
      />
    </div>
  );
}
