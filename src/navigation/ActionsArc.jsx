// src/navigation/ActionsArc.jsx
//
// The pop-up action arc. It lives in an overlay ABOVE the tab navigator
// (not inside the tab bar), so it is never clipped and every bubble is
// tappable on Android. Position is computed from the same constants the tab
// bar uses, so the bubbles fan out from the plus button.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/ThemeProvider';

/* Shared layout constants (CustomTabBar imports these) */
export const BAR_ROW = 60; // height of the tab row, excluding bottom inset
export const PLUS_LIFT = 10; // how far the plus button is raised
export const useBottomInset = () => Math.max(useSafeAreaInsets().bottom, 8);

export const ARC_ITEMS = [
  { id: 'stock-count', label: 'Stock count', short: 'Count', icon: 'clipboard-outline' },
  { id: 'stock-lookup', label: 'Stock lookup', short: 'Lookup', icon: 'search-outline' },
  { id: 'scan', label: 'Scan barcode', short: 'Scan', icon: 'barcode-outline' },
  { id: 'sales-today', label: "Today's sales", short: 'Sales', icon: 'receipt-outline' },
  { id: 'force-close', label: 'Force close shift', short: 'Close shift', icon: 'lock-closed-outline' },
];

const RADIUS = 118; // distance from the origin to each bubble centre
const MIN_ANGLE = -64; // fan spread: 32° between bubbles → ~66px apart
const MAX_ANGLE = 64;
const SIZE = 46; // bubble diameter
const ARC_GAP = 35;      // was 26 → 32
const LABEL_BLOCK = 25;  // was 22 → 16
const COL_W = 66; // width of one bubble column (bubble + label)

/* ── Context ─────────────────────────────────────────── */

const ArcContext = createContext(null);

export function ActionsArcProvider({ children, onAction }) {
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, toggle, close, progress, onAction }),
    [open, toggle, close, progress, onAction]
  );
  return <ArcContext.Provider value={value}>{children}</ArcContext.Provider>;
}

export function useActionsArc() {
  const ctx = useContext(ArcContext);
  if (!ctx) throw new Error('useActionsArc must be used inside <ActionsArcProvider>');
  return ctx;
}

/* ── Overlay ─────────────────────────────────────────── */

export function ActionsArcOverlay() {
  const { theme: c } = useTheme();
  const { open, close, progress, onAction } = useActionsArc();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomInset();
  const barHeight = BAR_ROW + bottomInset;

  const vals = useRef(ARC_ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.stagger(
          45,
          vals.map((v) =>
            Animated.spring(v, {
              toValue: 1,
              friction: 6,
              tension: 110,
              useNativeDriver: true,
            })
          )
        ),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: true }),
        ...vals.map((v) =>
          Animated.timing(v, { toValue: 0, duration: 140, useNativeDriver: true })
        ),
      ]).start();
    }
  }, [open, progress, vals]);

  // Android back button closes the arc first
  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open, close]);

  // plus centre → arc origin, measured from the bottom of the screen
  const originFromBottom = bottomInset + BAR_ROW / 2 + PLUS_LIFT + ARC_GAP;
  const cx = width / 2; // the Actions slot is the middle of 5

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'box-none' : 'none'}
    >
      {/* Tap outside to close. Stops above the bar so tabs stay tappable. */}
      <Pressable
        style={[styles.backdropHit, { bottom: barHeight }]}
        onPress={close}
        accessibilityLabel="Close actions"
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#000',
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.35],
              }),
            },
          ]}
        />
      </Pressable>

      {ARC_ITEMS.map((item, i) => {
        const t = ARC_ITEMS.length === 1 ? 0.5 : i / (ARC_ITEMS.length - 1);
        const rad = ((MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * t) * Math.PI) / 180;
        const dx = Math.sin(rad) * RADIUS;
        const up = Math.cos(rad) * RADIUS;
        const v = vals[i];

        return (
          <Animated.View
            key={item.id}
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.column,
              {
                left: cx + dx - COL_W / 2,
                bottom: originFromBottom + up - SIZE / 2 - LABEL_BLOCK,
                opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
                transform: [
                  // start at the plus button, spring out to the final spot
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] }) },
                  {
                    translateY: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [up + ARC_GAP + LABEL_BLOCK / 2, 0],
                    }),
                  },
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ],
              },
            ]}
          >
            <Pressable
              onPress={() => {
                close();
                onAction?.(item);
              }}
              style={({ pressed }) => [
                styles.bubble,
                { backgroundColor: c.primary },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons name={item.icon} size={21} color={c.textOnPrimary} />
            </Pressable>
            <View
              style={[
                styles.labelPill,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[styles.label, { color: c.textPrimary }]} numberOfLines={1}>
                {item.short}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdropHit: { position: 'absolute', top: 0, left: 0, right: 0 },
  column: {
    position: 'absolute',
    width: COL_W,
    alignItems: 'center',
  },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  labelPill: {
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: COL_W,
  },
  label: { fontSize: 10, fontWeight: '800' },
});