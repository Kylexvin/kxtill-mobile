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
          CommonActions.navigate({
            name: ROUTES.TAB_BUSINESS,
            params: {
              screen: ROUTES.BRANCH_SALES_LIST,
              params: {
                branchId: activeBranch?.id ?? null,
                branchName: activeBranch?.name ?? null,
              },
            },
          })
        );
        break;

      case 'team':
        navigationRef.dispatch(
          CommonActions.navigate({
            name: ROUTES.TAB_BUSINESS,
            params: { screen: ROUTES.BRANCH_TEAM },
          })
        );
        break;

      case 'add-product':
        navigationRef.dispatch(
          CommonActions.navigate({
            name: ROUTES.TAB_BUSINESS,
            params: { screen: ROUTES.PRODUCT_FORM, params: { mode: 'create' } },
          })
        );
        break;

      case 'stock-count':
        navigationRef.dispatch(
          CommonActions.navigate({
            name: ROUTES.TAB_BUSINESS,
            params: { screen: ROUTES.INVENTORY },
          })
        );
        break;

case 'barcode-tool':
  navigationRef.dispatch(
    CommonActions.navigate({
      name: ROUTES.TAB_BUSINESS,
      params: { screen: ROUTES.BARCODE_TOOLS },
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
          <Tab.Screen name={ROUTES.TAB_BUSINESS} component={BranchesStack} />
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