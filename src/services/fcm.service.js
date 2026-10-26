// src/services/fcm.service.js
//
// FCM registration for the mobile app.
//
//   - Requests notification permission via the OS (Android 13+ / iOS).
//   - Gets the FCM registration token from the device.
//   - POSTs it to /kxtill/mobile/devices/register so the backend can
//     target this device by (userId, productKey).
//   - Listens for token refresh and re-registers when it changes.
//
// Call init() only after sign-in. Before sign-in, there is no user to
// attach the token to, and /devices/register requires auth.

import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { api } from './api';

let initialized = false;
let unsubscribeOnTokenRefresh = null;

function deviceLabel() {
  // Reasonable, low-effort label. FCM does not give us a device model name
  // through the messaging API; the OS name is good enough for the devices
  // list in Account.
  return Platform.OS === 'ios' ? 'iPhone / iPad' : 'Android';
}

async function ensurePermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    return false;
  }

  // iOS: without this, a notification arriving while the app is in the
  // foreground is silently dropped.
  if (Platform.OS === 'ios') {
    await messaging().registerDeviceForRemoteMessages();
  }

  return true;
}

async function registerToken(token) {
  try {
    await api.post('/api/v1/organizations/placeholder/kxtill/mobile/devices/register', {
      token,
      platform: Platform.OS,
      deviceLabel: deviceLabel(),
    });
  } catch (e) {
    // The endpoint needs the org id in the URL, which the caller provides.
    // This function is a placeholder — see registerWithOrg below.
    throw e;
  }
}

export async function registerWithOrg(organizationId, token) {
  if (!organizationId || !token) return null;
  try {
    const { data } = await api.post(
      `/api/v1/organizations/${organizationId}/kxtill/mobile/devices/register`,
      {
        token,
        platform: Platform.OS,
        deviceLabel: deviceLabel(),
      }
    );
    return data?.data || null;
  } catch (e) {
    return null;
  }
}

export async function unregister() {
  try {
    const token = await messaging().getToken();
    if (token) {
      await messaging().deleteToken();
    }
  } catch {
    /* ignore */
  }
  if (unsubscribeOnTokenRefresh) {
    unsubscribeOnTokenRefresh();
    unsubscribeOnTokenRefresh = null;
  }
  initialized = false;
}

/**
 * Initialise FCM registration. Must be called after sign-in, with the
 * active organization id so the token is registered against the right org.
 *
 * Returns the current token (or null if permission was denied).
 */
export async function init(organizationId) {
  if (!organizationId) return null;
  if (initialized) return null;
  initialized = true;

  const granted = await ensurePermission();
  if (!granted) {
    return null;
  }

  let token = null;
  try {
    token = await messaging().getToken();
  } catch {
    return null;
  }

  if (!token) return null;

  await registerWithOrg(organizationId, token);

  // Token refresh: FCM issues new tokens periodically. Re-register so the
  // backend stops targeting the stale one.
  if (unsubscribeOnTokenRefresh) {
    unsubscribeOnTokenRefresh();
  }
  unsubscribeOnTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
    await registerWithOrg(organizationId, newToken);
  });

  return token;
}

export default { init, unregister, registerWithOrg };