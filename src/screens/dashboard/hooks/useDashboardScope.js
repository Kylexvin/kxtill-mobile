// src/screens/dashboard/hooks/useDashboardScope.js
//
// Shared view-scope hook. Reads/writes viewBranchId from OrganizationContext
// so every screen that calls this hook sees the same scope value.
//
// Ownership comes from the caller (usePermissions().isOwner), not from
// inspecting activeOrganization.permissions — the org object from
// listOrganizations() does not reliably carry the permission set.

import { useCallback, useMemo } from 'react';
import { useOrganizationContext } from '../../../context/OrganizationContext';

export function useDashboardScope({ isOwner }) {
  const {
    activeBranch,
    branches: orgBranches,
    setActiveBranch,
    viewBranchId,
    setViewBranchId,
  } = useOrganizationContext();

  const canSeeOrgWide = !!isOwner;

  const scopeOptions = useMemo(() => {
    const opts = [{ id: null, name: 'All branches' }];
    for (const b of orgBranches || []) opts.push({ id: b.id, name: b.name });
    return opts;
  }, [orgBranches]);

  const scopeLabel = useMemo(() => {
    if (!viewBranchId) return 'All branches';
    const match = (orgBranches || []).find((b) => b.id === viewBranchId);
    return match?.name || activeBranch?.name || 'Branch';
  }, [viewBranchId, orgBranches, activeBranch]);

  const pickScope = useCallback(
    (id) => {
      setViewBranchId(id ?? null);
      if (id) {
        const b = (orgBranches || []).find((x) => x.id === id);
        if (b) setActiveBranch(b);
      } else {
        setActiveBranch(null);
      }
    },
    [orgBranches, setActiveBranch, setViewBranchId]
  );

  return {
    viewBranchId,
    scopeLabel,
    scopeOptions,
    canSeeOrgWide,
    pickScope,
  };
}