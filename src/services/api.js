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

export function configureApi({ getToken, refresh, expired }) {
  if (getToken) getAccessToken = getToken;
  if (refresh) onRefreshNeeded = refresh;
  if (expired) onSessionExpired = expired;
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
    }
    return error;
  }
  // Non-Error reject (Hermes sometimes rejects with strings/undefined)
  const e = new Error(typeof error === 'string' ? error : 'Request failed');
  e.isSynthetic = true;
  return e;
}

export default api;