// src/context/OnboardingContext.jsx
//
// Persists whether the user has seen the onboarding slides.
// Single flag; supports an explicit reset (useful for "replay" from
// settings, and for tests).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kxtill.onboarded.v1';
const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!cancelled) setDone(raw === '1');
      } catch {
        if (!cancelled) setDone(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(async () => {
    setDone(true);
    try {
      await AsyncStorage.setItem(KEY, '1');
    } catch {
      /* session-only is fine */
    }
  }, []);

  const reset = useCallback(async () => {
    setDone(false);
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ ready, done, complete, reset }),
    [ready, done, complete, reset]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

export default OnboardingContext;