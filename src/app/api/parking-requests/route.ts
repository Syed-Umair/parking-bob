/**
 * GET  /api/parking-requests?rwaSlotId=<id>&status=PENDING
 *   List requests for a given slot (optionally filtered by status).
 *   Used by the owner portal.
 *
 * POST /api/parking-requests
 *   Body: { rwaSlotId, rwaName, requesterName, requesterPhone, vehiclePlate, durationHours }
 *   Creates a new PENDING request from a visitor.
 *
 * PATCH /api/parking-requests
 *   Body: { requestId, status: "ACCEPTED" | "DECLINED" }
 *   Owner accepts or declines a request.
 *   On ACCEPTED the RWA slot's availableSlots is decremented by 1 (if > 0).
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB, IS_REAL_DB } from "@/lib/db";
import { ParkingRequest, RwaSlot, Owner, RequestStatus } from "@/lib/models";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const rwaSlotId = searchParams.get("rwaSlotId");
    const status    = searchParams.get("status") as RequestStatus | null;
    const ownerEmail = searchParams.get("ownerEmail");

    // If ownerEmail provided, resolve the slot id from the owner record first
    let resolvedSlotId = rwaSlotId;
    if (ownerEmail && !resolvedSlotId) {
      const owner = await (Owner as any).findOne({ email: ownerEmail });
      if (!owner) {
        return NextResponse.json(
          { ok: false, error: "Owner not found." },
          { status: 404 }
        );
      }
      resolvedSlotId = owner.rwaSlotId;
    }

    const query: Record<string, unknown> = {};
    if (resolvedSlotId) query.rwaSlotId = resolvedSlotId;
    if (status)         query.status    = status;

    const requests = await (ParkingRequest as any).find(query);
    return NextResponse.json({ ok: true, count: requests.length, requests });
  } catch (err) {
    console.error("[parking-requests GET]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const {
      rwaSlotId,
      rwaName,
      requesterName,
      requesterPhone,
      vehiclePlate,
      durationHours,
    } = body as {
      rwaSlotId: string;
      rwaName: string;
      requesterName: string;
      requesterPhone: string;
      vehiclePlate: string;
      durationHours: number;
    };

    if (!rwaSlotId || !rwaName || !requesterName || !requesterPhone || !vehiclePlate) {
      return NextResponse.json(
        { ok: false, error: "rwaSlotId, rwaName, requesterName, requesterPhone and vehiclePlate are required." },
        { status: 400 }
      );
    }

    // Verify slot exists and has capacity
    const slot = await (RwaSlot as any).findById(rwaSlotId);
    if (!slot) {
      return NextResponse.json({ ok: false, error: "RWA slot not found." }, { status: 404 });
    }
    if (slot.availableSlots <= 0) {
      return NextResponse.json({ ok: false, error: "No available slots at this location." }, { status: 409 });
    }

    const request = await (ParkingRequest as any).create({
      rwaSlotId,
      rwaName,
      requesterName,
      requesterPhone,
      vehiclePlate,
      durationHours: durationHours ?? 1,
      hourlyRateINR: slot.hourlyRateINR ?? 0,
      status: "PENDING",
    });

    return NextResponse.json(
      { ok: true, message: "Parking request submitted. Awaiting owner approval.", request },
      { status: 201 }
    );
  } catch (err) {
    console.error("[parking-requests POST]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { requestId, status } = body as { requestId: string; status: RequestStatus };

    if (!requestId || !["ACCEPTED", "DECLINED"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "requestId and status ('ACCEPTED' | 'DECLINED') are required." },
        { status: 400 }
      );
    }

    const existing = await (ParkingRequest as any).findById(requestId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Request not found." }, { status: 404 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: `Request is already ${existing.status}.` },
        { status: 409 }
      );
    }

    const updated = await (ParkingRequest as any).findOneAndUpdate(
      { _id: requestId },
      { $set: { status } },
      { new: true }
    );

    // On acceptance, decrement the slot's available count
    if (status === "ACCEPTED") {
      const slot = await (RwaSlot as any).findById(existing.rwaSlotId);
      if (slot && slot.availableSlots > 0) {
        if (IS_REAL_DB) {
          await (RwaSlot as any).findOneAndUpdate(
            { _id: existing.rwaSlotId },
            { $inc: { availableSlots: -1 } }
          );
        } else {
          await (RwaSlot as any).findOneAndUpdate(
            { _id: existing.rwaSlotId },
            { $set: { availableSlots: slot.availableSlots - 1 } }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Request ${status.toLowerCase()}.`,
      request: updated,
    });
  } catch (err) {
    console.error("[parking-requests PATCH]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
