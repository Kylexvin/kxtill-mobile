// src/services/dashboard.service.js
//
// Mobile dashboard data source. Calls the purpose-built mobile endpoint
// and returns the raw envelope data. The screen maps this to its own shape.

import { api } from './api';

export async function getDashboard({ organizationId, branchId } = {}) {
  if (!organizationId) {
    return { empty: true };
  }

  const params = {};
  if (branchId) params.branchId = branchId;

  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/dashboard`,
    { params }
  );

  return data?.data || { empty: true };
}

export default { getDashboard };