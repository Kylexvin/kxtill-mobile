// src/offline/catalogue.js
import { getDb } from './db';
import * as inventoryService from '../services/inventory.service';

const PAGE = 200;
const inflight = new Map();

const rowToProduct = (r) => ({ ...JSON.parse(r.json), stock: r.stock });

export async function hasCatalogue(branchId) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', [
    `catalogue:${branchId}`,
  ]);
  return !!row;
}

// Single-flight per branch. `normalize` is normalizeProduct from usePos.
export function syncCatalogue(orgId, branchId, normalize) {
  const key = `${orgId}:${branchId}`;
  if (inflight.has(key)) return inflight.get(key);
  const p = doSync(orgId, branchId, normalize).finally(() =>
    inflight.delete(key)
  );
  inflight.set(key, p);
  return p;
}

async function doSync(orgId, branchId, normalize) {
  const all = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const res = await inventoryService.getBranchProducts(orgId, branchId, {
      limit: PAGE,
      offset,
    });
    const items = res?.items || [];
    if (items.length === 0) break;
    total = Number(res?.total ?? items.length);
    all.push(...items.map(normalize));
    offset += items.length;
  }

  // Server-side top sellers (all devices). Failure must never break the sync.
  let topIds = [];
  try {
    const top = await inventoryService.getTopProducts(orgId, branchId, {
      limit: 30,
      days: 30,
    });
    const list = Array.isArray(top) ? top : top?.items || [];
    topIds = list.map((t) => t.productId || t.id).filter(Boolean);
  } catch {}

  const db = await getDb();

  // Sales still queued haven't reduced server stock yet — keep them reserved.
  const pending = await db.getAllAsync(
    "SELECT lines FROM outbox WHERE status = 'PENDING' AND branch_id = ?",
    [branchId]
  );
  const reserved = {};
  for (const r of pending) {
    for (const l of JSON.parse(r.lines || '[]')) {
      reserved[l.productId] = (reserved[l.productId] || 0) + l.baseQty;
    }
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM products WHERE branch_id = ?', [branchId]);
    await db.runAsync('DELETE FROM barcodes WHERE branch_id = ?', [branchId]);

    await db.runAsync('DELETE FROM top_products WHERE branch_id = ?', [branchId]);
    for (let i = 0; i < topIds.length; i++) {
      await db.runAsync(
        'INSERT OR REPLACE INTO top_products (branch_id, product_id, rank) VALUES (?,?,?)',
        [branchId, topIds[i], i + 1]
      );
    }

    for (const p of all) {
      const stock = Math.max(0, p.stock - (reserved[p.id] || 0));
      await db.runAsync(
        `INSERT OR REPLACE INTO products
           (branch_id, product_id, json, name_lc, sku_lc, stock)
         VALUES (?,?,?,?,?,?)`,
        [
          branchId,
          p.id,
          JSON.stringify(p),
          (p.name || '').toLowerCase(),
          (p.sku || '').toLowerCase(),
          stock,
        ]
      );
      for (const u of p.units || []) {
        if (u.barcode) {
          await db.runAsync(
            `INSERT OR REPLACE INTO barcodes
               (branch_id, barcode, product_id, unit_id)
             VALUES (?,?,?,?)`,
            [branchId, String(u.barcode), p.id, u.id]
          );
        }
      }
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      [`catalogue:${branchId}`, String(Date.now())]
    );
  });

  return all.length;
}

// Name / SKU / barcode search. Empty query = full list.
// Order: in stock first, then server top sellers (rank), then this
// device's best sellers (last 30 days), then A-Z.
export async function searchLocal(branchId, q, limit = 60) {
  const db = await getDb();
  const since = Date.now() - 30 * 86400000;
  const term = (q || '').trim().toLowerCase();
  const params = [branchId, since, branchId];
  let where = '';
  if (term) {
    const like = `%${term}%`;
    where = ` AND (p.name_lc LIKE ? OR p.sku_lc LIKE ?
      OR p.product_id IN (
        SELECT product_id FROM barcodes WHERE branch_id = ? AND barcode LIKE ?))`;
    params.push(like, like, branchId, like);
  }
  params.push(limit);

  const rows = await db.getAllAsync(
    `SELECT p.json, p.stock
       FROM products p
       LEFT JOIN top_products t
         ON t.branch_id = p.branch_id AND t.product_id = p.product_id
       LEFT JOIN (
         SELECT product_id, SUM(qty) AS n
           FROM sales_log
          WHERE branch_id = ? AND at > ?
          GROUP BY product_id
       ) s ON s.product_id = p.product_id
      WHERE p.branch_id = ?${where}
      ORDER BY (p.stock > 0) DESC,
               COALESCE(t.rank, 9999) ASC,
               COALESCE(s.n, 0) DESC,
               p.name_lc ASC
      LIMIT ?`,
    params
  );
  return rows.map(rowToProduct);
}

// Local first (instant, works offline), server as fallback.
// Returns { product (normalized), unit } or null.
export async function lookupBarcode(orgId, branchId, code, normalize) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT p.json, p.stock, b.unit_id
       FROM barcodes b
       JOIN products p
         ON p.branch_id = b.branch_id AND p.product_id = b.product_id
      WHERE b.branch_id = ? AND b.barcode = ?`,
    [branchId, String(code)]
  );
  if (row) {
    const product = rowToProduct(row);
    const unit =
      product.units.find((u) => u.id === row.unit_id) || product.baseUnit;
    return { product, unit };
  }
  const raw = await inventoryService.getProductByBarcode(orgId, branchId, code);
  if (!raw) return null;
  const product = normalize(raw);
  const unit =
    product.units.find((u) => String(u.barcode) === String(code)) ||
    product.baseUnit;
  return { product, unit };
}

// Called inside the outbox transaction.
export async function applyLocalSale(db, branchId, lines) {
  const at = Date.now();
  for (const l of lines) {
    await db.runAsync(
      `UPDATE products SET stock = MAX(0, stock - ?)
        WHERE branch_id = ? AND product_id = ?`,
      [l.baseQty, branchId, l.productId]
    );
    await db.runAsync(
      'INSERT INTO sales_log (branch_id, product_id, qty, at) VALUES (?,?,?,?)',
      [branchId, l.productId, l.qty, at]
    );
  }
}