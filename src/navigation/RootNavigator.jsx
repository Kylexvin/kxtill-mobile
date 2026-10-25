// src/navigation/RootNavigator.jsx

import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../context/OnboardingContext';
import { useOrganizationContext } from '../context/OrganizationContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTheme } from '../styles/ThemeProvider';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import SelectOrganizationScreen from '../screens/auth/SelectOrganizationScreen';
import SelectBranchScreen from '../screens/auth/SelectBranchScreen';
import SplashScreen from '../screens/splash/SplashScreen';

export default function RootNavigator() {
  const { status } = useAuth();
  const { ready: onboardingReady, done: onboardingDone } = useOnboarding();
  const {
    organizations,
    activeOrganization,
    activeBranch,
    ready: orgReady,
  } = useOrganizationContext();
  const { isOwner } = usePermissions();
  const { theme: c } = useTheme();

  // Boot gate: nothing is decidable until auth + onboarding + org hydration
  // have all finished. While any is still resolving, show the branded splash.
  // This is what prevents the "flash of org picker" on cold start.
  const booting =
    status === 'loading' ||
    !onboardingReady ||
    (status === 'signedIn' && !orgReady);

  if (booting) {
    return <SplashScreen />;
  }

if (status === 'signedOut') {
  if (!onboardingDone) {
    return <OnboardingScreen onDone={() => { /* context flips done */ }} />;
  }
  return <AuthContainer theme={c} />;
}

  // ── signedIn ────────────────────────────────────────────────
  // At this point `orgReady === true`, so activeOrganization / activeBranch
  // are in a stable, final state for this launch. No more hydration races.

  if (organizations.length === 0) {
    return <SelectOrganizationScreen />;
  }

  if (!activeOrganization) {
    // Multiple orgs and no persisted match — user must pick.
    return <SelectOrganizationScreen />;
  }

  if (!activeBranch) {
    // Owners with "All branches" scope are allowed to have no branch.
    // Everyone else must pick one.
    if (isOwner) {
      return <MainContainer theme={c} />;
    }
    return <SelectBranchScreen />;
  }

  return <MainContainer theme={c} />;
}

function AuthContainer({ theme: c }) {
  const navTheme = makeNavTheme(c);
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <AuthNavigator />
    </NavigationContainer>
  );
}

function MainContainer({ theme: c }) {
  const navTheme = makeNavTheme(c);
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <MainNavigator />
    </NavigationContainer>
  );
}

function makeNavTheme(c) {
  return {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: c.background,
      card: c.surface,
      text: c.textPrimary,
      border: c.border,
      primary: c.primary,
    },
  };
}