// src/navigation/ActionsArc.jsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export const BAR_ROW = 60;
export const PLUS_LIFT = 10;
export const useBottomInset = () => Math.max(useSafeAreaInsets().bottom, 8);

export const ARC_ITEMS = [
  { id: 'share-receipt', label: 'Share receipt', short: 'Receipt', icon: 'share-social-outline' },
  { id: 'products', label: 'Products', short: 'Products', icon: 'pricetags-outline' },
  { id: 'pos', label: 'POS', short: 'POS', icon: 'cart-outline' },
  { id: 'barcode-tool', label: 'Barcode tool', short: 'Barcode', icon: 'barcode-outline' },
  { id: 'team', label: 'Team', short: 'Team', icon: 'people-outline' },
];

const RADIUS = 118;
const SIZE = 46;
const ARC_GAP = 35;
const LABEL_BLOCK = 25;
const COL_W = 66;

// Gap above the tab bar so the backdrop doesn't swallow plus-button taps.
const BACKDROP_GRACE = PLUS_LIFT + 12;

const ArcContext = createContext(null);

export function ActionsArcProvider({ children, onAction }) {
  const [open, setOpen] = useState(false);
  const progress = useMemo(() => new Animated.Value(0), []);
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

export function ActionsArcOverlay() {
  const { theme: c } = useTheme();
  const { open, close, progress, onAction } = useActionsArc();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomInset();
  const barHeight = BAR_ROW + bottomInset;

  const vals = useMemo(() => ARC_ITEMS.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.stagger(
          45,
          vals.map((v) =>
            Animated.spring(v, {
              toValue: 1,
              friction: 6,
              tension: 110,
              // MUST be false: native-driver transforms keep the touch
              // target at the untransformed position on Android, so the
              // first tap misses the bubble.
              useNativeDriver: false,
            })
          )
        ),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        ...vals.map((v) =>
          Animated.timing(v, {
            toValue: 0,
            duration: 140,
            useNativeDriver: false,
          })
        ),
      ]).start();
    }
  }, [open, progress, vals]);

  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open, close]);

  const originFromBottom = bottomInset + BAR_ROW / 2 + PLUS_LIFT + ARC_GAP;
  const cx = width / 2;
  const total = ARC_ITEMS.length;
  const spread = 64;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'box-none' : 'none'}>
      <Pressable
        style={[styles.backdropHit, { bottom: barHeight + BACKDROP_GRACE }]}
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
        const t = total === 1 ? 0.5 : i / (total - 1);
        const angleDeg = -spread + 2 * spread * t;
        const rad = (angleDeg * Math.PI) / 180;
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
                opacity: v,
                transform: [
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] }) },
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [up + ARC_GAP + LABEL_BLOCK / 2, 0] }) },
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ],
              },
            ]}
          >
            <Pressable
              onPress={() => {
                onAction?.(item);
                close();
              }}
              hitSlop={10}
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
  column: { position: 'absolute', width: COL_W, alignItems: 'center' },
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