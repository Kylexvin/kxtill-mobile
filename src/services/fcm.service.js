// src/services/fcm.service.js
//
// FCM registration using the modular API (v22+).
// v26 removed the namespaced messaging() call entirely.

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

let registeredOrgId = null;
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

export async function unregister() {
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
  registeredOrgId = organizationId;

  console.log('[fcm] init for org:', organizationId);

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

  await registerWithOrg(organizationId, token);

  if (unsubscribeOnTokenRefresh) {
    unsubscribeOnTokenRefresh();
  }
  unsubscribeOnTokenRefresh = onTokenRefresh(messaging, async (newToken) => {
    console.log('[fcm] token refreshed:', newToken.slice(0, 24) + '…');
    await registerWithOrg(organizationId, newToken);
  });

  return token;
}

export default { init, unregister, registerWithOrg };