// src/navigation/BranchesStack.jsx

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import BranchesScreen from '../screens/branches/BranchesScreen';
import BranchHomeScreen from '../screens/branches/BranchHomeScreen';
import BranchSalesScreen from '../screens/branches/BranchSalesScreen';
import BranchStockScreen from '../screens/branches/BranchStockScreen';
import BranchShiftsScreen from '../screens/branches/BranchShiftsScreen';
import BranchSettingsScreen from '../screens/branches/BranchSettingsScreen';

// ...

const Stack = createNativeStackNavigator();

export default function BranchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.BRANCHES_LIST} component={BranchesScreen} />
      <Stack.Screen name={ROUTES.BRANCH_HOME} component={BranchHomeScreen} />
      <Stack.Screen name={ROUTES.BRANCH_SALES} component={BranchSalesScreen} />
      <Stack.Screen name={ROUTES.BRANCH_STOCK} component={BranchStockScreen} />
      <Stack.Screen name={ROUTES.BRANCH_SHIFTS} component={BranchShiftsScreen} />
      <Stack.Screen
  name={ROUTES.BRANCH_SETTINGS}
  component={BranchSettingsScreen}
/>
    </Stack.Navigator>
  );
}