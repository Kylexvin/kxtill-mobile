// App.js

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, ThemeRoot } from './src/styles/ThemeProvider';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { AuthProvider } from './src/context/AuthContext';
import { OrganizationProvider } from './src/context/OrganizationContext';
import { PermissionsProvider } from './src/context/PermissionsContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <ThemeProvider>
      <ThemeRoot>
        <SafeAreaProvider>
          <OnboardingProvider>
            <AuthProvider>
              <OrganizationProvider>
                <PermissionsProvider>
                  <RootNavigator />
                </PermissionsProvider>
              </OrganizationProvider>
            </AuthProvider>
          </OnboardingProvider>
        </SafeAreaProvider>
      </ThemeRoot>
    </ThemeProvider>
  );
}