import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthContext } from './AuthContext';
import { useOrganizationContext } from './OrganizationContext';
import { api } from '../services/api';

const SubscriptionContext = createContext(null);

const GRACE_FALLBACK_DAYS = 2;
const DAY_MS = 86400000;
const POLL_MS = 5 * 60 * 1000;
const RETRY_MS = 60 * 1000;
// Local expiry math only kicks in when our data is old (probably offline).
// While fresh, the server's status is trusted as-is.
const STALE_MS = 15 * 60 * 1000;

const cacheKey = (orgId) => `kxtill.subscription.${orgId}`;

function safeTs(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

function deriveState(snapshot) {
  if (!snapshot?.payload) {
    // Unknown: never block the UI. The server is the authority.
    return {
      status: 'UNKNOWN',
      isKnown: false,
      canRead: true,
      canWrite: true,
      remainingDays: null,
      phaseEndsAt: null,
      graceEndsAt: null,
      isOfflineDerived: false,
      raw: null,
    };
  }

  const { payload, offsetMs = 0, fetchedAt = 0 } = snapshot;
  const now = Date.now() + offsetMs; // corrected by the server's clock
  const stale = Date.now() - fetchedAt > STALE_MS;

  const trialEndTs = safeTs(payload.trialEnd);
  const periodEndTs = safeTs(payload.currentPeriodEnd);
  const graceEndTs = safeTs(payload.graceEnd);

  let status = payload.status;
  let isOfflineDerived = false;

  const lapse = (endTs) => {
    const graceEnd =
      graceEndTs && graceEndTs > endTs
        ? graceEndTs
        : endTs + GRACE_FALLBACK_DAYS * DAY_MS;
    return now > graceEnd ? 'EXPIRED' : 'GRACE';
  };

  if (stale) {
    if (status === 'TRIAL' && trialEndTs && now > trialEndTs) {
      status = lapse(trialEndTs);
      isOfflineDerived = true;
    } else if (status === 'ACTIVE' && periodEndTs && now > periodEndTs) {
      status = lapse(periodEndTs);
      isOfflineDerived = true;
    } else if (status === 'GRACE' && graceEndTs && now > graceEndTs) {
      status = 'EXPIRED';
      isOfflineDerived = true;
    }
  }

  // Mirrors the server middleware: reads pass on TRIAL/ACTIVE/GRACE/EXPIRED,
  // writes only on TRIAL/ACTIVE.
  const canRead = ['TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED'].includes(status);
  const canWrite = status === 'TRIAL' || status === 'ACTIVE';

  const daysTo = (ts) =>
    ts ? Math.max(0, Math.ceil((ts - now) / DAY_MS)) : null;

  let remainingDays = null;
  let phaseEndsAt = null;
  if (status === 'TRIAL') {
    remainingDays = daysTo(trialEndTs);
    phaseEndsAt = payload.trialEnd || null;
  } else if (status === 'ACTIVE') {
    remainingDays = daysTo(periodEndTs);
    phaseEndsAt = payload.currentPeriodEnd || null;
  } else if (status === 'GRACE') {
    remainingDays = daysTo(graceEndTs);
    phaseEndsAt = payload.graceEnd || null;
  }

  return {
    status,
    isKnown: true,
    canRead,
    canWrite,
    remainingDays,
    phaseEndsAt,
    graceEndsAt: payload.graceEnd || null,
    isOfflineDerived,
    raw: payload,
  };
}

export function SubscriptionProvider({ children }) {
  const { status: authStatus } = useAuthContext();
  const { activeOrganization } = useOrganizationContext();
  const orgId = activeOrganization?.id || null;

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [lastFetchAt, setLastFetchAt] = useState(null);
  const [tick, setTick] = useState(0);

  const orgRef = useRef(orgId);
  const inFlightRef = useRef(null);

  useEffect(() => {
    orgRef.current = orgId;
  }, [orgId]);

  // ── network refresh (one at a time) ────────────────────────
  const refresh = useCallback(() => {
    if (!orgId || authStatus !== 'signedIn') return Promise.resolve();
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async () => {
      try {
        const { data } = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/billing`,
          { timeout: 8000 }
        );
        if (orgRef.current !== orgId) return;

        const payload = data?.data;
        if (!payload) {
          setFetchError('no subscription data');
          return;
        }
        const serverTs = safeTs(data?.serverNow);
        const now = Date.now();
        const next = {
          payload,
          offsetMs: serverTs ? serverTs - now : 0,
          fetchedAt: now,
        };
        setSnapshot(next);
        setLastFetchAt(new Date(now).toISOString());
        setFetchError(null);
        SecureStore.setItemAsync(cacheKey(orgId), JSON.stringify(next)).catch(
          () => {}
        );
      } catch (e) {
        // Keep whatever we had; never wipe state on a failed refresh.
        if (orgRef.current === orgId) {
          setFetchError(e?.response?.data?.message || e?.message || 'offline');
        }
      } finally {
        if (orgRef.current === orgId) setLoading(false);
      }
    })();

    inFlightRef.current = run;
    run.finally(() => {
      if (inFlightRef.current === run) inFlightRef.current = null;
    });
    return run;
  }, [orgId, authStatus]);

  // ── org change: show cache instantly, then refresh ─────────
  useEffect(() => {
    let cancelled = false;
    inFlightRef.current = null;
    setSnapshot(null);
    setFetchError(null);

    if (authStatus !== 'signedIn' || !orgId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(cacheKey(orgId));
        if (!cancelled && raw) {
          const cached = JSON.parse(raw);
          if (cached?.payload) setSnapshot((prev) => prev || cached);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, orgId, refresh]);

  // ── triggers: foreground, poll (faster retry while failing) ─
  useEffect(() => {
    if (authStatus !== 'signedIn' || !orgId) return undefined;

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });

    // No connectivity listener, so retry sooner after a failure and
    // recover quickly once the phone is back online.
    const t = setInterval(
      () => {
        if (AppState.currentState === 'active') refresh();
      },
      fetchError ? RETRY_MS : POLL_MS
    );

    return () => {
      appSub.remove();
      clearInterval(t);
    };
  }, [authStatus, orgId, refresh, fetchError]);

  // Re-derive every minute so day counts and offline transitions stay right.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const derived = useMemo(() => deriveState(snapshot), [snapshot, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only changes when something visible changes, so a quiet minute
  // tick does not re-render every consumer.
  const value = useMemo(
    () => ({ ...derived, refresh, loading, lastFetchAt, fetchError }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      derived.status,
      derived.canRead,
      derived.canWrite,
      derived.remainingDays,
      derived.phaseEndsAt,
      derived.isOfflineDerived,
      derived.raw,
      refresh,
      loading,
      lastFetchAt,
      fetchError,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}

export default SubscriptionContext;