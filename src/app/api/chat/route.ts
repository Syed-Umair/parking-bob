import { NextRequest, NextResponse } from "next/server";
import db, { type Spot } from "@/lib/db";

// ---------------------------------------------------------------------------
// Watsonx.ai helpers
// ---------------------------------------------------------------------------

const WATSONX_URL = process.env.WATSONX_URL ?? "https://us-south.ml.cloud.ibm.com";
const WATSONX_API_KEY = process.env.WATSONX_API_KEY ?? "";
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID ?? "";
const MODEL_ID = "ibm/granite-3-3-8b-instruct";
const API_VERSION = "2024-05-31";

/** Exchange IBM Cloud API key for a short-lived IAM Bearer token */
async function getIAMToken(): Promise<string> {
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: WATSONX_API_KEY,
    }),
  });
  if (!res.ok) {
    throw new Error(`IAM token fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

interface WatsonxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Call watsonx.ai chat completion */
async function watsonxChat(
  messages: WatsonxMessage[],
  token: string,
  maxTokens = 512
): Promise<string> {
  const res = await fetch(
    `${WATSONX_URL}/ml/v1/text/chat?version=${API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model_id: MODEL_ID,
        project_id: WATSONX_PROJECT_ID,
        messages,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: 0.3,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`watsonx.ai error ${res.status}: ${err}`);
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
// Intent extraction — ask the LLM to output JSON
// ---------------------------------------------------------------------------
const INTENT_SYSTEM_PROMPT = `You are a parking search assistant for Bengaluru.
Extract search intent from the user's message and return ONLY valid JSON (no markdown, no explanation).
JSON schema:
{
  "area": string | null,         // neighbourhood name, e.g. "Koramangala" — null if not mentioned
  "vehicle_size": "bike"|"car"|"suv"|null,
  "max_rate": number | null,     // max hourly rate in INR — null if not mentioned
  "is_parking_query": boolean    // true if the user wants to find/book parking
}`;

interface Intent {
  area: string | null;
  vehicle_size: "bike" | "car" | "suv" | null;
  max_rate: number | null;
  is_parking_query: boolean;
}

function parseIntent(raw: string): Intent {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as Intent;
  } catch {
    return { area: null, vehicle_size: null, max_rate: null, is_parking_query: false };
  }
}

// ---------------------------------------------------------------------------
// In-memory history store (per-session via cookie would be production-grade;
// this keeps things simple and stateless — history is passed from the client)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// POST /api/chat
// Body: { message: string; history?: ChatMessage[] }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const body = await request.json();
  const message: string = body?.message ?? "";
  const history: ChatMessage[] = Array.isArray(body?.history) ? body.history : [];

  if (!message.trim()) {
    return NextResponse.json({
      reply: "Tell me where you need to park — area, vehicle type, or budget.",
      spots: [],
    });
  }

  // Check env vars are set
  if (!WATSONX_API_KEY || !WATSONX_PROJECT_ID) {
    // Fall back to rule-based if keys not configured
    return ruleBasedFallback(message);
  }

  try {
    const token = await getIAMToken();

    // ── Step 1: extract intent ───────────────────────────────────────────
    const intentMessages: WatsonxMessage[] = [
      { role: "system", content: INTENT_SYSTEM_PROMPT },
      { role: "user", content: message },
    ];
    const intentRaw = await watsonxChat(intentMessages, token, 128);
    const intent = parseIntent(intentRaw);

    // ── Step 2: query SQLite ─────────────────────────────────────────────
    let spots: Spot[] = [];
    if (intent.is_parking_query) {
      let query = "SELECT * FROM spots WHERE is_available = 1";
      const params: (string | number)[] = [];

      if (intent.area) {
        // Fuzzy match — LLM may return partial names
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

    // ── Step 3: generate conversational reply ────────────────────────────
    const spotSummary =
      spots.length > 0
        ? spots
            .map(
              (s, i) =>
                `${i + 1}. ${s.title} — ${s.area}, ₹${s.hourly_rate}/hr, ${s.vehicle_size}, ${s.amenities || "no amenities listed"}`
            )
            .join("\n")
        : intent.is_parking_query
        ? "No spots found matching those filters."
        : "";

    const replySystemPrompt = `You are parkingBob, a friendly parking concierge for Bengaluru.
Keep replies short (2–4 sentences). Be conversational and helpful.
${spots.length > 0 ? `The following spots were found:\n${spotSummary}\nMention the top 1–2 options naturally.` : ""}
${intent.is_parking_query && spots.length === 0 ? "No spots matched. Suggest the user try a different area or loosen filters." : ""}
${!intent.is_parking_query ? "Answer the user's question helpfully. If they seem lost, guide them to search for parking." : ""}`;

    const replyMessages: WatsonxMessage[] = [
      { role: "system", content: replySystemPrompt },
      // Include recent conversation history (last 6 turns)
      ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];
    const reply = await watsonxChat(replyMessages, token, 256);

    return NextResponse.json({ reply: reply.trim(), spots, intent });
  } catch (err) {
    console.error("watsonx.ai error:", err);
    // Graceful fallback to rule-based on API failure
    return ruleBasedFallback(message);
  }
}

// ---------------------------------------------------------------------------
// Rule-based fallback (used when API keys not set or on error)
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
