import Database from "better-sqlite3";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Spot {
  id: number;
  title: string;
  area: string;
  address: string;
  start_hour: number;
  end_hour: number;
  vehicle_size: "bike" | "car" | "suv";
  hourly_rate: number;
  amenities: string; // comma-separated
  host_user_id: string;
  host_name: string;
  is_available: number; // 0 | 1
}

export interface Booking {
  id: number;
  spot_id: number;
  driver_user_id: string;
  driver_name: string;
  vehicle_number: string;
  start_hour: number;
  end_hour: number;
  total_cost: number;
  booking_code: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Singleton DB connection
// ---------------------------------------------------------------------------

const dbPath = process.env.VERCEL
  ? "/tmp/parkingbob.db"
  : path.resolve(process.cwd(), "parkingbob.db");

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS spots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    area         TEXT    NOT NULL,
    address      TEXT    NOT NULL,
    start_hour   INTEGER NOT NULL,
    end_hour     INTEGER NOT NULL,
    vehicle_size TEXT    NOT NULL,
    hourly_rate  INTEGER NOT NULL,
    amenities    TEXT    NOT NULL DEFAULT '',
    host_user_id TEXT    NOT NULL,
    host_name    TEXT    NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id          INTEGER NOT NULL REFERENCES spots(id),
    driver_user_id   TEXT    NOT NULL,
    driver_name      TEXT    NOT NULL,
    vehicle_number   TEXT    NOT NULL,
    start_hour       INTEGER NOT NULL,
    end_hour         INTEGER NOT NULL,
    total_cost       INTEGER NOT NULL,
    booking_code     TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------------------------------------------------------------------------
// Seed data — 8 realistic Bengaluru parking spots
// ---------------------------------------------------------------------------

const count = (
  db.prepare("SELECT COUNT(*) as n FROM spots").get() as { n: number }
).n;

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO spots (title, area, address, start_hour, end_hour, vehicle_size, hourly_rate, amenities, host_user_id, host_name)
    VALUES (@title, @area, @address, @start_hour, @end_hour, @vehicle_size, @hourly_rate, @amenities, @host_user_id, @host_name)
  `);

  const seed = db.transaction(() => {
    insert.run({
      title: "Shaded Driveway near Forum Mall",
      area: "Koramangala",
      address: "7th Block, Koramangala, Bengaluru 560095",
      start_hour: 8,
      end_hour: 22,
      vehicle_size: "car",
      hourly_rate: 50,
      amenities: "CCTV,Covered,Security Guard",
      host_user_id: "seed_host_1",
      host_name: "Priya Sharma",
    });
    insert.run({
      title: "Open Lot near 100 Feet Road",
      area: "Indiranagar",
      address: "100 Feet Road, Indiranagar, Bengaluru 560038",
      start_hour: 7,
      end_hour: 23,
      vehicle_size: "bike",
      hourly_rate: 20,
      amenities: "CCTV,24x7 Access",
      host_user_id: "seed_host_2",
      host_name: "Rahul Nair",
    });
    insert.run({
      title: "Basement Parking near MG Road Metro",
      area: "MG Road",
      address: "MG Road, Near Trinity Metro Station, Bengaluru 560001",
      start_hour: 6,
      end_hour: 22,
      vehicle_size: "car",
      hourly_rate: 60,
      amenities: "CCTV,Covered,EV Charging,Valet",
      host_user_id: "seed_host_3",
      host_name: "Ananya Krishnan",
    });
    insert.run({
      title: "SUV-friendly Garage in Whitefield",
      area: "Whitefield",
      address: "ITPL Main Road, Whitefield, Bengaluru 560066",
      start_hour: 7,
      end_hour: 21,
      vehicle_size: "suv",
      hourly_rate: 70,
      amenities: "CCTV,Covered,Security Guard,EV Charging",
      host_user_id: "seed_host_4",
      host_name: "Vikram Reddy",
    });
    insert.run({
      title: "Home Driveway near Jayanagar Park",
      area: "Jayanagar",
      address: "4th Block, Jayanagar, Bengaluru 560041",
      start_hour: 9,
      end_hour: 20,
      vehicle_size: "car",
      hourly_rate: 40,
      amenities: "CCTV,Quiet Street",
      host_user_id: "seed_host_5",
      host_name: "Meena Subramaniam",
    });
    insert.run({
      title: "Corner Spot near BDA Complex",
      area: "HSR Layout",
      address: "Sector 7, HSR Layout, Bengaluru 560102",
      start_hour: 8,
      end_hour: 22,
      vehicle_size: "car",
      hourly_rate: 45,
      amenities: "CCTV,24x7 Access",
      host_user_id: "seed_host_6",
      host_name: "Suresh Gowda",
    });
    insert.run({
      title: "Bike Parking near Mantri Mall",
      area: "Malleshwaram",
      address: "Sampige Road, Malleshwaram, Bengaluru 560003",
      start_hour: 7,
      end_hour: 21,
      vehicle_size: "bike",
      hourly_rate: 15,
      amenities: "Covered,CCTV",
      host_user_id: "seed_host_7",
      host_name: "Kavitha Murthy",
    });
    insert.run({
      title: "IT Park Entry Parking",
      area: "Electronic City",
      address: "Phase 1, Electronic City, Bengaluru 560100",
      start_hour: 6,
      end_hour: 23,
      vehicle_size: "car",
      hourly_rate: 35,
      amenities: "CCTV,Security Guard,EV Charging",
      host_user_id: "seed_host_8",
      host_name: "Deepak Hegde",
    });
  });

  seed();
}

export default db;
