"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  Button, 
  Table, 
  Input, 
  LoadingSpinner 
} from "@/components/ui/reusable";
import { Music, Upload, Trash2, Play, Pause, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function MusicLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<any[]>([]);

  // Audio Playback Preview State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  // Multi-File Upload States
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTracks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/music");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTracks(data);
      }
    } catch (err) {
      console.error("Failed to load music tracks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    return () => {
      if (audioObj) {
        audioObj.pause();
      }
    };
  }, []);

  const handlePlayPause = (track: any) => {
    if (playingTrackId === track.id) {
      if (audioObj) {
        audioObj.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioObj) {
        audioObj.pause();
      }

      const audio = new Audio(track.cloudflare_url);
      audio.play();
      audio.onended = () => setPlayingTrackId(null);

      setAudioObj(audio);
      setPlayingTrackId(track.id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleUploadTracks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const cleanTitle = file.name.includes(".") ? file.name.substring(0, file.name.lastIndexOf(".")) : file.name;

        setUploadProgressMsg(`Uploading ${i + 1} of ${selectedFiles.length}: ${file.name}...`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", cleanTitle);

        const res = await fetch("/api/music", {
          method: "POST",
          body: formData
        });
        const data = await res.json();

        if (data.error) {
          throw new Error(`Failed to upload ${file.name}: ${data.error}`);
        }
      }

      setSelectedFiles([]);
      setUploadProgressMsg("");
      fetchTracks();
      alert(`Successfully uploaded all ${selectedFiles.length} audio tracks to Cloudflare R2!`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload one or more audio tracks.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!confirm("Are you sure you want to delete this audio track from Cloudflare R2?")) return;

    try {
      const res = await fetch(`/api/music?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchTracks();
      }
    } catch (err) {
      alert("Failed to delete audio track.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="Background Music Library"
        description="Upload and manage copyright-free background music tracks. The rendering engine will automatically overlay a random track onto silent video schedules."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Form Block */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4 h-fit">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Upload className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Batch Upload Audio</h3>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {uploadProgressMsg && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-xl text-xs font-semibold">
              {uploadProgressMsg}
            </div>
          )}

          <form onSubmit={handleUploadTracks} className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-650 block mb-1">Select Audio Files (MP3 / WAV)</label>
              <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors">
                <Music className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-[11px] text-slate-650 font-bold">
                  {selectedFiles.length > 0 ? `${selectedFiles.length} Files Selected` : "Select Multiple Files"}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">Multi-file selection enabled</span>
                <input type="file" accept="audio/*" multiple onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5 border border-slate-200">
                <p className="font-bold text-[10px] uppercase text-slate-500">Files to Upload:</p>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] text-slate-700 font-medium">
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <span className="text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" className="w-full flex items-center justify-center space-x-1.5" disabled={uploading || selectedFiles.length === 0}>
              <Upload className="w-4 h-4" />
              <span>{uploading ? "Uploading Batch..." : `Upload ${selectedFiles.length} Tracks`}</span>
            </Button>
          </form>
        </div>

        {/* Tracks List Block */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Copyright-Free Tracks Pool</h3>
            <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              <span>Safety Verified</span>
            </span>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : tracks.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-12">
              No audio tracks uploaded yet. Use the upload panel to add copyright-free background music.
            </div>
          ) : (
            <Table headers={["Preview & Actions", "Track Title", "File Details", "Uploaded At"]}>
              {tracks.map((track) => {
                const isPlaying = playingTrackId === track.id;

                return (
                  <tr key={track.id} className="hover:bg-slate-55/50">
                    <td className="py-4 px-6 flex items-center space-x-3">
                      <button
                        onClick={() => handlePlayPause(track)}
                        className={`p-2 rounded-full border shadow transition-all ${
                          isPlaying 
                            ? "bg-accent border-accent text-primary" 
                            : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100"
                        }`}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteTrack(track.id)}
                        className="p-2 rounded-full border border-red-100 bg-red-50 text-red-650 hover:bg-red-100 shadow transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="py-4 px-6 font-semibold text-primary">{track.title}</td>
                    <td className="py-4 px-6 font-mono text-[10px] text-slate-500">
                      <div>{track.file_name}</div>
                      <div className="text-slate-400">{(track.file_size / 1024 / 1024).toFixed(2)} MB</div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {new Date(track.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
