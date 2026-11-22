/**
 * models.ts — Mongoose schemas + in-memory fallback models.
 *
 * Each exported symbol is either a real Mongoose Model (when MONGODB_URI is
 * set) or a lightweight in-memory shim (when it isn't).  API routes import
 * directly from here and never need to branch on IS_REAL_DB themselves.
 *
 * Models:
 *   Vehicle          — registered vehicles with QR tokens
 *   RwaSlot          — RWA parking hubs
 *   ParkingIncident  — double-parking / blocking incidents
 *   Owner            — RWA apartment owner / association account
 *   ParkingRequest   — visitor slot request submitted by a user; accepted or
 *                      declined by the owner of the target RWA slot
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import { IS_REAL_DB, createMemModel } from "./db";

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export type VehicleStatus = "PARKED" | "BLOCKING_REPORTED" | "MOVING";

export interface IVehicle extends Document {
  qrToken: string;          // e.g. "BLR-001"
  maskedPlate: string;      // e.g. "KA-01-MJ-****"
  ownerName: string;
  maskedPhone: string;      // e.g. "+91-98****1234"
  status: VehicleStatus;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    qrToken:     { type: String, required: true, unique: true, index: true },
    maskedPlate: { type: String, required: true },
    ownerName:   { type: String, required: true },
    maskedPhone: { type: String, required: true },
    status: {
      type: String,
      enum: ["PARKED", "BLOCKING_REPORTED", "MOVING"] as VehicleStatus[],
      default: "PARKED",
    },
  },
  { timestamps: true }
);

// ─── RwaSlot ──────────────────────────────────────────────────────────────────

export interface IRwaSlot extends Document {
  rwaName: string;          // e.g. "Prestige Shantiniketan Visitor Parking"
  locality: string;         // e.g. "Whitefield"
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  hourlyRateINR: number;
  availableSlots: number;
  totalSlots: number;
  openHours: string;        // e.g. "06:00–22:00"
}

const RwaSlotSchema = new Schema<IRwaSlot>(
  {
    rwaName:       { type: String, required: true },
    locality:      { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    hourlyRateINR:  { type: Number, required: true },
    availableSlots: { type: Number, required: true },
    totalSlots:     { type: Number, required: true },
    openHours:      { type: String, required: true },
  },
  { timestamps: true }
);

RwaSlotSchema.index({ location: "2dsphere" });

// ─── ParkingIncident ──────────────────────────────────────────────────────────

export type IncidentIssueType =
  | "BLOCKING_GATE"
  | "DOUBLE_PARKED"
  | "NO_PARKING_ZONE";

export type EscalationStage =
  | "WHATSAPP_NUDGE"
  | "MASKED_CALL"
  | "ALT_SLOT_OFFERED"
  | "RESOLVED";

export interface IParkingIncident extends Document {
  qrToken: string;
  issueType: IncidentIssueType;
  escalationStage: EscalationStage;
  createdAt: Date;
}

const ParkingIncidentSchema = new Schema<IParkingIncident>(
  {
    qrToken: { type: String, required: true, index: true },
    issueType: {
      type: String,
      enum: ["BLOCKING_GATE", "DOUBLE_PARKED", "NO_PARKING_ZONE"] as IncidentIssueType[],
      required: true,
    },
    escalationStage: {
      type: String,
      enum: ["WHATSAPP_NUDGE", "MASKED_CALL", "ALT_SLOT_OFFERED", "RESOLVED"] as EscalationStage[],
      default: "WHATSAPP_NUDGE",
    },
  },
  { timestamps: true }
);

// ─── Owner ────────────────────────────────────────────────────────────────────

export interface IOwner extends Document {
  name: string;              // e.g. "Prestige Shantiniketan RWA"
  email: string;             // login identifier
  rwaSlotId: string;         // which RwaSlot this owner manages (_id as string)
}

const OwnerSchema = new Schema<IOwner>(
  {
    name:      { type: String, required: true },
    email:     { type: String, required: true, unique: true, index: true },
    rwaSlotId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// ─── ParkingRequest ───────────────────────────────────────────────────────────

export type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface IParkingRequest extends Document {
  rwaSlotId: string;         // target RWA slot (_id as string)
  rwaName: string;           // denormalised for display
  requesterName: string;
  requesterPhone: string;    // masked by convention
  vehiclePlate: string;      // masked, e.g. "KA-01-MJ-****"
  durationHours: number;
  hourlyRateINR: number;     // snapshot of slot rate at time of request
  status: RequestStatus;
  createdAt: Date;
}

const ParkingRequestSchema = new Schema<IParkingRequest>(
  {
    rwaSlotId:      { type: String, required: true, index: true },
    rwaName:        { type: String, required: true },
    requesterName:  { type: String, required: true },
    requesterPhone: { type: String, required: true },
    vehiclePlate:   { type: String, required: true },
    durationHours:  { type: Number, required: true, default: 1 },
    hourlyRateINR:  { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED"] as RequestStatus[],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

// ─── Model factory (real vs shim) ─────────────────────────────────────────────

function getModel<T extends Document>(
  name: string,
  schema: Schema
): Model<T> {
  // Guard against Next.js hot-reload re-registering models
  if (mongoose.models[name]) return mongoose.models[name] as Model<T>;
  return mongoose.model<T>(name, schema);
}

export const Vehicle: Model<IVehicle> | ReturnType<typeof createMemModel> =
  IS_REAL_DB
    ? getModel<IVehicle>("Vehicle", VehicleSchema)
    : createMemModel<IVehicle & { _id: string }>("vehicles");

export const RwaSlot: Model<IRwaSlot> | ReturnType<typeof createMemModel> =
  IS_REAL_DB
    ? getModel<IRwaSlot>("RwaSlot", RwaSlotSchema)
    : createMemModel<IRwaSlot & { _id: string }>("rwaslots");

export const ParkingIncident:
  | Model<IParkingIncident>
  | ReturnType<typeof createMemModel> = IS_REAL_DB
  ? getModel<IParkingIncident>("ParkingIncident", ParkingIncidentSchema)
  : createMemModel<IParkingIncident & { _id: string }>("parkingincidents");

export const Owner: Model<IOwner> | ReturnType<typeof createMemModel> =
  IS_REAL_DB
    ? getModel<IOwner>("Owner", OwnerSchema)
    : createMemModel<IOwner & { _id: string }>("owners");

export const ParkingRequest:
  | Model<IParkingRequest>
  | ReturnType<typeof createMemModel> = IS_REAL_DB
  ? getModel<IParkingRequest>("ParkingRequest", ParkingRequestSchema)
  : createMemModel<IParkingRequest & { _id: string }>("parkingrequests");
