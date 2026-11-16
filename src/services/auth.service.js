// src/services/auth.service.js
//
// Wraps every auth-related backend call.
// Two server shapes coexist:
//   POST /api/v1/auth/login       -> camelCase { accessToken, refreshToken, ... }
//   POST /api/v1/auth/oauth/token -> snake_case { access_token, refresh_token, ... }
// Both are normalized to camelCase so the rest of the app is uniform.
//
// NOTE: does NOT use URL / URLSearchParams — they are not guaranteed in
// Hermes and pulling a polyfill in here has, in the past, created a
// require cycle via index.js. We build the query string by hand.

import { api } from './api';
import { config } from '../constants/config';

/* ── normalisation ───────────────────────────────────────────── */

const normalizeLogin = (data) => {
  const d = data && typeof data === 'object' ? data : {};
  return {
    user: d.user || null,
    accessToken: d.accessToken || d.access_token || null,
    refreshToken: d.refreshToken || d.refresh_token || null,
    organizations: Array.isArray(d.organizations) ? d.organizations : [],
  };
};

/**
 * Enforce the token contract at the service boundary so callers
 * (AuthContext) never receive a half-built session.
 * Throws an Error with code BAD_RESPONSE when the server says 2xx but
 * the body is missing tokens — that case is what usually surfaces as
 * "Invalid response from server" downstream.
 */
function assertSession(session) {
  if (!session?.accessToken || !session?.refreshToken) {
    const e = new Error('Invalid response from server');
    e.code = 'BAD_RESPONSE';
    throw e;
  }
  return session;
}

function toQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/* ── password login ──────────────────────────────────────────── */

export async function login(email, password) {
  const { data } = await api.post('/api/v1/auth/login', { email, password });
  return assertSession(normalizeLogin(data));
}

/* ── token refresh ───────────────────────────────────────────── */

export async function refresh(refreshToken) {
  const { data } = await api.post('/api/v1/auth/refresh', { refreshToken });
  // Server returns { accessToken } only — no new refresh token.
  return { accessToken: data?.accessToken || data?.access_token || null };
}

/* ── logout ──────────────────────────────────────────────────── */

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

/* ── profile ─────────────────────────────────────────────────── */

export async function getMe() {
  const { data } = await api.get('/api/v1/auth/me');
  return data;
}

/* ── oauth ───────────────────────────────────────────────────── */

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
  return assertSession(normalizeLogin(data)); // server uses snake_case; normalizer handles it
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