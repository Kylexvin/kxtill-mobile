// src/services/inventory.service.js
//
// The mobile api instance (src/services/api.js) has baseURL = host only.
// Every request must include /api/v1 explicitly, matching branches.service.js.
// Web hits these same paths through an axios instance whose baseURL
// already ends in /api/v1 — mobile must be explicit.

import { api } from './api';

export async function listProducts(organizationId, params = {}) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/products`,
    { params }
  );
  return data?.items || [];
}

export async function getInventoryHealth(organizationId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/inventory/health`
  );
  return data || null;
}

export async function getInventorySummary(organizationId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/inventory/summary`
  );
  return data || null;
}

export async function createProduct(organizationId, payload) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/products`,
    payload
  );
  return data?.product || null;
}

export async function updateProduct(organizationId, productId, payload) {
  const { data } = await api.patch(
    `/api/v1/organizations/${organizationId}/kxtill/products/${productId}`,
    payload
  );
  return data?.product || null;
}

export async function archiveProduct(organizationId, productId) {
  const { data } = await api.delete(
    `/api/v1/organizations/${organizationId}/kxtill/products/${productId}`
  );
  return data || null;
}

export default {
  listProducts,
  getInventoryHealth,
  getInventorySummary,
  createProduct,
  updateProduct,
  archiveProduct,
};