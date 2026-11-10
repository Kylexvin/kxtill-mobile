// src/services/inventory.service.js
//
// The mobile api instance (src/services/api.js) has baseURL = host only.
// Every request must include /api/v1 explicitly, matching branches.service.js.

import { api } from './api';

export async function listProducts(organizationId, params = {}) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/products`,
    { params }
  );
  return data?.items || [];
}

export async function getProducts(organizationId, params = {}) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/products`,
    { params }
  );
  return {
    items: data?.items || [],
    total: data?.total ?? (data?.items?.length || 0),
    counts: data?.counts || null,
  };
}

// Branch-scoped product list. Each item carries `stock`, `baseUnit`,
// `units[]`, `price`, `isAvailable` — everything POS needs without a
// second call per product.
export async function getBranchProducts(organizationId, branchId, params = {}) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/branches/${branchId}/products`,
    { params }
  );
  return {
    items: data?.items || [],
    total: data?.total ?? (data?.items?.length || 0),
    limit: data?.limit ?? null,
    offset: data?.offset ?? null,
  };
}

export async function generateBarcode(organizationId, productId, unitId) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/products/${productId}/units/${unitId}/barcode`
  );
  return data;
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

export async function getProductByBarcode(organizationId, branchId, barcode) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/products/barcode/${encodeURIComponent(barcode)}`,
    { params: { branchId } }
  );
  return data?.product || null;
}

// Quick-picks: favorites, recent, top for the POS chips row.

export async function getFavoriteProducts(organizationId, branchId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/products/favorites`
  );
  return data?.data?.items || data?.items || [];
}

export async function toggleFavoriteProduct(organizationId, branchId, productId) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/products/favorites`,
    { productId }
  );
  return data?.data || data;
}

export async function getRecentProducts(organizationId, branchId, params = {}) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/products/recent`,
    { params }
  );
  return data?.data?.items || data?.items || [];
}

export async function getTopProducts(organizationId, branchId, params = {}) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/products/top`,
    { params }
  );
  return data?.data?.items || data?.items || [];
}

export default {
  listProducts,
  getProducts,
  getBranchProducts,
  getProductByBarcode,
  getFavoriteProducts,
  toggleFavoriteProduct,
  getRecentProducts,
  getTopProducts,
  generateBarcode,
  getInventoryHealth,
  getInventorySummary,
  createProduct,
  updateProduct,
  archiveProduct,
};