// src/cache/branchesListCache.js
//
// SQLite cache for the branches list, keyed by (orgId, period).

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kxtill.branchHome.v2.db';
let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS branches_list_cache (
        org_id     TEXT NOT NULL,
        period     TEXT NOT NULL,
        payload    TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, period)
      );
    `);
    return db;
  })().catch((e) => {
    if (__DEV__) {
      console.warn('[branchesListCache] init failed', e?.message);
    }
    return null;
  });
  return dbPromise;
}

export async function readBranchesListCache(orgId, period = 'today') {
  if (!orgId) return null;
  const db = await getDb();
  if (!db) return null;
  try {
    const row = await db.getFirstAsync(
      'SELECT payload, updated_at FROM branches_list_cache WHERE org_id = ? AND period = ?',
      [String(orgId), String(period)]
    );
    if (!row) return null;
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch (e) {
    if (__DEV__) {
      console.warn('[branchesListCache] read failed', e?.message);
    }
    return null;
  }
}

export async function writeBranchesListCache(
  orgId,
  period = 'today',
  payload
) {
  if (!orgId || payload == null) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      `INSERT INTO branches_list_cache (org_id, period, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, period)
       DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [String(orgId), String(period), JSON.stringify(payload), Date.now()]
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('[branchesListCache] write failed', e?.message);
    }
  }
}

export async function clearBranchesListCache(orgId, period) {
  const db = await getDb();
  if (!db) return;
  try {
    if (period) {
      await db.runAsync(
        'DELETE FROM branches_list_cache WHERE org_id = ? AND period = ?',
        [String(orgId), String(period)]
      );
    } else {
      await db.runAsync(
        'DELETE FROM branches_list_cache WHERE org_id = ?',
        [String(orgId)]
      );
    }
  } catch {
    /* ignore */
  }
}

export async function clearAllBranchesListCache() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM branches_list_cache');
  } catch {
    /* ignore */
  }
}