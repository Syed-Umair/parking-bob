# parkingBob Implementation Plan

> "Smarter Streets, Better Living" — peer-to-peer micro-parking marketplace for Bengaluru.

## Overview

Build parkingBob on top of the existing clean Next.js 16 (App Router) + TypeScript + Tailwind CSS starter. The work is split into 5 sequential sub-tasks:

1. **UI Foundation** — shadcn/ui init + component install + theme
2. **Authentication** — Clerk install, middleware, ClerkProvider in layout
3. **Database Layer** — SQLite via better-sqlite3, schema, seed data
4. **API Routes** — /api/spots, /api/bookings, /api/chat
5. **App UI** — Header, Home page (spot listing), Booking flow, parkingBob AI chat

Each sub-task is independently reviewable before the next begins.

---

## Sub-Task 1 — UI Foundation

### Intent
Initialize shadcn/ui and install all required components. Apply the slate/navy + electric-blue theme. Replace the default globals.css CSS variables with the parkingBob design tokens.

### Expected Outcomes
- `components.json` present at repo root (shadcn config)
- `src/components/ui/` contains: button, card, input, badge, tabs, avatar, select, label, separator, scroll-area, sonner
- `src/app/globals.css` updated with shadcn CSS variable block and parkingBob colours (`--background: #0F172A`, `--primary: #2563EB`)
- `tailwind.config` / CSS theme extended to include brand tokens
- App still compiles with `next build`

### Todo List
1. Run `npx shadcn@latest init -y -d` to scaffold `components.json` (choose style: default, base colour: slate)
2. Run `npx shadcn@latest add button card input badge tabs avatar select label separator scroll-area sonner`
3. Edit `src/app/globals.css`: replace `:root` block with shadcn-compatible CSS variables; set `--background` to `#0F172A`, `--foreground` to `#F8FAFC`, `--primary` to `#2563EB`, `--primary-foreground` to `#FFFFFF`
4. Remove the `mongoose` dependency from `package.json` (unused; conflicts with serverless SQLite intent)
5. Verify `next build` passes

### Relevant Context
- Current `src/app/globals.css` uses Tailwind v4 `@import "tailwindcss"` — shadcn init may switch to v3 `@tailwind` directives; reconcile so Tailwind v4 `@theme inline` block is preserved alongside shadcn CSS vars
- `package.json` has `mongoose` — not needed; remove to keep bundle clean
- `@tailwindcss/turbopack` loader in `next.config.ts` must remain untouched

### Status
[ ] pending

---

## Sub-Task 2 — Authentication (Clerk)

### Intent
Install `@clerk/nextjs`, wire `clerkMiddleware()` so public routes (browse spots, chat) are accessible without login, and add `<ClerkProvider>` to the root layout. Auth is required only for booking and listing.

### Expected Outcomes
- `@clerk/nextjs` in `package.json` dependencies
- `src/middleware.ts` exists, exports `clerkMiddleware()` with `matcher` covering `/((?!_next|.*\\..*).*)` and marks `/api/spots GET`, `/api/chat POST`, and `/` as public
- `src/app/layout.tsx` wraps children in `<ClerkProvider>`; metadata updated to `parkingBob | Smarter Streets, Better Living`
- A `<Header />` component (`src/components/Header.tsx`) renders the logo/tagline, `<SignInButton mode="modal">` and `<UserButton>` from Clerk, plus nav links

### Todo List
1. `npm install @clerk/nextjs`
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` as `.env.local` stubs (empty strings, with comments explaining where to get real values)
3. Create `src/middleware.ts` with `clerkMiddleware` — public routes: `/`, `/api/spots` (GET only handled at app level, middleware just marks route public), `/api/chat`
4. Update `src/app/layout.tsx`: wrap with `<ClerkProvider>`, update metadata title/description, import and render `<Header />`
5. Create `src/components/Header.tsx`: logo text "parkingBob", tagline, `<SignedOut><SignInButton mode="modal"><Button>Sign In</Button></SignInButton></SignedOut>`, `<SignedIn><UserButton /></SignedIn>`

### Relevant Context
- Existing `src/app/layout.tsx` uses Geist fonts — keep them
- `clerkMiddleware` is the v5+ API (not `authMiddleware`) — use it
- The `matcher` in middleware must exclude static files and `_next` paths

### Status
[ ] pending

---

## Sub-Task 3 — Database Layer

### Intent
Create `src/lib/db.ts` as a singleton better-sqlite3 connection. Define `spots` and `bookings` tables. Auto-seed 8 realistic Bengaluru spots on first boot when `spots` is empty.

### Expected Outcomes
- `better-sqlite3` and `@types/better-sqlite3` in `package.json`
- `src/lib/db.ts` exports a `db` singleton (file path: `/tmp/parkingbob.db` on Vercel, `./parkingbob.db` locally)
- `initDb()` creates both tables (idempotent via `CREATE TABLE IF NOT EXISTS`)
- Seed data: 8 spots covering diverse Bengaluru areas (Koramangala, Indiranagar, MG Road, Whitefield, Jayanagar, HSR Layout, Malleshwaram, Electronic City) with realistic hourly rates (₹20–₹80), vehicle sizes (bike/car/SUV), and amenities (CCTV, covered, EV charging, etc.)
- `src/lib/db.ts` exports TypeScript types `Spot` and `Booking`

### Todo List
1. `npm install better-sqlite3` and `npm install -D @types/better-sqlite3`
2. Create `src/lib/db.ts`:
   - Determine DB path: `process.env.VERCEL ? '/tmp/parkingbob.db' : './parkingbob.db'`
   - Open DB with `new Database(dbPath)`
   - Run `CREATE TABLE IF NOT EXISTS spots (...)` and `CREATE TABLE IF NOT EXISTS bookings (...)`
   - Check `SELECT COUNT(*) FROM spots`; if 0, insert seed data
3. Define and export `Spot` and `Booking` TypeScript interfaces matching the column list
4. Export `db` as default singleton
5. Add `better-sqlite3` to `serverExternalPackages` in `next.config.ts` so Next.js doesn't try to bundle the native module

### Schema

**spots**
```
id INTEGER PRIMARY KEY AUTOINCREMENT,
title TEXT NOT NULL,
area TEXT NOT NULL,
address TEXT NOT NULL,
start_hour INTEGER NOT NULL,   -- 0-23
end_hour INTEGER NOT NULL,     -- 0-23
vehicle_size TEXT NOT NULL,    -- 'bike' | 'car' | 'suv'
hourly_rate INTEGER NOT NULL,  -- INR
amenities TEXT NOT NULL,       -- comma-separated
host_user_id TEXT NOT NULL,
host_name TEXT NOT NULL,
is_available INTEGER NOT NULL DEFAULT 1  -- 0 | 1
```

**bookings**
```
id INTEGER PRIMARY KEY AUTOINCREMENT,
spot_id INTEGER NOT NULL REFERENCES spots(id),
driver_user_id TEXT NOT NULL,
driver_name TEXT NOT NULL,
vehicle_number TEXT NOT NULL,
start_hour INTEGER NOT NULL,
end_hour INTEGER NOT NULL,
total_cost INTEGER NOT NULL,
booking_code TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
```

### Relevant Context
- `next.config.ts` already has a `turbopack.rules` block — add `serverExternalPackages: ['better-sqlite3']` at the top-level config object
- Native module requires Node.js runtime; API routes using `db` must have `export const runtime = 'nodejs'` (default for App Router, but explicit is safer)

### Status
[ ] pending

---

## Sub-Task 4 — API Routes

### Intent
Implement four API route handlers. Spots routes handle listing and creating. Bookings route prevents double-booking via a transaction. Chat route parses natural-language intent and queries SQLite.

### Expected Outcomes
- `GET /api/spots` — returns all available spots, supports `?area=`, `?vehicle_size=`, `?max_rate=` query filters
- `POST /api/spots` — requires auth (checks Clerk `auth()`), inserts a new spot
- `GET /api/bookings` — returns bookings for the signed-in user (`driver_user_id = auth().userId`)
- `POST /api/bookings` — requires auth; uses `db.transaction` to: check no overlapping booking exists for `spot_id` + hours, insert booking, return `booking_code`
- `POST /api/chat` — public; accepts `{ message: string }`; extracts intent keywords (area name, vehicle size, rate limit) from message via simple string matching; queries spots; returns structured response with matched spots + a human-readable reply string

### Todo List
1. Create `src/app/api/spots/route.ts` — `GET` (filtered list) and `POST` (auth-gated create)
2. Create `src/app/api/bookings/route.ts` — `GET` (user's bookings) and `POST` (transactional create)
3. Create `src/app/api/chat/route.ts` — intent parser + spot search + reply formatter
4. All routes: add `export const runtime = 'nodejs'` at top of each file
5. All routes return `NextResponse.json(...)` with appropriate HTTP status codes

### Chat Intent Parser (sub-task 4, step 3)
Simple rule-based (no LLM dependency, zero cost):
- Detect area: check if message contains any known area name (case-insensitive)
- Detect vehicle_size: "bike", "car", "suv" keywords
- Detect max_rate: extract first number following "₹", "rs", "under", "below", "max"
- Build a parameterized SQL query from detected filters
- Format reply: "Found N spots in [area]. Cheapest: [title] at ₹X/hr." or "No spots found — try broadening your search."

### Relevant Context
- `auth()` from `@clerk/nextjs/server` — call it in POST handlers to get `userId`; redirect or 401 if null
- `db.transaction(fn)` returns a function; call it with args to execute atomically
- Double-booking check: `SELECT COUNT(*) FROM bookings WHERE spot_id=? AND NOT (end_hour <= ? OR start_hour >= ?)`

### Status
[ ] pending

---

## Sub-Task 5 — App UI

### Intent
Replace the default home page with the full parkingBob UI: a spot-listing page with filters, a booking modal, and a floating parkingBob AI chat widget.

### Expected Outcomes
- `src/app/page.tsx` — full spot listing page: hero section with tagline, filter bar (area, vehicle size, max rate), spot cards grid using shadcn Card/Badge, "Book Now" button (triggers sign-in modal if not authed, else opens booking modal)
- `src/components/SpotCard.tsx` — card for a single spot: title, area badge, rate, vehicle size, amenities chips, host name, Book Now button
- `src/components/BookingModal.tsx` — shadcn Dialog: inputs for vehicle number, start/end hour (Select), cost preview, confirm button; calls `POST /api/bookings`; shows booking code on success via sonner toast
- `src/components/ChatWidget.tsx` — floating bottom-right chat button; expands to a scroll-area chat window; sends messages to `POST /api/chat`; renders bot responses; accessible to all users without sign-in
- `src/app/page.tsx` is an **async Server Component** — fetches spots directly via `db` import (or internal fetch to `/api/spots`), passes `Spot[]` to client `SpotCard` components as props
- Filter bar is a `'use client'` component that updates URL search params; page re-renders server-side on filter change via `searchParams` prop

### Todo List
1. Create `src/components/SpotCard.tsx`
2. Create `src/components/BookingModal.tsx` (uses shadcn Dialog — add with `npx shadcn@latest add dialog`)
3. Create `src/components/ChatWidget.tsx`
4. Rewrite `src/app/page.tsx` — hero, filter bar, spot grid
5. Add `<Toaster />` from sonner to `src/app/layout.tsx`
6. Add `npx shadcn@latest add dialog` to component installs (needed for BookingModal)

### Relevant Context
- Use `useAuth()` from `@clerk/nextjs` in client components to gate the Book Now action
- SpotCard and BookingModal are `'use client'` components
- ChatWidget is `'use client'`; no auth required
- Sonner `toast()` for booking success/error feedback
- Tailwind dark background (`bg-[#0F172A]`) set in globals.css means all pages default to dark theme

### Status
[ ] pending

---

## Dependency Summary

New packages to install:
- `@clerk/nextjs`
- `better-sqlite3`
- `@types/better-sqlite3` (dev)

Remove:
- `mongoose` (unused)

shadcn components to add (via CLI):
- button, card, input, badge, tabs, avatar, select, label, separator, scroll-area, sonner, dialog

---

## File Map (new/modified files)

```
src/
  middleware.ts                      [NEW]
  lib/
    db.ts                            [NEW]
  components/
    Header.tsx                       [NEW]
    SpotCard.tsx                     [NEW]
    BookingModal.tsx                 [NEW]
    ChatWidget.tsx                   [NEW]
    ui/                              [NEW - shadcn]
  app/
    layout.tsx                       [MODIFY]
    page.tsx                         [REPLACE]
    globals.css                      [MODIFY]
    api/
      spots/route.ts                 [NEW]
      bookings/route.ts              [NEW]
      chat/route.ts                  [NEW]
next.config.ts                       [MODIFY - add serverExternalPackages]
package.json                         [MODIFY - add/remove deps]
components.json                      [NEW - shadcn config]
.env.local                           [NEW - Clerk key stubs]
```
