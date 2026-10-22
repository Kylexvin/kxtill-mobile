// src/styles/ThemeProvider.jsx
//
// Usage:
//   <ThemeProvider> ...app... </ThemeProvider>
//   const { theme, mode, accent, setMode, setAccent } = useTheme();
//   const styles = useThemedStyles((t) => StyleSheet.create({ ... }));
//
// v3 — status bar fixed:
//   - StatusBar gets an explicit backgroundColor and translucent={false}
//     so the Android status bar area matches the hero band from the very
//     first themed frame.
//   - Root window background is set synchronously at module load using the
//     OS color scheme, so there is no black flash before AsyncStorage hydrates.
//   - Children are not rendered until `ready` is true.
//   - A themed wrapper View (via ThemeRoot, below) is applied inside App.js
//     so the app has a real background from frame 0.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { View, StyleSheet, Appearance, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCENTS, createTheme } from './theme';

const KEY = 'kxtill.theme.v1';
const ThemeContext = createContext(null);

// Pre-hydration: paint the root window with the OS color so there is no
// black flash before ThemeProvider's effect runs.
const SYSTEM_SCHEME = Appearance.getColorScheme();
SystemUI.setBackgroundColorAsync(
  SYSTEM_SCHEME === 'dark' ? '#000000' : '#FFFFFF'
).catch(() => {});

export function ThemeProvider({ children }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState('system'); // system | light | dark
  const [accent, setAccentState] = useState(ACCENTS.tomato);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw && !cancelled) {
          const saved = JSON.parse(raw);
          if (saved.mode) setModeState(saved.mode);
          if (saved.accent) setAccentState(saved.accent);
        }
      } catch {
        // fall back to defaults
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setMode = useCallback(
    (m) => {
      setModeState(m);
      persist({ mode: m, accent });
    },
    [accent, persist]
  );

  const setAccent = useCallback(
    (a) => {
      setAccentState(a);
      persist({ mode, accent: a });
    },
    [mode, persist]
  );

  const resolved = mode === 'system' ? system ?? 'dark' : mode;
  const theme = useMemo(
    () => createTheme(resolved, accent),
    [resolved, accent]
  );

  // Root window background — refined once the real theme is known.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  const value = useMemo(
    () => ({ theme, mode, resolved, accent, setMode, setAccent, ready }),
    [theme, mode, resolved, accent, setMode, setAccent, ready]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        style={resolved === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme.hero}
        translucent={false}
      />
      {ready ? children : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Re-creates styles only when the theme changes. */
export function useThemedStyles(factory) {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [theme]); // eslint-disable-line
}

/**
 * Renders a themed full-screen background View. Wrap the app inside this
 * INSIDE ThemeProvider so the status bar / navigation bar area always has
 * a non-black, correct theme color behind it — even before any child screen
 * paints.
 *
 * Usage:
 *   <ThemeProvider>
 *     <ThemeRoot>
 *       <SafeAreaProvider>...</SafeAreaProvider>
 *     </ThemeRoot>
 *   </ThemeProvider>
 */
export function ThemeRoot({ children }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});