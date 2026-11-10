// src/offline/outbox.js
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getDb } from './db';
import { applyLocalSale } from './catalogue';
import * as salesService from '../services/sales.service';

const MAX_SERVER_ERRORS = 8;
const PRUNE_AFTER_MS = 7 * 86400000;

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
let flushing = false;

export async function enqueueSale({ orgId, branchId, payload, lines }) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT OR IGNORE INTO outbox
         (client_sale_id, org_id, branch_id, payload, lines, status, attempts, created_at)
       VALUES (?,?,?,?,?,'PENDING',0,?)`,
      [
        payload.clientSaleId,
        orgId,
        branchId,
        JSON.stringify(payload),
        JSON.stringify(lines),
        Date.now(),
      ]
    );
    if (r.changes > 0) await applyLocalSale(db, branchId, lines);
  });
  emit();
  flush();
}

export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      "SELECT * FROM outbox WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 50"
    );

    for (const r of rows) {
      try {
        const sale = await salesService.createSale(
          r.org_id,
          JSON.parse(r.payload)
        );
        await db.runAsync(
          `UPDATE outbox SET status='SYNCED', sale_id=?, synced_at=?, last_error=NULL
            WHERE client_sale_id=?`,
          [sale?.id ?? null, Date.now(), r.client_sale_id]
        );
      } catch (e) {
        const status = e?.response?.status;
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          'Failed';

        if (!status) break; // no response: offline, try again later

        if (status === 401) break; // auth, let the interceptor refresh

        const retryable = status === 408 || status === 429 || status >= 500;
        if (retryable) {
          const attempts = r.attempts + 1;
          if (attempts >= MAX_SERVER_ERRORS) {
            await db.runAsync(
              "UPDATE outbox SET status='REVIEW', attempts=?, last_error=? WHERE client_sale_id=?",
              [attempts, msg, r.client_sale_id]
            );
          } else {
            await db.runAsync(
              'UPDATE outbox SET attempts=?, last_error=? WHERE client_sale_id=?',
              [attempts, msg, r.client_sale_id]
            );
          }
          continue;
        }

        // 4xx: the server rejected it for good
        await db.runAsync(
          "UPDATE outbox SET status='REVIEW', attempts=attempts+1, last_error=? WHERE client_sale_id=?",
          [msg, r.client_sale_id]
        );
      }
    }

    await db.runAsync(
      "DELETE FROM outbox WHERE status='SYNCED' AND synced_at < ?",
      [Date.now() - PRUNE_AFTER_MS]
    );
  } catch {
    // db unavailable: ignore, next tick retries
  } finally {
    flushing = false;
    emit();
  }
}

export function startWorker() {
  flush();
  const t = setInterval(flush, 20000);
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') flush();
  });
  return () => {
    clearInterval(t);
    sub.remove();
  };
}

export async function getCounts() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT status, COUNT(*) AS n FROM outbox WHERE status IN ('PENDING','REVIEW') GROUP BY status"
  );
  const out = { pending: 0, review: 0 };
  for (const r of rows) {
    if (r.status === 'PENDING') out.pending = r.n;
    if (r.status === 'REVIEW') out.review = r.n;
  }
  return out;
}

export function useOutboxCounts() {
  const [counts, setCounts] = useState({ pending: 0, review: 0 });
  useEffect(() => {
    let alive = true;
    const update = async () => {
      try {
        const c = await getCounts();
        if (alive) setCounts(c);
      } catch {}
    };
    update();
    listeners.add(update);
    return () => {
      alive = false;
      listeners.delete(update);
    };
  }, []);
  return counts;
}

export async function getSyncedSaleId(clientSaleId) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT sale_id FROM outbox WHERE client_sale_id = ? AND status = 'SYNCED'",
    [clientSaleId]
  );
  return row?.sale_id || null;
}

export async function listReview() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT payload, last_error, created_at FROM outbox WHERE status='REVIEW' ORDER BY created_at DESC LIMIT 10"
  );
  return rows.map((r) => {
    const p = JSON.parse(r.payload);
    return {
      total: p.payments?.[0]?.amount ?? 0,
      error: r.last_error || 'Rejected',
      at: r.created_at,
    };
  });
}