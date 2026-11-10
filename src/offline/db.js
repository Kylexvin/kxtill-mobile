// src/offline/db.js
import * as SQLite from 'expo-sqlite';

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('kxtill_pos.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
          branch_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          json TEXT NOT NULL,
          name_lc TEXT NOT NULL,
          sku_lc TEXT,
          stock REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (branch_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS barcodes (
          branch_id TEXT NOT NULL,
          barcode TEXT NOT NULL,
          product_id TEXT NOT NULL,
          unit_id TEXT NOT NULL,
          PRIMARY KEY (branch_id, barcode)
        );

        CREATE TABLE IF NOT EXISTS sales_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          branch_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          qty REAL NOT NULL,
          at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sales_log_branch_at
          ON sales_log (branch_id, at);

        CREATE TABLE IF NOT EXISTS outbox (
          client_sale_id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          lines TEXT NOT NULL,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          sale_id TEXT,
          created_at INTEGER NOT NULL,
          synced_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status
          ON outbox (status, created_at);
          
          CREATE TABLE IF NOT EXISTS top_products (
          branch_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          rank INTEGER NOT NULL,
          PRIMARY KEY (branch_id, product_id)
        );
      `);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}