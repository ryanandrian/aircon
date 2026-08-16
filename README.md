# AC Service Growth OS

Operating system mobile-first untuk usaha jasa AC/HVAC kecil-menengah.
Membantu tenant: dapat customer, atur teknisi & job, repeat order otomatis,
kontrol performa, dan Smart HVAC IoT (add-on).

## Tech stack
- Next.js 16 (App Router, TypeScript, PWA) — deploy Vercel
- Supabase (Postgres + Auth + RLS + Realtime + Storage + pg_cron)
- Prisma (schema & migrasi, tipe)
- EMQX Serverless (MQTT broker, IoT) + jembatan ke Supabase
- TanStack Query, Zod

## Auth
- Owner/Admin: Login with Google (SSO)
- Teknisi: undangan link WhatsApp → set PIN 6 digit
Detail: docs/Auth_Decision_Phone_PIN.md

## Arsitektur produk (money-first)
Dibangun berlapis dari yang paling dekat ke pendapatan:
- L0 Money Loop (repeat engine) — job → history → reminder → repeat
- L1 Get the Job (growth/lead/website booking)
- L2 Do the Job (FSM + smart scheduling + re-planning)
- L3 AC Sells Itself (IoT demand generator)
- L4 Know the Numbers (metrics)
- L5 Plumbing (auth, WA, billing)
Detail: docs/AC_Service_Growth_OS_PRD_and_Technical_Specification_v1.1_money-first.md

## Dokumentasi (docs/)
- Master Business Plan (v1.0)
- PRD + Technical Spec (v1.0, v1.1 money-first)
- Build Spec Pack (Part 1 data/API, Part 2 screens, Part 3 rules)
- TechStack v2.1 (Supabase + EMQX)
- Differentiation & Domain Strategy
- Auth Decision

## Setup dev
```bash
pnpm install
cp .env.example .env         # isi kredensial Supabase
npx prisma migrate dev       # setelah DATABASE_URL terisi
pnpm dev                     # http://localhost:3000
```

## Status
Scaffold + schema data lengkap (25+ model) siap. Menunggu kredensial Supabase
untuk migrasi pertama, lalu implementasi L0 money loop.
