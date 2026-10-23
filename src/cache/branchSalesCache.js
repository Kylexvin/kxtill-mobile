// src/cache/branchSalesCache.js
//
// SQLite cache for BranchSalesScreen payloads, keyed by
// (orgId, branchId, period).

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kxtill.branchSales.v1.db';
let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS branch_sales_cache (
        org_id     TEXT NOT NULL,
        branch_id  TEXT NOT NULL,
        period     TEXT NOT NULL,
        payload    TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, branch_id, period)
      );
    `);
    return db;
  })().catch((e) => {
    if (__DEV__) {
      console.warn('[branchSalesCache] init failed', e?.message);
    }
    return null;
  });
  return dbPromise;
}

export async function readBranchSalesCache(orgId, branchId, period = 'today') {
  if (!orgId || !branchId) return null;
  const db = await getDb();
  if (!db) return null;
  try {
    const row = await db.getFirstAsync(
      `SELECT payload, updated_at FROM branch_sales_cache
       WHERE org_id = ? AND branch_id = ? AND period = ?`,
      [String(orgId), String(branchId), String(period)]
    );
    if (!row) return null;
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch (e) {
    if (__DEV__) {
      console.warn('[branchSalesCache] read failed', e?.message);
    }
    return null;
  }
}

export async function writeBranchSalesCache(
  orgId,
  branchId,
  period = 'today',
  payload
) {
  if (!orgId || !branchId || payload == null) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      `INSERT INTO branch_sales_cache (org_id, branch_id, period, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(org_id, branch_id, period)
       DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [
        String(orgId),
        String(branchId),
        String(period),
        JSON.stringify(payload),
        Date.now(),
      ]
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('[branchSalesCache] write failed', e?.message);
    }
  }
}

export async function clearBranchSalesCache(orgId, branchId) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      'DELETE FROM branch_sales_cache WHERE org_id = ? AND branch_id = ?',
      [String(orgId), String(branchId)]
    );
  } catch {
    /* ignore */
  }
}

export async function clearAllBranchSalesCache() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM branch_sales_cache');
  } catch {
    /* ignore */
  }
}