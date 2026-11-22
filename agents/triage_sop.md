# Parking Bob — Double-Parking & RWA Slot Matcher
## Standard Operating Procedure (SOP) v1.0

**Scope:** Bengaluru hyperlocal double-parking triage.  
**Applies to:** Parking Bob AI Agent (watsonx Orchestrate), RWA facility managers, and commuter self-service flows.

---

## 1. Trigger Conditions

An incident triage sequence is initiated when **any** of the following occurs:

| Trigger | QR Scan | Manual Report | RWA Admin |
|---|---|---|---|
| Vehicle blocks a driveway or gate | ✅ | ✅ | ✅ |
| Vehicle double-parked in visitor zone | ✅ | ✅ | ✅ |
| Vehicle parked in a marked no-parking zone | ✅ | ✅ | — |

---

## 2. Privacy Rules (Non-Negotiable)

1. **No full plate numbers** are stored or displayed. Only the last four digits are masked (`KA-01-MJ-****`).
2. **No full phone numbers** are stored or transmitted. Only the masked form (`+91-98****1234`) is used in all communications.
3. **Owner name** may be shown to the reporting party for confirmation only — never broadcast publicly.
4. All WhatsApp messages and voice calls are routed through a **privacy relay** (masked call bridge). The reporter never receives the owner's direct number.
5. Incident records are retained for **72 hours** after `RESOLVED`, then automatically purged.

---

## 3. Escalation Ladder

The agent enforces a **strictly forward-only** escalation sequence. Stages cannot be skipped or reversed.

```
T+0m  → WHATSAPP_NUDGE
T+5m  → MASKED_CALL       (if not resolved)
T+15m → ALT_SLOT_OFFERED  (if not resolved)
        → RESOLVED         (manual or on vehicle removal confirmation)
```

### Stage 3.1 — WHATSAPP_NUDGE (T+0 min)

**Trigger:** Immediately on `POST /api/incidents`.

**Agent actions:**
1. Call `POST /api/incidents` with `{ qrToken, issueType }`.
2. Compose a WhatsApp message via privacy relay:
   > *"Namaskara! Your vehicle [MASKED_PLATE] appears to be blocking [LOCATION]. Kindly move it at the earliest. — Parking Bob 🙏"*
3. Record `escalationStage: WHATSAPP_NUDGE` in the incident record.
4. Start a 5-minute countdown timer.

**Expected outcome:** Owner moves vehicle within 5 minutes.  
**Success condition:** Reporter taps "Mark Resolved" or agent detects vacancy via slot sensor (future).

---

### Stage 3.2 — MASKED_CALL (T+5 min)

**Trigger:** 5 minutes elapsed since `WHATSAPP_NUDGE` with no resolution.

**Agent actions:**
1. Call `PATCH /api/incidents` with `{ incidentId, escalationStage: "MASKED_CALL" }`.
2. Initiate a **masked voice call** via privacy relay:
   - Caller ID shown to owner: RWA facility number (not reporter's number).
   - Automated message: *"This is an automated alert from your RWA. Your vehicle [MASKED_PLATE] is causing an obstruction. Please move it immediately."*
3. Log call attempt timestamp.
4. Start a 10-minute countdown timer.

**Expected outcome:** Owner responds to call and moves vehicle.  
**Fallback:** If call goes unanswered, proceed to Stage 3.3.

---

### Stage 3.3 — ALT_SLOT_OFFERED (T+15 min)

**Trigger:** 15 minutes elapsed since incident creation with no resolution.

**Agent actions:**
1. Extract the vehicle's approximate location from the incident's `qrToken` → linked RWA slot coordinates.
2. Call `GET /api/slots?lat={lat}&lng={lng}&radius=500` to find available RWA visitor slots within **500 metres**.
3. Call `PATCH /api/incidents` with `{ incidentId, escalationStage: "ALT_SLOT_OFFERED" }`.
4. Send WhatsApp message with nearest available slot:
   > *"Hi! We've found a free visitor slot at [RWA_NAME], [LOCALITY] — [DISTANCE]m away (₹[RATE]/hr, open [HOURS]). Please move your vehicle there. Slot reserved for 10 min. — Parking Bob"*
5. If `availableSlots === 0` within 500m, expand radius to 1000m and retry once.
6. If still no slot found, notify RWA admin and flag incident for manual intervention.

**Expected outcome:** Owner moves vehicle to the offered slot.  
**Side effect on booking:** Call `PATCH /api/slots` with `{ slotId, action: "BOOK" }` only after owner confirms move via app tap.

---

### Stage 3.4 — RESOLVED

**Trigger:** Reporter taps "Mark Resolved", RWA admin taps "Resolve", or owner confirms via app.

**Agent actions:**
1. Call `PATCH /api/incidents` with `{ incidentId, escalationStage: "RESOLVED" }`.
2. API automatically resets vehicle `status` to `PARKED`.
3. Send confirmation WhatsApp to both parties:
   - To owner: *"Thank you for cooperating. Incident closed. — Parking Bob 🙏"*
   - To reporter: *"The vehicle has been moved. Issue resolved. — Parking Bob ✅"*
4. Stop all timers.
5. Log resolution time for RWA analytics.

---

## 4. RWA Slot Matching Rules

When searching for an alternative slot at Stage 3.3:

| Priority | Rule |
|---|---|
| 1 | `availableSlots > 0` within 500m of incident location |
| 2 | Lowest `hourlyRateINR` among qualifying slots |
| 3 | Currently within `openHours` window |
| 4 | If tie: closest by Haversine distance |

**Never recommend** a slot with `availableSlots === 0`.  
**Never recommend** a slot outside its `openHours` window.  
**Always include** `hourlyRateINR` and `openHours` in the recommendation message.

---

## 5. Agent Decision Tree

```
Incident reported (POST /api/incidents)
│
├─ T+0 → Send WhatsApp nudge
│        ├─ Resolved?  → PATCH escalationStage=RESOLVED ✅
│        └─ T+5m elapsed?
│
├─ T+5 → Masked voice call
│        ├─ Resolved?  → PATCH escalationStage=RESOLVED ✅
│        └─ T+15m elapsed?
│
└─ T+15 → GET /api/slots?lat=&lng=&radius=500
          ├─ Slots found? → Send WhatsApp with slot details
          │                 PATCH escalationStage=ALT_SLOT_OFFERED
          │                 ├─ Resolved? → PATCH escalationStage=RESOLVED ✅
          │                 └─ No response → Flag for RWA admin 🚨
          └─ No slots? → Expand to 1000m → retry once
                         No result → Flag for RWA admin 🚨
```

---

## 6. Error Handling

| Scenario | Agent Behaviour |
|---|---|
| `POST /api/incidents` returns 404 (vehicle not found) | Inform reporter QR token is unregistered; suggest contacting RWA office |
| `GET /api/slots` returns 0 results within 1000m | Skip ALT_SLOT_OFFERED; flag admin; note in incident |
| `PATCH /api/incidents` returns 409 (forward-only violation) | Log error silently; re-read current stage and resume from correct stage |
| Network timeout on any API call | Retry once after 3 seconds; if still failing, alert RWA admin |
| Incident already RESOLVED when timer fires | Discard timer action; no further escalation |

---

## 7. Rate Limits & Anti-Spam

- Maximum **3 WhatsApp messages** per incident per vehicle.
- Maximum **2 voice call attempts** per incident.
- Minimum **60 seconds** between any two outbound contacts for the same vehicle.
- Incidents for the same `qrToken` within **10 minutes** of an existing active incident are **deduplicated** (append to existing, not create new).

---

## 8. Glossary

| Term | Definition |
|---|---|
| `qrToken` | Unique identifier printed on the windshield QR sticker (e.g., `BLR-001`) |
| `maskedPlate` | Partial licence plate with last 4 chars hidden (e.g., `KA-01-MJ-****`) |
| `maskedPhone` | Partial phone with middle digits hidden (e.g., `+91-98****1234`) |
| `RWA` | Resident Welfare Association — manages a gated community / apartment complex |
| `escalationStage` | Current position in the 4-step triage ladder |
| `availableSlots` | Real-time free visitor parking bays at an RWA hub |
| `2dsphere index` | MongoDB geospatial index enabling `$nearSphere` proximity queries |
