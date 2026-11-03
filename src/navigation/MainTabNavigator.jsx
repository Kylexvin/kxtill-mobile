// src/navigation/MainTabNavigator.jsx

import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROUTES } from '../constants/routes';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import BranchesStack from './BranchesStack';
import AccountScreen from '../screens/account/AccountScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import CustomTabBar from './CustomTabBar';
import { ActionsArcProvider, ActionsArcOverlay } from './ActionsArc';
import { navigationRef } from './navigationRef';

const Tab = createBottomTabNavigator();

// Actions tab renders nothing: its tap is intercepted by CustomTabBar
// and toggles the arc.
function NullScreen() {
  return null;
}

// item.id is one of: share-receipt, add-product, barcode-tool,
// stock-count, team. Wire each to a real screen as the features ship.
//
// Uses navigationRef instead of useNavigation() because the arc lives
// outside the tab navigator's screen context. navigationRef dispatches
// to the root and React Navigation resolves the screen by name across
// the whole navigator tree.
const handleArcAction = (item) => {
  if (!item) return;

  switch (item.id) {
    case 'share-receipt':
      // TODO: navigate to SalesListScreen when built
      break;

    case 'add-product':
      // TODO: navigate to AddProductScreen when built
      break;

    case 'barcode-tool':
      // TODO: navigate to BarcodeToolScreen when built
      break;

    case 'stock-count':
      // TODO: navigate to StockCountScreen when built
      break;

    case 'team':
      navigationRef.navigate(ROUTES.TAB_BUSINESS, {
        screen: ROUTES.BRANCH_TEAM,
      });
      break;

      case 'share-receipt':
       navigationRef.navigate(ROUTES.TAB_BUSINESS, {
         screen: ROUTES.BRANCH_SALES_LIST,
     });
     break;

    default:
      break;
  }
};

export default function MainTabNavigator() {
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
  options={{ popToTopOnBlur: true }}
/>
          <Tab.Screen name={ROUTES.TAB_ACTIONS} component={NullScreen} />
          <Tab.Screen
            name={ROUTES.TAB_NOTIFICATIONS}
            component={NotificationsScreen}
            options={{ tabBarLabel: 'Alerts' }}
          />
          <Tab.Screen name={ROUTES.TAB_ACCOUNT} component={AccountScreen} />
        </Tab.Navigator>

        {/* Above the navigator so it is never clipped by the tab bar */}
        <ActionsArcOverlay />
      </View>
    </ActionsArcProvider>
  );
}