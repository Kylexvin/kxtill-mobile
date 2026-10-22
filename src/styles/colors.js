// LEGACY — new files use useTheme() from src/styles/ThemeProvider.jsx.
// This file remains for existing screens (RootNavigator, AuthNavigator,
// MainNavigator, PairDeviceScreen) not yet migrated. Do not add new
// imports of this module; extend the theme tokens in src/styles/theme.js
// instead.

// src/styles/colors.js
export const colors = {
  // Brand
  primary: '#ff6a2b',
  primaryDark: '#C23300',
  primarySoft: 'rgba(240, 64, 0, 0.12)',

  // Surfaces (dark-first)
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1E1E1E',
  border: '#2A2A2A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#6E6E6E',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#2ECC71',
  warning: '#F5A623',
  danger: '#E5484D',
  info: '#3B82F6',

  // Utility
  overlay: 'rgba(0, 0, 0, 0.6)',
  transparent: 'transparent',
};

export default colors;