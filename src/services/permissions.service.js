// src/services/permissions.service.js

import { api } from './api';

export async function getDashboardContext(organizationId) {
  const { data } = await api.get('/api/v1/auth/me/dashboard', {
    params: { organizationId },
  });
  return {
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    hasAllBranches: !!data.membership?.hasAllBranches,
  };
}

export default { getDashboardContext };