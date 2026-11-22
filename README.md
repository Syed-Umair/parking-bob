# 🚗 Parking Bob

**Bengaluru's hyperlocal parking & double-parking triage platform**

Built with Next.js 16 App Router · TypeScript · Tailwind CSS · Mongoose · watsonx Orchestrate

---

## ✨ What it does

- **Windshield QR scanning** — scan a sticker QR on a blocking vehicle, report the issue, and trigger a privacy-masked WhatsApp + voice-call escalation sequence.
- **RWA visitor slot finder** — locate available parking bays in Bengaluru RWA hubs within walking distance, book a slot, and receive a gate QR pass.
- **RWA facility dashboard** — manage real-time visitor slot counts, monitor live double-parking incidents, and escalate from a single screen.
- **AI triage agent** — a watsonx Orchestrate native agent follows a 4-stage escalation SOP (WhatsApp nudge → masked call → nearby slot offer → resolved).

---

## 🗺️ Demo Quick-Start

### 1. Clone & install

```bash
git clone https://github.com/Syed-Umair/parking-bob.git
cd parking-bob
npm install
```

### 2. Configure environment (optional — works without MongoDB)

```bash
cp .env.local .env.local   # already created; edit values as needed
```

```env
# .env.local
MONGODB_URI=your_mongodb_uri_here        # leave empty → in-memory fallback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **No MongoDB? No problem.** The app automatically falls back to an in-memory store so you can explore the full demo without any database setup.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Seed demo data

Hit the **"🌱 Seed Bengaluru Demo Data"** button on the home page — or call the API directly:

```bash
curl http://localhost:3000/api/seed
```

This seeds 4 vehicles (`BLR-001` → `BLR-004`) and 5 RWA parking hubs across Bengaluru.

---

## 🔗 Key URLs

| URL | Description |
|---|---|
| [/](http://localhost:3000) | Landing hub — quick-launch cards + seed button |
| [/scan/BLR-001](http://localhost:3000/scan/BLR-001) | 📷 Demo QR scan for vehicle BLR-001 |
| [/scan/BLR-004](http://localhost:3000/scan/BLR-004) | 🚧 Demo — BLR-004 is pre-flagged as `BLOCKING_REPORTED` |
| [/park](http://localhost:3000/park) | 🅿️ Commuter slot finder with locality filters |
| [/rwa-admin](http://localhost:3000/rwa-admin) | 🏢 RWA facility manager dashboard |
| [/api/seed](http://localhost:3000/api/seed) | GET — idempotent seed |
| [/api/slots?lat=12.93&lng=77.62&radius=3000](http://localhost:3000/api/slots?lat=12.93&lng=77.62&radius=3000) | GET nearby slots |
| [/api/incidents](http://localhost:3000/api/incidents) | GET all incidents |

---

## 🏗️ Architecture

```
parking-bob/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing hub (3 cards + seed)
│   │   ├── scan/[qrToken]/page.tsx     # Mobile QR incident reporter
│   │   ├── park/page.tsx               # Commuter slot finder
│   │   ├── rwa-admin/page.tsx          # RWA facility dashboard
│   │   └── api/
│   │       ├── seed/route.ts           # GET/POST — demo data seeder
│   │       ├── slots/route.ts          # GET (geo-search) / PATCH (book/release)
│   │       └── incidents/route.ts      # GET / POST / PATCH (escalation)
│   └── lib/
│       ├── db.ts                       # Cached Mongoose conn + in-memory fallback
│       └── models.ts                   # Vehicle, RwaSlot, ParkingIncident schemas
└── agents/
    ├── triage_sop.md                   # Double-parking escalation SOP
    └── parking_bob_agent.yaml          # watsonx Orchestrate native agent config
```

### Data flow

```
Reporter scans QR
      │
      ▼
POST /api/incidents        ← creates incident at WHATSAPP_NUDGE
      │
      ▼  (5 min)
PATCH /api/incidents       ← escalate to MASKED_CALL
      │
      ▼  (15 min)
GET /api/slots?radius=500  ← find nearest free RWA slot
      │
      ▼
PATCH /api/incidents       ← escalate to ALT_SLOT_OFFERED
      │
      ▼
PATCH /api/incidents       ← RESOLVED (vehicle moved)
      │
      ▼
Vehicle.status → PARKED    ← side-effect on resolution
```

### Database models

| Model | Key fields |
|---|---|
| `Vehicle` | `qrToken` (unique), `maskedPlate`, `maskedPhone`, `status` |
| `RwaSlot` | `locality`, `location` (GeoJSON + 2dsphere), `hourlyRateINR`, `availableSlots` |
| `ParkingIncident` | `qrToken`, `issueType`, `escalationStage`, `createdAt` |

### Geo-search

- **With MongoDB:** `$nearSphere` query on a `2dsphere` index — O(log n).
- **Without MongoDB:** client-side Haversine distance filter on the in-memory store.

---

## 🤖 AI Agent (watsonx Orchestrate)

The agent config lives in [`agents/parking_bob_agent.yaml`](agents/parking_bob_agent.yaml).

**Model:** `ibm/granite-3-3-8b-instruct`  
**Tools:** `get_nearby_slots`, `update_slot`, `get_incidents`, `create_incident`, `escalate_incident`

**Escalation SOP:** [`agents/triage_sop.md`](agents/triage_sop.md)

```
T+0m  → WHATSAPP_NUDGE   — Privacy-masked WhatsApp message
T+5m  → MASKED_CALL      — Automated masked voice call
T+15m → ALT_SLOT_OFFERED — Nearest free RWA slot within 500m
        → RESOLVED        — Vehicle moved; status reset to PARKED
```

---

## 🌆 Bengaluru Demo Locations

| Hub | Locality | Coordinates |
|---|---|---|
| Salarpuria Sattva Divinity | HSR Layout Sector 2 | 12.9121°N, 77.6446°E |
| Mantri Synergy | Koramangala 5th Block | 12.9352°N, 77.6245°E |
| Indiranagar RWA Street Pod | Indiranagar 100ft Rd | 12.9784°N, 77.6408°E |
| Bellandur Lake View Overflow | Bellandur | 12.9259°N, 77.6762°E |
| Prestige Shantiniketan | Whitefield | 12.9698°N, 77.7499°E |

---

## 🔌 API Reference

### `GET /api/slots`

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `lat` | number | ✅ | — | Latitude |
| `lng` | number | ✅ | — | Longitude |
| `radius` | number | — | 3000 | Search radius in metres |

### `PATCH /api/slots`

```json
{ "slotId": "<_id>", "action": "BOOK" | "RELEASE" }
```

### `GET /api/incidents`

| Param | Type | Required | Description |
|---|---|---|---|
| `qrToken` | string | — | Filter by vehicle QR token |

### `POST /api/incidents`

```json
{ "qrToken": "BLR-001", "issueType": "BLOCKING_GATE" | "DOUBLE_PARKED" | "NO_PARKING_ZONE" }
```

### `PATCH /api/incidents`

```json
{ "incidentId": "<_id>", "escalationStage": "MASKED_CALL" | "ALT_SLOT_OFFERED" | "RESOLVED" }
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | MongoDB via Mongoose (in-memory fallback) |
| AI Agent | IBM watsonx Orchestrate (Granite 3.3 8B) |
| Deployment | Vercel (recommended) |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
