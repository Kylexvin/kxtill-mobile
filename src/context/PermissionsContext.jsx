// src/context/PermissionsContext.jsx
//
// Port of the web PermissionsContext. Same patternMatches / grantMatches
// logic — kept identical on purpose so mobile and POS agree on what a
// permission means. Cache is per-organization, stored in SecureStore.

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
import { useAuthContext } from './AuthContext';
import permissionsService from '../services/permissions.service';
import { expandPermissions } from '../constants/permissions';
import { useOrganizationContext } from './OrganizationContext';

const PermissionsContext = createContext(null);

function patternMatches(pattern, key) {
  if (!pattern || !key) return false;
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1); // keep the dot
    return key.startsWith(prefix);
  }
  return pattern === key;
}

function grantMatches(permissions, key) {
  if (!key || !Array.isArray(permissions)) return false;
  return permissions.some((p) => patternMatches(p, key));
}

const cacheKey = (orgId) => `kxtill.permissions.${orgId}`;
const INDEX_KEY = 'kxtill.permissions._index';

async function readCache(orgId) {
  if (!orgId) return null;
  try {
    const raw = await SecureStore.getItemAsync(cacheKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.permissions) ? parsed : null;
  } catch {
    return null;
  }
}

async function readIndex() {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(orgIds) {
  try {
    await SecureStore.setItemAsync(
      INDEX_KEY,
      JSON.stringify(Array.from(new Set(orgIds)))
    );
  } catch {
    /* ignore */
  }
}

async function writeCache(orgId, data) {
  if (!orgId) return;
  try {
    await SecureStore.setItemAsync(cacheKey(orgId), JSON.stringify(data));
    // Maintain an index of org ids we have cached. SecureStore does not
    // expose a portable "list all keys" API across SDKs, so we track them
    // explicitly for sign-out purges.
    const ids = await readIndex();
    if (!ids.includes(orgId)) {
      ids.push(orgId);
      await writeIndex(ids);
    }
  } catch {
    /* ignore */
  }
}

async function clearAllPermissionCaches() {
  try {
    const ids = await readIndex();
    await Promise.all(
      ids.map((id) => SecureStore.deleteItemAsync(cacheKey(id)).catch(() => {}))
    );
    await SecureStore.deleteItemAsync(INDEX_KEY).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function PermissionsProvider({ children }) {
  const { accessToken, user } = useAuthContext();
  const { activeOrganization } = useOrganizationContext();
  const orgId = activeOrganization?.id || null;

  const [permissions, setPermissions] = useState([]);
  const [hasAllBranches, setHasAllBranches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const purgeRef = useRef(false);

  const fetchPermissions = useCallback(async () => {
    if (!orgId || !accessToken) {
      setPermissions([]);
      setHasAllBranches(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await permissionsService.getDashboardContext(orgId);
      const next = expandPermissions(data.permissions);
      setPermissions(next);
      setHasAllBranches(data.hasAllBranches);
      await writeCache(orgId, {
        permissions: next,
        hasAllBranches: data.hasAllBranches,
        fetchedAt: Date.now(),
      });
    } catch (e) {
      const cached = await readCache(orgId);
      if (cached) {
        setPermissions(cached.permissions || []);
        setHasAllBranches(cached.hasAllBranches || false);
      } else {
        setPermissions([]);
        setHasAllBranches(false);
      }
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          'Failed to load permissions'
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, accessToken]);

  // Sign-out purge: the first time we observe `!user`, wipe every
  // per-org cache. Guarded by `purgeRef` so it runs once per session,
  // not on every render where user is null.
  useEffect(() => {
    if (user) {
      purgeRef.current = false;
      return;
    }
    if (purgeRef.current) return;
    purgeRef.current = true;
    clearAllPermissionCaches();
  }, [user]);

  useEffect(() => {
    if (!user || !orgId) {
      setPermissions([]);
      setHasAllBranches(false);
      setError(null);
      return;
    }
    (async () => {
      const cached = await readCache(orgId);
      if (cached) {
        setPermissions(cached.permissions || []);
        setHasAllBranches(cached.hasAllBranches || false);
      }
      fetchPermissions();
    })();
  }, [user, orgId, fetchPermissions]);

  const isOwner = useMemo(() => permissions.includes('*'), [permissions]);

  const hasPermission = useCallback(
    (key) => grantMatches(permissions, key),
    [permissions]
  );
  const hasAnyPermission = useCallback(
    (keys) =>
      Array.isArray(keys) && keys.some((k) => grantMatches(permissions, k)),
    [permissions]
  );
  const hasAllPermissions = useCallback(
    (keys) =>
      Array.isArray(keys) && keys.every((k) => grantMatches(permissions, k)),
    [permissions]
  );

  const value = useMemo(
    () => ({
      permissions,
      hasAllBranches,
      isOwner,
      loading,
      error,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      can: hasPermission,
      canAny: hasAnyPermission,
      canAll: hasAllPermissions,
      refresh: fetchPermissions,
      activeOrganization,
    }),
    [
      permissions,
      hasAllBranches,
      isOwner,
      loading,
      error,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      fetchPermissions,
      activeOrganization,
    ]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return ctx;
}

export default PermissionsContext;