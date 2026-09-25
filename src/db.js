import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DB_PATH || './data/callmap.db';
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  agency TEXT, agency_name TEXT, category TEXT, type TEXT, address TEXT,
  lat REAL, lng REAL, received_at INTEGER, first_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_first_seen ON calls(first_seen);
CREATE TABLE IF NOT EXISTS geocache (address TEXT PRIMARY KEY, lat REAL, lng REAL, ts INTEGER);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL, phone TEXT, token TEXT UNIQUE NOT NULL,
  stripe_customer TEXT, stripe_sub TEXT, status TEXT DEFAULT 'pending',
  notify_email INTEGER DEFAULT 1, notify_sms INTEGER DEFAULT 0,
  categories TEXT DEFAULT 'police,fire,medical,traffic', created_at INTEGER
);
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  label TEXT, address TEXT, lat REAL NOT NULL, lng REAL NOT NULL, radius_mi REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS pending (token TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER);
CREATE TABLE IF NOT EXISTS sent (subscriber_id INTEGER, call_id TEXT, ts INTEGER, PRIMARY KEY (subscriber_id, call_id));
`);
