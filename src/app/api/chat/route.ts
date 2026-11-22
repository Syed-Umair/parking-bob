import { NextRequest, NextResponse } from "next/server";
import db, { type Spot } from "@/lib/db";

// Known Bengaluru areas for intent detection
const KNOWN_AREAS = [
  "koramangala",
  "indiranagar",
  "mg road",
  "whitefield",
  "jayanagar",
  "hsr layout",
  "malleshwaram",
  "electronic city",
];

const VEHICLE_SIZES = ["bike", "car", "suv"];

function parseIntent(message: string): {
  area?: string;
  vehicle_size?: string;
  max_rate?: number;
} {
  const lower = message.toLowerCase();

  // Detect area
  const area = KNOWN_AREAS.find((a) => lower.includes(a));

  // Detect vehicle size
  const vehicle_size = VEHICLE_SIZES.find((v) => lower.includes(v));

  // Detect max rate — number preceded by ₹, rs, under, below, max, upto, up to
  let max_rate: number | undefined;
  const rateMatch = lower.match(
    /(?:₹|rs\.?|under|below|max|upto|up to)\s*(\d+)/i
  );
  if (rateMatch) {
    max_rate = parseInt(rateMatch[1], 10);
  }

  return { area, vehicle_size, max_rate };
}

// POST /api/chat — public
export async function POST(request: NextRequest) {
  const body = await request.json();
  const message: string = body?.message ?? "";

  if (!message.trim()) {
    return NextResponse.json(
      { reply: "Hi! I'm parkingBob 🚗 Ask me to find parking in Bengaluru — try: 'find car parking in Koramangala under ₹50'", spots: [] }
    );
  }

  const { area, vehicle_size, max_rate } = parseIntent(message);

  // Build parameterized SQL
  let query = "SELECT * FROM spots WHERE is_available = 1";
  const params: (string | number)[] = [];

  if (area) {
    query += " AND LOWER(area) LIKE LOWER(?)";
    params.push(`%${area}%`);
  }
  if (vehicle_size) {
    query += " AND vehicle_size = ?";
    params.push(vehicle_size);
  }
  if (max_rate !== undefined) {
    query += " AND hourly_rate <= ?";
    params.push(max_rate);
  }

  query += " ORDER BY hourly_rate ASC LIMIT 5";

  const spots = db.prepare(query).all(...params) as Spot[];

  // Build reply
  let reply: string;
  if (spots.length === 0) {
    reply = "No spots found";
    if (area) reply += ` in ${area}`;
    if (vehicle_size) reply += ` for ${vehicle_size}`;
    if (max_rate) reply += ` under ₹${max_rate}/hr`;
    reply += ". Try broadening your search — remove a filter and ask again.";
  } else {
    const cheapest = spots[0];
    reply = `Found ${spots.length} spot${spots.length > 1 ? "s" : ""}`;
    if (area) reply += ` in ${cheapest.area}`;
    if (vehicle_size) reply += ` for ${vehicle_size}`;
    reply += `. Cheapest: **${cheapest.title}** at ₹${cheapest.hourly_rate}/hr`;
    if (cheapest.amenities) reply += ` (${cheapest.amenities})`;
    reply += ".";
  }

  return NextResponse.json({ reply, spots });
}
