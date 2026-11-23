// src/services/api.js

import axios from 'axios';
import { config } from '../constants/config';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15000,
});

let getAccessToken = () => null;
let onRefreshNeeded = async () => null;
let onSessionExpired = () => {};
let onSubscriptionBlocked = () => {};

export function configureApi({ getToken, refresh, expired, subscriptionBlocked }) {
  if (getToken) getAccessToken = getToken;
  if (refresh) onRefreshNeeded = refresh;
  if (expired) onSessionExpired = expired;
  if (subscriptionBlocked) onSubscriptionBlocked = subscriptionBlocked;
}

api.interceptors.request.use((req) => {
  const token = getAccessToken();
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // ── NEW: normalise everything so callers always get an Error ──
    const norm = toAuthError(error);
    const original = norm.config || {};
    const status = norm.response?.status;

    // Server says the plan blocks this action: refresh the banner state now.
    const subCode = norm.response?.data?.code;
    if (
      status === 403 &&
      typeof subCode === 'string' &&
      subCode.startsWith('SUBSCRIPTION_')
    ) {
      try {
        onSubscriptionBlocked(subCode, norm.response.data);
      } catch {
        /* never let this break the error path */
      }
    }

    const isAuthEndpoint = /\/auth\/(login|refresh|logout|oauth\/token)/.test(
      original.url || ''
    );

    if (status === 401 && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const newToken = await onRefreshNeeded();
        if (newToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api.request(original);
        }
        onSessionExpired();
      } catch {
        onSessionExpired();
      }
    }

    return Promise.reject(norm);
  }
);

// ── NEW helper ──────────────────────────────────────────────
function toAuthError(error) {
  // Always return an Error instance with .response?.data as an object.
  if (error instanceof Error) {
    if (error.response) {
      const d = error.response.data;
      if (typeof d === 'string') {
        // HTML / plain-text body → coerce
        error.response.data = { message: d.slice(0, 240) };
      } else if (d == null || typeof d !== 'object') {
        error.response.data = {};
      }

      // The backend sends { error } or { errors: [] }, but screens read
      // .message. Fill it in so users see the real reason.
      const body = error.response.data;
      if (body && typeof body === 'object' && !body.message) {
        if (typeof body.error === 'string') {
          body.message = body.error;
        } else if (typeof body.error?.message === 'string') {
          body.message = body.error.message;
        } else if (Array.isArray(body.errors) && body.errors.length) {
          body.message = body.errors.join(', ');
        }
      }
    }
    return error;
  }
  // Non-Error reject (Hermes sometimes rejects with strings/undefined)
  const e = new Error(typeof error === 'string' ? error : 'Request failed');
  e.isSynthetic = true;
  return e;
}

export default api;