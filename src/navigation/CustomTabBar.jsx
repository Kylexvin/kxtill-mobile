// src/navigation/CustomTabBar.jsx
//
// Tab bar with a raised plus button. The pop-up arc is no longer drawn here:
// it lives in <ActionsArcOverlay /> (see ActionsArc.jsx), which sits above
// the navigator so it is never clipped. This file only toggles it.

import { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../styles/ThemeProvider';
import { ROUTES } from '../constants/routes';
import { useNotificationsUnread } from '../hooks/useNotificationsUnread';
import {
  BAR_ROW,
  PLUS_LIFT,
  useBottomInset,
  useActionsArc,
} from './ActionsArc';

const PLUS_SIZE = 52;

const PRIMARY = [
  { name: ROUTES.TAB_HOME, label: 'Home', icon: 'home-outline', active: 'home' },
  {
    name: ROUTES.TAB_BUSINESS,
    label: 'Business',
    icon: 'storefront-outline',
    active: 'storefront',
  },
  { name: ROUTES.TAB_ACTIONS, label: 'Actions', actionsSlot: true },
  {
    name: ROUTES.TAB_NOTIFICATIONS,
    label: 'Alerts',
    icon: 'notifications-outline',
    active: 'notifications',
  },
  {
    name: ROUTES.TAB_ACCOUNT,
    label: 'Account',
    icon: 'person-circle-outline',
    active: 'person-circle',
  },
];

export default function CustomTabBar({ state, navigation }) {
  const { theme: c } = useTheme();
  const bottomInset = useBottomInset();
  const { open, toggle, close, progress } = useActionsArc();
  const unreadCount = useNotificationsUnread();

  // any tab change closes the arc
  useEffect(() => {
    close();
  }, [state.index, close]);

  const onTabPress = useCallback(
    (item, routeIndex) => {
      if (item.actionsSlot) {
        toggle();
        return;
      }
      if (open) close();
      const route = state.routes[routeIndex];
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) navigation.navigate(item.name);
    },
    [open, close, toggle, navigation, state.routes]
  );

  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.bar,
        {
          height: BAR_ROW + bottomInset,
          paddingBottom: bottomInset,
          backgroundColor: c.surface,
          borderTopColor: c.border,
        },
      ]}
    >
      {PRIMARY.map((item, i) => {
        if (item.actionsSlot) {
          return (
            <Pressable
              key={item.name}
              style={styles.slot}
              onPress={() => onTabPress(item, i)}
              accessibilityRole="button"
              accessibilityLabel={open ? 'Close actions' : 'Open actions'}
              accessibilityState={{ expanded: open }}
            >
              <Animated.View
                style={[
                  styles.plus,
                  {
                    backgroundColor: c.primary,
                    transform: [
                      { translateY: -PLUS_LIFT },
                      {
                        rotate: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '135deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="add" size={28} color={c.textOnPrimary} />
              </Animated.View>
            </Pressable>
          );
        }

        const isActive = item.name === activeRouteName;
        const showBadge =
          item.name === ROUTES.TAB_NOTIFICATIONS && unreadCount > 0;
        return (
          <Pressable
            key={item.name}
            style={styles.slot}
            onPress={() => onTabPress(item, i)}
            accessibilityRole="button"
            accessibilityLabel={
              showBadge
                ? `${item.label}, ${unreadCount} unread`
                : item.label
            }
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={isActive ? item.active : item.icon}
                size={22}
                color={isActive ? c.primary : c.textMuted}
              />
              {showBadge ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: c.primary,
                      borderColor: c.surface,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                { color: isActive ? c.primary : c.textMuted },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  slot: {
    flex: 1,
    height: BAR_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrap: {
    position: 'relative',
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  plus: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    borderRadius: PLUS_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      },
      android: { elevation: 8 },
    }),
  },
});