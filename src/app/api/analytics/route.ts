/**
 * GET /api/analytics
 *
 * Returns aggregated metrics derived from ParkingRequest records:
 *
 *   totals:
 *     allotted   — count of ACCEPTED requests (slots actually allotted)
 *     pending    — count of PENDING requests
 *     declined   — count of DECLINED requests
 *     revenueINR — sum of (durationHours × hourlyRateINR) for ACCEPTED requests
 *
 *   bySlot[] — per-RWA breakdown sorted by revenue descending:
 *     rwaName, rwaSlotId, allotted, revenueINR
 */

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ParkingRequest } from "@/lib/models";

interface ReqDoc {
  rwaSlotId: string;
  rwaName: string;
  durationHours: number;
  hourlyRateINR: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
}

export async function GET() {
  try {
    await connectDB();

    const all: ReqDoc[] = await (ParkingRequest as any).find({});

    // ── Totals ────────────────────────────────────────────────────────────────
    let allotted   = 0;
    let pending    = 0;
    let declined   = 0;
    let revenueINR = 0;

    // ── Per-slot map ─────────────────────────────────────────────────────────
    const slotMap = new Map<string, { rwaName: string; allotted: number; revenueINR: number }>();

    for (const req of all) {
      if (req.status === "PENDING")  pending++;
      if (req.status === "DECLINED") declined++;

      if (req.status === "ACCEPTED") {
        allotted++;
        const earned = (req.durationHours ?? 1) * (req.hourlyRateINR ?? 0);
        revenueINR += earned;

        const key = req.rwaSlotId;
        const entry = slotMap.get(key) ?? { rwaName: req.rwaName, allotted: 0, revenueINR: 0 };
        entry.allotted++;
        entry.revenueINR += earned;
        slotMap.set(key, entry);
      }
    }

    const bySlot = Array.from(slotMap.entries())
      .map(([rwaSlotId, v]) => ({ rwaSlotId, ...v }))
      .sort((a, b) => b.revenueINR - a.revenueINR);

    return NextResponse.json({
      ok: true,
      totals: { allotted, pending, declined, revenueINR, total: all.length },
      bySlot,
    });
  } catch (err) {
    console.error("[analytics GET]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
