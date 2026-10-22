// src/services/organizations.service.js

import { api } from './api';

export async function listOrganizations() {
  const { data } = await api.get('/api/v1/organizations');
  return Array.isArray(data.organizations) ? data.organizations : [];
}

export async function listBranches(organizationId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/branches/my`
  );
  return Array.isArray(data.branches) ? data.branches : [];
}

export default { listOrganizations, listBranches };