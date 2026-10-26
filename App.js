// App.js

import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, ThemeRoot } from './src/styles/ThemeProvider';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { AuthProvider, useAuthContext } from './src/context/AuthContext';
import { OrganizationProvider, useOrganizationContext } from './src/context/OrganizationContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { PermissionsProvider } from './src/context/PermissionsContext';
import RootNavigator from './src/navigation/RootNavigator';
import fcmService from './src/services/fcm.service';

function FcmBootstrap() {
  const { status } = useAuthContext();
  const { activeOrganization } = useOrganizationContext();

  useEffect(() => {
    if (status !== 'signedIn') return;
    if (!activeOrganization?.id) return;
    fcmService.init(activeOrganization.id).catch(() => {});
  }, [status, activeOrganization?.id]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeRoot>
        <SafeAreaProvider>
          <OnboardingProvider>
            <AuthProvider>
              <OrganizationProvider>
                <SettingsProvider>
                  <PermissionsProvider>
                    <FcmBootstrap />
                    <RootNavigator />
                  </PermissionsProvider>
                </SettingsProvider>
              </OrganizationProvider>
            </AuthProvider>
          </OnboardingProvider>
        </SafeAreaProvider>
      </ThemeRoot>
    </ThemeProvider>
  );
}