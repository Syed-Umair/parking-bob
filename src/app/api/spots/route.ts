import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import db, { type Spot } from "@/lib/db";

// GET /api/spots — public, supports ?area=&vehicle_size=&max_rate=
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const area = searchParams.get("area");
  const vehicleSize = searchParams.get("vehicle_size");
  const maxRate = searchParams.get("max_rate");

  let query = "SELECT * FROM spots WHERE is_available = 1";
  const params: (string | number)[] = [];

  if (area) {
    query += " AND LOWER(area) LIKE LOWER(?)";
    params.push(`%${area}%`);
  }
  if (vehicleSize) {
    query += " AND vehicle_size = ?";
    params.push(vehicleSize);
  }
  if (maxRate) {
    const rate = parseInt(maxRate, 10);
    if (!isNaN(rate)) {
      query += " AND hourly_rate <= ?";
      params.push(rate);
    }
  }

  query += " ORDER BY hourly_rate ASC";

  const spots = db.prepare(query).all(...params) as Spot[];
  return NextResponse.json({ spots });
}

// POST /api/spots — requires auth
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    area,
    address,
    start_hour,
    end_hour,
    vehicle_size,
    hourly_rate,
    amenities,
    host_name,
  } = body;

  if (
    !title ||
    !area ||
    !address ||
    start_hour === undefined ||
    end_hour === undefined ||
    !vehicle_size ||
    !hourly_rate
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO spots (title, area, address, start_hour, end_hour, vehicle_size, hourly_rate, amenities, host_user_id, host_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      area,
      address,
      start_hour,
      end_hour,
      vehicle_size,
      hourly_rate,
      amenities ?? "",
      userId,
      host_name ?? "Anonymous"
    );

  const spot = db
    .prepare("SELECT * FROM spots WHERE id = ?")
    .get(result.lastInsertRowid) as Spot;

  return NextResponse.json({ spot }, { status: 201 });
}
