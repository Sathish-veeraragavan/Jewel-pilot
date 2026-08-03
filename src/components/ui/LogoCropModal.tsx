"use client";

import React, { useState, useRef, useEffect } from "react";
import { Crop, ZoomIn, Move, Check, X, RefreshCw } from "lucide-react";
import { Button } from "./reusable";

interface LogoCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  shopCode: string;
  onClose: () => void;
  onCropComplete: (croppedWebpFile: File) => void;
}

export default function LogoCropModal({
  isOpen,
  imageSrc,
  shopCode,
  onClose,
  onCropComplete,
}: LogoCropModalProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [cropWidthPct, setCropWidthPct] = useState<number>(80);
  const [cropHeightPct, setCropHeightPct] = useState<number>(80);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        imageRef.current = img;
        drawPreview();
      };
    }
  }, [imageSrc, zoom, cropWidthPct, cropHeightPct, offsetX, offsetY]);

  const drawPreview = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = 400;
    canvas.height = 400;

    // Draw transparent checkerboard background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const size = 12;
    for (let x = 0; x < canvas.width; x += size * 2) {
      for (let y = 0; y < canvas.height; y += size * 2) {
        ctx.fillStyle = "#f8fafc"; // slate-50
        ctx.fillRect(x, y, size, size);
        ctx.fillRect(x + size, y + size, size, size);
        ctx.fillStyle = "#e2e8f0"; // slate-200
        ctx.fillRect(x + size, y, size, size);
        ctx.fillRect(x, y + size, size, size);
      }
    }

    // Calculate image scaling & draw position
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * zoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (canvas.width - drawW) / 2 + offsetX;
    const drawY = (canvas.height - drawH) / 2 + offsetY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Draw Crop Overlay Box
    const cropW = (canvas.width * cropWidthPct) / 100;
    const cropH = (canvas.height * cropHeightPct) / 100;
    const cropX = (canvas.width - cropW) / 2;
    const cropY = (canvas.height - cropH) / 2;

    // Dim area outside crop box
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)"; // slate-900 dim
    ctx.fillRect(0, 0, canvas.width, cropY); // top
    ctx.fillRect(0, cropY + cropH, canvas.width, canvas.height - (cropY + cropH)); // bottom
    ctx.fillRect(0, cropY, cropX, cropH); // left
    ctx.fillRect(cropX + cropW, cropY, cropX, cropH); // right

    // Draw Crop Box border
    ctx.strokeStyle = "#eab308"; // Gold accent color
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cropX, cropY, cropW, cropH);

    // Draw Grid Lines inside crop box
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cropX + cropW / 3, cropY);
    ctx.lineTo(cropX + cropW / 3, cropY + cropH);
    ctx.moveTo(cropX + (2 * cropW) / 3, cropY);
    ctx.lineTo(cropX + (2 * cropW) / 3, cropY + cropH);
    ctx.moveTo(cropX, cropY + cropH / 3);
    ctx.lineTo(cropX + cropW, cropY + cropH / 3);
    ctx.moveTo(cropX, cropY + (2 * cropH) / 3);
    ctx.lineTo(cropX + cropW, cropY + (2 * cropH) / 3);
    ctx.stroke();
  };

  const handleApplyCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    setProcessing(true);

    try {
      // 1. Create high-res output canvas
      const outputCanvas = document.createElement("canvas");
      const previewCanvas = canvasRef.current;
      if (!previewCanvas) return;

      const cropW = (previewCanvas.width * cropWidthPct) / 100;
      const cropH = (previewCanvas.height * cropHeightPct) / 100;
      const cropX = (previewCanvas.width - cropW) / 2;
      const cropY = (previewCanvas.height - cropH) / 2;

      // Calculate original image coordinates to crop from (maintaining transparent pixels)
      const scale = Math.min(previewCanvas.width / img.width, previewCanvas.height / img.height) * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (previewCanvas.width - drawW) / 2 + offsetX;
      const drawY = (previewCanvas.height - drawH) / 2 + offsetY;

      const sX = (cropX - drawX) / scale;
      const sY = (cropY - drawY) / scale;
      const sW = cropW / scale;
      const sH = cropH / scale;

      outputCanvas.width = 512;
      outputCanvas.height = 512;

      const outCtx = outputCanvas.getContext("2d");
      if (!outCtx) return;

      // Fill transparent background
      outCtx.clearRect(0, 0, 512, 512);

      // Render cropped region from original image (not preview canvas) to 512x512 output canvas
      outCtx.drawImage(
        img,
        sX,
        sY,
        sW,
        sH,
        0,
        0,
        512,
        512
      );

      outputCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          const croppedFile = new File(
            [blob],
            `${shopCode}_logo.png`,
            { type: "image/png" }
          );
          onCropComplete(croppedFile);
          setProcessing(false);
          onClose();
        },
        "image/png"
      );
    } catch (err) {
      console.error("Crop error:", err);
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setZoom(1);
    setCropWidthPct(80);
    setCropHeightPct(80);
    setOffsetX(0);
    setOffsetY(0);
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <Crop className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900">Crop & Trim Shop Logo</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas & Live Preview Box */}
        <div className="flex justify-center bg-slate-900/5 p-4 rounded-2xl border border-slate-200">
          <canvas
            ref={canvasRef}
            className="w-80 h-80 rounded-xl shadow-inner border border-slate-300 bg-white"
          />
        </div>

        {/* Adjustments & Sliders */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          {/* Zoom Slider */}
          <div className="space-y-1">
            <div className="flex justify-between font-semibold text-slate-700">
              <span className="flex items-center space-x-1">
                <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                <span>Zoom / Scale</span>
              </span>
              <span>{zoom.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Crop Width Trim */}
          <div className="space-y-1">
            <div className="flex justify-between font-semibold text-slate-700">
              <span className="flex items-center space-x-1">
                <Crop className="w-3.5 h-3.5 text-amber-600" />
                <span>Trim Horizontal Margins (Width)</span>
              </span>
              <span>{cropWidthPct}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="100"
              step="1"
              value={cropWidthPct}
              onChange={(e) => setCropWidthPct(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Crop Height Trim */}
          <div className="space-y-1">
            <div className="flex justify-between font-semibold text-slate-700">
              <span className="flex items-center space-x-1">
                <Crop className="w-3.5 h-3.5 text-amber-600" />
                <span>Trim Vertical Margins (Height)</span>
              </span>
              <span>{cropHeightPct}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="100"
              step="1"
              value={cropHeightPct}
              onChange={(e) => setCropHeightPct(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Position Panning (X and Y) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span className="flex items-center space-x-1">
                  <Move className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pan Left / Right</span>
                </span>
                <span>{offsetX}px</span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="1"
                value={offsetX}
                onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span className="flex items-center space-x-1">
                  <Move className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pan Up / Down</span>
                </span>
                <span>{offsetY}px</span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="1"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl flex items-center space-x-1 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Crop</span>
          </button>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleApplyCrop} disabled={processing} className="flex items-center space-x-2">
              <Check className="w-4 h-4" />
              <span>{processing ? "Cropping..." : "Apply Crop & Upload Logo"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
