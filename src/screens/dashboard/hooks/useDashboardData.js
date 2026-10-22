// src/screens/dashboard/hooks/useDashboardData.js
//
// Owns the dashboard payload: cache-first read, network fetch, refresh,
// stale error flag. Exposes a stable `refresh()` and a `reload()`.
//
// v3 — defensive cache:
//   - The cache module is imported lazily inside helpers. If expo-sqlite
//     is missing or throws at import time, the hook still resolves as a
//     function; cache reads return null and writes are no-ops. The screen
//     keeps working (no cache, but a working fetch).
//   - This removes the "undefined is not a function" cascade that appeared
//     when the native module wasn't installed.
//
// Contract:
//   data        — current payload or null
//   loading     — true only when data is null AND a fetch is inflight
//                 (skeletons use this; pull-to-refresh does NOT set it)
//   refreshing  — true during pull-to-refresh
//   error       — string | null  (only set when we have NO data to show)
//   staleError  — string | null  (set when data is present but refresh failed)
//   cachedAt    — ms timestamp of the cache row we showed first, or null
//   refresh()   — pull-to-refresh path
//   reload()    — full reset (used for retry after a hard error)
//
// Race-safety: every fetch gets a monotonic token; late responses from a
// stale scope are discarded.

import { useCallback, useEffect, useRef, useState } from 'react';
import dashboardService from '../../../services/dashboard.service';

// ── Defensive cache layer ────────────────────────────────────────────
// We resolve the cache module once, lazily, and only if it can be loaded.
// Every cache function then has a no-op / null fallback so callers never
// have to guard.

let cacheModule = null;
let cacheModuleTried = false;

function getCacheModule() {
  if (cacheModuleTried) return cacheModule;
  cacheModuleTried = true;
  try {
    // eslint-disable-next-line global-require
    cacheModule = require('../cache/dashboardCache');
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[useDashboardData] cache module unavailable — continuing without cache',
        e?.message
      );
    }
    cacheModule = null;
  }
  return cacheModule;
}

async function cacheRead(orgId, branchId) {
  const mod = getCacheModule();
  if (!mod?.readDashboardCache) return null;
  try {
    return await mod.readDashboardCache(orgId, branchId);
  } catch {
    return null;
  }
}

function cacheWrite(orgId, branchId, payload) {
  const mod = getCacheModule();
  if (!mod?.writeDashboardCache) return;
  try {
    mod.writeDashboardCache(orgId, branchId, payload);
  } catch {
    /* ignore */
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useDashboardData({ organizationId, branchId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [cachedAt, setCachedAt] = useState(null);

  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const lastKeyRef = useRef('');
  const dataRef = useRef(null);

  // Track mounted state.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Mirror data into a ref for reads inside callbacks.
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const key = `${organizationId || ''}::${branchId || ''}`;

  // ── fetch ──────────────────────────────────────────────────────
  const fetchOnce = useCallback(
    async (isRefresh) => {
      if (!organizationId) return;
      const myToken = ++tokenRef.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const payload = await dashboardService.getDashboard({
          organizationId,
          branchId: branchId || undefined,
        });
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setData(payload);
        setStaleError(null);
        cacheWrite(organizationId, branchId, payload);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Could not load dashboard';
        // If we already have data on screen (fresh or cached), keep it.
        if (dataRef.current != null) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [organizationId, branchId]
  );

  // ── hydrate from cache, then fetch ─────────────────────────────
  useEffect(() => {
    if (!organizationId) {
      setData(null);
      setCachedAt(null);
      setError(null);
      setStaleError(null);
      setLoading(false);
      return;
    }
    if (lastKeyRef.current === key) return; // same scope — don't re-hydrate
    lastKeyRef.current = key;

    let cancelled = false;
    setData(null);
    setError(null);
    setStaleError(null);
    setCachedAt(null);
    setLoading(true);

    (async () => {
      const cached = await cacheRead(organizationId, branchId);
      if (cancelled) return;
      if (cached) {
        setData(cached.payload);
        setCachedAt(cached.updatedAt);
        setLoading(false);
      }
      // Always fetch after hydration — freshness wins over cache.
      fetchOnce(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, organizationId, branchId, fetchOnce]);

  // ── public actions ─────────────────────────────────────────────
  const refresh = useCallback(() => fetchOnce(true), [fetchOnce]);

  const reload = useCallback(() => {
    lastKeyRef.current = '';
    setData(null);
    setError(null);
    setStaleError(null);
    setCachedAt(null);
    // Let the hydrate effect re-fire on next tick by resetting the sentinel.
    setTimeout(() => {
      lastKeyRef.current = '';
      fetchOnce(false);
    }, 0);
  }, [fetchOnce]);

  return {
    data,
    loading,
    refreshing,
    error,
    staleError,
    cachedAt,
    refresh,
    reload,
  };
}

export default useDashboardData;