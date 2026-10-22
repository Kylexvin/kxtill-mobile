// src/services/kxtillSettings.service.js
//
// Thin wrapper around the existing kxtill settings endpoints.
// The backend returns { settings: {...} } — unwrap to just the object.

import { api } from './api';

export async function getSettings(organizationId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/settings`
  );
  return data?.settings || {};
}

export async function updateSettings(organizationId, patch) {
  const { data } = await api.patch(
    `/api/v1/organizations/${organizationId}/kxtill/settings`,
    patch
  );
  // PATCH may return { settings: {...} } or the raw settings row.
  return data?.settings || data || {};
}

export default { getSettings, updateSettings };