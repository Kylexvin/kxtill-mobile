// src/constants/config.js

export const config = {
  authBaseUrl:
    process.env.EXPO_PUBLIC_AUTH_BASE_URL || 'https://auth.kxbyte.co.ke',
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL || 'https://auth.kxbyte.co.ke',

  clientId: 'kxtill',
  redirectUri: 'kxtill://auth/callback',
  webRedirectUri: 'https://kxtill.kxbyte.co.ke/kx/kxtill/oauth/callback',

  oauthEnabled: true,
  forgotPasswordEnabled: true,
};

export const BRAND_ICONS = {
  kxtill: require('../../assets/icons/kxtill.png'),
  kxbyte: require('../../assets/icons/darklogo.png'),
};