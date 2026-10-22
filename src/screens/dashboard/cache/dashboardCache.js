// src/screens/dashboard/cache/dashboardCache.js
//
// SQLite-backed cache for the dashboard payload.
//
// Design:
//   - One row per (orgId, branchId). branchId = '' when scope is "All".
//   - Value is the raw JSON string the backend returned.
//   - We do NOT expire rows. The screen always re-fetches; the cached row
//     exists only so the first frame after mount can render instantly
//     (stale-first). If a fetch fails, the stale row keeps the screen
//     usable — matching the "display stale data offline" rule already
//     adopted by AuthContext.
//
// Safe to import when SQLite is unavailable: every function catches and
// returns a null/void fallback, so callers never need to guard.

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kxtill.dashboard.v1.db';

let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS dashboard_cache (
        org_id    TEXT NOT NULL,
        branch_id TEXT NOT NULL DEFAULT '',
        payload   TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, branch_id)
      );
    `);
    return db;
  })().catch((e) => {
    if (__DEV__) {
      console.warn('[dashboardCache] init failed', e?.message);
    }
    return null;
  });
  return dbPromise;
}

function branchKey(branchId) {
  return branchId ? String(branchId) : '';
}

/**
 * Read the cached payload for a given org/branch.
 * @returns {Promise<{ payload: any, updatedAt: number } | null>}
 */
export async function readDashboardCache(orgId, branchId) {
  if (!orgId) return null;
  const db = await getDb();
  if (!db) return null;
  try {
    const row = await db.getFirstAsync(
      'SELECT payload, updated_at FROM dashboard_cache WHERE org_id = ? AND branch_id = ?',
      [String(orgId), branchKey(branchId)]
    );
    if (!row) return null;
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch (e) {
    if (__DEV__) console.warn('[dashboardCache] read failed', e?.message);
    return null;
  }
}

/**
 * Upsert the payload for a given org/branch.
 * No-op on failure — cache is best-effort.
 */
export async function writeDashboardCache(orgId, branchId, payload) {
  if (!orgId || payload == null) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      `INSERT INTO dashboard_cache (org_id, branch_id, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, branch_id)
       DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [String(orgId), branchKey(branchId), JSON.stringify(payload), Date.now()]
    );
  } catch (e) {
    if (__DEV__) console.warn('[dashboardCache] write failed', e?.message);
  }
}

/** Clear one org/branch. */
export async function clearDashboardCache(orgId, branchId) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      'DELETE FROM dashboard_cache WHERE org_id = ? AND branch_id = ?',
      [String(orgId), branchKey(branchId)]
    );
  } catch {
    /* ignore */
  }
}

/** Clear every row (used on sign-out if you want a hard reset). */
export async function clearAllDashboardCache() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM dashboard_cache');
  } catch {
    /* ignore */
  }
}