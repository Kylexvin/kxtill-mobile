// src/services/sales.service.js
//
// Mobile sale creation. Calls the mobile-scoped endpoint
// (/mobile/sales), which delegates to the core online path
// (saleService.createSale). Offline route is deliberately not exposed.

import { api } from './api';

export async function createSale(organizationId, payload) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/sales`,
    payload
  );
  return data;
}

// Response shape: { shop, receipt, sale, items[], totals, payments[] }
export async function getReceipt(organizationId, saleId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/sales/${saleId}/receipt`
  );
  return data;
}


export default { createSale, getReceipt };