// src/services/shift.service.js
//
// Shift lifecycle for the POS client-side gate.
// Route source: kxtill.routes.js (/shifts/*)

import { api } from './api';

// GET /shifts/current -> { shift: {...} | null }
// Scoped to the authenticated user, not by branch. Caller must
// check shift.branchId against the active branch.
export async function getCurrentShift(organizationId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/shifts/current`
  );
  return data?.shift || null;
}

// POST /shifts/open -> 201 { shift: {...} }
// Payload: { branchId, openingFloat (number >= 0), tillId? }
export async function openShift(organizationId, payload) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/shifts/open`,
    payload
  );
  return data?.shift || null;
}

// POST /shifts/:shiftId/close -> 200 { shift: {...} }
// Payload: { declaredCash: number >= 0 }
// Response includes expectedCash + variance computed server-side.
export async function closeShift(organizationId, shiftId, payload) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/shifts/${shiftId}/close`,
    payload
  );
  return data?.shift || null;
}

// GET /branches/:branchId/settings -> { setting: {...} }
// Reads `shiftsEnabled` and `defaultPaymentMethod` (fallback chain
// handled in the screen).
export async function getBranchShiftSetting(organizationId, branchId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/branches/${branchId}/settings`
  );
  return data?.setting || data || null;
}

export default {
  getCurrentShift,
  openShift,
  closeShift,
  getBranchShiftSetting,
};