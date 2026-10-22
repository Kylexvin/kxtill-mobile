// src/services/auth.service.js
//
// Wraps every auth-related backend call.
// Two server shapes coexist:
//   POST /api/v1/auth/login     -> camelCase { accessToken, refreshToken, ... }
//   POST /api/v1/auth/oauth/token -> snake_case { access_token, refresh_token, ... }
// Both are normalized to camelCase so the rest of the app is uniform.
//
// NOTE: does NOT use URL / URLSearchParams — they are not guaranteed in
// Hermes and pulling a polyfill in here has, in the past, created a
// require cycle via index.js. We build the query string by hand.

import { api } from './api';
import { config } from '../constants/config';

const normalizeLogin = (data = {}) => ({
  user: data.user || null,
  accessToken: data.accessToken || data.access_token || null,
  refreshToken: data.refreshToken || data.refresh_token || null,
  organizations: data.organizations || [],
});

function toQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export async function login(email, password) {
  const { data } = await api.post('/api/v1/auth/login', { email, password });
  return normalizeLogin(data);
}

export async function refresh(refreshToken) {
  const { data } = await api.post('/api/v1/auth/refresh', { refreshToken });
  // Server returns { accessToken } only — no new refresh token.
  return { accessToken: data.accessToken || data.access_token || null };
}

export async function logout(refreshToken) {
  try {
    await api.post('/api/v1/auth/logout', { refreshToken });
  } catch {
    // Sign-out must always succeed locally; ignore network failures.
  }
}

export async function logoutAll() {
  try {
    await api.post('/api/v1/auth/logout-all');
  } catch {
    // same rationale
  }
}

export async function getMe() {
  const { data } = await api.get('/api/v1/auth/me');
  return data;
}

export function buildAuthorizeUrl(provider = 'oauth') {
  const path =
    provider === 'google'
      ? '/api/v1/auth/google'
      : '/api/v1/auth/oauth/authorize';

  const qs = toQuery({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
  });

  return `${config.authBaseUrl}${path}?${qs}`;
}

export async function exchangeCode(code) {
  const { data } = await api.post('/api/v1/auth/oauth/token', {
    code,
    client_id: config.clientId,
  });
  return normalizeLogin(data); // server uses snake_case; normalizer handles it
}

export default {
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  buildAuthorizeUrl,
  exchangeCode,
};