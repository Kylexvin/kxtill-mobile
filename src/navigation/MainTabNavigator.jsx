// src/navigation/MainTabNavigator.jsx

import { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../styles/ThemeProvider';
import { ROUTES } from '../constants/routes';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import BranchesStack from './BranchesStack';
import PlaceholderScreen from '../screens/common/PlaceholderScreen';
import AccountScreen from '../screens/account/AccountScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  [ROUTES.TAB_HOME]: { focused: 'home', unfocused: 'home-outline' },
  [ROUTES.TAB_BRANCHES]: { focused: 'git-branch', unfocused: 'git-branch-outline' },
  [ROUTES.TAB_REPORTS]: { focused: 'bar-chart', unfocused: 'bar-chart-outline' },
  [ROUTES.TAB_NOTIFICATIONS]: {
    focused: 'notifications',
    unfocused: 'notifications-outline',
  },
  [ROUTES.TAB_ACCOUNT]: {
    focused: 'person-circle',
    unfocused: 'person-circle-outline',
  },
};

export default function MainTabNavigator() {
  const { theme: c } = useTheme();

  const screenOptions = useMemo(
    () => ({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: c.textMuted,
      tabBarStyle: {
        backgroundColor: c.surface,
        borderTopColor: c.border,
        borderTopWidth: 1,
        paddingTop: 6,
        height: 64,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
      },
      tabBarIcon: ({ focused, color, size }) => {
        const icons = TAB_ICONS[route.name];
        const name = focused ? icons.focused : icons.unfocused;
        return <Ionicons name={name} size={size ?? 22} color={color} />;
      },
    }),
    [c]
  );

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name={ROUTES.TAB_HOME}
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name={ROUTES.TAB_BRANCHES}
        component={BranchesStack}
        options={{ tabBarLabel: 'Branches' }}
      />
      <Tab.Screen name={ROUTES.TAB_REPORTS} options={{ tabBarLabel: 'Reports' }}>
        {() => (
          <PlaceholderScreen
            kicker="REPORTS"
            title="Performance & history"
            description="Daily, weekly and monthly sales summaries, payment breakdowns and product performance. Coming in Phase 2."
            iconName="bar-chart-outline"
            phase="Phase 2"
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name={ROUTES.TAB_NOTIFICATIONS}
        options={{ tabBarLabel: 'Alerts' }}
      >
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
      <Tab.Screen
        name={ROUTES.TAB_ACCOUNT}
        component={AccountScreen}
        options={{ tabBarLabel: 'Account' }}
      />
    </Tab.Navigator>
  );
}