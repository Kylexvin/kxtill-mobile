import { useMemo } from 'react';
import { useOrganizationContext } from '../context/OrganizationContext';

// Single source of truth for "what kind of business is this org".
// Mixed orgs resolve to pharmacy until they are blocked at creation.
export default function useVertical() {
  const {
    productInstances,
    instancesReady,
    instancesFailed,
    retryInstances,
  } = useOrganizationContext();

  return useMemo(() => {
    const isPharmacy =
      instancesReady &&
      (productInstances || []).some((i) => i.vertical === 'pharmacy');
    return {
      ready: instancesReady,
      failed: instancesFailed,
      retry: retryInstances,
      isPharmacy,
      isRetail: instancesReady && !isPharmacy,
      vertical: !instancesReady ? null : isPharmacy ? 'pharmacy' : 'retail',
    };
  }, [productInstances, instancesReady, instancesFailed, retryInstances]);
}