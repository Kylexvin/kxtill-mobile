import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kxtill.cache.db';
const SCHEMA_VERSION = 1;
let dbPromise = null;

async function applyMigrations(db) {
  const row = await db.getFirstAsync('PRAGMA user_version;');
  const from = row?.user_version ?? 0;
  if (from >= SCHEMA_VERSION) return;

  if (from < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS dashboard_cache (
        org_id TEXT NOT NULL, branch_id TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, branch_id));
      CREATE TABLE IF NOT EXISTS branches_list_cache (
        org_id TEXT NOT NULL, period TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, period));
      CREATE TABLE IF NOT EXISTS branch_home_cache (
        org_id TEXT NOT NULL, branch_id TEXT NOT NULL, period TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, branch_id, period));
      CREATE TABLE IF NOT EXISTS branch_sales_cache (
        org_id TEXT NOT NULL, branch_id TEXT NOT NULL, period TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, branch_id, period));
      CREATE TABLE IF NOT EXISTS settings_cache (
        org_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id));
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

async function openDb() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await applyMigrations(db);
  return db;
}

export function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = openDb().catch((e) => {
    if (__DEV__) console.warn('[db] init failed', e?.message);
    return null;
  });
  return dbPromise;
}

export async function readRow(table, keys) {
  const db = await getDb();
  if (!db) return null;
  const cols = Object.keys(keys);
  const where = cols.map((c) => `${c} = ?`).join(' AND ');
  const values = cols.map((c) => String(keys[c]));
  try {
    return (
      (await db.getFirstAsync(
        `SELECT payload, updated_at FROM ${table} WHERE ${where} LIMIT 1`,
        values
      )) || null
    );
  } catch (e) {
    if (__DEV__) console.warn(`[db] read ${table} failed`, e?.message);
    return null;
  }
}

export async function writeRow(table, row) {
  const db = await getDb();
  if (!db) return;
  const cols = Object.keys(row);
  const ph = cols.map(() => '?').join(', ');
  const up = cols.map((c) => `${c} = excluded.${c}`).join(', ');
  try {
    await db.runAsync(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph})
       ON CONFLICT DO UPDATE SET ${up}`,
      cols.map((c) => row[c])
    );
  } catch (e) {
    if (__DEV__) console.warn(`[db] write ${table} failed`, e?.message);
  }
}

export async function wipeAllCaches() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execAsync(`
      DELETE FROM dashboard_cache;
      DELETE FROM branches_list_cache;
      DELETE FROM branch_home_cache;
      DELETE FROM branch_sales_cache;
      DELETE FROM settings_cache;
    `);
  } catch (e) {
    if (__DEV__) console.warn('[db] wipeAllCaches failed', e?.message);
  }
}