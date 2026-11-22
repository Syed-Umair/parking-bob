"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type IssueType = "BLOCKING_GATE" | "DOUBLE_PARKED" | "NO_PARKING_ZONE";
type EscalationStage =
  | "WHATSAPP_NUDGE"
  | "MASKED_CALL"
  | "ALT_SLOT_OFFERED"
  | "RESOLVED";

interface Vehicle {
  _id: string;
  qrToken: string;
  maskedPlate: string;
  ownerName: string;
  maskedPhone: string;
  status: string;
}

interface Incident {
  _id: string;
  qrToken: string;
  issueType: IssueType;
  escalationStage: EscalationStage;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ISSUE_OPTIONS: { value: IssueType; label: string; emoji: string }[] = [
  { value: "BLOCKING_GATE", label: "Blocking Driveway / Gate", emoji: "🚧" },
  { value: "DOUBLE_PARKED", label: "Double Parked", emoji: "🚗🚗" },
  { value: "NO_PARKING_ZONE", label: "No-Parking Zone", emoji: "🚫" },
];

const STAGE_LADDER: {
  stage: EscalationStage;
  label: string;
  minutesTrigger: number;
  emoji: string;
  color: string;
}[] = [
  {
    stage: "WHATSAPP_NUDGE",
    label: "WhatsApp Nudge",
    minutesTrigger: 0,
    emoji: "💬",
    color: "text-green-600",
  },
  {
    stage: "MASKED_CALL",
    label: "Privacy-Masked Call",
    minutesTrigger: 5,
    emoji: "📞",
    color: "text-amber-600",
  },
  {
    stage: "ALT_SLOT_OFFERED",
    label: "Nearby RWA Slot Offered",
    minutesTrigger: 15,
    emoji: "🅿️",
    color: "text-blue-600",
  },
  {
    stage: "RESOLVED",
    label: "Resolved",
    minutesTrigger: 999,
    emoji: "✅",
    color: "text-slate-500",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const [qrToken, setQrToken] = useState<string>("");

  // Vehicle + incident state
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueType>("BLOCKING_GATE");

  // UI state
  const [phase, setPhase] = useState<"lookup" | "report" | "tracking">("lookup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Live escalation timer
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve params Promise (Next.js 15 async params)
  useEffect(() => {
    params.then((p) => setQrToken(p.qrToken));
  }, [params]);

  // Fetch vehicle when qrToken is ready
  useEffect(() => {
    if (!qrToken) return;
    setLoading(true);
    fetch(`/api/incidents?qrToken=${qrToken}`)
      .then((r) => r.json())
      .then((data) => {
        // Also fetch vehicle via seed data approach — use incidents endpoint hint
        // We load vehicle by calling seed first to ensure it exists
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load vehicle info from seed vehicles
    fetch("/api/seed")
      .then((r) => r.json())
      .then(() => {
        // Now fetch existing incidents
        return fetch(`/api/incidents?qrToken=${qrToken}`);
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.incidents?.length > 0) {
          const active = data.incidents.find(
            (i: Incident) => i.escalationStage !== "RESOLVED"
          );
          if (active) {
            setIncident(active);
            setPhase("tracking");
            const created = new Date(active.createdAt).getTime();
            const diff = Math.floor((Date.now() - created) / 1000);
            setElapsedSec(diff);
            startTimer();
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Seed + load vehicle
  async function loadVehicle() {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/seed");
      const incRes = await fetch(`/api/incidents?qrToken=${qrToken}`);
      const incData = await incRes.json();

      // Derive vehicle from seed data shape
      const MOCK_VEHICLES: Record<string, Vehicle> = {
        "BLR-001": { _id: "1", qrToken: "BLR-001", maskedPlate: "KA-01-MJ-****", ownerName: "Arjun Sharma", maskedPhone: "+91-98****1234", status: "PARKED" },
        "BLR-002": { _id: "2", qrToken: "BLR-002", maskedPlate: "KA-05-HB-****", ownerName: "Priya Nair", maskedPhone: "+91-97****5678", status: "PARKED" },
        "BLR-003": { _id: "3", qrToken: "BLR-003", maskedPlate: "KA-03-AB-****", ownerName: "Rahul Verma", maskedPhone: "+91-96****9012", status: "MOVING" },
        "BLR-004": { _id: "4", qrToken: "BLR-004", maskedPlate: "KA-19-CD-****", ownerName: "Deepa Krishnamurthy", maskedPhone: "+91-95****3456", status: "BLOCKING_REPORTED" },
      };

      const v = MOCK_VEHICLES[qrToken];
      if (!v) {
        setError(`No vehicle registered for QR token "${qrToken}".`);
        return;
      }
      setVehicle(v);

      const active = incData.incidents?.find(
        (i: Incident) => i.escalationStage !== "RESOLVED"
      );
      if (active) {
        setIncident(active);
        setPhase("tracking");
        const diff = Math.floor((Date.now() - new Date(active.createdAt).getTime()) / 1000);
        setElapsedSec(diff);
        startTimer();
      } else {
        setPhase("report");
      }
    } catch {
      setError("Failed to load vehicle data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Report incident
  async function handleReport() {
    if (!vehicle) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: vehicle.qrToken, issueType: selectedIssue }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setIncident(data.incident);
      setElapsedSec(0);
      startTimer();
      setPhase("tracking");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to report incident.");
    } finally {
      setLoading(false);
    }
  }

  // ── Escalate
  async function handleEscalate(stage: EscalationStage) {
    if (!incident) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId: incident._id, escalationStage: stage }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setIncident(data.incident);
      if (stage === "RESOLVED") {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to escalate.");
    } finally {
      setLoading(false);
    }
  }

  // ── Timer display
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const timerLabel = `${mins}m ${secs.toString().padStart(2, "0")}s`;

  // ── Current escalation index
  const currentStageIdx = incident
    ? STAGE_LADDER.findIndex((s) => s.stage === incident.escalationStage)
    : -1;
  const nextStage = currentStageIdx >= 0 ? STAGE_LADDER[currentStageIdx + 1] : null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Top bar */}
      <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white/80 hover:text-white text-lg">←</Link>
        <div>
          <div className="font-bold text-sm">Parking Bob — QR Report</div>
          <div className="text-orange-100 text-xs font-mono">{qrToken || "…"}</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">

        {/* Phase: lookup */}
        {phase === "lookup" && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center space-y-4">
            <div className="text-5xl">📷</div>
            <h2 className="text-xl font-bold text-slate-800">QR Token Scanned</h2>
            <p className="text-slate-500 text-sm">
              Token <span className="font-mono font-semibold text-orange-600">{qrToken}</span> detected
              on windshield. Tap below to look up the vehicle.
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={loadVehicle}
              disabled={loading || !qrToken}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Loading…" : "🔍 Look Up Vehicle"}
            </button>
          </div>
        )}

        {/* Phase: report */}
        {phase === "report" && vehicle && (
          <>
            {/* Vehicle card */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">🚗</div>
                <div>
                  <div className="font-mono font-bold text-lg text-slate-800">{vehicle.maskedPlate}</div>
                  <div className="text-sm text-slate-500">{vehicle.ownerName}</div>
                </div>
                <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  vehicle.status === "PARKED" ? "bg-green-100 text-green-700"
                  : vehicle.status === "BLOCKING_REPORTED" ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-600"
                }`}>
                  {vehicle.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 pt-1 border-t border-slate-100">
                <span>📱</span>
                <span className="font-mono">{vehicle.maskedPhone}</span>
                <span className="text-xs text-slate-400 ml-auto">Privacy-masked</span>
              </div>
            </div>

            {/* Issue selector */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
              <h3 className="font-semibold text-slate-700 text-sm">Select Issue Type</h3>
              <div className="space-y-2">
                {ISSUE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedIssue === opt.value
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="issue"
                      value={opt.value}
                      checked={selectedIssue === opt.value}
                      onChange={() => setSelectedIssue(opt.value)}
                      className="accent-orange-500"
                    />
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {/* CTA */}
            <button
              onClick={handleReport}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm transition-colors shadow-md"
            >
              {loading ? "Sending…" : "📲 Send Privacy-Masked WhatsApp & Call Alert"}
            </button>
          </>
        )}

        {/* Phase: tracking */}
        {phase === "tracking" && incident && (
          <>
            {/* Timer */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-5 shadow-md">
              <div className="text-xs font-semibold opacity-80 mb-1 uppercase tracking-wide">Incident Active</div>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-mono font-bold">{timerLabel}</div>
                <div className="text-orange-100 text-sm mb-1">elapsed</div>
              </div>
              <div className="mt-2 text-sm opacity-90">
                {ISSUE_OPTIONS.find((o) => o.value === incident.issueType)?.emoji}{" "}
                {ISSUE_OPTIONS.find((o) => o.value === incident.issueType)?.label}
              </div>
            </div>

            {/* Escalation ladder */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-1">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Escalation Ladder</h3>
              {STAGE_LADDER.map((step, idx) => {
                const done = idx < currentStageIdx;
                const active = idx === currentStageIdx;
                return (
                  <div
                    key={step.stage}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      active
                        ? "bg-orange-50 border border-orange-200"
                        : done
                        ? "opacity-50"
                        : "opacity-30"
                    }`}
                  >
                    <span className="text-xl">{done ? "✅" : step.emoji}</span>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${active ? "text-orange-700" : "text-slate-700"}`}>
                        {step.label}
                      </div>
                      {step.minutesTrigger > 0 && step.minutesTrigger < 999 && (
                        <div className="text-xs text-slate-400">Triggers at {step.minutesTrigger}m</div>
                      )}
                    </div>
                    {active && (
                      <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Escalate + Resolve buttons */}
            <div className="space-y-3">
              {nextStage && nextStage.stage !== "RESOLVED" && (
                <button
                  onClick={() => handleEscalate(nextStage.stage)}
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {loading ? "…" : `${nextStage.emoji} Escalate to ${nextStage.label}`}
                </button>
              )}
              {incident.escalationStage !== "RESOLVED" && (
                <button
                  onClick={() => handleEscalate("RESOLVED")}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {loading ? "…" : "✅ Mark Resolved — Vehicle Moved"}
                </button>
              )}
              {incident.escalationStage === "RESOLVED" && (
                <div className="text-center bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-semibold text-emerald-700">Incident Resolved</p>
                  <p className="text-sm text-emerald-600 mt-1">Vehicle has been moved. Thank you!</p>
                  <Link
                    href="/"
                    className="mt-3 inline-block text-sm text-emerald-700 font-medium underline"
                  >
                    Back to Home
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
