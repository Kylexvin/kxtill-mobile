// src/screens/pos/usePosMpesa.js
import { useCallback, useRef, useState } from 'react';
import { api } from '../../services/api';

const POLL_MS = 2500;
const TIMEOUT_MS = 90000;
const FAILED = new Set(['FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED', 'REJECTED']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `254${d}`;
  if (/^254[17]\d{8}$/.test(d)) return d;
  return null;
}

export function usePosMpesa(orgId) {
  const [state, setState] = useState({ phase: 'idle', receipt: null, error: null });
  const runRef = useRef(0);

  const reset = useCallback(() => {
    runRef.current += 1;
    setState({ phase: 'idle', receipt: null, error: null });
  }, []);

  // Resolves with the M-Pesa receipt number on success, null otherwise.
  const start = useCallback(
    async ({ phone, amount, referenceId }) => {
      const msisdn = normalizePhone(phone);
      if (!msisdn) {
        setState({ phase: 'failed', receipt: null, error: 'Enter a valid Safaricom number' });
        return null;
      }
      const run = ++runRef.current;
      setState({ phase: 'waiting', receipt: null, error: null });
      const base = `/api/v1/organizations/${orgId}/payments/mpesa`;
      try {
        const { data } = await api.post(`${base}/stk-push`, {
          phone: msisdn,
          amount: Math.ceil(amount),
          referenceType: 'pos_cart',
          referenceId,
          productKey: 'kxtill',
        });
        const merchantRef = data?.merchantRef;
        if (!merchantRef) throw new Error('No payment reference returned');

        const deadline = Date.now() + TIMEOUT_MS;
        while (Date.now() < deadline) {
          await sleep(POLL_MS);
          if (run !== runRef.current) return null;
          let tx = null;
          try {
            const res = await api.get(`${base}/transactions/${merchantRef}`);
            tx = res.data?.transaction;
          } catch {}
          if (run !== runRef.current) return null;
          if (tx?.status === 'SUCCESS') {
            setState({ phase: 'success', receipt: tx.mpesaReceiptNumber, error: null });
            return tx.mpesaReceiptNumber;
          }
          if (tx && FAILED.has(tx.status)) {
            setState({
              phase: 'failed',
              receipt: null,
              error: tx.failureReason || 'Payment was not completed',
            });
            return null;
          }
        }
        setState({
          phase: 'failed',
          receipt: null,
          error: 'No response from customer. Try again or enter the code manually.',
        });
        return null;
      } catch (e) {
        if (run === runRef.current) {
          setState({
            phase: 'failed',
            receipt: null,
            error: e?.response?.data?.error || e?.message || 'Could not send prompt',
          });
        }
        return null;
      }
    },
    [orgId]
  );

  return { ...state, start, reset };
}