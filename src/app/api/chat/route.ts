import { NextRequest, NextResponse } from "next/server";
import db, { type Spot } from "@/lib/db";

// ---------------------------------------------------------------------------
// IBM Bob API — OpenAI-compatible, Bearer key directly (no token exchange)
// ---------------------------------------------------------------------------

const BOB_APIKEY = process.env.BOB_APIKEY ?? "";
// BOB_GATEWAY_URL is the base URL of your Bob workshop inference gateway.
// Set it in .env.local: BOB_GATEWAY_URL=https://<your-bob-gateway-host>
const BOB_GATEWAY_URL = (process.env.BOB_GATEWAY_URL ?? "").replace(/\/$/, "");
// Model name exposed by the Bob gateway (check /v1/models for the exact id)
const BOB_MODEL = process.env.BOB_MODEL ?? "premium-ide";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Call Bob's OpenAI-compatible chat completions endpoint */
async function bobChat(messages: ChatMessage[], maxTokens = 400): Promise<string> {
  const res = await fetch(`${BOB_GATEWAY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BOB_APIKEY}`,
    },
    body: JSON.stringify({
      model: BOB_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bob API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// Known Bengaluru areas for SQL query
// ---------------------------------------------------------------------------
const KNOWN_AREAS = [
  "koramangala", "indiranagar", "mg road", "whitefield",
  "jayanagar", "hsr layout", "malleshwaram", "electronic city",
  "bellandur", "btm layout", "marathahalli", "yelahanka",
  "jp nagar", "bannerghatta road", "hebbal",
];

// ---------------------------------------------------------------------------
// Intent extraction — ask Bob to output JSON
// ---------------------------------------------------------------------------
const INTENT_SYSTEM_PROMPT = `You are a parking search assistant for Bengaluru.
Extract search intent from the user's message and return ONLY valid JSON (no markdown, no explanation).
JSON schema:
{
  "area": string | null,
  "vehicle_size": "bike"|"car"|"suv"|null,
  "max_rate": number | null,
  "is_parking_query": boolean
}`;

interface Intent {
  area: string | null;
  vehicle_size: "bike" | "car" | "suv" | null;
  max_rate: number | null;
  is_parking_query: boolean;
}

function parseIntent(raw: string): Intent {
  try {
    const cleaned = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as Intent;
  } catch {
    return { area: null, vehicle_size: null, max_rate: null, is_parking_query: false };
  }
}

export interface ConvMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// POST /api/chat
// Body: { message: string; history?: ConvMessage[] }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const body = await request.json();
  const message: string = body?.message ?? "";
  const history: ConvMessage[] = Array.isArray(body?.history) ? body.history : [];

  if (!message.trim()) {
    return NextResponse.json({
      reply: "Tell me where you need to park — area, vehicle type, or budget.",
      spots: [],
    });
  }

  // Check Bob API is configured
  if (!BOB_APIKEY || !BOB_GATEWAY_URL) {
    return ruleBasedFallback(message);
  }

  try {
    // ── Step 1: extract intent via Bob ──────────────────────────────────
    const intentRaw = await bobChat(
      [{ role: "system", content: INTENT_SYSTEM_PROMPT }, { role: "user", content: message }],
      128
    );
    const intent = parseIntent(intentRaw);

    // ── Step 2: query SQLite ─────────────────────────────────────────────
    let spots: Spot[] = [];
    if (intent.is_parking_query) {
      let query = "SELECT * FROM spots WHERE is_available = 1";
      const params: (string | number)[] = [];

      if (intent.area) {
        const normalised = intent.area.toLowerCase();
        const matched = KNOWN_AREAS.find((a) => normalised.includes(a) || a.includes(normalised));
        if (matched) {
          query += " AND LOWER(area) LIKE LOWER(?)";
          params.push(`%${matched}%`);
        }
      }
      if (intent.vehicle_size) {
        query += " AND vehicle_size = ?";
        params.push(intent.vehicle_size);
      }
      if (intent.max_rate !== null && intent.max_rate > 0) {
        query += " AND hourly_rate <= ?";
        params.push(intent.max_rate);
      }

      query += " ORDER BY hourly_rate ASC LIMIT 6";
      spots = db.prepare(query).all(...params) as Spot[];
    }

    // ── Step 3: generate reply via Bob ───────────────────────────────────
    const spotSummary = spots.length > 0
      ? spots.map((s, i) =>
          `${i + 1}. ${s.title} — ${s.area}, ₹${s.hourly_rate}/hr, ${s.vehicle_size}, ${s.amenities || "no amenities"}`
        ).join("\n")
      : intent.is_parking_query ? "No spots found matching those filters." : "";

    const replySystemPrompt = `You are parkingBob, a friendly parking concierge for Bengaluru. Keep replies short (2–4 sentences). Be conversational and helpful.
${spots.length > 0 ? `Spots found:\n${spotSummary}\nMention the top 1–2 options naturally.` : ""}
${intent.is_parking_query && spots.length === 0 ? "No spots matched. Suggest trying a different area or loosening filters." : ""}
${!intent.is_parking_query ? "Answer helpfully. Guide lost users toward parking search." : ""}`;

    const replyMessages: ChatMessage[] = [
      { role: "system", content: replySystemPrompt },
      ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];
    const reply = await bobChat(replyMessages, 256);

    return NextResponse.json({ reply: reply.trim(), spots, intent });
  } catch (err) {
    console.error("Bob API error:", err);
    return ruleBasedFallback(message);
  }
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------
function ruleBasedFallback(message: string) {
  const lower = message.toLowerCase();
  const area = KNOWN_AREAS.find((a) => lower.includes(a));
  const vehicle_size = (["bike", "car", "suv"] as const).find((v) => lower.includes(v));
  const rateMatch = lower.match(/(?:₹|rs\.?|under|below|max|upto|up to)\s*(\d+)/i);
  const max_rate = rateMatch ? parseInt(rateMatch[1], 10) : undefined;

  let query = "SELECT * FROM spots WHERE is_available = 1";
  const params: (string | number)[] = [];
  if (area) { query += " AND LOWER(area) LIKE LOWER(?)"; params.push(`%${area}%`); }
  if (vehicle_size) { query += " AND vehicle_size = ?"; params.push(vehicle_size); }
  if (max_rate) { query += " AND hourly_rate <= ?"; params.push(max_rate); }
  query += " ORDER BY hourly_rate ASC LIMIT 6";

  const spots = db.prepare(query).all(...params) as Spot[];
  let reply: string;
  if (spots.length === 0) {
    reply = "No spots found";
    if (area) reply += ` in ${area}`;
    reply += ". Try a different area or remove a filter.";
  } else {
    reply = `Found ${spots.length} spot${spots.length > 1 ? "s" : ""}`;
    if (area) reply += ` in ${spots[0].area}`;
    reply += `. Cheapest: **${spots[0].title}** at ₹${spots[0].hourly_rate}/hr.`;
  }
  return NextResponse.json({ reply, spots });
}
