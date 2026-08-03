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
import { Database, Plus, Search, RefreshCcw, Settings, Globe, MapPin, Building } from "lucide-react";

type ActiveTab = "organizations" | "states" | "districts" | "languages" | "settings";

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("organizations");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // States for data catalogs
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  // Modal / Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [formPayload, setFormPayload] = useState<any>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm delete states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: string } | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/master-data?type=${activeTab}${stateFilter ? `&state_id=${stateFilter}` : ""}`);
      const data = await res.json();
      if (activeTab === "organizations") setOrganizations(data);
      else if (activeTab === "states") setStates(data);
      else if (activeTab === "districts") setDistricts(data);
      else if (activeTab === "languages") setLanguages(data);
      else if (activeTab === "settings") setSettings(data);
    } catch (err) {
      console.error("Fetch catalog error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Run initial state load for district state dropdowns
  const fetchStatesList = async () => {
    try {
      const res = await fetch("/api/master-data?type=states");
      const data = await res.json();
      setStates(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCatalog();
    if (activeTab === "districts") {
      fetchStatesList();
    }
  }, [activeTab, stateFilter]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/master-data/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Seed data successfully initialized!");
        fetchCatalog();
      } else {
        alert(`Seeding failed: ${data.error}`);
      }
    } catch (err) {
      alert("Error seeding data.");
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const isEdit = !!formPayload.id;
    const method = isEdit ? "PUT" : "POST";
    const body = {
      type: activeTab === "settings" ? "setting" : activeTab.slice(0, -1), // singular form
      id: formPayload.id,
      key: formPayload.setting_key,
      payload: formPayload
    };

    try {
      const res = await fetch("/api/master-data", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.error) {
        setFormError(data.error);
      } else {
        setModalOpen(false);
        fetchCatalog();
      }
    } catch (err) {
      setFormError("Operation failed.");
    }
  };

  const handleDeleteTrigger = (id: string, type: string) => {
    setDeleteTarget({ id, type });
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/master-data?type=${deleteTarget.type}&id=${deleteTarget.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        fetchCatalog();
      }
    } catch (err) {
      alert("Delete request failed.");
    } finally {
      setConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const openCreateModal = () => {
    setFormError(null);
    setFormPayload({});
    setModalTitle(`Add New ${activeTab.slice(0, -1).toUpperCase()}`);
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormError(null);
    setFormPayload(item);
    setModalTitle(`Edit ${activeTab.slice(0, -1).toUpperCase()}`);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader 
        title="Master Data Catalog" 
        description="Configure lookup records, regions, and default system settings."
        action={
          <div className="flex space-x-3">
            <Button variant="outline" onClick={handleSeed} disabled={seeding} className="flex items-center space-x-2">
              <RefreshCcw className="w-4 h-4" />
              <span>{seeding ? "Seeding..." : "Seed Default Data"}</span>
            </Button>
            {activeTab !== "settings" && (
              <Button onClick={openCreateModal} className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create New</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-border">
        {(["organizations", "states", "districts", "languages", "settings"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSearchQuery("");
            }}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-all border-b-2 -mb-px ${
              activeTab === tab 
                ? "border-accent text-accent font-bold" 
                : "border-transparent text-slate-500 hover:text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={`Search ${activeTab}...`} />

        {activeTab === "districts" && (
          <div className="w-48">
            <Select 
              value={stateFilter} 
              onChange={(e) => setStateFilter(e.target.value)}
              options={[
                { label: "All States", value: "" },
                ...states.map(s => ({ label: s.name, value: s.id }))
              ]} 
            />
          </div>
        )}
      </div>

      {/* Loading Status */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* 1. Organizations Table */}
          {activeTab === "organizations" && (
            <Table headers={["Organization Name", "Linked Outlets", "Created At", "Actions"]}>
              {organizations
                .filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-semibold">{org.name}</td>
                    <td className="py-4 px-6 font-medium text-slate-600">{org.shops?.[0]?.count ?? 0} Shops</td>
                    <td className="py-4 px-6">{new Date(org.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6">
                      <button onClick={() => openEditModal(org)} className="text-accent hover:underline mr-4 text-xs font-bold">Edit</button>
                      <button onClick={() => handleDeleteTrigger(org.id, "organization")} className="text-red-500 hover:underline text-xs font-bold">Delete</button>
                    </td>
                  </tr>
                ))}
            </Table>
          )}

          {/* 2. States Table */}
          {activeTab === "states" && (
            <Table headers={["State Name", "State Code", "Actions"]}>
              {states
                .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((state) => (
                  <tr key={state.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-semibold">{state.name}</td>
                    <td className="py-4 px-6 uppercase font-bold text-slate-600">{state.code}</td>
                    <td className="py-4 px-6">
                      <button onClick={() => handleDeleteTrigger(state.id, "state")} className="text-red-500 hover:underline text-xs font-bold">Delete</button>
                    </td>
                  </tr>
                ))}
            </Table>
          )}

          {/* 3. Districts Table */}
          {activeTab === "districts" && (
            <Table headers={["District Name", "State Location", "Actions"]}>
              {districts
                .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((dist) => (
                  <tr key={dist.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-semibold">{dist.name}</td>
                    <td className="py-4 px-6 font-medium text-slate-600">{dist.states?.name}</td>
                    <td className="py-4 px-6">
                      <button onClick={() => handleDeleteTrigger(dist.id, "district")} className="text-red-500 hover:underline text-xs font-bold">Delete</button>
                    </td>
                  </tr>
                ))}
            </Table>
          )}

          {/* 4. Languages Table */}
          {activeTab === "languages" && (
            <Table headers={["Language Name", "Locale Code", "Actions"]}>
              {languages
                .filter(l => l.language_name.toLowerCase().includes(searchQuery.toLowerCase()) || l.locale.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((lang) => (
                  <tr key={lang.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-semibold">{lang.language_name}</td>
                    <td className="py-4 px-6 font-medium text-slate-600">{lang.locale}</td>
                    <td className="py-4 px-6">
                      <button onClick={() => handleDeleteTrigger(lang.id, "language")} className="text-red-500 hover:underline text-xs font-bold">Delete</button>
                    </td>
                  </tr>
                ))}
            </Table>
          )}

          {/* 5. Settings Table */}
          {activeTab === "settings" && (
            <Table headers={["Configuration Setting Key", "Parameter Value", "Description", "Actions"]}>
              {settings
                .filter(s => s.setting_key.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((sett) => (
                  <tr key={sett.setting_key} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-mono text-xs text-slate-600">{sett.setting_key}</td>
                    <td className="py-4 px-6 font-semibold text-primary">{JSON.stringify(sett.value)}</td>
                    <td className="py-4 px-6 text-slate-500 max-w-sm">{sett.description}</td>
                    <td className="py-4 px-6">
                      <button onClick={() => openEditModal(sett)} className="text-accent hover:underline text-xs font-bold">Configure</button>
                    </td>
                  </tr>
                ))}
            </Table>
          )}
        </>
      )}

      {/* Main Dynamic Creation/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        <form onSubmit={handleCreateOrEdit} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Type = Organizations */}
          {activeTab === "organizations" && (
            <Input 
              label="Organization Name" 
              required 
              value={formPayload.name || ""} 
              onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} 
            />
          )}

          {/* Type = States */}
          {activeTab === "states" && (
            <>
              <Input 
                label="State Name" 
                required 
                value={formPayload.name || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} 
              />
              <Input 
                label="State Code" 
                required 
                placeholder="e.g. TN" 
                value={formPayload.code || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, code: e.target.value })} 
              />
            </>
          )}

          {/* Type = Districts */}
          {activeTab === "districts" && (
            <>
              <Select 
                label="State" 
                required 
                value={formPayload.state_id || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, state_id: e.target.value })}
                options={[
                  { label: "Select State", value: "" },
                  ...states.map(s => ({ label: s.name, value: s.id }))
                ]} 
              />
              <Input 
                label="District Name" 
                required 
                value={formPayload.name || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} 
              />
            </>
          )}

          {/* Type = Languages */}
          {activeTab === "languages" && (
            <>
              <Input 
                label="Language Name" 
                required 
                value={formPayload.name || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })} 
              />
              <Input 
                label="Locale Code" 
                required 
                placeholder="e.g. ta-IN" 
                value={formPayload.locale || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, locale: e.target.value })} 
              />
            </>
          )}

          {/* Type = Settings */}
          {activeTab === "settings" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 block">Configuration Parameter Key</label>
                <div className="font-mono text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">{formPayload.setting_key}</div>
              </div>
              <Input 
                label="Parameter Value (JSON)" 
                required 
                value={typeof formPayload.value === "object" ? JSON.stringify(formPayload.value) : formPayload.value || ""} 
                onChange={(e) => {
                  let parsedValue = e.target.value;
                  try { parsedValue = JSON.parse(e.target.value); } catch {}
                  setFormPayload({ ...formPayload, value: parsedValue });
                }} 
              />
              <Input 
                label="Description" 
                value={formPayload.description || ""} 
                onChange={(e) => setFormPayload({ ...formPayload, description: e.target.value })} 
              />
            </>
          )}

          <div className="flex justify-end pt-4 space-x-3">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {formPayload.id || formPayload.setting_key ? "Save Changes" : "Create Record"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog 
        isOpen={confirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Confirm Deletion" 
        message="Are you sure you want to permanently delete this master record? This action cannot be undone." 
        confirmText="Delete Record" 
        isDanger 
      />
    </div>
  );
}
