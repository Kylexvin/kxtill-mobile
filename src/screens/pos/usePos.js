// src/screens/pos/usePos.js
//
// All state + logic for the POS screen. Extracted from PosScreen so the
// screen itself stays orchestration-only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as inventoryService from '../../services/inventory.service';
import * as salesService from '../../services/sales.service';
import * as shiftService from '../../services/shift.service';

/* ── utils ──────────────────────────────────────────────────── */

export const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { key: 'MPESA', label: 'M-Pesa', icon: 'phone-portrait-outline' },
  { key: 'CARD', label: 'Card', icon: 'card-outline' },
  { key: 'BANK', label: 'Bank', icon: 'business-outline' },
  { key: 'CREDIT', label: 'Credit', icon: 'time-outline' },
];

export const needsReference = (method) => method !== 'CASH';

export async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!err?.response) return await fn();
    throw err;
  }
}

// Branch-products item -> product shape used by the POS.
export function normalizeProduct(p) {
  const units = Array.isArray(p.units) ? p.units : [];
  const unit = p.baseUnit || units[0] || null;
  return {
    id: p.productId || p.id,
    branchProductId: p.id,
    name: p.displayName || p.name,
    sku: p.sku || null,
    taxRate: Number(p.taxRate) || 0,
    baseUnit: unit,
    units,
    price: Number(unit?.price ?? p.price ?? 0),
    stock: Number(p.stock) || 0,
    minStock: Number(p.minStock) || 0,
    isAvailable: p.isAvailable !== false,
    category: p.category || null,
  };
}

/* ── usePosGate ─────────────────────────────────────────────── */

export function usePosGate({ orgId, branchId }) {
  const [gate, setGate] = useState({
    status: 'loading',
    shift: null,
    error: null,
  });

  const run = useCallback(async () => {
    if (!orgId || !branchId) {
      setGate({ status: 'error', shift: null, error: 'Missing branch context' });
      return;
    }
    setGate({ status: 'loading', shift: null, error: null });
    try {
      const setting = await shiftService.getBranchShiftSetting(orgId, branchId);
      if (setting?.shiftsEnabled !== true) {
        setGate({ status: 'ready', shift: null, error: null });
        return;
      }
      const current = await shiftService.getCurrentShift(orgId);
      if (current && current.branchId === branchId) {
        setGate({ status: 'ready', shift: current, error: null });
        return;
      }
      if (current && current.branchId !== branchId) {
        setGate({
          status: 'blocked',
          shift: current,
          error: `You have an open shift at ${
            current.branch?.name || 'another branch'
          }. Close it first.`,
        });
        return;
      }
      setGate({ status: 'no-shift', shift: null, error: null });
    } catch (e) {
      setGate({
        status: 'error',
        shift: null,
        error: e?.response?.data?.error || e?.message || 'Could not load POS',
      });
    }
  }, [orgId, branchId]);

  useEffect(() => {
    run();
  }, [run]);

  const openShift = useCallback(async () => {
    if (!orgId || !branchId) return;
    try {
      const shift = await shiftService.openShift(orgId, {
        branchId,
        openingFloat: 0,
      });
      setGate({ status: 'ready', shift, error: null });
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || 'Failed to open shift';
      if (/shifts are not enabled/i.test(msg)) {
        setGate({ status: 'ready', shift: null, error: null });
      } else {
        Alert.alert('Shift', msg);
      }
    }
  }, [orgId, branchId]);

  return { gate, runGate: run, openShift };
}

/* ── usePosProducts ─────────────────────────────────────────── */

export function usePosProducts({ orgId, branchId, enabled }) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const tokenRef = useRef(0);

  const load = useCallback(
    async (q) => {
      if (!orgId || !branchId) return;
      const myToken = ++tokenRef.current;
      setSearching(true);
      setError(null);
      try {
        const res = await inventoryService.getBranchProducts(orgId, branchId, {
          search: q ? q.trim() : undefined,
          limit: 30,
        });
        if (myToken !== tokenRef.current) return;
        setProducts((res?.items || []).map(normalizeProduct));
      } catch (e) {
        if (myToken !== tokenRef.current) return;
        setProducts([]);
        setError(
          e?.response?.data?.error || e?.message || 'Could not load products'
        );
      } finally {
        if (myToken === tokenRef.current) setSearching(false);
      }
    },
    [orgId, branchId]
  );

  useEffect(() => {
    if (enabled) load('');
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const t = setTimeout(() => load(query), 220);
    return () => clearTimeout(t);
  }, [query, enabled, load]);

  const reload = useCallback(() => load(query), [load, query]);

  return {
    query,
    setQuery,
    products,
    searching,
    error,
    reload,
  };
}

/* ── usePosCart ─────────────────────────────────────────────── */

export function usePosCart() {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [held, setHeld] = useState([]);
  const clientSaleIdRef = useRef(uuid());
  const lastKeyRef = useRef(null);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (s, l) => s + l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
        0
      ),
    [cart]
  );
  const totalQty = cart.reduce((s, l) => s + l.quantity, 0);

  const addToCart = useCallback((product, unit) => {
    if (!unit) {
      Alert.alert('No unit', 'This product has no sellable unit.');
      return;
    }
    if (product.stock <= 0) {
      Alert.alert(
        'Out of stock',
        `${product.name} has no stock at this branch.`
      );
      return;
    }
    const key = `${product.id}:${unit.id}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      const currentQty = existing?.quantity ?? 0;
      if (currentQty + 1 > product.stock) {
        Alert.alert(
          'Not enough stock',
          `Only ${product.stock} ${unit.abbreviation || 'unit'} available.`
        );
        return prev;
      }
      lastKeyRef.current = key;
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          branchProductId: product.branchProductId,
          unitId: unit.id,
          unitName: unit.name || unit.abbreviation || '',
          unitAbbrev: unit.abbreviation || 'u',
          unitType: unit.unitType || 'unit',
          conversionQty: Number(unit.conversionQty || 1),
          name: product.name,
          quantity: 1,
          unitPrice: Number(unit.price ?? product.price ?? 0),
          taxRate: product.taxRate || 0,
          stock: product.stock,
        },
      ];
    });
  }, []);

  const changeQty = useCallback((key, delta) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const undoLast = useCallback(() => {
    if (lastKeyRef.current) changeQty(lastKeyRef.current, -1);
  }, [changeQty]);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomer(null);
    lastKeyRef.current = null;
    clientSaleIdRef.current = uuid();
  }, []);

  const holdCurrent = useCallback(() => {
    if (cart.length === 0) return;
    setHeld((h) => [
      ...h,
      { id: clientSaleIdRef.current, cart, customer, at: Date.now() },
    ]);
    setCart([]);
    setCustomer(null);
    lastKeyRef.current = null;
    clientSaleIdRef.current = uuid();
  }, [cart, customer]);

  const recall = useCallback(
    (id) => {
      const target = held.find((h) => h.id === id);
      if (!target) return;
      setHeld((h) => {
        const rest = h.filter((x) => x.id !== id);
        return cart.length
          ? [
              ...rest,
              { id: clientSaleIdRef.current, cart, customer, at: Date.now() },
            ]
          : rest;
      });
      setCart(target.cart);
      setCustomer(target.customer);
      lastKeyRef.current = null;
      clientSaleIdRef.current = target.id;
    },
    [held, cart, customer]
  );

  const discardHeld = useCallback(
    (id) => setHeld((h) => h.filter((x) => x.id !== id)),
    []
  );

  return {
    cart,
    customer,
    setCustomer,
    subtotal,
    totalQty,
    held,
    addToCart,
    changeQty,
    undoLast,
    clearCart,
    holdCurrent,
    recall,
    discardHeld,
    clientSaleIdRef,
  };
}

/* ── usePosSale ─────────────────────────────────────────────── */

export function usePosSale({
  orgId,
  branchId,
  gate,
  cart,
  subtotal,
  customer,
  clientSaleIdRef,
  clearCart,
}) {
  const [submitting, setSubmitting] = useState(false);

  const submitSale = useCallback(
    async ({ method, reference }) => {
      if (!orgId || !branchId) throw new Error('Missing branch context');
      if (method === 'CREDIT' && !customer) {
        throw new Error('Select a customer to sell on credit.');
      }
      setSubmitting(true);
      try {
        const payload = {
          branchId,
          shiftId: gate.shift?.id ?? null,
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? 'Walk-in',
          clientSaleId: clientSaleIdRef.current,
          items: cart.map((l) => ({
            productId: l.productId,
            unitId: l.unitId,
            quantity: l.quantity,
          })),
          payments: [
            {
              method,
              amount: Number(subtotal.toFixed(2)),
              reference: needsReference(method) && reference ? reference : null,
            },
          ],
        };
        const sale = await withRetry(() =>
          salesService.createSale(orgId, payload)
        );
        clearCart();
        return sale;
      } finally {
        setSubmitting(false);
      }
    },
    [orgId, branchId, gate.shift, customer, cart, subtotal, clientSaleIdRef, clearCart]
  );

  return { submitSale, submitting };
}

/* ── usePosReceipt ──────────────────────────────────────────── */

export function usePosReceipt({ orgId }) {
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !saleId || !orgId) return undefined;
    let cancelled = false;
    setLoading(true);
    setReceipt(null);
    salesService
      .getReceipt(orgId, saleId)
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert(
            'Receipt',
            e?.response?.data?.error || e?.message || 'Could not load receipt'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, saleId, orgId]);

  const show = useCallback((id) => {
    setSaleId(id);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setReceipt(null);
    setSaleId(null);
  }, []);

  return { open, receipt, loading, show, close };
}