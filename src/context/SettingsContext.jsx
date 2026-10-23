// src/context/SettingsContext.jsx
//
// Settings source of truth for the mobile app.
//
//   - Fetch the org's KxTill settings (via kxtillSettingsService).
//   - Cache per-org (AsyncStorage, TTL 5 min).
//   - Expose: settings, loading, saving, error, refreshSettings,
//     updateSettings, getters, formatters, isFeatureEnabled.
//   - No hardcoded country/currency/timezone/locale anywhere.
//
// updateSettings: optimistic + rollback + cache write.
// Formatters: ISO code prefix (EUR 1,234.56), never a symbol guess.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import kxtillSettingsService from '../services/kxtillSettings.service';
import { useOrganizationContext } from './OrganizationContext';

const CACHE_PREFIX = 'kxtill.settings.v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

const cacheKey = (orgId) => `${CACHE_PREFIX}:${orgId}`;

async function readCache(orgId) {
  if (!orgId) return null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function writeCache(orgId, data) {
  if (!orgId || !data) return;
  try {
    await AsyncStorage.setItem(
      cacheKey(orgId),
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    /* best-effort */
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { activeOrganization } = useOrganizationContext();
  const orgId = activeOrganization?.id ?? null;

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const settingsRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /* ── fetch ──────────────────────────────────────────────────── */

  const fetchSettings = useCallback(
    async ({ force = false } = {}) => {
      if (!orgId) {
        setSettings(null);
        setLoading(false);
        setError(null);
        return null;
      }

      const myToken = ++tokenRef.current;

      if (!force && settingsRef.current == null) {
        const cached = await readCache(orgId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setSettings(cached);
          setLoading(false);
        }
      }

      setLoading(true);
      setError(null);

      try {
        const data = await kxtillSettingsService.getSettings(orgId);
        if (!mountedRef.current || myToken !== tokenRef.current) return null;
        const next = data ?? null;
        setSettings(next);
        if (next) await writeCache(orgId, next);
        return next;
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return null;
        const message =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          'Failed to load settings';
        setError(message);
        return settingsRef.current;
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
        }
      }
    },
    [orgId]
  );

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const refreshSettings = useCallback(
    () => fetchSettings({ force: true }),
    [fetchSettings]
  );

  /* ── update ─────────────────────────────────────────────────── */

  const updateSettings = useCallback(
    async (partial) => {
      if (!orgId) throw new Error('No active organization');
      if (!partial || typeof partial !== 'object') {
        throw new Error('updateSettings requires an object');
      }

      const previous = settingsRef.current;
      const optimistic = { ...(previous || {}), ...partial };
      setSettings(optimistic);
      setSaving(true);
      setError(null);

      try {
        const response = await kxtillSettingsService.updateSettings(
          orgId,
          partial
        );
        const merged = { ...optimistic, ...(response || {}) };
        if (!mountedRef.current) return merged;
        setSettings(merged);
        await writeCache(orgId, merged);
        return merged;
      } catch (e) {
        if (mountedRef.current) {
          setSettings(previous);
          const message =
            e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.message ||
            'Failed to save settings';
          setError(message);
        }
        throw e;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [orgId]
  );

  /* ── getters ────────────────────────────────────────────────── */

  const getCurrency = useCallback(
    () => settings?.currency || activeOrganization?.currency || null,
    [settings?.currency, activeOrganization?.currency]
  );

  const getDecimalPlaces = useCallback(() => {
    const n = settings?.decimalPlaces;
    return Number.isFinite(Number(n)) ? Number(n) : null;
  }, [settings?.decimalPlaces]);

  const getShopName = useCallback(
    () => settings?.shopName || activeOrganization?.name || null,
    [settings?.shopName, activeOrganization?.name]
  );

  const getTaxNumber = useCallback(
    () => settings?.taxNumber || null,
    [settings?.taxNumber]
  );

  const getReceiptHeader = useCallback(
    () => settings?.receiptHeader || null,
    [settings?.receiptHeader]
  );

  const getReceiptFooter = useCallback(
    () => settings?.receiptFooter || null,
    [settings?.receiptFooter]
  );

  const getDefaultPaymentMethod = useCallback(
    () => settings?.defaultPaymentMethod || null,
    [settings?.defaultPaymentMethod]
  );

  /* ── number formatting ──────────────────────────────────────── */

  const formatCurrency = useCallback(
    (amount) => {
      const n = Number(amount || 0);
      const currency = getCurrency();
      const decimals = getDecimalPlaces();

      if (!currency) {
        try {
          return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: decimals ?? 0,
            maximumFractionDigits: decimals ?? 0,
          }).format(n);
        } catch {
          return String(n);
        }
      }

      let body;
      try {
        const opts = {};
        if (decimals != null) {
          opts.minimumFractionDigits = decimals;
          opts.maximumFractionDigits = decimals;
        }
        body = new Intl.NumberFormat(undefined, opts).format(n);
      } catch {
        const fixed = decimals != null ? n.toFixed(decimals) : String(n);
        const [intPart, decPart = ''] = fixed.split('.');
        const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        body =
          decimals != null && decimals > 0
            ? `${withCommas}.${decPart.padEnd(decimals, '0')}`
            : withCommas;
      }

      return `${currency} ${body}`;
    },
    [getCurrency, getDecimalPlaces]
  );

  const formatCompactCurrency = useCallback(
    (amount) => {
      const n = Number(amount || 0);
      const currency = getCurrency();
      const compact =
        Math.abs(n) >= 1_000_000
          ? `${(n / 1_000_000).toFixed(1)}M`
          : Math.abs(n) >= 1_000
            ? `${(n / 1_000).toFixed(1)}K`
            : String(n);
      return currency ? `${currency} ${compact}` : compact;
    },
    [getCurrency]
  );

  /* ── date formatting ────────────────────────────────────────── */

  const formatDate = useCallback((date, options = {}) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return 'N/A';

    const pattern = options.format || 'DD/MM/YYYY';
    const replacements = {
      DD: String(d.getDate()).padStart(2, '0'),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      YYYY: String(d.getFullYear()),
      YY: String(d.getFullYear()).slice(-2),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
    };

    let result = pattern;
    for (const [k, v] of Object.entries(replacements)) {
      result = result.replace(new RegExp(k, 'g'), v);
    }
    return result;
  }, []);

  const formatTime = useCallback((date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  }, []);

  const formatDateTime = useCallback(
    (date, options = {}) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return 'N/A';
      return `${formatDate(d, options)} ${formatTime(d)}`;
    },
    [formatDate, formatTime]
  );

  /* ── feature flags ──────────────────────────────────────────── */

  const isFeatureEnabled = useCallback(
    (feature) => {
      if (!settings) return undefined;
      switch (feature) {
        case 'lowStockAlerts':
          return settings.lowStockAlerts;
        case 'dailySalesReport':
          return settings.dailySalesReport;
        case 'weeklySummary':
          return settings.weeklySummary;
        case 'refundNotifications':
          return settings.refundNotifications;
        case 'requirePinForRefund':
          return settings.requirePinForRefund;
        case 'allowBranchSwitch':
          return settings.allowBranchSwitch;
        default:
          return undefined;
      }
    },
    [settings]
  );

  /* ── context value ──────────────────────────────────────────── */

  const value = useMemo(
    () => ({
      settings,
      loading,
      saving,
      error,
      refreshSettings,
      updateSettings,
      getCurrency,
      getDecimalPlaces,
      getShopName,
      getTaxNumber,
      getReceiptHeader,
      getReceiptFooter,
      getDefaultPaymentMethod,
      formatCurrency,
      formatCompactCurrency,
      formatDate,
      formatTime,
      formatDateTime,
      isFeatureEnabled,
    }),
    [
      settings,
      loading,
      saving,
      error,
      refreshSettings,
      updateSettings,
      getCurrency,
      getDecimalPlaces,
      getShopName,
      getTaxNumber,
      getReceiptHeader,
      getReceiptFooter,
      getDefaultPaymentMethod,
      formatCurrency,
      formatCompactCurrency,
      formatDate,
      formatTime,
      formatDateTime,
      isFeatureEnabled,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}

export default SettingsContext;