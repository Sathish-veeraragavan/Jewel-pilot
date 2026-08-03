const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const presetsDir = path.resolve(process.cwd(), "public/presets");
if (!fs.existsSync(presetsDir)) {
  fs.mkdirSync(presetsDir, { recursive: true });
}

// ── COLOR GRADIENTS & SCHEMES ──────────────────────────────────────────
const GRADIENTS = {
  navy: {
    bg1: "#0d2035",
    bg2: "#1c3c5f",
    bg3: "#081320"
  },
  pink: {
    bg1: "#3c001c",
    bg2: "#7c0c43",
    bg3: "#240010"
  },
  purple: {
    bg1: "#1d0033",
    bg2: "#3f0a67",
    bg3: "#120021"
  },
  green: {
    bg1: "#0a2618",
    bg2: "#194d34",
    bg3: "#05130b"
  },
  maroon: {
    bg1: "#280303",
    bg2: "#570c0c",
    bg3: "#190101"
  }
};

const GOLD_GRADIENT = `
  <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#BF953F" />
    <stop offset="25%" stop-color="#FCF6BA" />
    <stop offset="50%" stop-color="#B38728" />
    <stop offset="75%" stop-color="#FBF5B7" />
    <stop offset="100%" stop-color="#AA771C" />
  </linearGradient>
`;

// ── NEW SHAPE: TRADITIONAL ORNATE BRACKET BANNER (AS REQUESTED) ────────
function getBracketSvg(colorName) {
  const g = GRADIENTS[colorName];
  return `
    <svg width="400" height="100" viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-grad-${colorName}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${g.bg2}" />
          <stop offset="50%" stop-color="${g.bg1}" />
          <stop offset="100%" stop-color="${g.bg3}" />
        </linearGradient>
        ${GOLD_GRADIENT}
      </defs>
      
      <!-- Ornate Bracket Body -->
      <path d="M 40,15 
               L 180,15 
               Q 200,8 220,15 
               L 360,15 
               Q 380,22 380,35 
               Q 395,50 380,65 
               Q 380,78 360,85 
               L 220,85 
               Q 200,92 180,85 
               L 40,85 
               Q 20,78 20,65 
               Q 5,50 20,35 
               Q 20,22 40,15 Z" 
            fill="url(#bg-grad-${colorName})" />
            
      <!-- Outer Gold Line Border -->
      <path d="M 40,17 
               L 179,17 
               Q 200,10 221,17 
               L 360,17 
               Q 378,24 378,35 
               Q 392,50 378,65 
               Q 378,76 360,83 
               L 221,83 
               Q 200,90 179,83 
               L 40,83 
               Q 22,76 22,65 
               Q 8,50 22,35 
               Q 22,24 40,17 Z" 
            fill="none" stroke="url(#gold-grad)" stroke-width="2" />
            
      <!-- Inner Accent Dash Line -->
      <path d="M 42,22 
               L 177,22 
               Q 200,15 223,22 
               L 358,22 
               Q 372,28 372,35 
               Q 384,50 372,65 
               Q 372,72 358,78 
               L 223,78 
               Q 200,85 177,78 
               L 42,78 
               Q 28,72 28,65 
               Q 16,50 28,35 
               Q 28,28 42,22 Z" 
            fill="none" stroke="url(#gold-grad)" stroke-width="1" opacity="0.6" stroke-dasharray="3,1.5" />
    </svg>
  `;
}

// ── SHAPE 1: RECTANGULAR BANNER WITH NOTCHED CORNERS ───────────────────
function getNotchedSvg(colorName) {
  const g = GRADIENTS[colorName];
  return `
    <svg width="600" height="120" viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-grad-${colorName}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${g.bg2}" />
          <stop offset="50%" stop-color="${g.bg1}" />
          <stop offset="100%" stop-color="${g.bg3}" />
        </linearGradient>
        ${GOLD_GRADIENT}
      </defs>
      
      <path d="M 25,10 
               L 575,10 
               L 590,25 
               L 590,95 
               L 575,110 
               L 25,110 
               L 10,95 
               L 10,25 Z" 
            fill="url(#bg-grad-${colorName})" />
            
      <path d="M 25,12 
               L 575,12 
               L 588,25 
               L 588,95 
               L 575,108 
               L 25,108 
               L 12,95 
               L 12,25 Z" 
            fill="none" stroke="url(#gold-grad)" stroke-width="2.5" />
            
      <path d="M 27,17 
               L 573,17 
               L 583,27 
               L 583,93 
               L 573,103 
               L 27,103 
               L 17,93 
               L 17,27 Z" 
            fill="none" stroke="url(#gold-grad)" stroke-width="1" opacity="0.7" />
    </svg>
  `;
}

// ── SHAPE 2: SLEEK ROUNDED PILL BANNER ─────────────────────────────────
function getPillSvg(colorName) {
  const g = GRADIENTS[colorName];
  return `
    <svg width="600" height="120" viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-grad-${colorName}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${g.bg2}" />
          <stop offset="50%" stop-color="${g.bg1}" />
          <stop offset="100%" stop-color="${g.bg3}" />
        </linearGradient>
        ${GOLD_GRADIENT}
      </defs>
      
      <rect x="10" y="10" width="580" height="100" rx="50" ry="50" fill="url(#bg-grad-${colorName})" />
      <rect x="12" y="12" width="576" height="96" rx="48" ry="48" fill="none" stroke="url(#gold-grad)" stroke-width="2.5" />
      <rect x="17" y="17" width="566" height="86" rx="43" ry="43" fill="none" stroke="url(#gold-grad)" stroke-width="1" opacity="0.6" />
    </svg>
  `;
}

// ── SHAPE 3: SOLID CIRCULAR DISC BADGE ──────────────────────────────────
function getCircleSvg(colorName) {
  const g = GRADIENTS[colorName];
  return `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-grad-${colorName}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${g.bg2}" />
          <stop offset="50%" stop-color="${g.bg1}" />
          <stop offset="100%" stop-color="${g.bg3}" />
        </linearGradient>
        ${GOLD_GRADIENT}
      </defs>
      
      <circle cx="100" cy="100" r="90" fill="url(#bg-grad-${colorName})" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="url(#gold-grad)" stroke-width="2.5" />
      <circle cx="100" cy="100" r="83" fill="none" stroke="url(#gold-grad)" stroke-width="1" opacity="0.6" />
    </svg>
  `;
}

// ── BATCH RENDER FUNCTION ──────────────────────────────────────────────
async function renderAll() {
  const tasks = [
    // Circle Badges (overwrite the old basic ones)
    { svg: getCircleSvg("navy"), name: "circle_blue_gold_border.png" },
    { svg: getCircleSvg("green"), name: "circle_green_gold_border.png" },
    { svg: getCircleSvg("pink"), name: "circle_red_gold_border.png" }, // red mapped to pink
    
    // Rectangular Banners (overwrite the old basic ones)
    { svg: getNotchedSvg("navy"), name: "rect_blue_gold_border.png" },
    { svg: getNotchedSvg("green"), name: "rect_green_gold_border.png" },
    { svg: getNotchedSvg("maroon"), name: "rect_maroon_gold_border.png" },

    // Pill-shaped Banners
    { svg: getPillSvg("navy"), name: "pill_blue_gold_border.png" },
    { svg: getPillSvg("pink"), name: "pill_pink_gold_border.png" },
    { svg: getPillSvg("purple"), name: "pill_purple_gold_border.png" },
    { svg: getPillSvg("green"), name: "pill_green_gold_border.png" },

    // New Ornate Bracket Banners (for individual price tags)
    { svg: getBracketSvg("navy"), name: "bracket_blue_gold.png" },
    { svg: getBracketSvg("pink"), name: "bracket_pink_gold.png" },
    { svg: getBracketSvg("purple"), name: "bracket_purple_gold.png" },
    { svg: getBracketSvg("green"), name: "bracket_green_gold.png" },
    { svg: getBracketSvg("maroon"), name: "bracket_maroon_gold.png" },
  ];

  console.log("Rasterizing premium vectors with sharp...");
  for (const t of tasks) {
    try {
      const outPath = path.join(presetsDir, t.name);
      await sharp(Buffer.from(t.svg))
        .png()
        .toFile(outPath);
      console.log(`Successfully generated: ${t.name} -> ${outPath}`);
    } catch (err) {
      console.error(`Failed to generate ${t.name}:`, err);
    }
  }
}

renderAll();
