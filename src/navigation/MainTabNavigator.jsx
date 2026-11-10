// src/navigation/MainTabNavigator.jsx

import { View, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  CommonActions,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { ROUTES } from '../constants/routes';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import BranchesStack from './BranchesStack';
import AccountScreen from '../screens/account/AccountScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import CustomTabBar from './CustomTabBar';
import { ActionsArcProvider, ActionsArcOverlay } from './ActionsArc';
import { navigationRef } from './navigationRef';
import { useOrganizationContext } from '../context/OrganizationContext';
import { usePermissionsContext } from '../context/PermissionsContext';
import { KXTILL } from '../constants/permissions';
import { goToBusinessScreen } from './helpers';

const Tab = createBottomTabNavigator();

function NullScreen() {
  return null;
}

// Routes inside BranchesStack that must hide the bottom tab bar.
const HIDE_TAB_BAR_ROUTES = new Set([ROUTES.POS, ROUTES.BARCODE_SCANNER]);

export default function MainTabNavigator() {
  const { activeBranch } = useOrganizationContext();
  const { can } = usePermissionsContext();

  const handleArcAction = (item) => {
    if (!item) return;

    switch (item.id) {
      case 'pos': {
        if (!can(KXTILL.SALES.CREATE)) {
          Alert.alert(
            'Not available',
            'You do not have permission to use POS.'
          );
          break;
        }
        goToBusinessScreen(navigationRef.dispatch, ROUTES.POS, {
          branchId: activeBranch?.id ?? null,
          branchName: activeBranch?.name ?? null,
        });
        break;
      }

      case 'share-receipt':
        goToBusinessScreen(navigationRef.dispatch, ROUTES.BRANCH_SALES_LIST, {
          branchId: activeBranch?.id ?? null,
          branchName: activeBranch?.name ?? null,
        });
        break;

      case 'team':
        goToBusinessScreen(navigationRef.dispatch, ROUTES.BRANCH_TEAM, {
          branchId: activeBranch?.id ?? null,
          branchName: activeBranch?.name ?? null,
        });
        break;

      case 'add-product':
        goToBusinessScreen(navigationRef.dispatch, ROUTES.PRODUCT_FORM, {
          mode: 'create',
          branchId: activeBranch?.id ?? null,
        });
        break;

      case 'barcode-tool':
        goToBusinessScreen(navigationRef.dispatch, ROUTES.BARCODE_TOOLS, {
          branchId: activeBranch?.id ?? null,
        });
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
          tabBar={(props) => {
            const focusedTab = props.state.routes[props.state.index];
            const nestedRoute =
              getFocusedRouteNameFromRoute(focusedTab) ?? null;

            if (
              focusedTab.name === ROUTES.TAB_BUSINESS &&
              HIDE_TAB_BAR_ROUTES.has(nestedRoute)
            ) {
              return null;
            }

            return <CustomTabBar {...props} />;
          }}
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