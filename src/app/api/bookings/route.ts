import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import db, { type Booking } from "@/lib/db";
import crypto from "crypto";

// GET /api/bookings — returns signed-in user's bookings
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = db
    .prepare(
      `SELECT b.*, s.title as spot_title, s.area, s.address, s.hourly_rate
       FROM bookings b
       JOIN spots s ON s.id = b.spot_id
       WHERE b.driver_user_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(userId) as (Booking & {
    spot_title: string;
    area: string;
    address: string;
    hourly_rate: number;
  })[];

  return NextResponse.json({ bookings });
}

// POST /api/bookings — requires auth; transactional to prevent double-booking
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { spot_id, driver_name, vehicle_number, start_hour, end_hour } = body;

  if (
    !spot_id ||
    !driver_name ||
    !vehicle_number ||
    start_hour === undefined ||
    end_hour === undefined
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (start_hour >= end_hour) {
    return NextResponse.json(
      { error: "start_hour must be before end_hour" },
      { status: 400 }
    );
  }

  const booking_code = `PB-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
  const hours = end_hour - start_hour;

  let newBooking: Booking | null = null;

  const book = db.transaction(() => {
    // Check spot exists and is available
    const spot = db
      .prepare("SELECT * FROM spots WHERE id = ? AND is_available = 1")
      .get(spot_id) as { hourly_rate: number } | undefined;

    if (!spot) {
      return { error: "Spot not found or unavailable", status: 404 };
    }

    // Double-booking guard: check for overlapping bookings on this spot
    const conflict = db
      .prepare(
        `SELECT COUNT(*) as n FROM bookings
         WHERE spot_id = ? AND NOT (end_hour <= ? OR start_hour >= ?)`
      )
      .get(spot_id, start_hour, end_hour) as { n: number };

    if (conflict.n > 0) {
      return { error: "Time slot already booked", status: 409 };
    }

    const total_cost = spot.hourly_rate * hours;

    const result = db
      .prepare(
        `INSERT INTO bookings (spot_id, driver_user_id, driver_name, vehicle_number, start_hour, end_hour, total_cost, booking_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        spot_id,
        userId,
        driver_name,
        vehicle_number,
        start_hour,
        end_hour,
        total_cost,
        booking_code
      );

    newBooking = db
      .prepare("SELECT * FROM bookings WHERE id = ?")
      .get(result.lastInsertRowid) as Booking;

    return null; // no error
  });

  const err = book();
  if (err) {
    return NextResponse.json(
      { error: err.error },
      { status: err.status }
    );
  }

  return NextResponse.json({ booking: newBooking }, { status: 201 });
}
