/**
 * GET   /api/incidents?qrToken=BLR-001
 *   Returns all incidents for a given QR token (or all incidents if omitted).
 *
 * POST  /api/incidents
 *   Body: { qrToken, issueType }
 *   Opens a new incident at WHATSAPP_NUDGE stage.
 *   Also updates the Vehicle status to BLOCKING_REPORTED.
 *
 * PATCH /api/incidents
 *   Body: { incidentId, escalationStage }
 *   Advances an existing incident to the given escalation stage.
 *   When stage is RESOLVED the Vehicle status is reset to PARKED.
 *
 * Escalation ladder:
 *   WHATSAPP_NUDGE → MASKED_CALL → ALT_SLOT_OFFERED → RESOLVED
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  ParkingIncident,
  Vehicle,
  IncidentIssueType,
  EscalationStage,
} from "@/lib/models";

// ─── Escalation order (for validation) ───────────────────────────────────────

const STAGES: EscalationStage[] = [
  "WHATSAPP_NUDGE",
  "MASKED_CALL",
  "ALT_SLOT_OFFERED",
  "RESOLVED",
];

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const qrToken = req.nextUrl.searchParams.get("qrToken");
    const query = qrToken ? { qrToken } : {};

    const incidents = await (ParkingIncident as any).find(query);
    return NextResponse.json({ ok: true, count: incidents.length, incidents });
  } catch (err) {
    console.error("[incidents GET]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { qrToken, issueType } = body as {
      qrToken: string;
      issueType: IncidentIssueType;
    };

    if (!qrToken || !issueType) {
      return NextResponse.json(
        { ok: false, error: "qrToken and issueType are required." },
        { status: 400 }
      );
    }

    const validIssueTypes: IncidentIssueType[] = [
      "BLOCKING_GATE",
      "DOUBLE_PARKED",
      "NO_PARKING_ZONE",
    ];
    if (!validIssueTypes.includes(issueType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `issueType must be one of: ${validIssueTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Verify vehicle exists
    const vehicle = await (Vehicle as any).findOne({ qrToken });
    if (!vehicle) {
      return NextResponse.json(
        { ok: false, error: `No vehicle found with qrToken "${qrToken}".` },
        { status: 404 }
      );
    }

    // Create incident
    const incident = await (ParkingIncident as any).create({
      qrToken,
      issueType,
      escalationStage: "WHATSAPP_NUDGE",
    });

    // Update vehicle status
    await (Vehicle as any).findOneAndUpdate(
      { qrToken },
      { $set: { status: "BLOCKING_REPORTED" } }
    );

    return NextResponse.json(
      {
        ok: true,
        message: `Incident created. WhatsApp nudge triggered for ${vehicle.maskedPhone}.`,
        incident,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[incidents POST]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { incidentId, escalationStage } = body as {
      incidentId: string;
      escalationStage: EscalationStage;
    };

    if (!incidentId || !escalationStage) {
      return NextResponse.json(
        { ok: false, error: "incidentId and escalationStage are required." },
        { status: 400 }
      );
    }

    if (!STAGES.includes(escalationStage)) {
      return NextResponse.json(
        { ok: false, error: `escalationStage must be one of: ${STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await (ParkingIncident as any).findById(incidentId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Incident not found." },
        { status: 404 }
      );
    }

    // Enforce forward-only escalation
    const currentIdx = STAGES.indexOf(existing.escalationStage as EscalationStage);
    const targetIdx  = STAGES.indexOf(escalationStage);
    if (targetIdx <= currentIdx) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot move from "${existing.escalationStage}" to "${escalationStage}". Escalation is forward-only.`,
        },
        { status: 409 }
      );
    }

    const updated = await (ParkingIncident as any).findOneAndUpdate(
      { _id: incidentId },
      { $set: { escalationStage } },
      { new: true }
    );

    // If resolved, reset vehicle status to PARKED
    if (escalationStage === "RESOLVED") {
      await (Vehicle as any).findOneAndUpdate(
        { qrToken: existing.qrToken },
        { $set: { status: "PARKED" } }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Incident escalated to ${escalationStage}.`,
      incident: updated,
    });
  } catch (err) {
    console.error("[incidents PATCH]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
