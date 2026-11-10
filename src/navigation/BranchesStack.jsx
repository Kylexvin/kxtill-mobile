// src/navigation/BranchesStack.jsx

import { useEffect } from 'react';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import BranchesScreen from '../screens/branches/BranchesScreen';
import BranchHomeScreen from '../screens/branches/BranchHomeScreen';
import BranchSalesScreen from '../screens/branches/BranchSalesScreen';
import BranchStockScreen from '../screens/branches/BranchStockScreen';
import BranchShiftsScreen from '../screens/branches/BranchShiftsScreen';
import BranchSettingsScreen from '../screens/branches/BranchSettingsScreen';
import TeamScreen from '../screens/branches/TeamScreen';
import SalesListScreen from '../screens/branches/SalesListScreen';
import ReceiptScreen from '../screens/branches/ReceiptScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import ProductFormScreen from '../screens/inventory/ProductFormScreen';
import ProductDetailScreen from '../screens/inventory/ProductDetailScreen';
import PosScreen from '../screens/pos/PosScreen';

import BarcodeToolsScreen from '../screens/branches/barcode/BarcodeToolsScreen';
import BarcodeScannerScreen from '../screens/branches/barcode/BarcodeScannerScreen';
import BarcodeGenerateScreen from '../screens/branches/barcode/BarcodeGenerateScreen';
import BarcodeLabelsScreen from '../screens/branches/barcode/BarcodeLabelsScreen';

const Stack = createNativeStackNavigator();

/**
 * Auto-root guard.
 *
 * Deep screens (POS, Product Form) can be pushed directly by the action arc
 * or dashboard quick actions without a parent screen. In that case back
 * navigation has nothing to return to.
 *
 * When this wrapper mounts and finds itself alone at the bottom of the
 * Business stack, it rewrites the stack to [BranchesScreen, currentScreen]
 * so back always lands on BranchesScreen.
 *
 * Runs once on mount; no-op when the screen already has a parent.
 */
function AutoRoot({ children }) {
  const navigation = useNavigation();

  useEffect(() => {
    const state = navigation.getState();
    if (!state) return;
    const routes = state.routes || [];
    if (routes.length === 1) {
      const current = routes[0];
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: ROUTES.BRANCHES_LIST },
            { name: current.name, params: current.params },
          ],
        })
      );
    }
  }, [navigation]);

  return children;
}

export default function BranchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.BRANCHES_LIST} component={BranchesScreen} />
      <Stack.Screen name={ROUTES.BRANCH_HOME} component={BranchHomeScreen} />
      <Stack.Screen name={ROUTES.BRANCH_SALES} component={BranchSalesScreen} />
      <Stack.Screen name={ROUTES.BRANCH_STOCK} component={BranchStockScreen} />
      <Stack.Screen name={ROUTES.BRANCH_SHIFTS} component={BranchShiftsScreen} />
      <Stack.Screen name={ROUTES.BRANCH_TEAM} component={TeamScreen} />
      <Stack.Screen name={ROUTES.BRANCH_SETTINGS} component={BranchSettingsScreen} />
      <Stack.Screen name={ROUTES.BRANCH_SALES_LIST} component={SalesListScreen} />
      <Stack.Screen name={ROUTES.BRANCH_RECEIPT} component={ReceiptScreen} />
      <Stack.Screen name={ROUTES.INVENTORY} component={InventoryScreen} />
      <Stack.Screen name={ROUTES.PRODUCT_DETAIL} component={ProductDetailScreen} />

      <Stack.Screen
        name={ROUTES.PRODUCT_FORM}
        options={{ presentation: 'modal' }}
      >
        {({ route, navigation }) => (
          <AutoRoot>
            <ProductFormScreen route={route} navigation={navigation} />
          </AutoRoot>
        )}
      </Stack.Screen>

      <Stack.Screen
        name={ROUTES.POS}
        options={{ presentation: 'fullScreenModal' }}
      >
        {({ route, navigation }) => (
          <AutoRoot>
            <PosScreen route={route} navigation={navigation} />
          </AutoRoot>
        )}
      </Stack.Screen>

      <Stack.Screen
        name={ROUTES.BARCODE_TOOLS}
        component={BarcodeToolsScreen}
      />
      <Stack.Screen
        name={ROUTES.BARCODE_SCANNER}
        component={BarcodeScannerScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name={ROUTES.BARCODE_GENERATE}
        component={BarcodeGenerateScreen}
      />
      <Stack.Screen
        name={ROUTES.BARCODE_LABELS}
        component={BarcodeLabelsScreen}
      />
    </Stack.Navigator>
  );
}