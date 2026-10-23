// src/navigation/MainTabNavigator.jsx

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROUTES } from '../constants/routes';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import BranchesStack from './BranchesStack';
import PlaceholderScreen from '../screens/common/PlaceholderScreen';
import AccountScreen from '../screens/account/AccountScreen';
import CustomTabBar from './CustomTabBar';

const Tab = createBottomTabNavigator();

// Actions tab renders nothing — its tap is intercepted by CustomTabBar
// and toggles the arc.
function NullScreen() {
  return null;
}

export default function MainTabNavigator() {
  return (
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
      <Tab.Screen name={ROUTES.TAB_NOTIFICATIONS}>
        {() => (
          <PlaceholderScreen
            kicker="NOTIFICATIONS"
            title="Alerts & activity"
            description="Low stock, cash variances, offline devices and shift closures, delivered through Firebase Cloud Messaging. Coming in Phase 3."
            iconName="notifications-outline"
            phase="Phase 3"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name={ROUTES.TAB_ACCOUNT} component={AccountScreen} />
    </Tab.Navigator>
  );
}