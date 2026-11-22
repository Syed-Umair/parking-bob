/**
 * GET  /api/slots?lat=12.93&lng=77.62&radius=3000
 *   Returns RWA slots within `radius` metres of the given coordinates.
 *   When MongoDB is available uses `$nearSphere` (index-backed).
 *   When using the in-memory fallback uses a Haversine distance calculation.
 *
 * PATCH /api/slots
 *   Body: { slotId: string, action: "BOOK" | "RELEASE" }
 *   Atomically increments/decrements availableSlots (clamped to [0, totalSlots]).
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB, IS_REAL_DB } from "@/lib/db";
import { RwaSlot, IRwaSlot } from "@/lib/models";

// ─── Haversine distance (metres) ─────────────────────────────────────────────

function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const lat    = parseFloat(searchParams.get("lat")    ?? "");
    const lng    = parseFloat(searchParams.get("lng")    ?? "");
    const radius = parseFloat(searchParams.get("radius") ?? "3000"); // metres

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { ok: false, error: "lat and lng query params are required." },
        { status: 400 }
      );
    }

    let slots: IRwaSlot[];

    if (IS_REAL_DB) {
      // MongoDB $nearSphere — requires 2dsphere index on RwaSlot.location
      slots = await (RwaSlot as any).find({
        location: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: radius,
          },
        },
      });
    } else {
      // In-memory Haversine fallback
      const all: IRwaSlot[] = await (RwaSlot as any).find({});
      slots = all
        .filter((s) => {
          const [sLng, sLat] = s.location.coordinates;
          return haversineMetres(lat, lng, sLat, sLng) <= radius;
        })
        .sort((a, b) => {
          const [aLng, aLat] = a.location.coordinates;
          const [bLng, bLat] = b.location.coordinates;
          return (
            haversineMetres(lat, lng, aLat, aLng) -
            haversineMetres(lat, lng, bLat, bLng)
          );
        });
    }

    return NextResponse.json({ ok: true, count: slots.length, slots });
  } catch (err) {
    console.error("[slots GET]", err);
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
    const { slotId, action } = body as {
      slotId: string;
      action: "BOOK" | "RELEASE";
    };

    if (!slotId || !["BOOK", "RELEASE"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "slotId and action ('BOOK' | 'RELEASE') are required." },
        { status: 400 }
      );
    }

    const slot: IRwaSlot | null = await (RwaSlot as any).findById(slotId);
    if (!slot) {
      return NextResponse.json(
        { ok: false, error: "Slot not found." },
        { status: 404 }
      );
    }

    if (action === "BOOK" && slot.availableSlots <= 0) {
      return NextResponse.json(
        { ok: false, error: "No available slots." },
        { status: 409 }
      );
    }
    if (action === "RELEASE" && slot.availableSlots >= slot.totalSlots) {
      return NextResponse.json(
        { ok: false, error: "Slots already at maximum capacity." },
        { status: 409 }
      );
    }

    const delta = action === "BOOK" ? -1 : 1;

    let updated: IRwaSlot | null;

    if (IS_REAL_DB) {
      updated = await (RwaSlot as any).findOneAndUpdate(
        { _id: slotId },
        { $inc: { availableSlots: delta } },
        { new: true }
      );
    } else {
      // In-memory: manual patch
      updated = await (RwaSlot as any).findOneAndUpdate(
        { _id: slotId },
        { $set: { availableSlots: slot.availableSlots + delta } },
        { new: true }
      );
    }

    return NextResponse.json({ ok: true, slot: updated });
  } catch (err) {
    console.error("[slots PATCH]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
