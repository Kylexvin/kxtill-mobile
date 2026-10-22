// src/navigation/AuthNavigator.jsx

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import { useTheme } from '../styles/ThemeProvider';
import LoginScreen from '../screens/auth/LoginScreen';
import PairDeviceScreen from '../screens/auth/PairDeviceScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  const { theme: c } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen
        name={ROUTES.PAIR_DEVICE}
        component={PairDeviceScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}