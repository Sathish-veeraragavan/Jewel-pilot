# Workspace Rules - Jewellery Video Automation SaaS Platform

## General Guidelines
- Build the application module-by-module. Do not generate the complete application in one step.
- Follow a White, Blue, and Gold Accent theme with rounded cards and minimal design (no unnecessary animations).
- Keep code clean, reusable, and structured under a clear service layer with hooks, context, and utility functions.
- Supabase stores metadata only. Cloudflare R2 stores all files. Hostinger VPS performs rendering.
- Rendered videos are temporary and must be cleaned up automatically after download.
