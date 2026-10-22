// src/services/api.js
//
// Single axios instance used by every service. AuthProvider wires the
// interceptors at mount. Screens never import this file — they import
// services, which import api.

import axios from 'axios';
import { config } from '../constants/config';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15000,
});

// Injected by AuthProvider on mount. Defaults do nothing (safe if a
// request fires before AuthProvider has wired things up).
let getAccessToken = () => null;
let onRefreshNeeded = async () => null;   // returns new accessToken or null
let onSessionExpired = () => {};

export function configureApi({ getToken, refresh, expired }) {
  if (getToken) getAccessToken = getToken;
  if (refresh) onRefreshNeeded = refresh;
  if (expired) onSessionExpired = expired;
}

api.interceptors.request.use((req) => {
  const token = getAccessToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// 401 → try to refresh once, retry the original request. If refresh
// fails (or the retry also 401s), invoke session-expired. Never loop.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    // Do not attempt refresh on the refresh endpoint itself
    // (would cause infinite recursion) or on auth endpoints.
    const isAuthEndpoint = /\/auth\/(login|refresh|logout|oauth\/token)/.test(
      original.url || ''
    );

    if (status === 401 && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      const newToken = await onRefreshNeeded();
      if (newToken) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      onSessionExpired();
    }

    return Promise.reject(error);
  }
);

export default api;