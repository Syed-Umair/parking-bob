/**
 * db.ts — Cached Mongoose connection with an automatic in-memory fallback.
 *
 * If MONGODB_URI is set  → connects to MongoDB (connection is cached across
 *   Next.js hot-reloads via a module-level global).
 * If MONGODB_URI is absent → all Mongoose model operations are shimmed by a
 *   lightweight in-memory store so the demo never crashes.
 */

import mongoose from "mongoose";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // Persist across Next.js hot-reloads in development.
  // eslint-disable-next-line no-var
  var __mongoose_cache: MongooseCache | undefined;
}

// ─── In-memory fallback store ────────────────────────────────────────────────

type Doc = Record<string, unknown> & { _id: string };

const memStore: Record<string, Doc[]> = {};

function memCollection(name: string): Doc[] {
  if (!memStore[name]) memStore[name] = [];
  return memStore[name];
}

/**
 * Minimal in-memory shim that mirrors the Mongoose Model API surface used
 * by this app: find, findOne, findById, create, findOneAndUpdate, save().
 */
export function createMemModel<T extends Doc>(collectionName: string) {
  const col = () => memCollection(collectionName);

  return {
    collectionName,

    async find(query: Partial<T> = {}): Promise<T[]> {
      return col().filter((d) =>
        Object.entries(query).every(([k, v]) => d[k] === v)
      ) as T[];
    },

    async findOne(query: Partial<T>): Promise<T | null> {
      return (
        (col().find((d) =>
          Object.entries(query).every(([k, v]) => d[k] === v)
        ) as T) ?? null
      );
    },

    async findById(id: string): Promise<T | null> {
      return (col().find((d) => d._id === id) as T) ?? null;
    },

    async create(data: Omit<T, "_id"> | Array<Omit<T, "_id">>): Promise<T | T[]> {
      const items = Array.isArray(data) ? data : [data];
      const created = items.map((item) => ({
        ...item,
        _id: Math.random().toString(36).slice(2),
        createdAt: new Date(),
      })) as T[];
      col().push(...created);
      return Array.isArray(data) ? created : created[0];
    },

    async findOneAndUpdate(
      query: Partial<T>,
      update: { $set?: Partial<T> } | Partial<T>,
      opts: { new?: boolean; upsert?: boolean } = {}
    ): Promise<T | null> {
      const idx = col().findIndex((d) =>
        Object.entries(query).every(([k, v]) => d[k] === v)
      );
      const patch =
        "$set" in update ? (update as { $set: Partial<T> }).$set : update;
      if (idx === -1) {
        if (opts.upsert) {
          const doc = {
            ...query,
            ...patch,
            _id: Math.random().toString(36).slice(2),
          } as T;
          col().push(doc);
          return doc;
        }
        return null;
      }
      col()[idx] = { ...col()[idx], ...(patch as object) } as Doc;
      return (opts.new !== false ? col()[idx] : col()[idx]) as T;
    },

    async deleteMany(): Promise<void> {
      memStore[collectionName] = [];
    },
  };
}

// ─── Whether we are using real Mongo ─────────────────────────────────────────

export const IS_REAL_DB = Boolean(process.env.MONGODB_URI);

// ─── Real Mongoose connection (cached) ───────────────────────────────────────

async function connectMongoose(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI!;

  if (!global.__mongoose_cache) {
    global.__mongoose_cache = { conn: null, promise: null };
  }
  const cache = global.__mongoose_cache;

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/**
 * Call `connectDB()` at the top of every API route that needs Mongoose models.
 * When MONGODB_URI is absent it resolves immediately (no-op).
 */
export async function connectDB(): Promise<void> {
  if (IS_REAL_DB) {
    await connectMongoose();
  }
}
