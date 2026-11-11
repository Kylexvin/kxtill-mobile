// src/services/fcm.service.js
//
// FCM registration using the modular API (v22+).
// v26 removed the namespaced messaging() call entirely.
//
// v2:
//   - Guard (`registeredOrgId`) is only set AFTER successful registration.
//     The old code set it before permission/token/register, so any transient
//     failure (permission prompt, cold getToken, network) permanently locked
//     the device out with "already registered for this org".
//   - In-flight promise dedupe: concurrent init() calls share one attempt.
//   - Org switch: previous org's token row is best-effort unregistered on
//     the server before registering the new one. FCM token itself is kept
//     (not deleted) so other orgs on the same device keep working.
//   - registerWithOrg returns the row (or null); init only marks success
//     when the server accepted it.

import { Platform } from 'react-native';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  deleteToken,
  requestPermission,
  AuthorizationStatus,
  registerDeviceForRemoteMessages,
  isDeviceRegisteredForRemoteMessages,
} from '@react-native-firebase/messaging';
import { api } from './api';

// Create the messaging instance once.
const messaging = getMessaging();

/** @type {string|null} org the device is currently registered with */
let registeredOrgId = null;

/** @type {Promise<string|null>|null} in-flight init() attempt */
let inflight = null;

/** @type {null | (() => void)} */
let unsubscribeOnTokenRefresh = null;

function deviceLabel() {
  return Platform.OS === 'ios' ? 'iPhone / iPad' : 'Android';
}

async function ensurePermission() {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await requestPermission(messaging);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      console.log('[fcm] ios permission status:', authStatus, 'granted:', enabled);
      if (!enabled) return false;

      if (!isDeviceRegisteredForRemoteMessages(messaging)) {
        await registerDeviceForRemoteMessages(messaging);
      }
    } else {
      console.log('[fcm] android: skipping requestPermission');
    }
    return true;
  } catch (e) {
    console.log('[fcm] permission error:', e?.message);
    return false;
  }
}

export async function registerWithOrg(organizationId, token) {
  if (!organizationId || !token) {
    console.log('[fcm] register skipped: missing orgId or token');
    return null;
  }
  try {
    const { data } = await api.post(
      `/api/v1/organizations/${organizationId}/kxtill/mobile/devices/register`,
      {
        token,
        platform: Platform.OS,
        deviceLabel: deviceLabel(),
      }
    );
    console.log('[fcm] registered with backend:', data?.data?.id || 'ok');
    return data?.data || null;
  } catch (e) {
    console.log(
      '[fcm] register failed:',
      e?.response?.status,
      e?.response?.data || e?.message
    );
    return null;
  }
}

/**
 * Best-effort removal of this device token from a specific org.
 * The FCM token itself is NOT deleted — other orgs on the same device
 * keep working.
 */
async function unregisterFromOrg(organizationId) {
  if (!organizationId) return;
  try {
    const token = await getToken(messaging);
    if (!token) return;
    await api.delete(
      `/api/v1/organizations/${organizationId}/kxtill/mobile/devices/${encodeURIComponent(
        token
      )}`
    );
    console.log('[fcm] unregistered from org:', organizationId);
  } catch (e) {
    console.log(
      '[fcm] unregister failed:',
      e?.response?.status,
      e?.response?.data || e?.message
    );
  }
}

/**
 * Full sign-out / token invalidation. Use this when the user signs out
 * of ALL orgs on this device. For per-org switches use unregisterFromOrg.
 */
export async function unregister() {
  if (registeredOrgId) {
    await unregisterFromOrg(registeredOrgId);
  }
  try {
    const token = await getToken(messaging);
    if (token) {
      await deleteToken(messaging);
    }
  } catch {
    /* ignore */
  }
  if (unsubscribeOnTokenRefresh) {
    unsubscribeOnTokenRefresh();
    unsubscribeOnTokenRefresh = null;
  }
  registeredOrgId = null;
  inflight = null;
}

async function runInit(organizationId) {
  console.log('[fcm] init for org:', organizationId);

  // Org switch: clean up the previous org's row for this token first.
  if (registeredOrgId && registeredOrgId !== organizationId) {
    console.log(
      '[fcm] org changed:',
      registeredOrgId,
      '→',
      organizationId
    );
    await unregisterFromOrg(registeredOrgId);
    registeredOrgId = null;
  }

  const granted = await ensurePermission();
  if (!granted) {
    console.log('[fcm] init aborted: permission not granted');
    return null;
  }

  let token = null;
  try {
    token = await getToken(messaging);
    console.log('[fcm] token:', token);
  } catch (e) {
    console.log('[fcm] getToken failed:', e?.message);
    return null;
  }

  if (!token) {
    console.log('[fcm] init aborted: no token');
    return null;
  }

  const registered = await registerWithOrg(organizationId, token);
  if (!registered) {
    console.log('[fcm] init aborted: register failed');
    return null;
  }

  // ── Success. Commit the guard only now. ─────────────────────
  registeredOrgId = organizationId;

  if (unsubscribeOnTokenRefresh) {
    unsubscribeOnTokenRefresh();
    unsubscribeOnTokenRefresh = null;
  }
  unsubscribeOnTokenRefresh = onTokenRefresh(messaging, async (newToken) => {
    console.log('[fcm] token refreshed:', newToken.slice(0, 24) + '…');
    await registerWithOrg(organizationId, newToken);
  });

  return token;
}

export async function init(organizationId) {
  if (!organizationId) {
    console.log('[fcm] init skipped: no orgId');
    return null;
  }
  if (registeredOrgId === organizationId) {
    console.log('[fcm] init skipped: already registered for this org');
    return null;
  }
  if (inflight) {
    // Another init() is already running; share its result.
    return inflight;
  }

  inflight = (async () => {
    try {
      return await runInit(organizationId);
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export default { init, unregister, registerWithOrg };