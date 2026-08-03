---
name: jewellery-video-automation
description: Comprehensive architecture, rules, deduplication constraints, scheduler logic, and FFmpeg rendering specifications for the Jewellery Video Automation SaaS Platform.
---

# Jewellery Video Automation SaaS Platform - Comprehensive Specification

## 1. High-Level Architecture
- **Supabase**: Metadata storage only (Shops, Profiles/RBAC, Subscriptions, Videos, Templates, Gold Rates, Schedules, Occasions/Festivals, Downloads).
- **Cloudflare R2**: Master asset storage (Raw base product videos, shop logos, frame overlay templates, outros).
- **Hostinger VPS**: On-demand and batch FFmpeg video rendering pipeline.
- **Next.js Web Application**: Frontend portal for Super Admin, Sales Admin, and Shop Users (Mobile/Desktop Web).

---

## 2. Core Business Workflows & Functional Requirements

### A. Role-Based Access Control (RBAC) & Authentication
- **Roles**: `super_admin`, `admin` (Sales Admin), `shop_user`.
- **RBAC Enforcement**:
  - `super_admin`: Full system control (manage shops, update subscriptions, set daily gold/silver rates, trigger auto-schedulers, override video templates).
  - `admin` (Sales Admin): Shop onboarding, initial shop information updates, logo upload to R2, subscription initialization (status `pending_approval`).
  - `shop_user`: Dedicated portal access. Can **only** view and download their own daily scheduled videos. No cross-shop access or administrative privilege.
- **Authentication**: Strict validation of Supabase JWT + `profiles` table role. Role redirection on login prevents unauthorized panel access.

### B. Daily Content Layering & Overlay Rules
- **Video Composition (12–15 sec main video + Outro)**:
  1. Base Video (from R2)
  2. Frame/Template Overlay (Gray areas top/bottom, center dynamic canvas)
  3. Dynamic Text & Assets:
     - Shop Logo (R2)
     - Shop Phone & Address
     - Current Date
     - **Daily Precious Metal Rates**: 22K Gold, 24K Gold, Silver price (updated daily by Admin/Super Admin).
  4. **Festival / Occasion Mode**:
     - On normal days: Omit tagline/festival wishes, render default layout with rates & shop info.
     - On festival/event days (pre-configured in Supabase `occasions` table by Admin): Automatically inject festival tagline/wishes (e.g., "Happy New Year from [Shop Name]"), along with festival overlay graphics.
  5. Outro video segment with brand call-to-action.

### C. Smart Scheduling & Deduplication Logic
- **Schedule Horizon**: Supports toggling between **1 Week** (7 days) and **1 Month** auto-scheduling.
- **Execution Trigger**: Runs automatically on the first day of every week (or manually triggered by Super Admin).
- **Strict Deduplication Rules**:
  1. **User History Lockout**: A shop user must **NEVER** receive a video they have already received in the same month (or until pool cycle resets). Unique video filenames/IDs serve as validators.
  2. **District Isolation**: Two shops in the **same district** (`district_id` in `shops` table) must **NEVER** receive the same video on the same day/week.
- **Validation Checkpoint**: Before assigning `video_id` to `shop_id` for `scheduled_date`, verify:
  `WHERE scheduled_date = X AND video_id = Y AND shop_id IN (SELECT id FROM shops WHERE district_id = target_district_id)` is EMPTY.

### D. On-Demand Rendering & Gold Rate Trigger
- **Gold Rate Update Trigger**: When Admin/Super Admin submits daily 22K, 24K, and Silver prices:
  - System flags the day's scheduled videos as queued/ready for rendering.
- **Rendering Process (VPS + FFmpeg)**:
  - Pull base video, template overlay, logo, outro from Cloudflare R2 into temporary VPS storage.
  - Apply FFmpeg filters to place text coordinates, logo overlay, festival tagline, gold rates.
  - Stitch main video + outro.
  - Stream/store rendered video for customer download.
  - Clean up temporary files immediately on VPS after rendering/download.

### E. Subscription Management
- **Subscription Lifecycle**: `pending_approval` -> `active` -> `expired` / `suspended`.
- Admins/Super Admins can create, grant temporary access (e.g., 1-day trial), or modify start/end subscription dates.
- Video generation and download access strictly validate that `NOW() BETWEEN start_date AND end_date` and `status = 'active'`.

---

## 3. Database & Optimization Directives
- Cache metadata lookups and minimize redundant API calls.
- Store rendered files as temporary assets; preserve Cloudflare R2 bandwidth and host storage efficiently.
