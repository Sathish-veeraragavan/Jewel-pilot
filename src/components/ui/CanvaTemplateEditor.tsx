"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Type, 
  Image as ImageIcon, 
  Coins, 
  Calendar, 
  Building, 
  Phone, 
  MapPin, 
  Plus, 
  Trash2, 
  Move, 
  Layers, 
  Palette, 
  Save, 
  Eye, 
  Sparkles,
  Upload,
  RefreshCw
} from "lucide-react";
import { Button, Input, Select, Modal, LoadingSpinner } from "./reusable";

export interface CanvasElement {
  id: string;
  name: string;
  type: "shop_logo" | "shop_name" | "shop_phone" | "shop_address" | "rate_24k" | "rate_22k" | "rate_silver" | "occasion_text" | "custom_text" | "icon_image" |
        "placeholder_1_title" | "placeholder_1_price" | "placeholder_2_title" | "placeholder_2_price" | "placeholder_3_title" | "placeholder_3_price" | "placeholder_4_title" | "placeholder_4_price" | "date" | "todays_rate_header";
  placeholder: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  w: number; // percentage 0-100
  h: number; // percentage 0-100
  fontSize?: number;
  color?: string;
  bgColor?: string;
  opacity?: number; // 0-100
  borderWidth?: number; // px
  borderColor?: string; // hex
  borderRadius?: number;
  iconUrl?: string;
  zIndex?: number;
  align?: "left" | "center" | "right";
  visible?: boolean;
  fontFamily?: string;
  flipH?: boolean;
  rotateDeg?: number; // 0, 90, 180, 270
  animationType?: "fade" | "slide_left" | "slide_right" | "slide_up" | "slide_down" | "zoom_in" | "zoom_out" | "gold_sparkle" | "block" | "bounce" | "bangle_roll" | "glow_sweep";
  animationGroup?: string;
}

// Helper functions for background color transparency handling
function hexToRgba(hex: string, alphaPercent: number) {
  if (!hex || hex === "transparent") hex = "#000000";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = (alphaPercent / 100).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getHexAndAlpha(colorStr: string) {
  if (!colorStr || colorStr === "transparent") {
    return { hex: "#000000", alpha: 0 };
  }
  const match = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    const a = match[4] !== undefined ? Math.round(parseFloat(match[4]) * 100) : 100;
    return { hex: `#${r}${g}${b}`, alpha: a };
  }
  if (colorStr.startsWith("#")) {
    if (colorStr.length === 9) {
      return {
        hex: colorStr.slice(0, 7),
        alpha: Math.round((parseInt(colorStr.slice(7, 9), 16) / 255) * 100)
      };
    }
    return { hex: colorStr, alpha: 100 };
  }
  return { hex: colorStr, alpha: 100 };
}

function getPlaceholderPreviewText(placeholder: string): string {
  if (!placeholder) return "";
  if (placeholder.includes("placeholder_1_title")) return "Gold 22K";
  if (placeholder.includes("placeholder_1_price")) return "₹7,200";
  if (placeholder.includes("placeholder_2_title")) return "Gold 24K";
  if (placeholder.includes("placeholder_2_price")) return "₹7,850";
  if (placeholder.includes("placeholder_3_title")) return "Silver 1G";
  if (placeholder.includes("placeholder_3_price")) return "₹100";
  if (placeholder.includes("placeholder_4_title")) return "Gold 18K";
  if (placeholder.includes("placeholder_4_price")) return "₹5,900";
  
  if (placeholder.includes("rate_22k")) return "₹7,200";
  if (placeholder.includes("rate_24k")) return "₹7,850";
  if (placeholder.includes("rate_silver")) return "₹100";
  if (placeholder.includes("rate_change_text")) return "+₹150";
  if (placeholder.includes("occasion_text")) return "Happy Diwali";
  if (placeholder.includes("todays_rate_header")) return "◆  TODAY'S GOLD RATE  ◆";
  if (placeholder.includes("date") || placeholder.includes("current_date")) return "28 - JULY - 2026";
  
  return placeholder;
}

interface CanvaTemplateEditorProps {
  initialConfig?: any;
  bgImageUrl?: string;
  onSaveConfig: (config: any, closeEditor?: boolean) => Promise<any>;
  templateId?: string;
}

export default function CanvaTemplateEditor({
  initialConfig,
  bgImageUrl,
  onSaveConfig,
  templateId,
}: CanvaTemplateEditorProps) {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"branding" | "rates" | "occasions" | "icons">("branding");
  
  // Icon library state
  const [icons, setIcons] = useState<{ key: string; url: string; name?: string }[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);

  // Render Test Video flow states
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [renderStatus, setRenderStatus] = useState<"idle" | "saving" | "triggering" | "rendering" | "completed" | "failed">("idle");
  const [currentJobId, setCurrentJobId] = useState("");
  const [renderLogs, setRenderLogs] = useState<any[]>([]);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState("");
  const [renderError, setRenderError] = useState("");
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Load shops and product videos when test modal opens
  useEffect(() => {
    if (!testModalOpen) return;
    
    const fetchModalData = async () => {
      setLoadingModalData(true);
      try {
        const [shopsRes, videosRes] = await Promise.all([
          fetch("/api/shops"),
          fetch("/api/videos")
        ]);
        const shopsData = await shopsRes.json();
        const videosData = await videosRes.json();
        
        setShops(Array.isArray(shopsData) ? shopsData : []);
        setVideos(Array.isArray(videosData) ? videosData : []);
        
        if (Array.isArray(shopsData) && shopsData.length > 0) {
          setSelectedShopId(shopsData[0].id);
        }
        if (Array.isArray(videosData) && videosData.length > 0) {
          setSelectedVideoId(videosData[0].id);
        }
      } catch (err) {
        console.error("Failed to load test preview selector data", err);
      } finally {
        setLoadingModalData(false);
      }
    };
    
    fetchModalData();
  }, [testModalOpen]);

  // Poll render status & logs from VPS worker
  useEffect(() => {
    if (renderStatus !== "rendering" || !currentJobId) return;

    let intervalId = setInterval(async () => {
      try {
        const statusRes = await fetch("/api/renders");
        const jobs = await statusRes.json();
        if (Array.isArray(jobs)) {
          const currentJob = jobs.find(j => j.id === currentJobId);
          if (currentJob) {
            if (currentJob.status === "Completed") {
              setRenderedVideoUrl(currentJob.rendered_video_url);
              setRenderStatus("completed");
              clearInterval(intervalId);
            } else if (currentJob.status === "Failed") {
              setRenderError(currentJob.error_message || "VPS rendering failed.");
              setRenderStatus("failed");
              clearInterval(intervalId);
            }
          }
        }

        const logsRes = await fetch(`/api/renders?type=logs&job_id=${currentJobId}`);
        const logs = await logsRes.json();
        if (Array.isArray(logs)) {
          setRenderLogs(logs);
        }
      } catch (err) {
        console.error("Error polling render status:", err);
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [renderStatus, currentJobId]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Parse initialConfig if provided
  useEffect(() => {
    if (initialConfig?.elements && Array.isArray(initialConfig.elements)) {
      // Map database percentage fields (x_pct, y_pct, etc.) back to local state (x, y, etc.)
      const parsedElements = initialConfig.elements.map((el: any) => ({
        id: el.id,
        name: el.name || el.type,
        type: el.type,
        placeholder: el.placeholder,
        x: el.x_pct ?? el.x ?? 10,
        y: el.y_pct ?? el.y ?? 10,
        w: el.w_pct ?? el.w ?? 20,
        h: el.h_pct ?? el.h ?? 8,
        fontSize: el.font_size ?? el.fontSize ?? 18,
        color: el.color || "#FFFFFF",
        bgColor: el.bg_color ?? el.bgColor ?? "transparent",
        borderRadius: el.border_radius ?? el.borderRadius ?? 0,
        iconUrl: el.icon_url ?? el.iconUrl,
        align: el.align || "center",
        zIndex: el.z_index ?? el.zIndex ?? 1,
        visible: el.visible !== false,
        opacity: el.opacity ?? 100,
        borderWidth: el.border_width ?? el.borderWidth ?? 0,
        borderColor: el.border_color ?? el.borderColor ?? "#FFFFFF",
        fontFamily: el.font_family ?? el.fontFamily ?? "Outfit-Bold",
        flipH: el.flip_h ?? el.flipH ?? false,
        rotateDeg: el.rotate_deg ?? el.rotateDeg ?? 0,
        animationType: el.animation_type ?? el.animationType ?? "fade",
        animationGroup: el.animation_group ?? el.animationGroup ?? "none"
      }));
      setElements(parsedElements);
    } else if (initialConfig) {
      // Convert legacy box format if present
      const legacyElements: CanvasElement[] = [];
      if (initialConfig.logo_box?.visible !== false) {
        legacyElements.push({
          id: "elem_logo",
          name: "Shop Logo",
          type: "shop_logo",
          placeholder: "{{shop_logo}}",
          x: ((initialConfig.logo_box?.x || 440) / 1080) * 100,
          y: ((initialConfig.logo_box?.y || 150) / 1920) * 100,
          w: 20,
          h: 12,
          zIndex: 5
        });
      }
      if (initialConfig.shop_name_box?.visible !== false) {
        legacyElements.push({
          id: "elem_name",
          name: "Shop Name",
          type: "shop_name",
          placeholder: "{{shop_name}}",
          x: 10,
          y: ((initialConfig.shop_name_box?.y || 400) / 1920) * 100,
          w: 80,
          h: 6,
          fontSize: 24,
          color: initialConfig.shop_name_box?.color || "#FFFFFF",
          align: "center",
          zIndex: 4
        });
      }
      if (initialConfig.gold_box?.visible !== false) {
        legacyElements.push({
          id: "elem_rate_24k",
          name: "24K Gold Rate Badge",
          type: "rate_24k",
          placeholder: "24K Gold: {{rate_24k}}",
          x: 10,
          y: ((initialConfig.gold_box?.y || 1400) / 1920) * 100,
          w: 80,
          h: 8,
          fontSize: 20,
          color: "#D4AF37",
          bgColor: "rgba(15, 23, 42, 0.85)",
          borderRadius: 12,
          align: "center",
          zIndex: 6
        });
      }
      setElements(legacyElements);
    } else {
      // Default initial layout elements
      setElements([
        {
          id: "elem_logo",
          name: "Shop Logo",
          type: "shop_logo",
          placeholder: "{{shop_logo}}",
          x: 40,
          y: 6,
          w: 20,
          h: 11,
          zIndex: 5
        },
        {
          id: "elem_name",
          name: "Shop Name",
          type: "shop_name",
          placeholder: "{{shop_name}}",
          x: 10,
          y: 20,
          w: 80,
          h: 6,
          fontSize: 24,
          color: "#FFFFFF",
          align: "center",
          zIndex: 4
        },
        {
          id: "elem_rate_24k_label",
          name: "24K Gold Label",
          type: "custom_text",
          placeholder: "24K Gold",
          x: 10,
          y: 70,
          w: 80,
          h: 4,
          fontSize: 16,
          color: "#D4AF37",
          align: "center",
          zIndex: 6
        },
        {
          id: "elem_rate_24k",
          name: "24K Gold Price",
          type: "rate_24k",
          placeholder: "₹{{rate_24k}}",
          x: 10,
          y: 74,
          w: 80,
          h: 6,
          fontSize: 22,
          color: "#FFFFFF",
          align: "center",
          zIndex: 7
        },
        {
          id: "elem_rate_22k_label",
          name: "22K Gold Label",
          type: "custom_text",
          placeholder: "22K Gold",
          x: 10,
          y: 80,
          w: 80,
          h: 4,
          fontSize: 16,
          color: "#FACC15",
          align: "center",
          zIndex: 8
        },
        {
          id: "elem_rate_22k",
          name: "22K Gold Price",
          type: "rate_22k",
          placeholder: "₹{{rate_22k}}",
          x: 10,
          y: 84,
          w: 80,
          h: 6,
          fontSize: 22,
          color: "#FFFFFF",
          align: "center",
          zIndex: 9
        }
      ]);
    }
  }, [initialConfig]);

  // Fetch icon assets from R2
  const fetchIcons = async () => {
    setLoadingIcons(true);
    try {
      const res = await fetch("/api/template-icons");
      const data = await res.json();
      if (Array.isArray(data)) {
        setIcons(data);
      }
    } catch (err) {
      console.error("Failed to load icons:", err);
    } finally {
      setLoadingIcons(false);
    }
  };

  useEffect(() => {
    fetchIcons();
  }, []);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);

      const res = await fetch("/api/template-icons", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.url) {
        fetchIcons();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingIcon(false);
    }
  };

  const addElement = (preset: Partial<CanvasElement>) => {
    const newElem: CanvasElement = {
      id: `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: preset.name || "New Element",
      type: preset.type || "custom_text",
      placeholder: preset.placeholder || "Text Element",
      x: preset.x ?? 20,
      y: preset.y ?? 40,
      w: preset.w ?? 60,
      h: preset.h ?? 8,
      fontSize: preset.fontSize ?? 50,
      color: preset.color ?? "#FFFFFF",
      bgColor: preset.bgColor ?? "transparent",
      borderRadius: preset.borderRadius ?? 0,
      iconUrl: preset.iconUrl,
      align: preset.align ?? "center",
      zIndex: elements.length + 1,
      visible: true,
      opacity: preset.opacity ?? 100,
      borderWidth: preset.borderWidth ?? 0,
      borderColor: preset.borderColor ?? "#FFFFFF",
      fontFamily: preset.fontFamily ?? "Outfit-Bold"
    };

    setElements(prev => [...prev, newElem]);
    setSelectedId(newElem.id);
  };

  const addRichFrameWidget = (frameKey: string, frameUrl: string, slotCount: 3 | 4) => {
    // 1. Add background frame
    addElement({
      name: `${frameKey.replace(/_/g, " ")} Background`,
      type: "icon_image",
      iconUrl: `/api/media/${frameUrl}`,
      x: 5, y: 65, w: 90, h: 24,
      zIndex: 2
    });

    // 2. Add Slot titles & prices
    if (slotCount === 3) {
      // Slot 1 (Column 1)
      addElement({
        name: "Slot 1 Title",
        type: "custom_text",
        placeholder: "{{placeholder_1_title}}",
        fontSize: 34, color: "#FFFFFF",
        x: 10, y: 69, w: 24, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 1 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_1_price}}",
        fontSize: 48, color: "#FACC15",
        x: 10, y: 75, w: 24, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });

      // Slot 2 (Column 2)
      addElement({
        name: "Slot 2 Title",
        type: "custom_text",
        placeholder: "{{placeholder_2_title}}",
        fontSize: 34, color: "#FFFFFF",
        x: 38, y: 69, w: 24, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 2 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_2_price}}",
        fontSize: 48, color: "#FACC15",
        x: 38, y: 75, w: 24, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });

      // Slot 3 (Column 3)
      addElement({
        name: "Slot 3 Title",
        type: "custom_text",
        placeholder: "{{placeholder_3_title}}",
        fontSize: 34, color: "#FFFFFF",
        x: 66, y: 69, w: 24, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 3 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_3_price}}",
        fontSize: 48, color: "#FACC15",
        x: 66, y: 75, w: 24, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
    } else {
      // Slot 1 (Column 1)
      addElement({
        name: "Slot 1 Title",
        type: "custom_text",
        placeholder: "{{placeholder_1_title}}",
        fontSize: 28, color: "#FFFFFF",
        x: 9, y: 69, w: 18, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 1 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_1_price}}",
        fontSize: 40, color: "#FACC15",
        x: 9, y: 75, w: 18, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });

      // Slot 2 (Column 2)
      addElement({
        name: "Slot 2 Title",
        type: "custom_text",
        placeholder: "{{placeholder_2_title}}",
        fontSize: 28, color: "#FFFFFF",
        x: 31, y: 69, w: 18, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 2 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_2_price}}",
        fontSize: 40, color: "#FACC15",
        x: 31, y: 75, w: 18, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });

      // Slot 3 (Column 3)
      addElement({
        name: "Slot 3 Title",
        type: "custom_text",
        placeholder: "{{placeholder_3_title}}",
        fontSize: 28, color: "#FFFFFF",
        x: 53, y: 69, w: 18, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 3 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_3_price}}",
        fontSize: 40, color: "#FACC15",
        x: 53, y: 75, w: 18, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });

      // Slot 4 (Column 4)
      addElement({
        name: "Slot 4 Title",
        type: "custom_text",
        placeholder: "{{placeholder_4_title}}",
        fontSize: 28, color: "#FFFFFF",
        x: 75, y: 69, w: 18, h: 3,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
      addElement({
        name: "Slot 4 Price",
        type: "custom_text",
        placeholder: "₹{{placeholder_4_price}}",
        fontSize: 40, color: "#FACC15",
        x: 75, y: 75, w: 18, h: 4,
        align: "center", zIndex: 3,
        fontFamily: "Outfit-Bold"
      });
    }
  };

  const addRateWidget = (presetName: string) => {
    switch (presetName) {
      // ── New Rich Multi-Slot Layout Presets ──
      case "scalloped_red_3":
        addRichFrameWidget("Scalloped_Red", "template-icons/custom_scalloped_red.png", 3);
        break;
      case "scalloped_red_4":
        addRichFrameWidget("Scalloped_Red", "template-icons/custom_scalloped_red.png", 4);
        break;
      case "scalloped_purple_3":
        addRichFrameWidget("Scalloped_Purple", "template-icons/custom_scalloped_purple.png", 3);
        break;
      case "scalloped_purple_4":
        addRichFrameWidget("Scalloped_Purple", "template-icons/custom_scalloped_purple.png", 4);
        break;
      case "scalloped_green_3":
        addRichFrameWidget("Scalloped_Green", "template-icons/custom_scalloped_green.png", 3);
        break;
      case "scalloped_green_4":
        addRichFrameWidget("Scalloped_Green", "template-icons/custom_scalloped_green.png", 4);
        break;
      case "scalloped_magenta_3":
        addRichFrameWidget("Scalloped_Magenta", "template-icons/custom_scalloped_magenta.png", 3);
        break;
      case "scalloped_magenta_4":
        addRichFrameWidget("Scalloped_Magenta", "template-icons/custom_scalloped_magenta.png", 4);
        break;

      case "custom_badge_shield":
        // Gold Shield Crest Badge (Individual)
        addElement({
          name: "Shield Crest BG",
          type: "icon_image",
          iconUrl: "/api/media/template-icons/custom_badge_shield.png",
          x: 35, y: 70, w: 30, h: 20,
          zIndex: 2
        });
        addElement({
          name: "Shield Label",
          type: "custom_text",
          placeholder: "22K GOLD",
          fontSize: 30, color: "#FACC15",
          x: 37, y: 76, w: 26, h: 3,
          align: "center", zIndex: 3,
          fontFamily: "Outfit-Bold"
        });
        addElement({
          name: "Shield Rate",
          type: "rate_22k",
          placeholder: "₹{{rate_22k}}",
          fontSize: 40, color: "#FFFFFF",
          x: 37, y: 81, w: 26, h: 4,
          align: "center", zIndex: 3,
          fontFamily: "Outfit-Bold"
        });
        break;

      case "custom_badge_diamond":
        // Gold Diamond Filigree Badge (Individual)
        addElement({
          name: "Diamond Filigree BG",
          type: "icon_image",
          iconUrl: "/api/media/template-icons/custom_badge_diamond.png",
          x: 35, y: 70, w: 30, h: 20,
          zIndex: 2
        });
        addElement({
          name: "Diamond Label",
          type: "custom_text",
          placeholder: "22K GOLD",
          fontSize: 30, color: "#FACC15",
          x: 37, y: 76, w: 26, h: 3,
          align: "center", zIndex: 3,
          fontFamily: "Outfit-Bold"
        });
        addElement({
          name: "Diamond Rate",
          type: "rate_22k",
          placeholder: "₹{{rate_22k}}",
          fontSize: 40, color: "#FFFFFF",
          x: 37, y: 81, w: 26, h: 4,
          align: "center", zIndex: 3,
          fontFamily: "Outfit-Bold"
        });
        break;

      default:
        break;
    }
  };

  const updateSelectedElement = (updates: Partial<CanvasElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Mouse Dragging handlers on canvas
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setIsDragging(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const targetElem = elements.find(el => el.id === id);
    if (!targetElem) return;

    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    setDragOffset({
      x: mouseX - targetElem.x,
      y: mouseY - targetElem.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    let newX = Math.max(0, Math.min(100 - (selectedElement?.w || 10), mouseX - dragOffset.x));
    let newY = Math.max(0, Math.min(100 - (selectedElement?.h || 5), mouseY - dragOffset.y));

    updateSelectedElement({
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  const getLayoutConfig = () => {
    return {
      dimensions: { width: 1080, height: 1920, aspect_ratio: "9:16" },
      elements: elements.map(el => ({
        id: el.id,
        name: el.name,
        type: el.type,
        placeholder: el.placeholder,
        x_pct: el.x,
        y_pct: el.y,
        w_pct: el.w,
        h_pct: el.h,
        // Pixel coordinates mapped to 1080x1920 resolution for Hostinger VPS / FFmpeg rendering engine
        x_px: Math.round((el.x / 100) * 1080),
        y_px: Math.round((el.y / 100) * 1920),
        w_px: Math.round((el.w / 100) * 1080),
        h_px: Math.round((el.h / 100) * 1920),
        font_size: el.fontSize,
        color: el.color,
        bg_color: el.bgColor,
        border_radius: el.borderRadius,
        icon_url: el.iconUrl,
        align: el.align,
        z_index: el.zIndex,
        opacity: el.opacity ?? 100,
        border_width: el.borderWidth ?? 0,
        border_color: el.borderColor ?? "#FFFFFF",
        font_family: el.fontFamily || "Outfit-Bold",
        flip_h: el.flipH || false,
        rotate_deg: el.rotateDeg || 0,
        animation_type: el.animationType || "fade",
        animation_group: el.animationGroup || "none"
      }))
    };
  };

  const handleSave = () => {
    onSaveConfig(getLayoutConfig());
  };

  const startTestRender = async () => {
    if (!selectedShopId || !selectedVideoId) {
      alert("Please select a shop and product video to test rendering.");
      return;
    }
    
    setRenderStatus("saving");
    setRenderLogs([]);
    setRenderedVideoUrl("");
    setRenderError("");

    // 1. Save current template layout configuration first
    const layoutConfig = getLayoutConfig();
    const savedTemplate = await onSaveConfig(layoutConfig, false);
    
    if (!savedTemplate) {
      setRenderStatus("failed");
      setRenderError("Failed to save template configuration first. Test cancelled.");
      return;
    }

    const finalTemplateId = templateId || savedTemplate.id;
    if (!finalTemplateId) {
      setRenderStatus("failed");
      setRenderError("No valid template ID available to render. Please save first.");
      return;
    }

    setRenderStatus("triggering");
    
    // 2. POST render job to api/renders
    try {
      const res = await fetch("/api/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: selectedShopId,
          template_id: finalTemplateId,
          video_library_id: selectedVideoId,
          priority: "Critical"
        })
      });
      const data = await res.json();
      if (data.error) {
        setRenderStatus("failed");
        setRenderError(data.error);
      } else if (data.id) {
        setCurrentJobId(data.id);
        setRenderStatus("rendering");
      } else {
        setRenderStatus("failed");
        setRenderError("Failed to queue render job. Server did not return job ID.");
      }
    } catch (err: any) {
      setRenderStatus("failed");
      setRenderError(err.message || "Network request failed.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-100 p-6 rounded-3xl border border-slate-200 shadow-inner min-h-[700px]">
      {/* Import Premium Fonts for Canvas Preview */}
      <link 
        rel="stylesheet" 
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Lora:ital,wght@1,700&family=Montserrat:wght@700&family=Outfit:wght@700&family=Playfair+Display:wght@700&display=swap" 
      />
      {/* 1. Left Sidebar Toolbox */}
      <div className="lg:col-span-3 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Canvas Elements</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">9:16 Reel</span>
          </div>

          {/* Toolbox Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
            <button 
              type="button"
              onClick={() => setActiveTab("branding")} 
              className={`py-1.5 rounded-lg transition-colors ${activeTab === "branding" ? "bg-white text-primary shadow-xs" : "text-slate-500"}`}
            >
              Shop
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("rates")} 
              className={`py-1.5 rounded-lg transition-colors ${activeTab === "rates" ? "bg-white text-primary shadow-xs" : "text-slate-500"}`}
            >
              Rates
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("occasions")} 
              className={`py-1.5 rounded-lg transition-colors ${activeTab === "occasions" ? "bg-white text-primary shadow-xs" : "text-slate-500"}`}
            >
              Occasion
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("icons")} 
              className={`py-1.5 rounded-lg transition-colors ${activeTab === "icons" ? "bg-white text-primary shadow-xs" : "text-slate-500"}`}
            >
              Icons
            </button>
          </div>

          {/* Tab 1: Shop Branding Elements */}
          {activeTab === "branding" && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Click to add dynamic shop placeholders to your video layout:</p>
              
              <button 
                type="button"
                onClick={() => addElement({ name: "Shop Logo", type: "shop_logo", placeholder: "{{shop_logo}}", w: 22, h: 12 })}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
              >
                <div className="p-2 bg-amber-100 text-accent rounded-lg">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <div>Shop Logo</div>
                  <div className="text-[10px] text-slate-400 font-mono">{"{{shop_logo}}"}</div>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => addElement({ name: "Shop Name", type: "shop_name", placeholder: "{{shop_name}}", fontSize: 75, color: "#FFFFFF" })}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
              >
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <div>Shop Name</div>
                  <div className="text-[10px] text-slate-400 font-mono">{"{{shop_name}}"}</div>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => addElement({ name: "Shop Phone", type: "shop_phone", placeholder: "{{shop_phone}}", fontSize: 50, color: "#FFFFFF" })}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
              >
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div>Shop Phone</div>
                  <div className="text-[10px] text-slate-400 font-mono">{"{{shop_phone}}"}</div>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => addElement({ name: "Shop Address", type: "shop_address", placeholder: "{{shop_address}}", fontSize: 45, color: "#E2E8F0" })}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
              >
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div>Shop Address</div>
                  <div className="text-[10px] text-slate-400 font-mono">{"{{shop_address}}"}</div>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => addElement({ name: "Dynamic Date", type: "date", placeholder: "{{date}}", fontSize: 45, color: "#FFFFFF" })}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
              >
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div>Dynamic Date</div>
                  <div className="text-[10px] text-slate-400 font-mono">{"{{date}}"}</div>
                </div>
              </button>
            </div>
          )}

          {/* Tab 2: Rate Badges */}
          {activeTab === "rates" && (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Dynamic Rate Overlays</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        addElement({
                          name: `Slot ${num} Title`,
                          type: `placeholder_${num}_title` as any,
                          placeholder: `{{placeholder_${num}_title}}`,
                          fontSize: 40,
                          color: "#FACC15",
                          x: 15,
                          y: 65 + num * 6
                        });
                        addElement({
                          name: `Slot ${num} Price`,
                          type: `placeholder_${num}_price` as any,
                          placeholder: `₹{{placeholder_${num}_price}}`,
                          fontSize: 60,
                          color: "#FFFFFF",
                          x: 15,
                          y: 65 + num * 6 + 3
                        });
                      }}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[10px] text-accent font-extrabold uppercase">Slot {num} Overlay</span>
                      <span className="text-[8px] font-mono font-normal text-slate-400">{"{{placeholder_" + num + "}}"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Today's Rate Header</p>
                <div className="space-y-2 mb-3">
                  {/* Today's Gold Rate + Date compound element */}
                  <button
                    type="button"
                    onClick={() => {
                      // 1. "TODAY'S GOLD RATE" decorative header with pointy chevrons
                      addElement({
                        name: "Today's Rate Title",
                        type: "todays_rate_header",
                        placeholder: "❮❮  TODAY'S GOLD RATE  ❯❯",
                        fontSize: 52,
                        color: "#FFD700",
                        bgColor: "transparent",
                        align: "center",
                        x: 5,
                        y: 60,
                        w: 90,
                        h: 8,
                        fontFamily: "Outfit-Bold"
                      });
                      // 2. Dynamic date below the header
                      addElement({
                        name: "Today's Date",
                        type: "date",
                        placeholder: "{{date}}",
                        fontSize: 40,
                        color: "#FFFFFF",
                        bgColor: "transparent",
                        align: "center",
                        x: 5,
                        y: 68,
                        w: 90,
                        h: 6,
                        fontFamily: "Outfit-Bold"
                      });
                    }}
                    className="w-full text-left p-3 rounded-xl border border-amber-300 bg-amber-50/40 hover:border-accent hover:bg-amber-100/60 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
                  >
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-amber-800">Today's Gold Rate + Date</div>
                      <div className="text-[10px] text-slate-400 font-mono">{"❮❮ TODAY'S GOLD RATE ❯❯ + {{date}}"}</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Basic Elements</p>
                <div className="space-y-2">
                  <button 
                    type="button"
                    onClick={() => {
                      addElement({ 
                        name: "24K Gold Label", 
                        type: "custom_text", 
                        placeholder: "24K Gold", 
                        fontSize: 50, 
                        color: "#D4AF37",
                        y: 70
                      });
                      addElement({ 
                        name: "24K Gold Price", 
                        type: "rate_24k", 
                        placeholder: "₹{{rate_24k}}", 
                        fontSize: 70, 
                        color: "#FFFFFF",
                        y: 74
                      });
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
                  >
                    <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <div>24K Gold Stack (Label + Price)</div>
                      <div className="text-[10px] text-slate-400 font-mono">{"{{rate_24k}}"}</div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      addElement({ 
                        name: "22K Gold Label", 
                        type: "custom_text", 
                        placeholder: "22K Gold", 
                        fontSize: 50, 
                        color: "#FACC15",
                        y: 80
                      });
                      addElement({ 
                        name: "22K Gold Price", 
                        type: "rate_22k", 
                        placeholder: "₹{{rate_22k}}", 
                        fontSize: 70, 
                        color: "#FFFFFF",
                        y: 84
                      });
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
                  >
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <div>22K Gold Stack (Label + Price)</div>
                      <div className="text-[10px] text-slate-400 font-mono">{"{{rate_22k}}"}</div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      addElement({ 
                        name: "Silver Label", 
                        type: "custom_text", 
                        placeholder: "Silver Rate", 
                        fontSize: 45, 
                        color: "#E2E8F0",
                        y: 88
                      });
                      addElement({ 
                        name: "Silver Price", 
                        type: "rate_silver", 
                        placeholder: "₹{{silver_rate}}", 
                        fontSize: 58, 
                        color: "#FFFFFF",
                        y: 92
                      });
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
                  >
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <div>Silver Rate Stack (Label + Price)</div>
                      <div className="text-[10px] text-slate-400 font-mono">{"{{rate_silver}}"}</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Dynamic Layout Frames (3 & 4 Slots)</p>
                <div className="space-y-2">
                  {/* Crimson Red Frame */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_red_3")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-red-600 font-extrabold uppercase">Crimson Frame</span>
                      <span className="text-[8px] text-slate-400 font-normal">3 Dynamic Slots</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_red_4")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-red-600 font-extrabold uppercase">Crimson Frame</span>
                      <span className="text-[8px] text-slate-400 font-normal">4 Dynamic Slots</span>
                    </button>
                  </div>

                  {/* Royale Purple Frame */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_purple_3")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-purple-600 font-extrabold uppercase">Royale Purple</span>
                      <span className="text-[8px] text-slate-400 font-normal">3 Dynamic Slots</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_purple_4")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-purple-600 font-extrabold uppercase">Royale Purple</span>
                      <span className="text-[8px] text-slate-400 font-normal">4 Dynamic Slots</span>
                    </button>
                  </div>

                  {/* Emerald Green Frame */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_green_3")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-emerald-600 font-extrabold uppercase">Emerald Green</span>
                      <span className="text-[8px] text-slate-400 font-normal">3 Dynamic Slots</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_green_4")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-emerald-600 font-extrabold uppercase">Emerald Green</span>
                      <span className="text-[8px] text-slate-400 font-normal">4 Dynamic Slots</span>
                    </button>
                  </div>

                  {/* Luxury Magenta Frame */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_magenta_3")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-pink-600 font-extrabold uppercase">Luxury Magenta</span>
                      <span className="text-[8px] text-slate-400 font-normal">3 Dynamic Slots</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => addRateWidget("scalloped_magenta_4")}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex flex-col justify-between transition-colors text-[10px] font-bold text-primary"
                    >
                      <span className="text-[9px] text-pink-600 font-extrabold uppercase">Luxury Magenta</span>
                      <span className="text-[8px] text-slate-400 font-normal">4 Dynamic Slots</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Luxury Shaped Badges (Single Rate)</p>
                <div className="space-y-2">
                  <button 
                    type="button"
                    onClick={() => addRateWidget("custom_badge_shield")}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-bold text-primary"
                  >
                    <div className="w-6 h-6 bg-yellow-100 text-yellow-700 rounded-lg flex items-center justify-center font-mono text-[10px]">🛡️</div>
                    <div>
                      <div>Baroque Shield Badge</div>
                      <div className="text-[9px] text-slate-400 font-normal">Luxury shield badge overlay</div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={() => addRateWidget("custom_badge_diamond")}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-bold text-primary"
                  >
                    <div className="w-6 h-6 bg-yellow-100 text-yellow-700 rounded-lg flex items-center justify-center font-mono text-[10px]">💎</div>
                    <div>
                      <div>Filigree Diamond Badge</div>
                      <div className="text-[9px] text-slate-400 font-normal">Luxury diamond filigree overlay</div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={() => addRateWidget("purity_sticker_916")}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-bold text-primary"
                  >
                    <div className="w-6 h-6 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center font-mono text-[10px]">916</div>
                    <div>
                      <div>916 BIS HUID Purity Sticker</div>
                      <div className="text-[9px] text-slate-400 font-normal">Official gold hallmark emblem</div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={() => addRateWidget("rate_change_trend")}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-bold text-primary"
                  >
                    <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-mono text-[10px]">📈</div>
                    <div>
                      <div>Rate Trend Text</div>
                      <div className="text-[9px] text-slate-400 font-normal">e.g. "Increased by ₹100"</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Occasion Banner */}
          {activeTab === "occasions" && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Add scheduled festival & occasion banners:</p>
              
              <button 
                type="button"
                onClick={() => addElement({ name: "Occasion Banner", type: "occasion_text", placeholder: "✨ {{occasion_text}} ✨", fontSize: 70, color: "#FFD700", align: "center" })}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-accent hover:bg-amber-50/50 flex items-center space-x-3 transition-colors text-xs font-semibold text-primary"
              >
                <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div>Occasion Banner</div>
                  <div className="text-[10px] text-slate-400 font-mono">{"{{occasion_text}}"}</div>
                </div>
              </button>
            </div>
          )}

          {/* Tab 4: Template Icons Library (Cloudflare R2) */}
          {activeTab === "icons" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Drag / click R2 elements/gifs:</p>
                <label className="cursor-pointer bg-accent hover:bg-yellow-400 text-primary p-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-1">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingIcon ? "Uploading..." : "Upload Element"}</span>
                  <input type="file" accept="image/*" onChange={handleIconUpload} className="hidden" disabled={uploadingIcon} />
                </label>
              </div>

              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Preset Transparent Outline Frames (Bg-Less)</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { name: "Classic Scroll Frame", url: "/presets/frame_classic_scroll.png", w: 75, h: 12 },
                    { name: "Scalloped Notch Frame", url: "/presets/frame_scalloped_notch.png", w: 75, h: 12 },
                    { name: "Filigree Cartouche Oval", url: "/presets/frame_filigree_cartouche.png", w: 75, h: 14 },
                    { name: "Diamond Notch Frame", url: "/presets/frame_diamond_notch.png", w: 75, h: 12 },
                    { name: "Curly Flourish Frame", url: "/presets/frame_curly_flourish.png", w: 75, h: 12 },
                    { name: "Double Line Ornate Frame", url: "/presets/frame_double_line_ornate.png", w: 75, h: 12 },
                  ].map((item, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => addElement({ name: item.name, type: "icon_image", placeholder: item.name, iconUrl: item.url, w: item.w, h: item.h })}
                      className="p-2 bg-slate-800 rounded-xl border border-slate-700 hover:border-amber-400 flex items-center justify-center transition-all aspect-video overflow-hidden group"
                      title={item.name}
                    >
                      <img src={item.url} alt={item.name} className="w-full h-full object-contain pointer-events-none group-hover:scale-105 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Preset Flourishes & Shapes (Flippable)</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { name: "Gold Spear Flourish", url: "/presets/spear_flourish_gold.png", w: 15, h: 8 },
                    { name: "Red Spear Flourish", url: "/presets/spear_flourish_red.png", w: 15, h: 8 },
                    { name: "White Spear Flourish", url: "/presets/spear_flourish_white.png", w: 15, h: 8 },
                    { name: "Gold Diamond Crest", url: "/presets/diamond_flourish_gold.png", w: 12, h: 12 },
                    { name: "Gold Flower Flourish", url: "/presets/flower_flourish_gold.png", w: 12, h: 12 },
                    { name: "Gold Ornate Line", url: "/presets/line_ornate_gold.png", w: 70, h: 4 },
                    { name: "White Ornate Line", url: "/presets/line_ornate_white.png", w: 70, h: 4 },
                    { name: "Red Ornate Line", url: "/presets/line_ornate_red.png", w: 70, h: 4 },
                  ].map((item, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => addElement({ name: item.name, type: "icon_image", placeholder: item.name, iconUrl: item.url, w: item.w, h: item.h })}
                      className="p-1.5 bg-slate-800 rounded-xl border border-slate-700 hover:border-amber-400 flex items-center justify-center transition-all aspect-square overflow-hidden group"
                      title={item.name}
                    >
                      <img src={item.url} alt={item.name} className="w-full h-full object-contain pointer-events-none group-hover:scale-110 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {icons.length === 0 ? (
                  <div className="col-span-3 text-center text-[10px] text-slate-400 py-4">No custom elements in R2 library</div>
                ) : (
                  icons.map((ic) => (
                    <button
                      type="button"
                      key={ic.key}
                      onClick={() => addElement({ name: "Template Asset", type: "icon_image", placeholder: "Asset", iconUrl: ic.url, w: 25, h: 15 })}
                      className="p-2 bg-slate-100 rounded-lg border border-slate-200 hover:border-accent hover:shadow-xs flex items-center justify-center transition-all aspect-square overflow-hidden"
                    >
                      <img src={ic.url} alt="Icon" className="w-full h-full object-contain pointer-events-none" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} className="w-full flex items-center justify-center space-x-2">
          <Save className="w-4 h-4" />
          <span>Save Layout Config JSON</span>
        </Button>
        <Button 
          onClick={() => setTestModalOpen(true)} 
          variant="outline" 
          className="w-full flex items-center justify-center space-x-2 border-accent text-primary hover:bg-amber-50/50 mt-2 font-bold"
        >
          <Eye className="w-4 h-4 text-accent" />
          <span>Render Preview Video</span>
        </Button>
      </div>

      {/* 2. Middle 9:16 Canvas Interactive Sandbox */}
      <div className="lg:col-span-5 flex flex-col items-center justify-center">
        <div className="text-center mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visual 9:16 Reel Canvas Sandbox</span>
        </div>

        {/* 9:16 Aspect ratio canvas preview box (340x604) */}
        <div 
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => setSelectedId(null)}
          className="relative w-[340px] h-[604px] bg-slate-900 rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden select-none cursor-crosshair"
        >
          {bgImageUrl && (bgImageUrl.toLowerCase().endsWith(".mp4") || bgImageUrl.toLowerCase().endsWith(".webm") || bgImageUrl.toLowerCase().includes("/api/media/videos")) ? (
            <video 
              src={bgImageUrl} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" 
            />
          ) : bgImageUrl ? (
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center pointer-events-none z-0" 
              style={{ backgroundImage: `url(${bgImageUrl})` }} 
            />
          ) : null}

          {!bgImageUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-650 font-semibold pointer-events-none z-0">
              9:16 Video Background Frame
            </div>
          )}

          {/* Render Elements on Canvas */}
          {elements.map((el) => {
            const isSelected = el.id === selectedId;

            return (
              <div
                key={el.id}
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                className={`absolute cursor-move transition-shadow flex items-center justify-center p-1 rounded ${
                  isSelected ? "ring-2 ring-amber-400 ring-offset-1 shadow-lg bg-amber-400/10" : "hover:outline hover:outline-amber-300/50"
                }`}
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.w}%`,
                  height: `${el.h}%`,
                  fontSize: `${(el.fontSize || 50) * (340 / 1080)}px`,
                  color: el.color || "#FFFFFF",
                  backgroundColor: el.bgColor || "transparent",
                  borderRadius: `${el.borderRadius || 0}px`,
                  border: el.borderWidth ? `${el.borderWidth * (340 / 1080)}px solid ${el.borderColor || '#FFFFFF'}` : "none",
                  opacity: (el.opacity ?? 100) / 100,
                  textAlign: el.align || "center",
                  zIndex: el.zIndex || 1,
                  fontFamily: el.fontFamily ? `'${el.fontFamily.replace("-Bold", "")}', sans-serif` : "inherit",
                  fontWeight: el.fontFamily?.includes("Bold") ? "bold" : "normal",
                  transform: `${el.rotateDeg ? `rotate(${el.rotateDeg}deg)` : ""} ${el.flipH ? "scaleX(-1)" : ""}`.trim() || "none"
                }}
              >
                {el.type === "shop_logo" ? (
                  <div className="w-full h-full border-2 border-dashed border-amber-400 bg-amber-400/20 text-accent font-bold text-[10px] flex items-center justify-center rounded-lg">
                    Shop Logo
                  </div>
                ) : el.type === "icon_image" && el.iconUrl ? (
                  <img 
                    src={el.iconUrl} 
                    alt="Icon" 
                    className="w-full h-full object-contain pointer-events-none" 
                    style={{ transform: el.flipH ? "scaleX(-1)" : "none" }}
                  />
                ) : (
                  <div className="font-bold w-full h-full pointer-events-none flex flex-col justify-center whitespace-pre-line leading-tight">
                    {getPlaceholderPreviewText(el.placeholder)}
                  </div>
                )}

                {isSelected && (
                  <div className="absolute -top-3 -right-3 bg-amber-400 text-slate-900 rounded-full p-0.5 text-[8px] font-black shadow">
                    <Move className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Right Property Inspector & Layer Controls */}
      <div className="lg:col-span-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4 overflow-y-auto max-h-[640px]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Property Inspector</h3>
          </div>
          {selectedElement && (
            <button 
              type="button"
              onClick={() => removeElement(selectedElement.id)} 
              className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center space-x-1 p-1 rounded hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>

        {selectedElement ? (
          <div className="space-y-4 text-xs">
            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-semibold text-amber-900">
              Selected: <span className="font-bold">{selectedElement.name}</span>
            </div>

            <Input 
              label="Placeholder Tag Text" 
              value={selectedElement.placeholder} 
              onChange={(e) => updateSelectedElement({ placeholder: e.target.value })} 
            />
            <p className="text-[10px] text-slate-400 -mt-2 font-normal leading-normal">
              Note: The canvas displays a realistic preview of the tag (e.g. "Gold 22K" for <code className="font-mono bg-slate-100 p-0.5 rounded">{"{{placeholder_1_title}}"}</code>).
            </p>

            {/* Position X / Y Sliders */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Position X (%): {selectedElement.x}%</label>
                <input 
                  type="range" min="0" max="95" step="0.5" 
                  value={selectedElement.x} 
                  onChange={(e) => updateSelectedElement({ x: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Position Y (%): {selectedElement.y}%</label>
                <input 
                  type="range" min="0" max="95" step="0.5" 
                  value={selectedElement.y} 
                  onChange={(e) => updateSelectedElement({ y: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
            </div>

            {/* Dimensions W / H Sliders */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Width (%): {selectedElement.w}%</label>
                <input 
                  type="range" min="2" max="100" step="0.5" 
                  value={selectedElement.w} 
                  onChange={(e) => updateSelectedElement({ w: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Height (%): {selectedElement.h}%</label>
                <input 
                  type="range" min="1" max="50" step="0.5" 
                  value={selectedElement.h} 
                  onChange={(e) => updateSelectedElement({ h: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
            </div>

            {/* Styling */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Font Size: {selectedElement.fontSize || 50}px</label>
                <input 
                  type="range" min="12" max="200" step="1" 
                  value={selectedElement.fontSize || 50} 
                  onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650 block">Text Color</label>
                <input 
                  type="color" 
                  value={selectedElement.color || "#FFFFFF"} 
                  onChange={(e) => updateSelectedElement({ color: e.target.value })}
                  className="w-full h-8 rounded-lg cursor-pointer border border-slate-200 mt-1" 
                />
              </div>
            </div>

            {/* Font Family Selector */}
            {selectedElement.type !== "shop_logo" && selectedElement.type !== "icon_image" && (
              <div>
                <Select
                  label="Font Family"
                  value={selectedElement.fontFamily || "Outfit-Bold"}
                  onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                  options={[
                    { label: "Outfit Elegant (Default)", value: "Outfit-Bold" },
                    { label: "Playfair Display Royal (Classic)", value: "PlayfairDisplay-Bold" },
                    { label: "Cinzel Decorative (Luxury)", value: "Cinzel-Bold" },
                    { label: "Montserrat Modern (Sleek)", value: "Montserrat-Bold" },
                    { label: "Lora Serif (Premium)", value: "Lora-Bold" }
                  ]}
                />
              </div>
            )}

                      {/* Bg Color Picker & Bg Opacity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650 block">Bg Color Picker</label>
                <div className="flex items-center space-x-2 mt-1">
                  <input 
                    type="color" 
                    value={getHexAndAlpha(selectedElement.bgColor || "transparent").hex} 
                    onChange={(e) => {
                      const { alpha } = getHexAndAlpha(selectedElement.bgColor || "transparent");
                      updateSelectedElement({ bgColor: hexToRgba(e.target.value, alpha === 0 ? 85 : alpha) });
                    }}
                    className="w-10 h-8 rounded-lg cursor-pointer border border-slate-200" 
                  />
                  <button
                    type="button"
                    onClick={() => updateSelectedElement({ bgColor: "transparent" })}
                    className="px-2 py-1 text-[10px] border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650 block">Bg Opacity: {getHexAndAlpha(selectedElement.bgColor || "transparent").alpha}%</label>
                <input 
                  type="range" min="0" max="100" step="5"
                  value={getHexAndAlpha(selectedElement.bgColor || "transparent").alpha} 
                  onChange={(e) => {
                    const { hex } = getHexAndAlpha(selectedElement.bgColor || "transparent");
                    const alpha = parseInt(e.target.value, 10);
                    if (alpha === 0) {
                      updateSelectedElement({ bgColor: "transparent" });
                    } else {
                      updateSelectedElement({ bgColor: hexToRgba(hex, alpha) });
                    }
                  }}
                  className="w-full accent-amber-500 mt-2" 
                />
              </div>
            </div>

            {/* Element Opacity Slider */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Element Opacity: {selectedElement.opacity ?? 100}%</label>
                <input 
                  type="range" min="10" max="100" step="5" 
                  value={selectedElement.opacity ?? 100} 
                  onChange={(e) => updateSelectedElement({ opacity: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Corner Radius: {selectedElement.borderRadius || 0}px</label>
                <input 
                  type="range" min="0" max="50" step="1" 
                  value={selectedElement.borderRadius || 0} 
                  onChange={(e) => updateSelectedElement({ borderRadius: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
            </div>

            {/* Text Border / Outline Width & Outline Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650">Text Outline Width: {selectedElement.borderWidth ?? 0}px</label>
                <input 
                  type="range" min="0" max="30" step="1" 
                  value={selectedElement.borderWidth ?? 0} 
                  onChange={(e) => updateSelectedElement({ borderWidth: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 mt-1" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650 block font-medium">Outline Color</label>
                <input 
                  type="color" 
                  value={selectedElement.borderColor || "#FFFFFF"} 
                  onChange={(e) => updateSelectedElement({ borderColor: e.target.value })}
                  className="w-full h-8 rounded-lg cursor-pointer border border-slate-200 mt-1" 
                />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-650 block">Layer Order (Z-Index)</label>
                <input 
                  type="number" min="1" max="100" 
                  value={selectedElement.zIndex || 1} 
                  onChange={(e) => updateSelectedElement({ zIndex: parseInt(e.target.value, 10) })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs mt-1" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-650 block">Text Alignment</label>
                <select 
                  value={selectedElement.align || "center"} 
                  onChange={(e: any) => updateSelectedElement({ align: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs mt-1"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            {/* Flip Horizontal, Rotate 90° & Animation Controls */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <div>
                <label className="text-[10px] font-semibold text-slate-650 block">Flip Horizontal</label>
                <button
                  type="button"
                  onClick={() => updateSelectedElement({ flipH: !selectedElement.flipH })}
                  className={`w-full mt-1 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                    selectedElement.flipH 
                      ? "bg-amber-500 text-slate-950 border-amber-600 shadow-sm" 
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${selectedElement.flipH ? "rotate-180" : ""}`} />
                  <span>{selectedElement.flipH ? "Flipped" : "Normal"}</span>
                </button>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-650 block">Rotate Angle</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextDeg = ((selectedElement.rotateDeg || 0) + 90) % 360;
                    updateSelectedElement({ rotateDeg: nextDeg });
                  }}
                  className="w-full mt-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] font-bold transition-all flex items-center justify-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3 text-amber-600" />
                  <span>{selectedElement.rotateDeg || 0}°</span>
                </button>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-650 block">Animation FX</label>
                <select 
                  value={selectedElement.animationType || "fade"} 
                  onChange={(e: any) => updateSelectedElement({ animationType: e.target.value })}
                  className="w-full p-1.5 border border-slate-200 rounded-lg text-[11px] mt-1 bg-white"
                >
                  <option value="fade">✨ Fade In</option>
                  <option value="slide_left">⬅ Slide Left</option>
                  <option value="slide_right">➡ Slide Right</option>
                  <option value="slide_up">⬆ Slide Up</option>
                  <option value="slide_down">⬇ Slide Down</option>
                  <option value="zoom_in">🔍 Zoom In</option>
                  <option value="zoom_out">🔍 Zoom Out</option>
                  <option value="gold_sparkle">👑 Gold Sparkle Highlight</option>
                  <option value="block">🧱 Block Reveal</option>
                  <option value="bounce">🦘 Bounce Entry</option>
                  <option value="bangle_roll">⭕ Bangle Roll Reveal</option>
                  <option value="glow_sweep">🌟 Gold Glow Sweep</option>
                </select>
              </div>
              <div className="mt-2">
                <label className="text-[10px] font-semibold text-slate-650 block">Animation Group</label>
                <select 
                  value={selectedElement.animationGroup || "none"} 
                  onChange={(e: any) => updateSelectedElement({ animationGroup: e.target.value })}
                  className="w-full p-1.5 border border-slate-200 rounded-lg text-[11px] mt-1 bg-white"
                >
                  <option value="none">None (Individual)</option>
                  <option value="group_1">👑 Group 1 (Top Slot)</option>
                  <option value="group_2">👑 Group 2 (Middle Slot)</option>
                  <option value="group_3">👑 Group 3 (Bottom Slot)</option>
                  <option value="logo">✨ Shop Logo</option>
                  <option value="banners">📢 Footer / Banner</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-slate-400 py-12">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
            <p className="font-semibold text-slate-600">No Element Selected</p>
            <p className="text-[11px] text-slate-400 mt-1">Click any element on the 9:16 canvas or add one from the left toolbox to adjust properties.</p>
          </div>
        )}
      </div>
      {/* Test Render Preview Modal */}
      {testModalOpen && (
        <Modal 
          isOpen={testModalOpen} 
          onClose={() => {
            setTestModalOpen(false);
            setRenderStatus("idle");
          }}
          title="🎬 Render Real-Time Video Preview"
        >
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground text-[11px]">
              Test how your template overlays, hallmarks, shapes, fonts, and trend comparers look when burned into a final product video.
            </p>

            {loadingModalData ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <LoadingSpinner />
                <span className="text-slate-400">Loading shops and videos...</span>
              </div>
            ) : renderStatus === "idle" ? (
              <div className="space-y-3">
                <Select
                  label="Select Demo Shop"
                  value={selectedShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  options={shops.map(s => ({ label: `${s.name} (${s.city})`, value: s.id }))}
                />
                
                <Select
                  label="Select Product Video"
                  value={selectedVideoId}
                  onChange={(e) => setSelectedVideoId(e.target.value)}
                  options={videos.map(v => ({ label: v.title, value: v.id }))}
                />

                <div className="pt-2">
                  <Button onClick={startTestRender} className="w-full flex items-center justify-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Start Test Render</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-primary">Render Status:</span>
                  <div className="flex items-center space-x-1.5">
                    {renderStatus === "completed" ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">Success ✓</span>
                    ) : renderStatus === "failed" ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">Failed ✗</span>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <LoadingSpinner />
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black animate-pulse">
                          {renderStatus}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {renderStatus === "rendering" && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Live Render Progress Logs:</span>
                    <div className="bg-slate-900 text-green-400 font-mono text-[9px] p-3 rounded-lg max-h-[140px] overflow-y-auto space-y-1 scrollbar-thin">
                      {renderLogs.length === 0 && <div>[Queue] Waiting for Hostinger VPS worker...</div>}
                      {renderLogs.map((log) => (
                        <div key={log.id} className="whitespace-pre-wrap">
                          [{new Date(log.created_at).toLocaleTimeString()}] {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {renderStatus === "completed" && renderedVideoUrl && (
                  <div className="space-y-2">
                    <div className="aspect-[9/16] w-[220px] mx-auto rounded-xl border-4 border-slate-800 shadow-lg overflow-hidden bg-black">
                      <video src={renderedVideoUrl} controls autoPlay className="w-full h-full object-cover" />
                    </div>
                    <a 
                      href={renderedVideoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-center py-2 bg-accent hover:bg-yellow-400 text-primary font-bold rounded-lg transition-colors"
                    >
                      Open Video in New Tab
                    </a>
                  </div>
                )}

                {renderStatus === "failed" && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    <p className="font-bold">Error:</p>
                    <p className="text-[11px] whitespace-pre-wrap">{renderError}</p>
                  </div>
                )}

                {/* Reset button to test again */}
                {(renderStatus === "completed" || renderStatus === "failed") && (
                  <Button 
                    onClick={() => setRenderStatus("idle")} 
                    variant="outline" 
                    className="w-full flex items-center justify-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test Another Render</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
