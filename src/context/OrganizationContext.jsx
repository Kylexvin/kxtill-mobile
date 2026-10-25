// src/context/OrganizationContext.jsx
//
// Owns: organizations, activeOrganization, branches, activeBranch,
// and viewBranchId (the display scope used by dashboard + branches tabs).
//
// Auto-select rules:
//   - Pairing hint (from POS) takes priority on first hydrate after pairing.
//   - Persisted org from SecureStore is next.
//   - Single-org fallback last.
//   - Explicit clear (setActiveOrganization(null)) disables re-fire.
//   - Branch auto-select runs once per org hydrate.
//
// Persistence: { organizationId, branchId, viewBranchId } as one blob.
//
// Hydration gate:
//   - `ready` stays false until the org list has been fetched at least once
//     AND any pending auto-selects have completed.

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
import orgsService from '../services/organizations.service';

const STORAGE_KEY = 'kxtill.org.context.v1';
const OrganizationContext = createContext(null);

function readStored() {
  return SecureStore.getItemAsync(STORAGE_KEY)
    .then((raw) => (raw ? JSON.parse(raw) : null))
    .catch(() => null);
}

async function writeStored(patch) {
  try {
    const current = (await readStored()) || {};
    const next = { ...current, ...patch };
    Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function OrganizationProvider({ children }) {
  const {
    status,
    organizations: loginOrgs,
    consumePairingContext,
  } = useAuthContext();

  const [organizations, setOrganizations] = useState([]);
  const [activeOrganization, setActiveOrganizationState] = useState(null);
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranchState] = useState(null);
  const [viewBranchId, setViewBranchIdState] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const orgAutoSelectDone = useRef(false);
  const branchAutoSelectDone = useRef(false);
  const loadedOrgsOnce = useRef(false);
  // One-shot branch hint from the POS pairing flow.
  const pendingBranchIdRef = useRef(null);

  // ── Load organizations ─────────────────────────────────────
  useEffect(() => {
    if (status !== 'signedIn') {
      setOrganizations([]);
      setActiveOrganizationState(null);
      setBranches([]);
      setActiveBranchState(null);
      setViewBranchIdState(null);
      setError(null);
      setLoadingOrgs(false);
      setLoadingBranches(false);
      orgAutoSelectDone.current = false;
      branchAutoSelectDone.current = false;
      loadedOrgsOnce.current = false;
      pendingBranchIdRef.current = null;
      SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
      return;
    }

    let cancelled = false;
    setLoadingOrgs(true);
    setError(null);
    (async () => {
      try {
        const list = await orgsService.listOrganizations();
        if (cancelled) return;
        setOrganizations(list.length ? list : loginOrgs || []);
      } catch (e) {
        if (cancelled) return;
        setOrganizations(loginOrgs || []);
        setError(
          e?.response?.data?.message ||
            e?.response?.data?.error ||
            'Failed to load organizations'
        );
      } finally {
        if (!cancelled) {
          loadedOrgsOnce.current = true;
          setLoadingOrgs(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, loginOrgs]);

  // ── Org auto-select (once) ─────────────────────────────────
  useEffect(() => {
    if (status !== 'signedIn') return;
    if (loadingOrgs) return;
    if (!organizations.length) return;
    if (activeOrganization) return;
    if (orgAutoSelectDone.current) return;

    orgAutoSelectDone.current = true;

    (async () => {
      // 1) POS pairing hint — highest priority on first hydrate after pairing.
      const pairingCtx = consumePairingContext?.();
      if (pairingCtx?.organizationId) {
        const found = organizations.find(
          (o) => o.id === pairingCtx.organizationId
        );
        if (found) {
          setActiveOrganizationState(found);
          pendingBranchIdRef.current = pairingCtx.branchId || null;
          // Persist so the next cold start does not need the hint again.
          await writeStored({
            organizationId: found.id,
            branchId: pairingCtx.branchId || undefined,
          });
          return;
        }
      }

      // 2) Persisted org from a prior session
      const stored = await readStored();
      if (stored?.organizationId) {
        const found = organizations.find((o) => o.id === stored.organizationId);
        if (found) {
          setActiveOrganizationState(found);
          return;
        }
      }

      // 3) Single-org fallback
      if (organizations.length === 1) {
        setActiveOrganizationState(organizations[0]);
      }
    })();
  }, [
    status,
    loadingOrgs,
    organizations,
    activeOrganization,
    consumePairingContext,
  ]);

  // ── Branch load whenever the active ORG ID changes ─────────
  const activeOrgId = activeOrganization?.id ?? null;

  useEffect(() => {
    if (status !== 'signedIn') return;
    if (!activeOrgId) {
      setBranches([]);
      setActiveBranchState(null);
      setViewBranchIdState(null);
      branchAutoSelectDone.current = false;
      return;
    }

    let cancelled = false;
    setLoadingBranches(true);
    setError(null);
    branchAutoSelectDone.current = false;

    (async () => {
      try {
        const list = await orgsService.listBranches(activeOrgId);
        if (cancelled) return;
        setBranches(list);

        if (branchAutoSelectDone.current) return;
        branchAutoSelectDone.current = true;

        let restored = null;
        const stored = await readStored();
        if (stored?.organizationId === activeOrgId && stored?.branchId) {
          restored = list.find((b) => b.id === stored.branchId) || null;
        }
        // Pairing hint (one-shot): the branch the POS user was on.
        if (!restored && pendingBranchIdRef.current) {
          restored =
            list.find((b) => b.id === pendingBranchIdRef.current) || null;
          pendingBranchIdRef.current = null;
        }

        if (restored) setActiveBranchState(restored);
        else if (list.length === 1) setActiveBranchState(list[0]);
        else setActiveBranchState(null);

        // View scope: prefer persisted viewBranchId, then restored, then
        // the single-branch fallback.
        const storedView =
          stored?.organizationId === activeOrgId && 'viewBranchId' in stored
            ? stored.viewBranchId
            : undefined;

        if (storedView !== undefined) {
          setViewBranchIdState(storedView);
        } else if (restored) {
          setViewBranchIdState(restored.id);
        } else if (list.length === 1) {
          setViewBranchIdState(list[0].id);
        } else {
          setViewBranchIdState(null);
        }
      } catch (e) {
        if (cancelled) return;
        setBranches([]);
        setActiveBranchState(null);
        setViewBranchIdState(null);
        setError(
          e?.response?.data?.message ||
            e?.response?.data?.error ||
            'Failed to load branches'
        );
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, activeOrgId]);

  // ── Hydration gate ─────────────────────────────────────────
  useEffect(() => {
    if (status !== 'signedIn') {
      setReady(true);
      return;
    }
    if (!loadedOrgsOnce.current) {
      setReady(false);
      return;
    }
    if (loadingOrgs || loadingBranches) {
      setReady(false);
      return;
    }
    if (organizations.length > 0 && !activeOrganization) {
      if (!orgAutoSelectDone.current) {
        setReady(false);
        return;
      }
    }
    if (activeOrganization && branches.length > 0 && !activeBranch) {
      if (!branchAutoSelectDone.current) {
        setReady(false);
        return;
      }
    }
    setReady(true);
  }, [
    status,
    loadingOrgs,
    loadingBranches,
    organizations.length,
    activeOrganization,
    branches.length,
    activeBranch,
  ]);

  // ── Setters ────────────────────────────────────────────────
  const setActiveOrganization = useCallback(
    async (orgOrId) => {
      if (orgOrId === null) {
        orgAutoSelectDone.current = true;
        setActiveOrganizationState(null);
        setActiveBranchState(null);
        setViewBranchIdState(null);
        setBranches([]);
        await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
        return;
      }

      const org =
        typeof orgOrId === 'string'
          ? organizations.find((o) => o.id === orgOrId) || null
          : orgOrId;
      if (!org) return;

      orgAutoSelectDone.current = true;
      setActiveOrganizationState(org);
      setActiveBranchState(null);
      setViewBranchIdState(null);
      setBranches([]);

      const stored = await readStored();
      await writeStored({
        organizationId: org.id,
        branchId:
          stored?.organizationId === org.id ? stored.branchId : undefined,
        viewBranchId:
          stored?.organizationId === org.id ? stored.viewBranchId : undefined,
      });
    },
    [organizations]
  );

  const setActiveBranch = useCallback(async (branch) => {
    branchAutoSelectDone.current = true;
    setActiveBranchState(branch || null);
    if (!branch) {
      const stored = await readStored();
      await writeStored({
        organizationId: stored?.organizationId,
        branchId: undefined,
      });
      return;
    }
    await writeStored({ branchId: branch.id });
  }, []);

  const setViewBranchId = useCallback(async (id) => {
    setViewBranchIdState(id ?? null);
    await writeStored({ viewBranchId: id ?? null });
  }, []);

  const refresh = useCallback(async () => {
    if (status !== 'signedIn') return;
    setError(null);
    try {
      const list = await orgsService.listOrganizations();
      setOrganizations(list.length ? list : loginOrgs || []);
      if (activeOrgId) {
        const blist = await orgsService.listBranches(activeOrgId);
        setBranches(blist);
      }
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          'Failed to refresh context'
      );
    }
  }, [status, loginOrgs, activeOrgId]);

  const value = useMemo(
    () => ({
      organizations,
      activeOrganization,
      setActiveOrganization,
      branches,
      activeBranch,
      setActiveBranch,
      viewBranchId,
      setViewBranchId,
      loadingOrgs,
      loadingBranches,
      ready,
      error,
      refresh,
      hasOrganizations: organizations.length > 0,
    }),
    [
      organizations,
      activeOrganization,
      setActiveOrganization,
      branches,
      activeBranch,
      setActiveBranch,
      viewBranchId,
      setViewBranchId,
      loadingOrgs,
      loadingBranches,
      ready,
      error,
      refresh,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error(
      'useOrganizationContext must be used within OrganizationProvider'
    );
  }
  return ctx;
}

export default OrganizationContext;