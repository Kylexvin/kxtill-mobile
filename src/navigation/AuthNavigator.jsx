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
      initialRouteName={ROUTES.PAIR_DEVICE}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen
        name={ROUTES.PAIR_DEVICE}
        component={PairDeviceScreen}
      />
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
    </Stack.Navigator>
  );
}