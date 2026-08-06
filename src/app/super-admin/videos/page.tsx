"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  Select, 
  Modal, 
  SearchBar, 
  StatusBadge, 
  LoadingSpinner 
} from "@/components/ui/reusable";
import { Film, Upload, Eye, Trash2, RefreshCw } from "lucide-react";

const CATEGORY_OPTIONS = [
  { label: "Necklace (NC)", value: "Necklace" },
  { label: "Bracelets/Bangles (BG)", value: "Bracelets/Bangles" },
  { label: "Rings (RG)", value: "Rings" },
  { label: "Earrings (ER)", value: "Earrings" },
  { label: "Ankle Chains (AC)", value: "Ankle Chains" },
  { label: "Chains (CH)", value: "Chains" }
];

export default function VideoLibraryPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  
  // Master lists for metadata options
  const [occasions, setOccasions] = useState<any[]>([]);

  // Filter conditions
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [occasionFilter, setOccasionFilter] = useState("");

  // Wizard modal control
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("Necklace");
  const [generatedCode, setGeneratedCode] = useState("NC-0001");
  const [wizardPayload, setWizardPayload] = useState<any>({
    title: "",
    category: "Necklace",
    occasion_ids: [],
    cloudflare_url: "",
    is_lite_weight: false
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Detail/Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<any>(null);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/videos");
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const resO = await fetch("/api/master-data?type=occasions");
      setOccasions(await resO.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchMetadata();
  }, []);

  const handleSyncR2 = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_r2" })
      });
      const data = await res.json();
      if (data.purgedCount > 0) {
        alert(`Storage Sync Complete: Removed ${data.purgedCount} orphaned database record(s) missing from Cloudflare R2.`);
      } else {
        alert("Storage Sync Complete: All database records match active files in Cloudflare R2.");
      }
      fetchVideos();
    } catch (err) {
      console.error("R2 sync error:", err);
      alert("Failed to sync storage with Cloudflare R2.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteVideo = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This will permanently delete the file from Cloudflare R2 storage and Supabase.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/videos?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.error) {
        alert(`Failed to delete: ${data.error}`);
      } else {
        fetchVideos();
      }
    } catch (err) {
      alert("Failed to delete video asset.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleVideoStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/videos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentStatus })
      });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to update status: ${data.error}`);
      } else {
        fetchVideos();
      }
    } catch (err) {
      alert("Failed to update video status.");
    }
  };

  const handleCategorySelect = async (cat: string) => {
    setSelectedCategory(cat);
    setWizardPayload((prev: any) => ({ ...prev, category: cat }));

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_code", category: cat })
      });
      const data = await res.json();
      if (data.videoCode) {
        setGeneratedCode(data.videoCode);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setWizardError(null);

    // Enforce 50 MB max limit check before uploading
    if (file.size > 50 * 1024 * 1024) {
      setWizardError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum 50 MB limit.`);
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    let finalUrl = "";
    try {
      // 1. Get presigned upload URL
      const presignedRes = await fetch("/api/upload/r2-presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
          prefix: generatedCode
        })
      });
      const presignedData = await presignedRes.json();
      if (presignedData.error) throw new Error(presignedData.error);

      const { url: uploadUrl, publicUrl } = presignedData;

      // 2. PUT the file directly to R2 bucket via presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error(`Direct R2 upload failed with status: ${uploadRes.status}`);
      }

      setUploadProgress(100);
      finalUrl = publicUrl;
      const titleWithoutExt = file.name.split(".")[0];
      setWizardPayload((prev: any) => ({
        ...prev,
        title: `[${generatedCode}] ${titleWithoutExt}`,
        cloudflare_url: finalUrl
      }));
      setWizardStep(2);
    } catch (err: any) {
      console.error("R2 chunked upload error:", err);
      setWizardError(err.message || "Failed to upload video to Cloudflare R2 storage.");
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const saveWizardVideo = async () => {
    setLoading(true);
    setWizardError(null);

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_metadata",
          ...wizardPayload
        })
      });
      const data = await res.json();

      if (data.error) {
        setWizardError(data.error);
      } else {
        setWizardOpen(false);
        setWizardStep(1);
        setWizardPayload({ title: "", category: "Necklace", occasion_ids: [], cloudflare_url: "", is_lite_weight: false });
        fetchVideos();
      }
    } catch (err) {
      setWizardError("Failed to save video configuration.");
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = videos.filter((vid) => {
    const matchesSearch = vid.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || vid.category === categoryFilter;
    const matchesOccasion = !occasionFilter || vid.occasion_tags?.includes(occasionFilter);

    return matchesSearch && matchesCategory && matchesOccasion;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
        title="Branded Video Library"
        description="Manage promotional video assets categorized into Necklace (NC), Bracelets/Bangles (BG), Rings (RG), Earrings (ER), Ankle Chains (AC), and Chains (CH) - Max 50 MB per video."
        action={
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={handleSyncR2} 
              disabled={syncing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-accent" : ""}`} />
              <span>{syncing ? "Syncing..." : "Sync R2 Storage"}</span>
            </Button>
            <Button onClick={() => { handleCategorySelect("Necklace"); setWizardStep(1); setWizardOpen(true); }} className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Upload New Video</span>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Video Assets</p>
          <p className="text-2xl font-bold mt-2 text-primary">{videos.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Asset Capacity</p>
          <p className="text-2xl font-bold mt-2 text-blue-600">5,000 Unique Codes</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max File Limit</p>
          <p className="text-2xl font-bold mt-2 text-accent">50 MB per Video</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-border">
        <div className="md:col-span-2">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search title or video code (e.g. NC-0001)..." />
        </div>
        <Select 
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { label: "Category: All", value: "" },
            ...CATEGORY_OPTIONS
          ]}
        />
        <Select 
          value={occasionFilter} 
          onChange={(e) => setOccasionFilter(e.target.value)}
          options={[
            { label: "Occasion: All", value: "" },
            ...occasions.map(o => ({ label: o.name, value: o.id }))
          ]}
        />
      </div>

      {/* Video Inventory Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <Table headers={["Asset Code & Title", "Category", "Target Occasions", "Status", "Usage Renders", "Actions"]}>
          {filteredVideos.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-500 text-xs font-semibold">
                No video assets found. Click "Upload New Video" to import footage into Cloudflare R2.
              </td>
            </tr>
          ) : (
            filteredVideos.map((video) => (
              <tr key={video.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-xs">
                      <Film className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="font-semibold text-primary">{video.title}</div>
                      <div className="text-xs text-muted-foreground">Uploaded: {new Date(video.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-md text-xs font-bold block w-fit">
                    {video.category}
                  </span>
                  {video.is_lite_weight && (
                    <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold mt-1 block w-fit">
                      Lite Weight
                    </span>
                  )}
                </td>
                <td className="py-4 px-6 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {video.occasion_tags && video.occasion_tags.length > 0 ? (
                      video.occasion_tags.map((oid: string) => {
                        const matchedOcc = occasions.find(o => o.id === oid);
                        return (
                          <span key={oid} className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                            {matchedOcc ? matchedOcc.name : oid}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">All Occasions</span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <StatusBadge status={video.is_active ? "active" : "inactive"} />
                </td>
                <td className="py-4 px-6 font-bold text-slate-700">{video.usage_count || 0} times</td>
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleToggleVideoStatus(video.id, video.is_active)}
                      className={`p-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1 ${
                        video.is_active
                          ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      }`}
                      title="Toggle Active / Inactive"
                    >
                      {video.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button 
                      onClick={() => { setPreviewVideo(video); setPreviewOpen(true); }}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-semibold flex items-center space-x-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteVideo(video.id, video.title)}
                      disabled={deletingId === video.id}
                      className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-700 text-xs font-semibold flex items-center space-x-1"
                      title="Delete video asset permanently from Cloudflare R2 and Supabase"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{deletingId === video.id ? "Deleting..." : "Delete"}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      {/* Multi-step Upload Wizard Modal */}
      <Modal isOpen={wizardOpen} onClose={() => setWizardOpen(false)} title={`Upload Footage Wizard (Step ${wizardStep} of 3)`}>
        <div className="space-y-6">
          {wizardError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium">
              {wizardError}
            </div>
          )}

          {/* Step 1: Category & File Selection */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <Select 
                label="Select Jewellery Category" 
                required 
                value={selectedCategory} 
                onChange={(e) => handleCategorySelect(e.target.value)}
                options={CATEGORY_OPTIONS}
              />

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-800">Auto-Generated Unique Video Code:</span>
                <span className="font-extrabold text-accent text-sm font-mono">{generatedCode}</span>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-48">
                <Upload className="w-8 h-8 text-slate-400 mb-3" />
                <p className="text-sm font-semibold text-primary">Upload Promotional Video (.MP4 / .MOV)</p>
                <p className="text-xs text-muted-foreground mt-1">Uploaded to Cloudflare R2 as <strong className="font-mono">{generatedCode}.mp4</strong> (Max 50 MB)</p>
                <input 
                  type="file" 
                  accept="video/mp4,video/quicktime,video/webm" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  id="video-file-input" 
                  disabled={uploadingFile}
                />
                <label 
                  htmlFor="video-file-input" 
                  className="mt-4 bg-accent hover:bg-yellow-400 text-primary px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow"
                >
                  {uploadingFile ? `Uploading to Cloudflare R2 (${uploadProgress}%)...` : "Select Video File"}
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Assign Details & Metadata */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <Input 
                label="Asset Name / Title" 
                required 
                value={wizardPayload.title} 
                onChange={(e) => setWizardPayload({ ...wizardPayload, title: e.target.value })} 
              />

              {/* Target Occasions checklist */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Target Occasions (Optional)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-150 p-3 rounded-xl bg-slate-50">
                  {occasions.map(o => (
                    <label key={o.id} className="flex items-center space-x-2 text-xs text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={wizardPayload.occasion_ids.includes(o.id)}
                        onChange={(e) => {
                          const occasion_ids = e.target.checked 
                            ? [...wizardPayload.occasion_ids, o.id]
                            : wizardPayload.occasion_ids.filter((id: string) => id !== o.id);
                          setWizardPayload({ ...wizardPayload, occasion_ids });
                        }}
                      />
                      <span>{o.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Lite Weight Toggle */}
              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
                <input 
                  type="checkbox" 
                  id="wizard-lite-weight"
                  checked={wizardPayload.is_lite_weight || false}
                  onChange={(e) => setWizardPayload({ ...wizardPayload, is_lite_weight: e.target.checked })}
                  className="w-4 h-4 text-accent rounded"
                />
                <label htmlFor="wizard-lite-weight" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Mark as Lite Weight Video (assigned to Kerala shops)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setWizardStep(1)}>Back</Button>
                <Button onClick={() => setWizardStep(3)}>Review Asset</Button>
              </div>
            </div>
          )}

          {/* Step 3: Final review & save */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2 border border-slate-100 p-4 rounded-xl bg-slate-50 text-sm">
                <div>
                  <span className="font-semibold text-slate-500 mr-2">Video Code:</span>
                  <span className="font-mono font-bold text-accent">{generatedCode}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-2">Asset Title:</span>
                  <span className="font-bold text-primary">{wizardPayload.title}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-2">Category:</span>
                  <span className="font-semibold text-slate-700">{wizardPayload.category}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-2">Type / Class:</span>
                  <span className="font-semibold text-slate-700">{wizardPayload.is_lite_weight ? "Lite Weight Video" : "Standard Video"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-2">Cloudflare R2 URL:</span>
                  <span className="font-mono text-xs break-all text-slate-600 block mt-1">{wizardPayload.cloudflare_url}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setWizardStep(2)}>Back</Button>
                <Button onClick={saveWizardVideo}>Save Asset to Supabase</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Video Preview Modal */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Video Asset Details">
        {previewVideo && (
          <div className="space-y-6">
            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center text-slate-400">
              <video 
                src={previewVideo.cloudflare_url} 
                controls 
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-3 text-sm border-t border-slate-100 pt-4">
              <div>
                <span className="font-semibold text-slate-500 mr-2">Video Title:</span>
                <span className="font-bold text-primary">{previewVideo.title}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 mr-2">Category:</span>
                <span className="font-semibold text-slate-700">{previewVideo.category}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 mr-2">Type / Class:</span>
                <span className="font-semibold text-slate-700">{previewVideo.is_lite_weight ? "Lite Weight Video" : "Standard Video"}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 mr-2">Storage URL:</span>
                <span className="font-mono text-xs break-all text-slate-600 block mt-1">{previewVideo.cloudflare_url}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 space-x-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setPreviewOpen(false);
                  handleDeleteVideo(previewVideo.id, previewVideo.title);
                }}
                className="text-red-600 border-red-200 hover:bg-red-50 flex items-center space-x-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Video Asset</span>
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close View</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
