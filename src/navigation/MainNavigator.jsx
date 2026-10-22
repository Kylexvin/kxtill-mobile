// src/navigation/MainNavigator.jsx

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import MainTabNavigator from './MainTabNavigator';
import KxtillSettingsScreen from '../screens/account/KxtillSettingsScreen';

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.MAIN_TABS} component={MainTabNavigator} />
      <Stack.Screen
        name={ROUTES.KXTILL_SETTINGS}
        component={KxtillSettingsScreen}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}