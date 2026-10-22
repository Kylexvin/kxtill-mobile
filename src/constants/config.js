// src/constants/config.js
export const config = {
  authBaseUrl: 'https://auth.kxbyte.co.ke',
  apiBaseUrl: 'https://auth.kxbyte.co.ke',
  apiBaseUrl: 'http://192.168.1.141:5000',
  clientId: 'kxtill',
  redirectUri: 'kxtill://auth/callback',
  webRedirectUri: 'https://kxtill.kxbyte.co.ke/kx/kxtill/oauth/callback',

  oauthEnabled: true,            // ← on: render both buttons for UI design
  forgotPasswordEnabled: true,
};

// Brand icon — bundled PNG, not a vector glyph
// src/constants/config.js
export const BRAND_ICONS = {
  kxtill: require('../../assets/icons/kxtill.png'),
  kxbyte: require('../../assets/icons/darklogo.png'),
};