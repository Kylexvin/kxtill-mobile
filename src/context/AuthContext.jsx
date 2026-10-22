// src/context/AuthContext.jsx
//
// Auth session owner. Persists to SecureStore, exposes status, user,
// tokens, and orchestrates the API interceptor lifecycle.
//
// Key invariants:
//   - configureApi runs ONCE for the provider's lifetime. It reads tokens
//     from refs, so it never needs to be re-installed.
//   - refs are the source of truth for the interceptor; state mirrors them.
//   - Sign-out and token-expiry paths clear LOCAL state first, then fire
//     the server revoke fire-and-forget.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { configureApi } from '../services/api';
import authService from '../services/auth.service';
import { config } from '../constants/config';

const STORAGE_KEY = 'kxtill.auth.session';

const AuthContext = createContext(null);

/** Hermes-safe query param extraction. */
function extractQueryParam(url, key) {
  if (typeof url !== 'string') return null;
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return null;
  const query = url.slice(qIndex + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const k = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
    if (k === key) {
      const v = eq === -1 ? '' : pair.slice(eq + 1);
      return decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return null;
}

function friendlyAuthError(e) {
  return (
    (e?.response?.data?.code === 'INVALID_CREDENTIALS' &&
      'Email or password is incorrect') ||
    (e?.response?.data?.code === 'EMAIL_NOT_VERIFIED' &&
      'Email not verified. Check your inbox.') ||
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.message ||
    'Sign in failed'
  );
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | signedIn | signedOut
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [refreshToken, setRefreshTokenState] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Refs are the canonical token holders — the interceptor reads them.
  const accessTokenRef = useRef(null);
  const refreshTokenRef = useRef(null);

  const setTokens = useCallback((access, refresh) => {
    accessTokenRef.current = access ?? null;
    refreshTokenRef.current = refresh ?? null;
    setAccessTokenState(access ?? null);
    setRefreshTokenState(refresh ?? null);
  }, []);

  // ── persistence ────────────────────────────────────────────
  const persist = useCallback(async (session) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* non-fatal */
    }
  }, []);

  const clearPersisted = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // ── session application ────────────────────────────────────
  const applySession = useCallback(
    async (session) => {
      setUser(session.user || null);
      setTokens(session.accessToken, session.refreshToken);
      setOrganizations(session.organizations || []);
      setStatus('signedIn');
      await persist({
        user: session.user || null,
        accessToken: session.accessToken || null,
        refreshToken: session.refreshToken || null,
        organizations: session.organizations || [],
      });
    },
    [persist, setTokens]
  );

  /** Merge-updates only the fields we own — never clobber organizations. */
  const patchPersistedUser = useCallback(
    async (patch) => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : null;
        if (!stored) return;
        await persist({ ...stored, ...patch });
      } catch {
        /* ignore */
      }
    },
    [persist]
  );

  // ── local wipe (does not call the server) ──────────────────
  const clearLocalSession = useCallback(async () => {
    setUser(null);
    setTokens(null, null);
    setOrganizations([]);
    setStatus('signedOut');
    setError(null);
    await clearPersisted();
  }, [clearPersisted, setTokens]);

  // ── public auth actions ────────────────────────────────────
  const signOut = useCallback(async () => {
    const token = refreshTokenRef.current;
    await clearLocalSession();
    if (token) authService.logout(token).catch(() => {});
  }, [clearLocalSession]);

  /** Used by the interceptor on genuine auth failure — no network revoke. */
  const forceSignOut = useCallback(async () => {
    await clearLocalSession();
  }, [clearLocalSession]);

  const signOutAllDevices = useCallback(async () => {
    await clearLocalSession();
    authService.logoutAll().catch(() => {});
  }, [clearLocalSession]);

  const signIn = useCallback(
    async (email, password) => {
      if (isSubmitting) return null; // dedupe double-tap
      setError(null);
      setIsSubmitting(true);
      try {
        const session = await authService.login(email, password);
        if (!session?.accessToken || !session?.refreshToken) {
          throw new Error('Invalid response from server');
        }
        await applySession(session);
        return session;
      } catch (e) {
        setError(friendlyAuthError(e));
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [applySession, isSubmitting]
  );

  const beginOAuth = useCallback(
    async (provider = 'oauth') => {
      if (!config.oauthEnabled) {
        throw new Error('OAuth is not enabled in this build');
      }
      if (isSubmitting) return null;
      setError(null);
      setIsSubmitting(true);
      try {
        const url = authService.buildAuthorizeUrl(provider);
        const result = await WebBrowser.openAuthSessionAsync(
          url,
          config.redirectUri
        );

        if (result.type === 'cancel' || result.type === 'dismiss') return null;
        if (result.type !== 'success' || !result.url) {
          throw new Error('Sign in was interrupted');
        }

        const code = extractQueryParam(result.url, 'code');
        const oauthError = extractQueryParam(result.url, 'error');
        if (oauthError) throw new Error(oauthError);
        if (!code) throw new Error('No authorization code returned');

        const session = await authService.exchangeCode(code);
        if (!session?.accessToken) throw new Error('Token exchange failed');
        await applySession(session);
        return session;
      } catch (e) {
        setError(friendlyAuthError(e));
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [applySession, isSubmitting]
  );

  // ── API interceptor — install ONCE ─────────────────────────
  // We deliberately capture `forceSignOut` via a ref so this effect can
  // have an empty dep array. Re-installing the interceptor mid-session
  // was the source of stale-token bugs.
  const forceSignOutRef = useRef(forceSignOut);
  useEffect(() => {
    forceSignOutRef.current = forceSignOut;
  }, [forceSignOut]);

  useEffect(() => {
    configureApi({
      getToken: () => accessTokenRef.current,
      refresh: async () => {
        const rt = refreshTokenRef.current;
        if (!rt) return null;
        try {
          const { accessToken: newToken, refreshToken: newRt } =
            await authService.refresh(rt);
          if (!newToken) return null;
          setTokens(newToken, newRt ?? rt);
          // Persist silently — do not disturb status.
          patchPersistedUser({
            accessToken: newToken,
            refreshToken: newRt ?? rt,
          });
          return newToken;
        } catch (err) {
          // Offline: keep the session, let the caller decide.
          if (!err?.response) return null;
          // Server rejected the refresh token — hard sign-out.
          await forceSignOutRef.current();
          return null;
        }
      },
      expired: () => {
        // Refresh already exhausted the token. Local-only wipe.
        forceSignOutRef.current();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── session restore ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!raw) {
          if (!cancelled) setStatus('signedOut');
          return;
        }
        const stored = JSON.parse(raw);
        if (!stored?.accessToken || !stored?.refreshToken) {
          if (!cancelled) setStatus('signedOut');
          return;
        }
        if (cancelled) return;

        setUser(stored.user || null);
        setTokens(stored.accessToken, stored.refreshToken);
        setOrganizations(stored.organizations || []);
        setStatus('signedIn');

        // Background refresh of profile — never blocks the UI.
        try {
          const freshUser = await authService.getMe();
          if (cancelled || !freshUser) return;
          setUser(freshUser);
          await patchPersistedUser({ user: freshUser });
        } catch {
          /* interceptor handles refresh-or-signout */
        }
      } catch {
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patchPersistedUser, setTokens]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      status,
      user,
      accessToken,
      refreshToken,
      organizations,
      isSubmitting,
      error,
      signIn,
      beginOAuth,
      signOut,
      signOutAllDevices,
      clearError,
      isAuthenticated: status === 'signedIn',
    }),
    [
      status,
      user,
      accessToken,
      refreshToken,
      organizations,
      isSubmitting,
      error,
      signIn,
      beginOAuth,
      signOut,
      signOutAllDevices,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}

export default AuthContext;