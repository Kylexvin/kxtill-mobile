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

const Tab = createBottomTabNavigator();

// Actions tab renders nothing: its tap is intercepted by CustomTabBar
// and toggles the arc.
function NullScreen() {
  return null;
}

// item.id is one of: stock-count, stock-lookup, scan, sales-today,
// force-close. Wire each to real navigation as the features ship.
const handleArcAction = (item) => {
  // TODO
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