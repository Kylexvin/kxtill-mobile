// src/cache/kxtillSettingsCache.js
//
// SQLite cache for the KxTill product settings, keyed by organization id.
// Same pattern as dashboardCache: cache-first read, silent revalidate,
// stale-first on fetch failure.

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kxtill.settings.v1.db';
let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS settings_cache (
        org_id     TEXT PRIMARY KEY,
        payload    TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    return db;
  })().catch((e) => {
    if (__DEV__) {
      console.warn('[kxtillSettingsCache] init failed', e?.message);
    }
    return null;
  });
  return dbPromise;
}

export async function readSettingsCache(orgId) {
  if (!orgId) return null;
  const db = await getDb();
  if (!db) return null;
  try {
    const row = await db.getFirstAsync(
      'SELECT payload, updated_at FROM settings_cache WHERE org_id = ?',
      [String(orgId)]
    );
    if (!row) return null;
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch (e) {
    if (__DEV__) {
      console.warn('[kxtillSettingsCache] read failed', e?.message);
    }
    return null;
  }
}

export async function writeSettingsCache(orgId, payload) {
  if (!orgId || payload == null) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      `INSERT INTO settings_cache (org_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(org_id)
       DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [String(orgId), JSON.stringify(payload), Date.now()]
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('[kxtillSettingsCache] write failed', e?.message);
    }
  }
}

export async function clearSettingsCache(orgId) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      'DELETE FROM settings_cache WHERE org_id = ?',
      [String(orgId)]
    );
  } catch {
    /* ignore */
  }
}

export async function clearAllSettingsCache() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM settings_cache');
  } catch {
    /* ignore */
  }
}