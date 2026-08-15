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
import { 
  LayoutTemplate, 
  Plus, 
  Eye, 
  Code, 
  Archive, 
  RefreshCw, 
  AlertCircle, 
  Sparkles,
  Upload,
  Trash2,
  Image as ImageIcon
} from "lucide-react";
import CanvaTemplateEditor from "@/components/ui/CanvaTemplateEditor";

export default function TemplateManagerPage() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"roster" | "editor" | "icons">("roster");

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Editor State
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [templateName, setTemplateName] = useState("New Luxury Template");
  const [templateType, setTemplateType] = useState("luxury");
  const [bgImageUrl, setBgImageUrl] = useState("");
  const [outroUrl, setOutroUrl] = useState("");
  const [occasionId, setOccasionId] = useState("");
  const [placeholderCount, setPlaceholderCount] = useState(3);
  const [editorConfig, setEditorConfig] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [allowedShopIds, setAllowedShopIds] = useState<string[]>([]);

  // Occasions State
  const [occasions, setOccasions] = useState<any[]>([]);

  // Icons Library State
  const [icons, setIcons] = useState<any[]>([]);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Status toggle confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<any>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIcons = async () => {
    try {
      const res = await fetch("/api/template-icons");
      const data = await res.json();
      setIcons(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOccasions = async () => {
    try {
      const res = await fetch("/api/occasions");
      const data = await res.json();
      setOccasions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch occasions", err);
    }
  };

  const fetchShops = async () => {
    try {
      const res = await fetch("/api/shops");
      const data = await res.json();
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch shops", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchIcons();
    fetchOccasions();
    fetchShops();
  }, []);

  const openVisualEditor = (template?: any) => {
    if (template) {
      setActiveTemplate(template);
      setTemplateName(template.name);
      setTemplateType(template.template_type || "luxury");
      setTemplateStatus(template.status || "active");
      setBgImageUrl(template.bg_image_url || "");
      setOutroUrl(template.outro_url || "");
      setOccasionId(template.occasion_id || "");
      setPlaceholderCount(template.placeholder_count || 3);
      setEditorConfig(template.config || null);
      setAllowedShopIds(template.allowed_shop_ids || []);
    } else {
      setActiveTemplate(null);
      setTemplateName("New Luxury Template");
      setTemplateType("luxury");
      setTemplateStatus("active");
      setBgImageUrl("");
      setOutroUrl("");
      setOccasionId("");
      setPlaceholderCount(3);
      setEditorConfig(null);
      setAllowedShopIds([]);
    }
    setActiveTab("editor");
  };

  const handleSaveEditorConfig = async (configData: any, closeEditor: boolean = true) => {
    setLoading(true);

    const isEdit = !!activeTemplate?.id;
    const method = isEdit ? "PUT" : "POST";

    const payload = {
      id: activeTemplate?.id,
      name: templateName,
      template_type: templateType,
      bg_image_url: bgImageUrl,
      outro_url: outroUrl,
      occasion_id: occasionId || null,
      placeholder_count: placeholderCount,
      version: activeTemplate?.version || "1.0.0",
      status: templateStatus || "active",
      config: configData,
      allowed_shop_ids: allowedShopIds.length > 0 ? allowedShopIds : null
    };

    try {
      const res = await fetch("/api/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        alert(`Failed to save template: ${data.error}`);
        return null;
      } else {
        if (closeEditor) {
          alert(`Template "${templateName}" saved successfully with 9:16 layout JSON!`);
          fetchTemplates();
          setActiveTab("roster");
        } else {
          // If editing a template just created, assign the id to activeTemplate
          if (!isEdit && data.id) {
            setActiveTemplate(data);
          }
          fetchTemplates();
        }
        return data;
      }
    } catch (err) {
      alert("Failed to save template configuration.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleIconFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingIcon(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);

        await fetch("/api/template-icons", {
          method: "POST",
          body: formData
        });
      }
      fetchIcons();
    } catch (err) {
      alert("Failed to upload template elements.");
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleDeleteIcon = async (key: string) => {
    if (!confirm("Are you sure you want to delete this template icon from Cloudflare R2?")) return;

    try {
      await fetch(`/api/template-icons?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      fetchIcons();
    } catch (err) {
      alert("Failed to delete template icon.");
    }
  };

  const [templateStatus, setTemplateStatus] = useState("active");

  const handleDuplicateTemplate = async (template: any) => {
    setLoading(true);
    try {
      const payload = {
        name: `${template.name} (Copy)`,
        template_type: template.template_type || "luxury",
        bg_image_url: template.bg_image_url || "",
        outro_url: template.outro_url || "",
        occasion_id: template.occasion_id || null,
        placeholder_count: template.placeholder_count || 3,
        version: template.version || "1.0.0",
        status: "active",
        config: template.config || {}
      };

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        alert(`Failed to duplicate template: ${data.error}`);
      } else {
        alert(`Template duplicated as "${data.name}"!`);
        fetchTemplates();
      }
    } catch (err) {
      alert("Failed to duplicate template.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === "active" ? "archived" : "active";
    try {
      const res = await fetch("/api/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: statusTarget.id,
          name: statusTarget.name,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (data && !data.error) {
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmOpen(false);
      setStatusTarget(null);
    }
  };

  const filteredTemplates = templates.filter((temp) => {
    const matchesSearch = temp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || temp.template_type === typeFilter;
    const matchesStatus = !statusFilter || temp.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <PageHeader 
        title="Canva-Style 9:16 Template Manager"
        description="Design 9:16 Reel layouts visually, position dynamic shop placeholders & gold/silver badges, and manage Cloudflare R2 icon assets."
        action={
          <div className="flex items-center space-x-3">
            <Button onClick={() => openVisualEditor()} className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span>Launch 9:16 Canvas Editor</span>
            </Button>
          </div>
        }
      />

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-8 text-sm font-bold">
        <button 
          onClick={() => setActiveTab("roster")}
          className={`pb-3 transition-all ${activeTab === "roster" ? "text-accent border-b-2 border-accent" : "text-slate-500 hover:text-slate-800"}`}
        >
          Template Roster ({templates.length})
        </button>
        <button 
          onClick={() => openVisualEditor()}
          className={`pb-3 transition-all ${activeTab === "editor" ? "text-accent border-b-2 border-accent" : "text-slate-500 hover:text-slate-800"}`}
        >
          Visual 9:16 Canvas Editor
        </button>
        <button 
          onClick={() => setActiveTab("icons")}
          className={`pb-3 transition-all ${activeTab === "icons" ? "text-accent border-b-2 border-accent" : "text-slate-500 hover:text-slate-800"}`}
        >
          Cloudflare R2 Template Icons ({icons.length})
        </button>
      </div>

      {/* TAB 1: TEMPLATE ROSTER */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          {/* KPI stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Layouts</p>
              <p className="text-2xl font-bold mt-2 text-primary">{templates.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Templates</p>
              <p className="text-2xl font-bold mt-2 text-green-600">
                {templates.filter(t => t.status === "active").length}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">R2 Icon Assets</p>
              <p className="text-2xl font-bold mt-2 text-purple-600">{icons.length} Icons</p>
            </div>
          </div>

          {/* Filters toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search template name..." />
            <div className="flex gap-3">
              <div className="w-40">
                <Select 
                  value={typeFilter} 
                  onChange={(e) => setTypeFilter(e.target.value)}
                  options={[
                    { label: "Type: All", value: "" },
                    { label: "Luxury", value: "luxury" },
                    { label: "Festival", value: "festival" },
                    { label: "Offer", value: "offer" },
                    { label: "Minimal", value: "minimal" },
                    { label: "Premium", value: "premium" }
                  ]} 
                />
              </div>
              <div className="w-40">
                <Select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { label: "Status: All", value: "" },
                    { label: "Active", value: "active" },
                    { label: "Archived", value: "archived" }
                  ]} 
                />
              </div>
            </div>
          </div>

          {/* Tables list */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <Table headers={["Layout Name", "Template Style", "Slots Count", "Version Tag", "Status", "Created Date", "Actions"]}>
              {filteredTemplates.map((temp) => (
                <tr key={temp.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-50 text-accent rounded-lg border border-yellow-100">
                        <LayoutTemplate className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-primary">{temp.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 capitalize font-semibold text-slate-700">{temp.template_type}</td>
                  <td className="py-4 px-6 font-semibold text-slate-650">{temp.placeholder_count || 3} Slots</td>
                  <td className="py-4 px-6 font-mono text-xs text-slate-500">v{temp.version}</td>
                  <td className="py-4 px-6">
                    <StatusBadge status={temp.status} />
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    {new Date(temp.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 space-x-2">
                    <button 
                      onClick={() => openVisualEditor(temp)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center space-x-1 inline-flex"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Edit Layout</span>
                    </button>
                    <button 
                      onClick={() => handleDuplicateTemplate(temp)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 inline-flex"
                      title="Duplicate Template"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                    <button 
                      onClick={() => { setStatusTarget(temp); setConfirmOpen(true); }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors inline-flex ${
                        temp.status === "active"
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                      }`}
                      title="Toggle Active / Inactive"
                    >
                      {temp.status === "active" ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}

      {/* TAB 2: VISUAL 9:16 CANVAS EDITOR */}
      {activeTab === "editor" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-6 gap-4">
            <Input 
              label="Template Name" 
              value={templateName} 
              onChange={(e) => setTemplateName(e.target.value)} 
            />
            <Select 
              label="Template Style" 
              value={templateType} 
              onChange={(e) => setTemplateType(e.target.value)}
              options={[
                { label: "Luxury", value: "luxury" },
                { label: "Festival", value: "festival" },
                { label: "Offer", value: "offer" },
                { label: "Minimal", value: "minimal" },
                { label: "Premium", value: "premium" }
              ]}
            />
            <Select 
              label="Status" 
              value={templateStatus} 
              onChange={(e) => setTemplateStatus(e.target.value)}
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "archived" }
              ]}
            />
            <Select 
              label="Price Slots Count" 
              value={placeholderCount.toString()} 
              onChange={(e) => setPlaceholderCount(parseInt(e.target.value, 10))}
              options={[
                { label: "2 Slots", value: "2" },
                { label: "3 Slots", value: "3" },
                { label: "4 Slots", value: "4" }
              ]}
            />
            <Select 
              label="Linked Occasion (Optional)" 
              value={occasionId} 
              onChange={(e) => setOccasionId(e.target.value)}
              options={[
                { label: "None (Regular Template)", value: "" },
                ...occasions.map(o => ({ label: o.name, value: o.id }))
              ]}
            />
            <Input 
              label="Preview Video Background (for Editor)" 
              placeholder="/api/media/videos/NC-0001.mp4" 
              value={bgImageUrl} 
              onChange={(e) => setBgImageUrl(e.target.value)} 
            />
            <div className="flex flex-col space-y-1 col-span-1 md:col-span-6 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Restricted/Allowed Shops (Leave empty for public templates)</label>
              <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto pt-1">
                {shops.map((shop) => {
                  const isChecked = allowedShopIds.includes(shop.id);
                  return (
                    <label key={shop.id} className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      isChecked ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllowedShopIds([...allowedShopIds, shop.id]);
                          } else {
                            setAllowedShopIds(allowedShopIds.filter(id => id !== shop.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>{shop.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <CanvaTemplateEditor 
            initialConfig={editorConfig}
            bgImageUrl={bgImageUrl}
            onSaveConfig={handleSaveEditorConfig}
            templateId={activeTemplate?.id}
          />
        </div>
      )}

      {/* TAB 3: CLOUDFLARE R2 TEMPLATE ICONS MANAGER */}
      {activeTab === "icons" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-base text-primary">Cloudflare R2 Template Icons Library</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Upload PNG, SVG, or WEBP icon overlays to <strong className="font-mono text-purple-600">template-icons/</strong> in Cloudflare R2.</p>
            </div>
            <label className="cursor-pointer bg-accent hover:bg-yellow-400 text-primary px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>{uploadingIcon ? "Uploading..." : "Upload New Icon Asset"}</span>
              <input type="file" accept="image/*" multiple onChange={handleIconFileUpload} className="hidden" disabled={uploadingIcon} />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {icons.length === 0 ? (
              <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs font-semibold">
                No template icons found in Cloudflare R2. Click "Upload New Icon Asset" to add PNG / SVG / WEBP icons.
              </div>
            ) : (
              icons.map((ic) => (
                <div key={ic.key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between space-y-3 group hover:border-accent transition-colors">
                  <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                    <img src={ic.url} alt="Icon" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-center w-full">
                    <p className="text-[11px] font-bold text-slate-700 truncate">{ic.key.replace("template-icons/", "")}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(ic.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteIcon(ic.key)}
                    className="text-red-500 hover:text-red-700 text-[10px] font-semibold flex items-center space-x-1 p-1 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Confirmation box */}
      <ConfirmationDialog 
        isOpen={confirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleToggleStatus} 
        title="Confirm Status Alteration" 
        message="Are you sure you want to change this template status? Archived templates will remain in past assignments but cannot be selected for future scheduling tasks."
        confirmText="Toggle Status" 
      />
    </div>
  );
}
