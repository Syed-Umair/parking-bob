/**
 * GET /api/seed  — idempotent seed of vehicles + RWA slots.
 * POST /api/seed — same, but also wipes existing data first (hard reset).
 *
 * Realistic Bengaluru coordinates (verified OSM):
 *  HSR Layout Sector 2  : 12.9121° N, 77.6446° E
 *  Koramangala 5th Block: 12.9352° N, 77.6245° E
 *  Indiranagar 100ft Rd : 12.9784° N, 77.6408° E
 *  Bellandur            : 12.9259° N, 77.6762° E
 *  Whitefield           : 12.9698° N, 77.7499° E
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Vehicle, RwaSlot, ParkingIncident, Owner } from "@/lib/models";

// ─── Seed data ───────────────────────────────────────────────────────────────

const VEHICLES = [
  {
    qrToken: "BLR-001",
    maskedPlate: "KA-01-MJ-****",
    ownerName: "Arjun Sharma",
    maskedPhone: "+91-98****1234",
    status: "PARKED",
  },
  {
    qrToken: "BLR-002",
    maskedPlate: "KA-05-HB-****",
    ownerName: "Priya Nair",
    maskedPhone: "+91-97****5678",
    status: "PARKED",
  },
  {
    qrToken: "BLR-003",
    maskedPlate: "KA-03-AB-****",
    ownerName: "Rahul Verma",
    maskedPhone: "+91-96****9012",
    status: "MOVING",
  },
  {
    qrToken: "BLR-004",
    maskedPlate: "KA-19-CD-****",
    ownerName: "Deepa Krishnamurthy",
    maskedPhone: "+91-95****3456",
    status: "BLOCKING_REPORTED",
  },
] as const;

const RWA_SLOTS = [
  {
    rwaName: "Salarpuria Sattva Divinity Visitor Parking",
    locality: "HSR Layout Sector 2",
    location: { type: "Point" as const, coordinates: [77.6446, 12.9121] },
    hourlyRateINR: 20,
    availableSlots: 8,
    totalSlots: 20,
    openHours: "06:00–22:00",
  },
  {
    rwaName: "Mantri Synergy Visitor Hub",
    locality: "Koramangala 5th Block",
    location: { type: "Point" as const, coordinates: [77.6245, 12.9352] },
    hourlyRateINR: 30,
    availableSlots: 3,
    totalSlots: 15,
    openHours: "07:00–23:00",
  },
  {
    rwaName: "Indiranagar RWA Street Parking Pod",
    locality: "Indiranagar 100ft Rd",
    location: { type: "Point" as const, coordinates: [77.6408, 12.9784] },
    hourlyRateINR: 25,
    availableSlots: 12,
    totalSlots: 25,
    openHours: "05:00–23:59",
  },
  {
    rwaName: "Bellandur Lake View Resident Overflow",
    locality: "Bellandur",
    location: { type: "Point" as const, coordinates: [77.6762, 12.9259] },
    hourlyRateINR: 15,
    availableSlots: 20,
    totalSlots: 40,
    openHours: "00:00–23:59",
  },
  {
    rwaName: "Prestige Shantiniketan Visitor Parking",
    locality: "Whitefield",
    location: { type: "Point" as const, coordinates: [77.7499, 12.9698] },
    hourlyRateINR: 35,
    availableSlots: 5,
    totalSlots: 30,
    openHours: "06:00–22:00",
  },
] as const;

// Owners are seeded after RWA slots so we can reference the slot's _id.
// We seed one owner account per slot, keyed by rwaName.
const OWNER_TEMPLATES = [
  { name: "Salarpuria Sattva RWA",      email: "admin@salarpuria-hsr.rwa" },
  { name: "Mantri Synergy RWA",          email: "admin@mantri-koramangala.rwa" },
  { name: "Indiranagar RWA Association", email: "admin@indiranagar100ft.rwa" },
  { name: "Bellandur Lake RWA",          email: "admin@bellandur-lake.rwa" },
  { name: "Prestige Shantiniketan RWA",  email: "admin@prestige-whitefield.rwa" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function runSeed(wipe = false) {
  await connectDB();

  if (wipe) {
    await Vehicle.deleteMany({});
    await RwaSlot.deleteMany({});
    await ParkingIncident.deleteMany({});
  }

  // Upsert vehicles (idempotent by qrToken)
  const vehicleResults = await Promise.all(
    VEHICLES.map((v) =>
      (Vehicle as any).findOneAndUpdate(
        { qrToken: v.qrToken },
        { $set: v },
        { upsert: true, new: true }
      )
    )
  );

  // Upsert RWA slots (idempotent by rwaName)
  const slotResults: Array<{ _id: string; rwaName: string }> = await Promise.all(
    RWA_SLOTS.map((s) =>
      (RwaSlot as any).findOneAndUpdate(
        { rwaName: s.rwaName },
        { $set: s },
        { upsert: true, new: true }
      )
    )
  );

  // Upsert owners — one per slot, matched by index (same order as RWA_SLOTS)
  const ownerResults = await Promise.all(
    OWNER_TEMPLATES.map((tmpl, idx) => {
      const slot = slotResults[idx];
      return (Owner as any).findOneAndUpdate(
        { email: tmpl.email },
        { $set: { name: tmpl.name, email: tmpl.email, rwaSlotId: String(slot._id) } },
        { upsert: true, new: true }
      );
    })
  );

  return {
    vehicles: vehicleResults.length,
    rwaSlots: slotResults.length,
    owners: ownerResults.length,
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    const counts = await runSeed(false);
    return NextResponse.json({
      ok: true,
      message: "Seed completed (idempotent — existing records preserved).",
      seeded: counts,
    });
  } catch (err) {
    console.error("[seed GET]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest) {
  try {
    const counts = await runSeed(true);
    return NextResponse.json({
      ok: true,
      message: "Hard reset + re-seed complete.",
      seeded: counts,
    });
  } catch (err) {
    console.error("[seed POST]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
