// src/navigation/CustomTabBar.jsx
//
// Custom tab bar with an expandable action arc.
// The arc lives INSIDE the tab bar container (overflow visible), rising
// above the bar. Tapping the middle Actions button toggles the arc.
// Tapping an arc icon, another tab, or Actions again closes it.
//
// No backdrop, no modal, no new dependencies.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/ThemeProvider';
import { ROUTES } from '../constants/routes';

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

const ARC_ITEMS = [
  { id: 'stock-count', label: 'Stock count', icon: 'clipboard-outline' },
  { id: 'stock-lookup', label: 'Stock lookup', icon: 'search-outline' },
  { id: 'force-close', label: 'Force close shift', icon: 'lock-closed-outline' },
  { id: 'sales-today', label: "Today's sales", icon: 'receipt-outline' },
  { id: 'scan', label: 'Scan barcode', icon: 'barcode-outline' },
];

const ARC_RADIUS = 96;
const ARC_MIN_ANGLE = -62;
const ARC_MAX_ANGLE = 62;
const ARC_ITEM_SIZE = 48;
const ARC_ICON_SIZE = 22;
const BAR_HEIGHT = 64;

const onArcItemPress = (item, navigation) => {
  // TODO: wire each id to real navigation when the action ships.
};

export default function CustomTabBar({ state, navigation }) {
  const { theme: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [arcOpen, setArcOpen] = useState(false);
  const arcAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(arcAnim, {
      toValue: arcOpen ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [arcOpen, arcAnim]);

  const actionsIndex = PRIMARY.findIndex((p) => p.actionsSlot);
  const slotWidth = screenWidth / PRIMARY.length;
  const middleX = slotWidth * (actionsIndex + 0.5);

  const onPrimaryPress = useCallback(
    (item, routeIndex) => {
      if (item.actionsSlot) {
        setArcOpen((v) => !v);
        return;
      }
      if (arcOpen) setArcOpen(false);
      const route = state.routes[routeIndex];
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(item.name);
      }
    },
    [arcOpen, navigation, state.routes]
  );

  const onArcItem = useCallback(
    (item) => {
      setArcOpen(false);
      onArcItemPress(item, navigation);
    },
    [navigation]
  );

  const activeRouteName = state.routes[state.index]?.name;
  const barHeight = BAR_HEIGHT + Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.barContainer,
        { height: barHeight, backgroundColor: c.surface, borderTopColor: c.border },
      ]}
    >
      {/* Arc: sibling of the bar's contents, absolutely positioned relative
          to the bar container. Rises above the bar because the container
          has overflow: 'visible' and the arc's bottom is offset upward. */}
      <View
        pointerEvents={arcOpen ? 'box-none' : 'none'}
        style={[
          styles.arcLayer,
          {
            // Anchor the arc's origin at the vertical centre of the Actions
            // button, which sits near the top of the bar.
            bottom: barHeight - 24,
          },
        ]}
      >
        {ARC_ITEMS.map((item, i) => {
          const t = ARC_ITEMS.length === 1 ? 0.5 : i / (ARC_ITEMS.length - 1);
          const angleDeg =
            ARC_MIN_ANGLE + (ARC_MAX_ANGLE - ARC_MIN_ANGLE) * t;
          const rad = (angleDeg * Math.PI) / 180;
          const dx = Math.sin(rad) * ARC_RADIUS;
          const dy = -Math.cos(rad) * ARC_RADIUS;

          return (
            <Animated.View
              key={item.id}
              style={[
                styles.arcItem,
                {
                  left: middleX + dx - ARC_ITEM_SIZE / 2,
                  top: dy,
                  opacity: arcAnim,
                  transform: [
                    {
                      scale: arcAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.arcBubble}
                activeOpacity={0.85}
                onPress={() => onArcItem(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Ionicons
                  name={item.icon}
                  size={ARC_ICON_SIZE}
                  color={c.primary}
                />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Primary tab slots */}
      <View style={styles.primaryRow}>
        {PRIMARY.map((item, i) => {
          const isActive = item.actionsSlot
            ? arcOpen
            : item.name === activeRouteName;
          if (item.actionsSlot) {
            return (
              <TouchableOpacity
                key={item.name}
                style={styles.slot}
                activeOpacity={0.85}
                onPress={() => onPrimaryPress(item, i)}
              >
                <View
                  style={[
                    styles.actionsBtn,
                    {
                      backgroundColor: isActive ? c.primary : c.surfaceElevated,
                      borderColor: isActive ? c.primary : c.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={isActive ? 'close' : 'add'}
                    size={24}
                    color={isActive ? c.textOnPrimary : c.primary}
                  />
                </View>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={item.name}
              style={styles.slot}
              activeOpacity={0.85}
              onPress={() => onPrimaryPress(item, i)}
            >
              <Ionicons
                name={isActive ? item.active : item.icon}
                size={22}
                color={isActive ? c.primary : c.textMuted}
              />
              <Text
                style={[
                  styles.label,
                  { color: isActive ? c.primary : c.textMuted },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: 'relative',
    borderTopWidth: 1,
    overflow: 'visible',
    justifyContent: 'flex-end',
  },
  arcLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 200,
    pointerEvents: 'box-none',
  },
  arcItem: {
    position: 'absolute',
  },
  arcBubble: {
    width: ARC_ITEM_SIZE,
    height: ARC_ITEM_SIZE,
    borderRadius: ARC_ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionsBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: -18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
});