/**
 * Hostinger VPS Render Worker v2
 * ──────────────────────────────
 * Pipeline:
 *   Step 1 → Overlay logo + text on product video (video-only, no audio)
 *   Step 2 → Concat [overlayed video] + [outro], add background music over both
 *   Step 3 → Output final MP4 and report to Vercel API
 *
 * Fixes:
 *   - CSS rgba() / hex colors → FFmpeg 0xRRGGBB@alpha format
 *   - Separated overlay step from concat+music step
 *   - Premium font support (Playfair Display for jewellery)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const express = require("express");

function getMediaDuration(filePath) {
  try {
    const stdout = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    ).toString().trim();
    return parseFloat(stdout) || 0;
  } catch (err) {
    console.error(`Failed to probe duration for ${filePath}:`, err);
    return 0;
  }
}

// ── Configuration ──────────────────────────────────────────────
const SERVER_URL = "https://jewellery-videos.vercel.app";
const VPS_PUBLIC_IP = "31.97.202.176";
const VPS_PORT = 8080;
const WORKER_ID = `hostinger_vps_worker_${require("os").hostname()}`;
const POLL_INTERVAL_MS = 5000;

let currentCleanupTime = "21:00"; // default daily cleanup time IST (HH:MM)
let currentRetentionHours = 24;   // default retention hours before deletion

// Target video resolution (9:16 vertical for mobile/reels)
const VIDEO_W = 1080;
const VIDEO_H = 1920;

// Unicode range regex matching Indian regional scripts (Tamil, Telugu, Malayalam, Kannada, Devanagari/Hindi)
// Excludes emojis and other standard symbols to prevent incorrect text wrapping scale factors.
const REGIONAL_SCRIPT_REGEX = /[\u0B80-\u0BFF\u0D00-\u0D7F\u0C00-\u0C7F\u0C80-\u0CFF\u0900-\u097F]/;

// Directories
const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
const TEMP_DIR = path.resolve(__dirname, "temp");
const FONTS_DIR = path.resolve(__dirname, "fonts");

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

// ── Font path (will be set after checking availability) ────────
// ── Premium Google Fonts map ───────────────────────────
const PREMIUM_FONTS = {
  "Outfit-Bold": "https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyC4E.ttf",
  "PlayfairDisplay-Bold": "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf",
  "Cinzel-Bold": "https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgTYo.ttf",
  "Montserrat-Bold": "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf",
  "Lora-Bold": "https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJG.ttf",
  "NotoSansTamil-Bold": "https://fonts.gstatic.com/s/notosanstamil/v28/nTF34anw3OJv3ZjP9Mdf59v-9uN7YFvX.ttf",
  "NotoSansTelugu-Bold": "https://fonts.gstatic.com/s/notosanstelugu/v25/0F14uS64W7D3r11P6Yp559v-9uN7YFvX.ttf",
  "NotoSansKannada-Bold": "https://fonts.gstatic.com/s/notosanskannada/v27/0F12uS64W7D3r11P6Yp559v-9uN7YFvX.ttf",
  "NotoSansMalayalam-Bold": "https://fonts.gstatic.com/s/notosansmalayalam/v25/0F16uS64W7D3r11P6Yp559v-9uN7YFvX.ttf",
  "NotoSansDevanagari-Bold": "https://fonts.gstatic.com/s/notosansdevanagari/v25/0F10uS64W7D3r11P6Yp559v-9uN7YFvX.ttf"
};

let FONT_PATH = "";

function detectFont() {
  // Priority order: Regional Noto Sans → custom Playfair Display → system DejaVu → fallback
  const candidates = [
    "/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    path.join(FONTS_DIR, "NotoSansTamil-Bold.ttf"),
    path.join(FONTS_DIR, "PlayfairDisplay-Bold.ttf"),
    path.join(FONTS_DIR, "Cinzel-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      FONT_PATH = f;
      console.log(`[Font] Using: ${f}`);
      return;
    }
  }
  console.log("[Font] No custom font found. FFmpeg will use its built-in default.");
}

// ── Color Helpers ──────────────────────────────────────────────
/**
 * Convert CSS color strings to FFmpeg-compatible format.
 *
 * FFmpeg drawtext accepts:
 *   - Named colors: white, black, red
 *   - Hex without alpha: 0xRRGGBB
 *   - Hex with alpha: 0xRRGGBB@opacity  (opacity = 0.0 to 1.0)
 *
 * CSS colors we receive from the template editor:
 *   - rgba(15, 23, 42, 0.85) → commas break FFmpeg filter parser!
 *   - #0F172A
 *   - #FFFFFF
 *   - transparent
 */
function parseColorToFFmpeg(colorStr) {
  if (!colorStr || colorStr === "transparent") return null;

  // Already in FFmpeg format (0x...)
  if (colorStr.startsWith("0x")) return colorStr;

  // Parse rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = colorStr.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0");
    const alpha = rgbaMatch[4] !== undefined ? rgbaMatch[4] : "1";
    return `0x${r}${g}${b}@${alpha}`;
  }

  // Parse hex #RGB, #RRGGBB, #RRGGBBAA
  if (colorStr.startsWith("#")) {
    const hex = colorStr.replace("#", "");
    if (hex.length === 3) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return `0x${r}${g}${b}`;
    }
    if (hex.length === 6) {
      return `0x${hex}`;
    }
    if (hex.length === 8) {
      // #RRGGBBAA → 0xRRGGBB@opacity
      const rgb = hex.substring(0, 6);
      const alphaVal = (parseInt(hex.substring(6, 8), 16) / 255).toFixed(2);
      return `0x${rgb}@${alphaVal}`;
    }
  }

  // Named color fallback (white, black, etc.)
  return colorStr;
}

function applyElementOpacity(ffmpegColor, opacityPct) {
  if (!ffmpegColor) return null;
  const alphaMultiplier = opacityPct !== undefined ? opacityPct / 100 : 1.0;
  if (alphaMultiplier >= 1.0) return ffmpegColor;

  if (ffmpegColor.includes("@")) {
    const parts = ffmpegColor.split("@");
    const existingAlpha = parseFloat(parts[1]);
    const alpha = (existingAlpha * alphaMultiplier).toFixed(2);
    return `${parts[0]}@${alpha}`;
  }

  return `${ffmpegColor}@${alphaMultiplier.toFixed(2)}`;
}

// ── URL Helpers ────────────────────────────────────────────────
const getAbsoluteUrl = (urlStr) => {
  if (!urlStr) return "";
  if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) return urlStr;
  return `${SERVER_URL}${urlStr.startsWith("/") ? "" : "/"}${urlStr}`;
};

// ── Express Static File Server ─────────────────────────────────
const app = express();
app.use("/downloads", express.static(DOWNLOADS_DIR));
app.listen(VPS_PORT, () => {
  console.log(`[HTTP] Static file server running at http://${VPS_PUBLIC_IP}:${VPS_PORT}/downloads`);
});

async function downloadFile(url, destPath) {
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    console.log(`[Download] Skipping download for invalid/empty URL: "${url}"`);
    return;
  }
  const fetch = (await import("node-fetch")).default;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const fileStream = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

// ── FFmpeg Text Escaping ───────────────────────────────────────
/**
 * Escape text for FFmpeg drawtext filter.
 * FFmpeg drawtext uses ':' as option separator and ''' for quoting.
 * Special chars inside text must be escaped.
 */
function escapeFFmpegText(text) {
  if (!text) return "";
  // Strip emojis and non-supported unicode symbols (keeps Tamil/Hindi characters and standard ASCII)
  const cleaned = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
  return cleaned
    .replace(/\\/g, "\\\\\\\\")  // Backslashes
    .replace(/'/g, "\u2019")      // Typographic apostrophe (safe for FFmpeg drawtext)
    .replace(/:/g, "\\:")         // Colons break filter options
    .replace(/%/g, "%%");         // Percent signs
}

function wrapText(text, maxChars) {
  if (!text) return "";
  const lines = text.split("\n");
  const wrappedLines = [];
  
  for (const line of lines) {
    if (line.length <= maxChars) {
      wrappedLines.push(line);
      continue;
    }
    
    const words = line.split(" ");
    let currentLine = "";
    
    for (const word of words) {
      if ((currentLine + (currentLine ? " " : "") + word).length > maxChars) {
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        currentLine = word;
      } else {
        currentLine += (currentLine ? " " : "") + word;
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }
  
  return wrappedLines.join("\n");
}

function applyImageAnimation(el, wPx, hPx, xPx, yPx, startT, fadeDur, inputIdx, sparkStreamLabel, bangleStreamLabel, glowStreamLabel, currentLayerLabel, outputLayerLabel) {
  const animType = el.animation_type ?? el.animationType ?? "fade";
  const isFlipped = el.flip_h ?? el.flipH ?? false;
  const rotateDeg = el.rotate_deg ?? el.rotateDeg ?? 0;

  // 1. Build transform filters (scale, flip, rotate)
  let transformFilters = `scale=${wPx}:${hPx}`;
  if (isFlipped) transformFilters += `,hflip`;
  if (rotateDeg === 90) transformFilters += `,transpose=1`;
  else if (rotateDeg === 180) transformFilters += `,transpose=1,transpose=1`;
  else if (rotateDeg === 270) transformFilters += `,transpose=2`;

  // 2. Add entry animations (fade / slide / zoom / sparkle / bounce / block)
  let overlayX = `${xPx}`;
  let overlayY = `${yPx}`;
  const baseFadeFilter = (animType === "none" || animType === "instant") ? "" : `,fade=in:st=${startT}:d=${fadeDur}:alpha=1`;

  if (animType === "slide_left") {
    overlayX = `${xPx}+if(lt(t,${startT}),300,if(lt(t,${startT+fadeDur}),300*(1-(t-${startT})/${fadeDur}),0))`;
    transformFilters += baseFadeFilter;
  } else if (animType === "slide_right") {
    overlayX = `${xPx}-if(lt(t,${startT}),300,if(lt(t,${startT+fadeDur}),300*(1-(t-${startT})/${fadeDur}),0))`;
    transformFilters += baseFadeFilter;
  } else if (animType === "slide_up") {
    overlayY = `${yPx}+if(lt(t,${startT}),200,if(lt(t,${startT+fadeDur}),200*(1-(t-${startT})/${fadeDur}),0))`;
    transformFilters += baseFadeFilter;
  } else if (animType === "slide_down") {
    overlayY = `${yPx}-if(lt(t,${startT}),200,if(lt(t,${startT+fadeDur}),200*(1-(t-${startT})/${fadeDur}),0))`;
    transformFilters += baseFadeFilter;
  } else if (animType === "zoom_in") {
    overlayX = `${xPx}+(${wPx}/2)*(1-if(lt(t,${startT}),0,if(lt(t,${startT+fadeDur}),(t-${startT})/${fadeDur},1)))`;
    overlayY = `${yPx}+(${hPx}/2)*(1-if(lt(t,${startT}),0,if(lt(t,${startT+fadeDur}),(t-${startT})/${fadeDur},1)))`;
    transformFilters += `,scale='iw*if(lt(t,${startT}),0,if(lt(t,${startT+fadeDur}),(t-${startT})/${fadeDur},1))':'-1'${baseFadeFilter}`;
  } else if (animType === "zoom_out") {
    overlayX = `${xPx}-(${wPx}/2)*(1-if(lt(t,${startT}),0,if(lt(t,${startT+fadeDur}),(t-${startT})/${fadeDur},1)))`;
    overlayY = `${yPx}-(${hPx}/2)*(1-if(lt(t,${startT}),0,if(lt(t,${startT+fadeDur}),(t-${startT})/${fadeDur},1)))`;
    transformFilters += `,scale='iw*(2-if(lt(t,${startT}),1,if(lt(t,${startT+fadeDur}),1+(t-${startT})/${fadeDur},2)))':'-1'${baseFadeFilter}`;
  } else if (animType === "bounce") {
    overlayY = `${yPx}+if(lt(t,${startT}),150,if(lt(t,${startT+0.3}),150*(1-(t-${startT})/0.3)-20*(t-${startT})/0.3,if(lt(t,${startT+0.5}),-20*(1-(t-${startT}-0.3)/0.2),0)))`;
    transformFilters += baseFadeFilter;
  } else if (animType === "block") {
    const revealDur = 0.5;
    overlayX = `${xPx}+if(lt(t,${startT}),iw,if(lt(t,${startT+revealDur}),iw*(1-(t-${startT})/${revealDur}),0))`;
    transformFilters += baseFadeFilter;
  } else {
    transformFilters += baseFadeFilter;
  }

  let filterStr = "";
  if (animType === "glow_sweep" && glowStreamLabel) {
    const sweepDur = 0.6;
    const glowW = Math.round(hPx * 0.8);
    const startX = xPx - glowW;
    const endX = xPx + wPx;
    
    const glowXExpr = `(${startX})+if(lt(t,${startT}),0,if(lt(t,${startT+sweepDur}),(${endX - startX})*(t-${startT})/${sweepDur},${endX - startX}))`;
    
    const scaledGlow = `scaled_glow_${outputLayerLabel}`;
    const glowLayer = `glow_layer_${outputLayerLabel}`;
    const scaledEl = `scaled_el_${outputLayerLabel}`;
    
    filterStr += `; [${glowStreamLabel}]scale=${glowW}:${hPx},fade=in:st=${startT}:d=0.1:alpha=1,fade=out:st=${startT+sweepDur}:d=0.1:alpha=1[${scaledGlow}]`;
    filterStr += `; [${inputIdx}:v]${transformFilters}[${scaledEl}]`;
    filterStr += `; [${currentLayerLabel}][${scaledEl}]overlay=x='${overlayX}':y='${overlayY}':shortest=1:enable='gte(t,${startT})'[${glowLayer}]`;
    filterStr += `; [${glowLayer}][${scaledGlow}]overlay=x='${glowXExpr}':y='${yPx}':shortest=1:enable='between(t,${startT},${startT+sweepDur})'[${outputLayerLabel}]`;
  } else if (animType === "bangle_roll" && bangleStreamLabel) {
    const rollDur = 0.8;
    const bangleW = Math.round(hPx * 1.3);
    const bangleH = Math.round(hPx * 1.3);
    const startX = xPx - Math.round(bangleW / 2);
    const endX = xPx + wPx - Math.round(bangleW / 2);
    const bangleY = Math.round(yPx - (bangleH - hPx) / 2);
    
    const bangleXExpr = `(${startX})+if(lt(t,${startT}),0,if(lt(t,${startT+rollDur}),(${endX - startX})*(t-${startT})/${rollDur},${endX - startX}))`;
    const bangleRotExpr = `(t-${startT})*5`;
    
    const maskBg = `mask_bg_bangle_${outputLayerLabel}`;
    const maskFg = `mask_fg_bangle_${outputLayerLabel}`;
    const maskMoving = `mask_moving_bangle_${outputLayerLabel}`;
    const scaledEl = `scaled_el_${outputLayerLabel}`;
    const maskedEl = `masked_el_bangle_${outputLayerLabel}`;
    const scaledBangle = `scaled_bangle_${outputLayerLabel}`;
    const bangleLayer = `bangle_${outputLayerLabel}`;
    
    filterStr += `; color=c=black:s=${wPx}x${hPx}:d=20[${maskBg}]`;
    filterStr += `; color=c=white:s=${wPx}x${hPx}:d=20[${maskFg}]`;
    filterStr += `; [${maskBg}][${maskFg}]overlay=x='-w+w*if(lt(t,${startT}),0,if(lt(t,${startT+rollDur}),(t-${startT})/${rollDur},1))':y=0:shortest=1[${maskMoving}]`;
    filterStr += `; [${inputIdx}:v]${transformFilters}[${scaledEl}]`;
    filterStr += `; [${scaledEl}][${maskMoving}]alphamerge[${maskedEl}]`;
    filterStr += `; [${currentLayerLabel}][${maskedEl}]overlay=x='${xPx}':y='${yPx}':shortest=1:enable='gte(t,${startT})'[${bangleLayer}]`;
    filterStr += `; [${bangleStreamLabel}]scale=${bangleW}:${bangleH},rotate=angle='if(lt(t,${startT}),0,${bangleRotExpr})':fillcolor=none,fade=in:st=${startT}:d=0.1:alpha=1,fade=out:st=${startT+rollDur}:d=0.1:alpha=1[${scaledBangle}]`;
    filterStr += `; [${bangleLayer}][${scaledBangle}]overlay=x='${bangleXExpr}':y='${bangleY}':shortest=1:enable='between(t,${startT},${startT+rollDur+0.2})'[${outputLayerLabel}]`;
  } else if (animType === "gold_sparkle" && sparkStreamLabel) {
    const sparkW = Math.round(wPx * 1.6);
    const sparkH = Math.round(hPx * 1.6);
    const sparkX = Math.round(xPx - (sparkW - wPx) / 2);
    const sparkY = Math.round(yPx - (sparkH - hPx) / 2);
    
    const sparkLayer = `spark_${outputLayerLabel}`;
    const scaledSpark = `scaled_spark_${outputLayerLabel}`;
    const scaledEl = `scaled_el_${outputLayerLabel}`;
    
    filterStr += `; [${sparkStreamLabel}]scale=${sparkW}:${sparkH},rotate=angle='t*1.5':fillcolor=none,fade=in:st=${startT}:d=0.3:alpha=1[${scaledSpark}]`;
    filterStr += `; [${inputIdx}:v]${transformFilters}[${scaledEl}]`;
    filterStr += `; [${currentLayerLabel}][${scaledSpark}]overlay=x='${sparkX}':y='${sparkY}':shortest=1:enable='gte(t,${startT})'[${sparkLayer}]`;
    filterStr += `; [${sparkLayer}][${scaledEl}]overlay=x='${overlayX}':y='${overlayY}':shortest=1:enable='gte(t,${startT})'[${outputLayerLabel}]`;
  } else {
    const scaledEl = `scaled_el_${outputLayerLabel}`;
    filterStr += `; [${inputIdx}:v]${transformFilters}[${scaledEl}]`;
    filterStr += `; [${currentLayerLabel}][${scaledEl}]overlay=x='${overlayX}':y='${overlayY}':shortest=1:enable='gte(t,${startT})'[${outputLayerLabel}]`;
  }

  return filterStr;
}

// ══════════════════════════════════════════════════════════════
//  MAIN VIDEO PROCESSING PIPELINE
// ══════════════════════════════════════════════════════════════
async function processVideoJob(job) {
  if (job.is_rotation) {
    const jobDir = path.join(TEMP_DIR, `render_${job.id}`);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

    const sourceVideoPath = path.join(jobDir, "source_video.mp4");
    const rotatedVideoPath = path.join(DOWNLOADS_DIR, `${job.id}_final.mp4`);

    console.log(`\n[Job ${job.id}] Downloading source video for rotation: ${job.source_video_url}`);
    await downloadFile(getAbsoluteUrl(job.source_video_url), sourceVideoPath);

    let transposeFilter = "transpose=1";
    if (job.angle === "90_ccw") {
      transposeFilter = "transpose=2";
    } else if (job.angle === "180") {
      transposeFilter = "transpose=2,transpose=2";
    }

    const cmd = `ffmpeg -y -i "${sourceVideoPath}" -vf "${transposeFilter}" -c:a copy "${rotatedVideoPath}"`;
    console.log(`[Job ${job.id}] Executing rotation: ${cmd}`);
    execSync(cmd, { stdio: "inherit" });

    fs.rmSync(jobDir, { recursive: true, force: true });

    const outputUrl = `http://${VPS_PUBLIC_IP}:${VPS_PORT}/downloads/${job.id}_final.mp4`;
    console.log(`[Job ${job.id}] Output URL: ${outputUrl}`);
    return outputUrl;
  }

  const jobDir = path.join(TEMP_DIR, `render_${job.id}`);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

  const config = job.template_config || {};
  const elements = config.elements || [];
  const hasQrElement = elements.some(el => el.type === "shop_qr" && el.visible !== false);
  const hasQrCode = !!job.qr_code_url && hasQrElement;

  // File paths
  const baseVideoPath = path.join(jobDir, "base_video.mp4");
  const logoExt = job.logo_url ? (job.logo_url.split('?')[0].split('.').pop() || 'webp') : 'webp';
  const logoPath = path.join(jobDir, `logo.${logoExt}`);
  const qrExt = hasQrCode ? (job.qr_code_url.split('?')[0].split('.').pop() || 'webp') : 'webp';
  const qrPath = path.join(jobDir, `qrcode.${qrExt}`);
  const outroPath = path.join(jobDir, "outro.mp4");
  const audioTrackPath = path.join(jobDir, "bg_music.mp3");

  // Output paths
  const layeredVideoPath = path.join(jobDir, "layered_main.mp4");
  const finalOutputPath = path.join(DOWNLOADS_DIR, `${job.id}_final.mp4`);

  // ── DOWNLOAD PHASE ──────────────────────────────────────────
  console.log(`\n[Job ${job.id}] Downloading resources...`);

  const baseVideoUrl = getAbsoluteUrl(job.video_url);
  const logoUrl = getAbsoluteUrl(job.logo_url);
  const outroUrl = getAbsoluteUrl(job.outro_url);
  const audioUrl = job.audio_track_url ? getAbsoluteUrl(job.audio_track_url) : null;

  console.log(`[Job ${job.id}] Video: ${baseVideoUrl}`);
  console.log(`[Job ${job.id}] Logo:  ${logoUrl}`);
  if (hasQrCode) console.log(`[Job ${job.id}] QR Code: ${job.qr_code_url}`);
  console.log(`[Job ${job.id}] Outro: ${outroUrl}`);
  console.log(`[Job ${job.id}] Music: ${audioUrl || "None"}`);

  const downloads = [
    downloadFile(baseVideoUrl, baseVideoPath),
    downloadFile(logoUrl, logoPath),
    downloadFile(outroUrl, outroPath),
  ];
  if (audioUrl) downloads.push(downloadFile(audioUrl, audioTrackPath));
  if (hasQrCode) downloads.push(downloadFile(getAbsoluteUrl(job.qr_code_url), qrPath));

  // Dynamic font downloads
  for (const el of elements) {
    const fontName = el.font_family || el.fontFamily;
    if (fontName && PREMIUM_FONTS[fontName]) {
      const localFontPath = path.join(FONTS_DIR, `${fontName}.ttf`);
      if (!fs.existsSync(localFontPath)) {
        console.log(`[Job ${job.id}] Queueing font download: ${fontName}`);
        downloads.push(downloadFile(PREMIUM_FONTS[fontName], localFontPath));
      }
    }
  }

  // Dynamic icon/shape image downloads
  const iconElements = elements.filter(el => el.type === "icon_image" && (el.icon_url || el.iconUrl));
  iconElements.forEach((el, index) => {
    const iconUrl = getAbsoluteUrl(el.icon_url ?? el.iconUrl);
    const ext = iconUrl.split(".").pop().split(/[?#]/)[0] || "png";
    const localPath = path.join(jobDir, `icon_${index}.${ext}`);
    el.localPath = localPath;
    console.log(`[Job ${job.id}] Queueing icon download: ${iconUrl}`);
    downloads.push(downloadFile(iconUrl, localPath).catch(err => {
      console.error(`[Job ${job.id}] Failed to download icon ${iconUrl}:`, err.message);
    }));
  });

  // Check if any element uses 'gold_sparkle' animation
  const logoEl = elements.find(el => el.type === "shop_logo");
  const logoAnim = logoEl?.animation_type ?? logoEl?.animationType ?? "fade";
  const hasLogoSparkle = logoAnim === "gold_sparkle";
  const hasIconSparkle = iconElements.some(el => (el.animation_type ?? el.animationType) === "gold_sparkle");
  const hasSparkle = hasLogoSparkle || hasIconSparkle;

  const sparkLocalPath = path.join(jobDir, "gold_spark_highlight.png");
  if (hasSparkle) {
    console.log(`[Job ${job.id}] Queueing gold spark highlight download...`);
    downloads.push(downloadFile(`${SERVER_URL}/presets/gold_spark_highlight.png`, sparkLocalPath).catch(err => {
      console.error(`[Job ${job.id}] Failed to download gold spark highlight:`, err.message);
    }));
  }

  // Check if any element uses 'bangle_roll' animation
  const hasLogoBangle = logoAnim === "bangle_roll";
  const hasIconBangle = iconElements.some(el => (el.animation_type ?? el.animationType) === "bangle_roll");
  const hasBangle = hasLogoBangle || hasIconBangle;

  const bangleLocalPath = path.join(jobDir, "gold_bangle.png");
  if (hasBangle) {
    console.log(`[Job ${job.id}] Queueing gold bangle download...`);
    downloads.push(downloadFile(`${SERVER_URL}/presets/gold_bangle.png`, bangleLocalPath).catch(err => {
      console.error(`[Job ${job.id}] Failed to download gold bangle:`, err.message);
    }));
  }

  // Check if any element uses 'glow_sweep' animation
  const hasGlowSweep = elements.some(el => (el.animation_type ?? el.animationType) === "glow_sweep");
  const glowLocalPath = path.join(jobDir, "gold_glow_bar.png");
  if (hasGlowSweep) {
    console.log(`[Job ${job.id}] Queueing gold glow bar download...`);
    downloads.push(downloadFile(`${SERVER_URL}/presets/gold_glow_bar.png`, glowLocalPath).catch(err => {
      console.error(`[Job ${job.id}] Failed to download gold glow bar:`, err.message);
    }));
  }

  await Promise.all(downloads);
  console.log(`[Job ${job.id}] All resources downloaded.`);

  // Filter out any icon elements whose download failed
  const activeIconElements = iconElements.filter(el => el.localPath && fs.existsSync(el.localPath));

  // ── BUILD OVERLAY FILTERS ───────────────────────────────────
  // Parse template config for logo position + text elements

  let logoX = 440, logoY = 100, logoW = 200, logoH = 200;
  let qrX = 0, qrY = 0, qrW = 0, qrH = 0, qrEl = null;
  const drawtextFilters = [];

  for (const el of elements) {
    if (el.visible === false) continue;

    // Convert percentage coordinates → pixel values
    const xPct = el.x_pct ?? el.x ?? 10;
    const yPct = el.y_pct ?? el.y ?? 10;
    const wPct = el.w_pct ?? el.w ?? 20;
    const hPct = el.h_pct ?? el.h ?? 8;

    const xPx = Math.round((xPct / 100) * VIDEO_W);
    const yPx = Math.round((yPct / 100) * VIDEO_H);
    const wPx = Math.round((wPct / 100) * VIDEO_W);
    const hPx = Math.round((hPct / 100) * VIDEO_H);

    if (el.type === "shop_logo") {
      logoX = xPx; logoY = yPx; logoW = wPx; logoH = hPx;
      continue;
    }

    if (el.type === "shop_qr") {
      qrX = xPx; qrY = yPx; qrW = wPx; qrH = hPx;
      qrEl = el;

      if (hasQrCode) {
        const headerTextSize = Math.round(hPx * 0.18); // ~18% of QR code height
        const headerFontPath = path.join(FONTS_DIR, "Outfit-Bold.ttf");
        const resolvedFont = fs.existsSync(headerFontPath) ? headerFontPath : FONT_PATH;
        
        const animType = el.animation_type ?? el.animationType ?? "fade";
        const startT = 0.2;
        const fadeDur = 0.5;
        const qrOpacity = (el.opacity ?? 100) / 100;
        const headerAlphaExpr = (animType === "none" || animType === "instant")
          ? `(${qrOpacity}*if(lt(t,${startT}),0,1))`
          : `(${qrOpacity}*if(lt(t,${startT}),0,if(lt(t,${startT + fadeDur}),(t-${startT})/${fadeDur},1)))`;

        let headerFilter = `drawtext=text='DIGI GOLD'`;
        headerFilter += `:x='${xPx} + (${wPx} - tw)/2':y='${yPx} - th - 12'`;
        headerFilter += `:fontsize=${headerTextSize}`;
        headerFilter += `:fontcolor=#E2C799`; // Gold/Yellow hex matching reference image
        headerFilter += `:fontfile='${resolvedFont}'`;
        headerFilter += `:alpha='${headerAlphaExpr}'`;

        drawtextFilters.push({
          filter: headerFilter,
          el: el,
          xPx: xPx,
          yPx: yPx,
          wPx: wPx,
          hPx: hPx,
          startT: startT
        });
      }
      continue;
    }

    if (el.type === "icon_image") {
      continue;
    }

    // ── Resolve placeholder text ────────────────────────────
    let txt = el.placeholder || "";
    txt = txt.replace(/\{\{rate_22k\}\}/g, job.rate_22k || "");
    txt = txt.replace(/\{\{rate_24k\}\}/g, job.rate_24k || "");
    txt = txt.replace(/\{\{rate_22k_8gm\}\}/g, job.rate_22k_8gm || "");
    txt = txt.replace(/\{\{rate_24k_8gm\}\}/g, job.rate_24k_8gm || "");
    txt = txt.replace(/\{\{rate_silver\}\}/g, job.silver_rate || "");
    txt = txt.replace(/\{\{silver_rate\}\}/g, job.silver_rate || "");
    txt = txt.replace(/\{\{rate_change_text\}\}/g, job.rate_change_text || "");
    txt = txt.replace(/\{\{shop_name\}\}/g, job.shop_name || "");
    txt = txt.replace(/\{\{shop_phone\}\}/g, job.shop_phone || "");
    txt = txt.replace(/\{\{shop_address\}\}/g, job.shop_address || "");
    txt = txt.replace(/\{\{occasion_text\}\}/g, job.festival_text || "");
    // Resolve fallback formatted date if needed
    let displayDate = job.formatted_date;
    if (!displayDate && job.scheduled_date) {
      const parts = job.scheduled_date.split("-");
      if (parts.length === 3) {
        const monthNames = [
          "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
          "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
        ];
        const day = parts[2];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const year = parts[0];
        if (monthIdx >= 0 && monthIdx < 12) {
          displayDate = `${day} - ${monthNames[monthIdx]} - ${year}`;
        }
      }
    }
    if (!displayDate) {
      const today = new Date();
      const monthNames = [
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
      ];
      displayDate = `${String(today.getDate()).padStart(2, '0')} - ${monthNames[today.getMonth()]} - ${today.getFullYear()}`;
    }

    txt = txt.replace(/\{\{date\}\}/g, displayDate);
    txt = txt.replace(/\{\{current_date\}\}/g, displayDate);

    // Dynamic placeholders 1-4
    for (let i = 1; i <= 4; i++) {
      const titleRegex = new RegExp(`\\{\\{placeholder_${i}_title\\}\\}`, "g");
      const priceRegex = new RegExp(`\\{\\{placeholder_${i}_price\\}\\}`, "g");
      txt = txt.replace(titleRegex, job[`placeholder_${i}_title`] || "");
      txt = txt.replace(priceRegex, job[`placeholder_${i}_price`] || "");
    }

    // ── Font color & Opacity ────────────────────────────────
    const elementOpacity = el.opacity ?? 100;
    const baseColor = parseColorToFFmpeg(el.color || "#FFFFFF") || "white";
    const rawFontSize = el.font_size ?? el.fontSize ?? 48;
    let fontSize = Math.round(rawFontSize);

    // Auto-compress font size if the wrapped text would exceed the element's height constraint
    const charLen = txt.trim().length;
    const isRegional = REGIONAL_SCRIPT_REGEX.test(txt);
    if (charLen > 0 && wPx > 0 && hPx > 0) {
      // Regional scripts (Tamil, Telugu) occupy more visual width per glyph
      const fontScaleFactor = isRegional ? 0.75 : 0.43;
      
      let testFontSize = fontSize;
      while (testFontSize > 18) {
        const charPerLine = Math.max(5, Math.floor(wPx / (testFontSize * fontScaleFactor)));
        const linesCount = Math.ceil(charLen / charPerLine);
        const totalHeight = linesCount * testFontSize * 1.25;
        if (totalHeight <= hPx) {
          break;
        }
        testFontSize--;
      }
      fontSize = testFontSize;
    }

    const fontScaleFactor = isRegional ? 0.75 : 0.43;
    const maxChars = Math.max(10, Math.floor(wPx / (fontSize * fontScaleFactor)));
    txt = wrapText(txt, maxChars);

    txt = escapeFFmpegText(txt);
    if (!txt.trim()) continue;

    // ── Animation & Staggered Timing ───────────────────────
    const elName = (el.name || "").toLowerCase();
    const elType = el.type || "";
    const rawPlaceholder = (el.placeholder || "").toLowerCase();

    let startT = 0.2;
    const fadeDur = 0.5;

    const isRateSlot = 
      elType.startsWith("rate_") || 
      elName.includes("circle") || 
      elName.includes("label") || 
      elName.includes("price") || 
      rawPlaceholder.includes("rate") || 
      rawPlaceholder.includes("gold") || 
      rawPlaceholder.includes("silver") ||
      rawPlaceholder.includes("1gm") ||
      rawPlaceholder.includes("8gm");

    // startT remains 0.2s for simultaneous entry

    const animType = el.animation_type ?? el.animationType ?? "fade";

    // ── Dynamic Alignment & Position Formulas ──────────────
    let baseX = `${xPx}`;
    if (el.align === "center") {
      baseX = `${xPx}+(${wPx}-text_w)/2`;
    } else if (el.align === "right") {
      baseX = `${xPx}+${wPx}-text_w`;
    }
    let baseY = `${yPx}+(${hPx}-text_h)/2`;

    let xFormula = baseX;
    let yFormula = baseY;

    if (animType === "slide_left") {
      // Slide in from right edge (+300px offset)
      xFormula = `(${baseX})+if(lt(t,${startT}),300,if(lt(t,${startT+fadeDur}),300*(1-(t-${startT})/${fadeDur}),0))`;
    } else if (animType === "slide_right") {
      // Slide in from left edge (-300px offset)
      xFormula = `(${baseX})-if(lt(t,${startT}),300,if(lt(t,${startT+fadeDur}),300*(1-(t-${startT})/${fadeDur}),0))`;
    } else if (animType === "slide_up") {
      // Slide in from below (+150px offset)
      yFormula = `(${baseY})+if(lt(t,${startT}),150,if(lt(t,${startT+fadeDur}),150*(1-(t-${startT})/${fadeDur}),0))`;
    } else if (animType === "slide_down") {
      // Slide in from above (-150px offset)
      yFormula = `(${baseY})-if(lt(t,${startT}),150,if(lt(t,${startT+fadeDur}),150*(1-(t-${startT})/${fadeDur}),0))`;
    }

    // ── Build filter string ─────────────────────────────────
    let filter = `drawtext=text='${txt}'`;
    filter += `:x=${xFormula}:y=${yFormula}`;
    filter += `:fontsize=${fontSize}`;
    filter += `:fontcolor=${baseColor}`;

    // Scale by base element opacity percentage
    const baseOpacity = elementOpacity / 100;
    const alphaExpr = animType === "none" || animType === "instant"
      ? `(${baseOpacity}*if(lt(t,${startT}),0,1))`
      : `(${baseOpacity}*if(lt(t,${startT}),0,if(lt(t,${startT + fadeDur}),(t-${startT})/${fadeDur},1)))`;
    filter += `:alpha='${alphaExpr}'`;

    // Add premium font if available, fallback to regional font for Indian script characters
    let elementFontPath = FONT_PATH;
    const fontName = el.font_family || el.fontFamily;
    const isRegionalText = REGIONAL_SCRIPT_REGEX.test(txt);

    if (isRegionalText) {
      const regionalFontCandidates = [
        "/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansMalayalam-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansTelugu-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansKannada-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        path.join(FONTS_DIR, "NotoSansTamil-Bold.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
      ];
      for (const fontCandidate of regionalFontCandidates) {
        if (fs.existsSync(fontCandidate)) {
          elementFontPath = fontCandidate;
          break;
        }
      }
    } else if (fontName && PREMIUM_FONTS[fontName]) {
      const localFontPath = path.join(FONTS_DIR, `${fontName}.ttf`);
      if (fs.existsSync(localFontPath)) {
        elementFontPath = localFontPath;
      }
    }

    if (elementFontPath) {
      filter += `:fontfile='${elementFontPath}'`;
    }

    // Text outline for readability on video backgrounds
    const rawBorderWidth = el.border_width ?? el.borderWidth ?? 0;
    const borderWidth = Math.round(rawBorderWidth);
    const rawBorderColor = el.border_color ?? el.borderColor ?? "black";
    const baseBorderColor = parseColorToFFmpeg(rawBorderColor) || "black";
    if (borderWidth > 0) {
      filter += `:borderw=${borderWidth}:bordercolor=${baseBorderColor}`;
    }

    // ── Background box (semi-transparent) ───────────────────
    const bgColor = el.bg_color ?? el.bgColor;
    if (bgColor && bgColor !== "transparent") {
      const baseBoxColor = parseColorToFFmpeg(bgColor);
      if (baseBoxColor) {
        filter += `:box=1:boxcolor=${baseBoxColor}:boxborderw=8`;
      }
    }

    let canvasFilter = `drawtext=text='${txt}'`;
    let canvasX = "0";
    if (el.align === "center") {
      canvasX = `(w-text_w)/2`;
    } else if (el.align === "right") {
      canvasX = `w-text_w`;
    }
    canvasFilter += `:x=${canvasX}:y=(h-text_h)/2`;
    canvasFilter += `:fontsize=${fontSize}`;
    canvasFilter += `:fontcolor=${baseColor}`;
    canvasFilter += `:alpha='${alphaExpr}'`;
    if (elementFontPath) {
      canvasFilter += `:fontfile='${elementFontPath}'`;
    }
    if (borderWidth > 0) {
      canvasFilter += `:borderw=${borderWidth}:bordercolor=${baseBorderColor}`;
    }

    drawtextFilters.push({
      filter: filter,
      canvasFilter: canvasFilter,
      el: el,
      xPx: xPx,
      yPx: yPx,
      wPx: wPx,
      hPx: hPx,
      startT: startT
    });
  }

  // ══════════════════════════════════════════════════════════
  //  STEP 1: Overlay logo + text on product video (VIDEO ONLY)
  // ══════════════════════════════════════════════════════════
  console.log(`[Job ${job.id}] Step 1: Overlaying logo + text on product video...`);

  // Build inputs list and track stream indexes dynamically
  const step1InputsRaw = [
    `-i "${baseVideoPath}"`,
    `-loop 1 -i "${logoPath}"`
  ];

  let nextStreamIdx = 2;
  let qrStreamIdx = -1;
  if (hasQrCode) {
    step1InputsRaw.push(`-loop 1 -i "${qrPath}"`);
    qrStreamIdx = nextStreamIdx;
    nextStreamIdx++;
  }

  let sparkStreamIdx = -1;
  if (hasSparkle) {
    step1InputsRaw.push(`-loop 1 -i "${sparkLocalPath}"`);
    sparkStreamIdx = nextStreamIdx;
    nextStreamIdx++;
  }

  let bangleStreamIdx = -1;
  if (hasBangle) {
    step1InputsRaw.push(`-loop 1 -i "${bangleLocalPath}"`);
    bangleStreamIdx = nextStreamIdx;
    nextStreamIdx++;
  }

  let glowStreamIdx = -1;
  if (hasGlowSweep) {
    step1InputsRaw.push(`-loop 1 -i "${glowLocalPath}"`);
    glowStreamIdx = nextStreamIdx;
    nextStreamIdx++;
  }

  activeIconElements.forEach((el) => {
    el.streamIndex = nextStreamIdx;
    step1InputsRaw.push(`-loop 1 -i "${el.localPath}"`);
    nextStreamIdx++;
  });

  let filterComplex = "";

  let sparkStreamLabel = "";
  let bangleStreamLabel = "";
  let glowStreamLabel = "";

  const colorkeys = [];
  if (hasSparkle) {
    colorkeys.push(`[${sparkStreamIdx}:v]colorkey=0x000000:0.15:0.1[spark_clean]`);
    sparkStreamLabel = "spark_clean";
  }
  if (hasBangle) {
    colorkeys.push(`[${bangleStreamIdx}:v]colorkey=0x000000:0.15:0.1[bangle_clean]`);
    bangleStreamLabel = "bangle_clean";
  }
  if (hasGlowSweep) {
    colorkeys.push(`[${glowStreamIdx}:v]colorkey=0x000000:0.15:0.1[glow_clean]`);
    glowStreamLabel = "glow_clean";
  }

  if (colorkeys.length > 0) {
    filterComplex = colorkeys.join("; ");
  }

  // Scale and overlay logo with animation
  const logoStartT = 0.2;
  const logoFadeDur = 0.5;

  let logoFilter = applyImageAnimation(
    logoEl || { type: "shop_logo" },
    logoW, logoH, logoX, logoY,
    logoStartT, logoFadeDur,
    1,
    sparkStreamLabel,
    bangleStreamLabel,
    glowStreamLabel,
    "0:v",
    "logo_layer"
  );

  if (filterComplex === "") {
    filterComplex += logoFilter.substring(2);
  } else {
    filterComplex += logoFilter;
  }

  let currentLayer = "logo_layer";

  if (hasQrCode && qrEl) {
    const nextLayer = "qr_layer";
    const qrStartT = 0.2;
    const qrFadeDur = 0.5;

    let qrFilter = applyImageAnimation(
      qrEl,
      qrW, qrH, qrX, qrY,
      qrStartT, qrFadeDur,
      qrStreamIdx,
      sparkStreamLabel,
      bangleStreamLabel,
      glowStreamLabel,
      currentLayer,
      nextLayer
    );
    filterComplex += qrFilter;
    currentLayer = nextLayer;
  }

  // Overlay each shape/badge icon image in order
  activeIconElements.forEach((el, index) => {
    const nextLayer = `lay${index}`;
    const xPct = el.x_pct ?? el.x ?? 10;
    const yPct = el.y_pct ?? el.y ?? 10;
    const wPct = el.w_pct ?? el.w ?? 20;
    const hPct = el.h_pct ?? el.h ?? 8;

    const xPx = Math.round((xPct / 100) * VIDEO_W);
    const yPx = Math.round((yPct / 100) * VIDEO_H);
    const wPx = Math.round((wPct / 100) * VIDEO_W);
    const hPx = Math.round((hPct / 100) * VIDEO_H);

    let startT = 0.2;
    const name = (el.name || "").toLowerCase();
    const animGroup = el.animation_group ?? el.animationGroup ?? "none";

    // startT remains 0.2s for simultaneous entry
    const fadeDur = 0.5;

    filterComplex += applyImageAnimation(
      el,
      wPx, hPx, xPx, yPx,
      startT, fadeDur,
      el.streamIndex,
      sparkStreamLabel,
      bangleStreamLabel,
      glowStreamLabel,
      currentLayer,
      nextLayer
    );
    currentLayer = nextLayer;
  });

  // Chain drawtext filters onto the final overlay layer
  let lastLabel = currentLayer;
  drawtextFilters.forEach((item, idx) => {
    const txtLabel = `txt${idx}`;
    filterComplex += `; [${lastLabel}]${item.filter}[${txtLabel}]`;
    
    const animType = item.el.animation_type ?? item.el.animationType ?? "fade";
    if (animType === "glow_sweep" && glowStreamLabel) {
      const nextLabel = `glow_txt${idx}`;
      const glowW = Math.round(item.hPx * 0.8);
      const startX = -glowW;
      const endX = item.wPx;
      const sweepDur = 0.6;
      
      const glowXExpr = `(${startX})+if(lt(t,${item.startT}),0,if(lt(t,${item.startT+sweepDur}),(${endX - startX})*(t-${item.startT})/${sweepDur},${endX - startX}))`;
      
      const canvasLabel = `canvas_glow_${idx}`;
      const txtCanvasLabel = `txt_canvas_glow_${idx}`;
      const scaledGlow = `scaled_glow_txt_${idx}`;
      const glowMoving = `glow_moving_txt_${idx}`;
      const maskedGlow = `masked_glow_txt_${idx}`;
      
      filterComplex += `; color=c=black@0:s=${item.wPx}x${item.hPx}:d=20,format=rgba[${canvasLabel}]`;
      filterComplex += `; [${canvasLabel}]${item.canvasFilter}[${txtCanvasLabel}_raw]`;
      filterComplex += `; [${txtCanvasLabel}_raw]split=2[${txtCanvasLabel}][${txtCanvasLabel}_mask]`;
      filterComplex += `; [${glowStreamLabel}]scale=${glowW}:${item.hPx}[${scaledGlow}]`;
      filterComplex += `; [${txtCanvasLabel}][${scaledGlow}]overlay=x='${glowXExpr}':y=0:shortest=1:enable='between(t,${item.startT},${item.startT+sweepDur})'[${glowMoving}]`;
      filterComplex += `; [${glowMoving}][${txtCanvasLabel}_mask]alphamerge[${maskedGlow}]`;
      filterComplex += `; [${txtLabel}][${maskedGlow}]overlay=x=${item.xPx}:y=${item.yPx}:shortest=1:enable='between(t,${item.startT},${item.startT+sweepDur})'[${nextLabel}]`;
      
      lastLabel = nextLabel;
    } else if (animType === "gold_sparkle" && sparkStreamLabel) {
      const nextLabel = `spark_txt${idx}`;
      const sparkW = Math.round(item.hPx * 1.6);
      const sparkH = Math.round(item.hPx * 1.6);
      const sparkX = Math.round(item.xPx - (sparkW - item.wPx) / 2);
      const sparkY = Math.round(item.yPx - (sparkH - item.hPx) / 2);
      
      const canvasLabel = `canvas_spark_${idx}`;
      const txtCanvasLabel = `txt_canvas_spark_${idx}`;
      const scaledSpark = `scaled_spark_txt_${idx}`;
      const sparkMoving = `spark_moving_txt_${idx}`;
      const maskedSpark = `masked_spark_txt_${idx}`;
      
      filterComplex += `; color=c=black@0:s=${item.wPx}x${item.hPx}:d=20,format=rgba[${canvasLabel}]`;
      filterComplex += `; [${canvasLabel}]${item.canvasFilter}[${txtCanvasLabel}_raw]`;
      filterComplex += `; [${txtCanvasLabel}_raw]split=2[${txtCanvasLabel}][${txtCanvasLabel}_mask]`;
      filterComplex += `; [${sparkStreamLabel}]scale=${sparkW}:${sparkH},rotate=angle='t*1.5':fillcolor=none,fade=in:st=${item.startT}:d=0.3:alpha=1,fade=out:st=${item.startT+0.8}:d=0.3:alpha=1[${scaledSpark}]`;
      filterComplex += `; [${txtCanvasLabel}][${scaledSpark}]overlay=x='(w-iw)/2':y='(h-ih)/2':shortest=1:enable='between(t,${item.startT},${item.startT+1.1})'[${sparkMoving}]`;
      filterComplex += `; [${sparkMoving}][${txtCanvasLabel}_mask]alphamerge[${maskedSpark}]`;
      filterComplex += `; [${txtLabel}][${maskedSpark}]overlay=x=${item.xPx}:y=${item.yPx}:shortest=1:enable='between(t,${item.startT},${item.startT+1.1})'[${nextLabel}]`;
      
      lastLabel = nextLabel;
    } else if (animType === "bangle_roll" && bangleStreamLabel) {
      const nextLabel = `bangle_txt${idx}`;
      const rollDur = 0.8;
      const bangleW = Math.round(item.hPx * 1.3);
      const bangleH = Math.round(item.hPx * 1.3);
      const startX = -Math.round(bangleW / 2);
      const endX = item.wPx - Math.round(bangleW / 2);
      const bangleY = -Math.round((bangleH - item.hPx) / 2);
      
      const bangleXExpr = `(${startX})+if(lt(t,${item.startT}),0,if(lt(t,${item.startT+rollDur}),(${endX - startX})*(t-${item.startT})/${rollDur},${endX - startX}))`;
      const bangleRotExpr = `(t-${item.startT})*5`;
      
      const canvasLabel = `canvas_bangle_${idx}`;
      const txtCanvasLabel = `txt_canvas_bangle_${idx}`;
      const scaledBangle = `scaled_bangle_txt_${idx}`;
      const croppedCanvas = `cropped_canvas_txt_${idx}`;
      const bangleMoving = `bangle_moving_txt_${idx}`;
      const maskedBangle = `masked_bangle_txt_${idx}`;
      
      filterComplex += `; color=c=black@0:s=${item.wPx}x${item.hPx}:d=20,format=rgba[${canvasLabel}]`;
      filterComplex += `; [${canvasLabel}]${item.canvasFilter}[${txtCanvasLabel}_raw]`;
      filterComplex += `; [${txtCanvasLabel}_raw]split=2[${txtCanvasLabel}][${txtCanvasLabel}_mask]`;
      filterComplex += `; [${bangleStreamLabel}]scale=${bangleW}:${bangleH},rotate=angle='if(lt(t,${item.startT}),0,${bangleRotExpr})':fillcolor=none,fade=in:st=${item.startT}:d=0.1:alpha=1,fade=out:st=${item.startT+rollDur}:d=0.1:alpha=1[${scaledBangle}]`;
      // Create sliding mask for text reveal
      filterComplex += `; color=c=black:s=${item.wPx}x${item.hPx}:d=20[${canvasLabel}_mask_bg]`;
      filterComplex += `; color=c=white:s=${item.wPx}x${item.hPx}:d=20[${canvasLabel}_mask_fg]`;
      filterComplex += `; [${canvasLabel}_mask_bg][${canvasLabel}_mask_fg]overlay=x='-w+w*if(lt(t,${item.startT}),0,if(lt(t,${item.startT+rollDur}),(t-${item.startT})/${rollDur},1))':y=0:shortest=1[${croppedCanvas}]`;
      // Merge text with sliding mask
      filterComplex += `; [${txtCanvasLabel}][${croppedCanvas}]alphamerge[${canvasLabel}_txt_drawn]`;
      filterComplex += `; [${canvasLabel}_txt_drawn][${scaledBangle}]overlay=x='${bangleXExpr}':y='${bangleY}':shortest=1:enable='between(t,${item.startT},${item.startT+rollDur+0.2})'[${bangleMoving}]`;
      filterComplex += `; [${bangleMoving}][${txtCanvasLabel}_mask]alphamerge[${maskedBangle}]`;
      filterComplex += `; [${txtLabel}][${maskedBangle}]overlay=x=${item.xPx}:y=${item.yPx}:shortest=1:enable='gte(t,${item.startT})'[${nextLabel}]`;
      
      lastLabel = nextLabel;
    } else {
      lastLabel = txtLabel;
    }
  });

  // Write filter complex to a file to prevent shell escaping and command length issues
  const filterScriptPath = path.join(jobDir, "filter.txt");
  fs.writeFileSync(filterScriptPath, filterComplex);

  const step1Inputs = step1InputsRaw;

  const step1Cmd = [
    `ffmpeg -y`,
    ...step1Inputs,
    `-filter_complex_script "${filterScriptPath}"`,
    `-map "[${lastLabel}]"`,
    `-an`,                      // Strip all audio (video-only output)
    `-c:v libx264 -preset fast -pix_fmt yuv420p`,
    `"${layeredVideoPath}"`
  ].join(" ");

  console.log(`[Job ${job.id}] FFmpeg Step 1:\n${step1Cmd}\n`);
  execSync(step1Cmd, { stdio: "inherit" });
  console.log(`[Job ${job.id}] Step 1 complete ✓`);

  // ══════════════════════════════════════════════════════════
  //  STEP 2: Concat [overlayed video] + [outro] + add music
  // ══════════════════════════════════════════════════════════
  console.log(`[Job ${job.id}] Step 2: Concatenating with outro + adding background music...`);

  const mainDuration = getMediaDuration(layeredVideoPath);
  const outroDuration = getMediaDuration(outroPath);
  const totalDuration = mainDuration + outroDuration;
  const fadeOutStart = Math.max(0, totalDuration - 0.5);

  console.log(`[Job ${job.id}] Combined duration = ${totalDuration}s (main: ${mainDuration}s, outro: ${outroDuration}s). Fade out starts at ${fadeOutStart}s.`);

  // Both the main video and the outro may have different resolutions.
  // FFmpeg concat requires identical dimensions, so we scale and pad both streams to match.
  // We apply video fade-out (0.5s) at the end of the concatenated stream.
  const concatFilter = `[0:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=decrease,pad=${VIDEO_W}:${VIDEO_H}:(ow-iw)/2:(oh-ih)/2,setsar=1[scaled_main]; [1:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=decrease,pad=${VIDEO_W}:${VIDEO_H}:(ow-iw)/2:(oh-ih)/2,setsar=1[scaled_outro]; [scaled_main][scaled_outro]concat=n=2:v=1:a=0,fade=t=out:st=${fadeOutStart}:d=0.5[outv]`;

  let step2Cmd = "";
  if (audioUrl) {
    // With background music: concat video streams + add music track and fade audio
    //   [0] = layered_main.mp4  (video only)
    //   [1] = outro.mp4         (may have audio, we ignore it)
    //   [2] = bg_music.mp3
    step2Cmd = [
      `ffmpeg -y`,
      `-i "${layeredVideoPath}"`,
      `-i "${outroPath}"`,
      `-i "${audioTrackPath}"`,
      `-filter_complex "${concatFilter}"`,
      `-map "[outv]"`,
      `-map 2:a`,               // Use music track as audio
      `-filter:a "afade=t=out:st=${fadeOutStart}:d=0.5"`,
      `-c:v libx264 -preset fast -pix_fmt yuv420p`,
      `-c:a aac -b:a 192k`,
      `-shortest`,              // End when shorter stream (video) ends
      `"${finalOutputPath}"`
    ].join(" ");
  } else {
    // No music: just concat video streams, no audio output
    step2Cmd = [
      `ffmpeg -y`,
      `-i "${layeredVideoPath}"`,
      `-i "${outroPath}"`,
      `-filter_complex "${concatFilter}"`,
      `-map "[outv]"`,
      `-c:v libx264 -preset fast -pix_fmt yuv420p`,
      `"${finalOutputPath}"`
    ].join(" ");
  }

  console.log(`[Job ${job.id}] FFmpeg Step 2:\n${step2Cmd}\n`);
  execSync(step2Cmd, { stdio: "inherit" });
  console.log(`[Job ${job.id}] Step 2 complete ✓`);

  // ── Cleanup temp files ────────────────────────────────────
  console.log(`[Job ${job.id}] Final render complete! Cleaning temp files...`);
  fs.rmSync(jobDir, { recursive: true, force: true });

  const outputUrl = `http://${VPS_PUBLIC_IP}:${VPS_PORT}/downloads/${job.id}_final.mp4`;
  console.log(`[Job ${job.id}] Output URL: ${outputUrl}`);
  return outputUrl;
}

// ── Configurable Cleanups ─────────────────────────────────────────
function startCleanupScheduler() {
  // 1. Daily Purge check (runs every minute)
  setInterval(() => {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utcMs + 3600000 * 5.5);

    const targetParts = currentCleanupTime.split(":");
    const targetHour = parseInt(targetParts[0]) || 21;
    const targetMin = parseInt(targetParts[1]) || 0;

    if (ist.getHours() === targetHour && ist.getMinutes() === targetMin) {
      console.log(`[Scheduler] Daily Purge triggered at ${currentCleanupTime} IST (deleting files older than 12 hours)...`);
      try {
        const nowMs = Date.now();
        const cutoffMs = 12 * 3600000; // 12 hours

        for (const file of fs.readdirSync(DOWNLOADS_DIR)) {
          const filePath = path.join(DOWNLOADS_DIR, file);
          const stats = fs.statSync(filePath);
          const ageMs = nowMs - stats.mtimeMs;

          if (ageMs > cutoffMs) {
            fs.unlinkSync(filePath);
            console.log(`[Scheduler] Daily Purged: ${file}`);
          }
        }
        console.log("[Scheduler] Daily Purge complete ✓");
      } catch (err) {
        console.error("[Scheduler] Daily Purge error:", err);
      }
    }
  }, 60000);

  // 2. Retention Hourly Purge check (runs every hour)
  setInterval(() => {
    console.log(`[Scheduler] Running retention purge (retention: ${currentRetentionHours} hours)...`);
    try {
      const nowMs = Date.now();
      const cutoffMs = currentRetentionHours * 3600000;

      for (const file of fs.readdirSync(DOWNLOADS_DIR)) {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        const ageMs = nowMs - stats.mtimeMs;

        if (ageMs > cutoffMs) {
          fs.unlinkSync(filePath);
          console.log(`[Scheduler] Retention Purged: ${file} (Age: ${(ageMs / 3600000).toFixed(1)} hrs)`);
        }
      }
    } catch (err) {
      console.error("[Scheduler] Retention Purge error:", err);
    }
  }, 3600000); // Check once per hour
}

async function uploadToPresignedUrl(filePath, presignedUrl) {
  const fetch = (await import("node-fetch")).default;
  const stats = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);
  const res = await fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": stats.size.toString()
    },
    body: fileStream
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`R2 upload failed: ${res.statusText} (${txt})`);
  }
}

// ── Auto Updater ───────────────────────────────────────────────
async function checkForUpdates() {
  try {
    console.log("[Updater] Checking for worker script updates from server...");
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(`${SERVER_URL}/vps_render_worker.js`);
    if (!response.ok) {
      console.log("[Updater] No update file found on server or server offline.");
      return;
    }
    const remoteContent = await response.text();
    const localPath = __filename;
    const localContent = fs.readFileSync(localPath, "utf8");
    
    if (remoteContent && remoteContent.length > 1000 && remoteContent !== localContent) {
      console.log("[Updater] New version detected! Updating local worker script...");
      fs.writeFileSync(localPath, remoteContent);
      console.log("[Updater] Update complete. Restarting worker process...");
      process.exit(0); // Exit process, PM2 will automatically restart it with the updated script!
    } else {
      console.log("[Updater] Worker script is up-to-date.");
    }
  } catch (err) {
    console.error("[Updater] Update check failed:", err.message);
  }
}

// ── Main Worker Loop ───────────────────────────────────────────
async function startWorker() {
  detectFont();
  await checkForUpdates();

  console.log(`\n${"═".repeat(52)}`);
  console.log(`  Aurum VPS Render Worker v2`);
  console.log(`  Worker ID : ${WORKER_ID}`);
  console.log(`  API       : ${SERVER_URL}/api/renders`);
  console.log(`  Font      : ${FONT_PATH || "System default"}`);
  console.log(`  Downloads : http://${VPS_PUBLIC_IP}:${VPS_PORT}/downloads`);
  console.log(`  Cleanup   : 9:00 PM IST daily`);
  console.log(`${"═".repeat(52)}\n`);

  const fetch = (await import("node-fetch")).default;
  startCleanupScheduler();

  while (true) {
    try {
      await checkForUpdates();
      const res = await fetch(`${SERVER_URL}/api/renders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dequeue", worker_id: WORKER_ID }),
      });
      const data = await res.json();

      if (data.vps_cleanup_time) {
        currentCleanupTime = data.vps_cleanup_time;
      }
      if (data.render_retention_hours !== undefined) {
        currentRetentionHours = data.render_retention_hours;
      }

      if (data.id) {
        console.log(`\n[+] Dequeued Render Job: ${data.id}`);

        try {
          const videoUrl = await processVideoJob(data);

          let finalUrl = videoUrl;
          if (data.presigned_upload_url && data.r2_public_url) {
            console.log(`[Job ${data.id}] Uploading final video to Cloudflare R2...`);
            const finalOutputPath = path.join(DOWNLOADS_DIR, `${data.id}_final.mp4`);
            await uploadToPresignedUrl(finalOutputPath, data.presigned_upload_url);
            console.log(`[Job ${data.id}] R2 upload successful!`);
            finalUrl = data.r2_public_url;
            
            // Delete local file to free space on VPS
            try {
              fs.unlinkSync(finalOutputPath);
              console.log(`[Job ${data.id}] Cleaned up local file: ${finalOutputPath}`);
            } catch (cleanupErr) {
              console.error(`[Job ${data.id}] Local file cleanup failed:`, cleanupErr);
            }
          }

          await fetch(`${SERVER_URL}/api/renders`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.id,
              status: "Completed",
              rendered_video_url: finalUrl,
            }),
          });
          console.log(`[+] Job ${data.id} → Completed ✓\n`);
        } catch (jobErr) {
          console.error(`[-] Job ${data.id} → FAILED:`, jobErr.message);

          await fetch(`${SERVER_URL}/api/renders`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.id,
              status: "Failed",
              error_message: jobErr.message || "FFmpeg execution failed",
            }),
          });
        }
      }
    } catch (err) {
      console.error("[-] Poll error:", err.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

startWorker();
