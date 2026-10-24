# ICEM Connect — Vercel Deployment & Production Runbook

This guide details the complete deployment process for **ICEM Connect** to [Vercel](https://vercel.com) using a production Supabase backend, fulfilling the **Phase 11 — Deployment + Pilot Preparation** specification (`TC-DEP-01` through `TC-DEP-07`).

---

## 1. Architecture Overview

- **Hosting & CDN:** Vercel Global Edge Network (SSL / HTTPS, automatic HTTP/2, edge caching)
- **Frontend Framework:** React 18 + Vite 5 + TypeScript + Tailwind CSS (Optimized chunk splitting)
- **Routing:** Client-side SPA routing managed via `vercel.json` rewrites (`/(.*) -> /index.html`)
- **API & Health:** Native Vercel Serverless Function at `/api/health` + Supabase RPC endpoints
- **Database & Auth:** Supabase PostgreSQL with 14 sequential migrations, strict RLS, and `@indiraicem.ac.in` domain enforcement

---

## 2. Prerequisites

1. A [Vercel Account](https://vercel.com/signup).
2. A [Supabase Project](https://supabase.com) (or local/self-hosted instance).
3. The ICEM Connect Git repository connected to GitHub, GitLab, or Bitbucket.

---

## 3. Quick Deployment (Turnkey)

### Option A: Via Vercel Web Dashboard (Recommended)

1. Navigate to [vercel.com/new](https://vercel.com/new) and import the `icem-connect` repository.
2. Configure Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Add Environment Variables (under **Environment Variables**):

| Variable Name | Description | Example / Default |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public Anon key | `eyJhbGciOi...` |
| `VITE_INSTITUTION_EMAIL_DOMAIN` | Campus email restriction | `indiraicem.ac.in` |

4. Click **Deploy**. Vercel will build the optimized production bundles and provision a global HTTPS endpoint within 60 seconds.

---

### Option B: Via Vercel CLI

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link & Deploy
vercel

# 3. Deploy to Production with environment variables
vercel --prod
```

---

## 4. Supabase Database Migration Setup

Apply all 14 sequential migrations located in `supabase/migrations/` using either the Supabase CLI or the Supabase SQL Editor:

```bash
# Using Supabase CLI:
supabase link --project-ref your-project-ref
supabase db push
```

Or execute the scripts in order in the Supabase Dashboard SQL Editor:
1. `20261021000000_phase0_baseline.sql`
2. `20261021000001_phase1_auth_identity.sql`
3. `20261021000002_phase2_core_data_model.sql`
4. `20261021000003_phase3_ride_lifecycle.sql`
5. `20261021000004_phase4_routes_waypoints.sql`
6. `20261021000005_phase5_find_matching.sql`
7. `20261021000006_phase6_join_requests_capacity.sql`
8. `20261021000007_phase6_fix_rpc_and_policies.sql`
9. `20261021000008_phase7_ratings_moderation.sql`
10. `20261021000009_phase8_realtime_ride_sessions.sql`
11. `20261021000010_phase8_ratings_participant_fix.sql`
12. `20261021000011_phase9_live_location.sql`
13. `20261021000012_phase10_coordination_chat_hardening.sql`
14. `20261022000001_soft_delete_and_auto_purge_2days.sql`

---

## 5. Release Gates Verification (`TC-DEP-*`)

Before opening the campus pilot to ICEM students, verify the 7 release gates:

* [x] **`TC-DEP-01` Build Verification:** `npm run build` succeeds with 0 errors. Chunks are split into `vendor-react`, `vendor-supabase`, `vendor-ui`, and `vendor-forms`.
* [x] **`TC-DEP-02` SPA Routing & Security Headers:** `vercel.json` provides `/(.*)` rewrites to `/index.html` and sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy`.
* [x] **`TC-DEP-03` Domain Validation:** Non-`@indiraicem.ac.in` emails are strictly rejected at the signup form.
* [x] **`TC-DEP-04` Database Integrity:** RLS enabled on all 14 tables; atomic seat reservation prevents race conditions.
* [x] **`TC-DEP-05` Privacy & Security:** Zero PRN leakage; ephemeral chat expires after 3 hours; 0 GPS coordinates stored in database.
* [x] **`TC-DEP-06` Test Suite Pass:** 224/224 Vitest tests passing (`npm test`).
* [x] **`TC-DEP-07` Pilot Operations Runbook:** Fast rollback (5 seconds in Vercel dashboard) and campus emergency contact list documented.

---

## 6. Uptime Monitoring & Health Verification

Verify your live Vercel deployment with curl or a browser:

```bash
# 1. Check Vercel serverless edge health
curl -s https://your-project.vercel.app/api/health

# Response:
# {"status":"ok","service":"ICEM Connect Vercel Edge/Serverless Gateway","version":"1.1.0","domain":"indiraicem.ac.in"}
```

Within the application:
- Log in and open the **Admin Console** at `/admin`.
- Review the **System Health & Connectivity Status** card to inspect live Supabase database latency and institutional domain validation.
