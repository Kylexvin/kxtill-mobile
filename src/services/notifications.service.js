// src/services/notifications.service.js

import { api } from './api';

export async function list(organizationId, { filter, limit, offset } = {}) {
  const params = {};
  if (filter) params.filter = filter;
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/notifications`,
    { params }
  );
  return data?.data || null;
}

export async function detail(organizationId, id) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/notifications/${id}`
  );
  return data?.data || null;
}

export async function markRead(organizationId, id) {
  const { data } = await api.patch(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/notifications/${id}/read`
  );
  return data?.data || null;
}

export async function markAllRead(organizationId) {
  const { data } = await api.post(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/notifications/mark-all-read`
  );
  return data?.data || null;
}

export async function unreadCount(organizationId) {
  const { data } = await api.get(
    `/api/v1/organizations/${organizationId}/kxtill/mobile/notifications/unread-count`
  );
  return data?.data?.count ?? 0;
}

export default { list, detail, markRead, markAllRead, unreadCount };