// src/navigation/MainTabNavigator.jsx

import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { ROUTES } from '../constants/routes';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import BranchesStack from './BranchesStack';
import AccountScreen from '../screens/account/AccountScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import CustomTabBar from './CustomTabBar';
import { ActionsArcProvider, ActionsArcOverlay } from './ActionsArc';
import { navigationRef } from './navigationRef';
import { useOrganizationContext } from '../context/OrganizationContext';

const Tab = createBottomTabNavigator();

function NullScreen() {
  return null;
}

export default function MainTabNavigator() {
  const { activeBranch } = useOrganizationContext();

  const handleArcAction = (item) => {
    if (!item) return;

    switch (item.id) {
      case 'share-receipt':
        navigationRef.dispatch(
          CommonActions.navigate(ROUTES.TAB_BUSINESS, {
            screen: ROUTES.BRANCH_SALES_LIST,
            params: {
              branchId: activeBranch?.id ?? null,
              branchName: activeBranch?.name ?? null,
            },
          })
        );
        break;

      case 'add-product':
        // Land on the inventory list with the create form open on top.
        // After save, the form closes and the user sees the fresh list.
        navigationRef.dispatch(
          CommonActions.navigate(ROUTES.TAB_BUSINESS, {
            screen: ROUTES.INVENTORY,
            params: { openCreate: true },
          })
        );
        break;

      case 'barcode-tool':
        // Route to inventory with a scan hint. Real scanner screen later.
        navigationRef.dispatch(
          CommonActions.navigate(ROUTES.TAB_BUSINESS, {
            screen: ROUTES.INVENTORY,
            params: { focus: 'scan' },
          })
        );
        break;

      case 'stock-count':
        // BranchStockScreen is the stock-counting surface.
        navigationRef.dispatch(
          CommonActions.navigate(ROUTES.TAB_BUSINESS, {
            screen: ROUTES.BRANCH_STOCK,
            params: {
              branchId: activeBranch?.id ?? null,
              branchName: activeBranch?.name ?? null,
            },
          })
        );
        break;

      case 'team':
        navigationRef.dispatch(
          CommonActions.navigate(ROUTES.TAB_BUSINESS, {
            screen: ROUTES.BRANCH_TEAM,
          })
        );
        break;

      default:
        break;
    }
  };

  return (
    <ActionsArcProvider onAction={handleArcAction}>
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <CustomTabBar {...props} />}
        >
          <Tab.Screen name={ROUTES.TAB_HOME} component={DashboardScreen} />
          <Tab.Screen
            name={ROUTES.TAB_BUSINESS}
            component={BranchesStack}
          />
          <Tab.Screen name={ROUTES.TAB_ACTIONS} component={NullScreen} />
          <Tab.Screen
            name={ROUTES.TAB_NOTIFICATIONS}
            component={NotificationsScreen}
            options={{ tabBarLabel: 'Alerts' }}
          />
          <Tab.Screen name={ROUTES.TAB_ACCOUNT} component={AccountScreen} />
        </Tab.Navigator>

        <ActionsArcOverlay />
      </View>
    </ActionsArcProvider>
  );
}