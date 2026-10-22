// src/services/branches.service.js
import { api } from './api';

export async function getBranchDetail(organizationId, branchId, period = 'today') {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}`,
    { params: { period } }
  );
  return data?.data || null;
}

export async function getBranchSales(organizationId, branchId, period = 'today') {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/sales`,
    { params: { period } }
  );
  return data?.data || null;
}

export async function getBranchStock(organizationId, branchId, status) {
  const params = {};
  if (status) params.status = status;
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/stock`,
    { params }
  );
  return data?.data || null;
}

export async function getBranchShifts(organizationId, branchId, status) {
  const params = {};
  if (status) params.status = status;
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/shifts`,
    { params }
  );
  return data?.data || null;
}

export async function reviewShiftVariance(organizationId, branchId, shiftId, note) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/shifts/${shiftId}/review`,
    { note: note || null }
  );
  return data?.data || null;
}

export async function forceCloseShift(organizationId, branchId, shiftId, declaredCash, reason) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/branches/${branchId}/shifts/${shiftId}/force-close`,
    { declaredCash: Number(declaredCash), reason: reason || null }
  );
  return data?.data || null;
}

export default {
  getBranchDetail,
  getBranchSales,
  getBranchStock,
  getBranchShifts,
  reviewShiftVariance,
  forceCloseShift,
};