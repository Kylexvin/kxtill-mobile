// src/navigation/ActionsArc.jsx
//
// The pop-up action arc. Lives in an overlay ABOVE the tab navigator so it
// is never clipped. Five universal actions, always visible — no vertical
// gating, no shift gating. The fan is designed for five; four looks
// unbalanced, so every org gets all five regardless of product instances.
//
// Each action's destination is wired in MainTabNavigator's handleArcAction.
// The arc itself does not navigate — it only calls onAction(item).

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

export const BAR_ROW = 60;
export const PLUS_LIFT = 10;
export const useBottomInset = () => Math.max(useSafeAreaInsets().bottom, 8);

export const ARC_ITEMS = [

  {
    id: 'share-receipt',
    label: 'Share receipt',
    short: 'Receipt',
    icon: 'share-social-outline',
  },
  {
    id: 'add-product',
    label: 'Add product',
    short: 'Product',
    icon: 'add-circle-outline',
  },
    {
    id: 'pos',
    label: 'POS',
    short: 'POS',
    icon: 'cart-outline',
  },
  {
    id: 'barcode-tool',
    label: 'Barcode tool',
    short: 'Barcode',
    icon: 'barcode-outline',
  },
  {
    id: 'team',
    label: 'Team',
    short: 'Team',
    icon: 'people-outline',
  },
];

const RADIUS = 118;
const SIZE = 46;
const ARC_GAP = 35;
const LABEL_BLOCK = 25;
const COL_W = 66;

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

export function ActionsArcOverlay() {
  const { theme: c } = useTheme();
  const { open, close, progress, onAction } = useActionsArc();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomInset();
  const barHeight = BAR_ROW + bottomInset;

  // Five-item fan. Fixed count, but the ref array is still sized by
  // ARC_ITEMS.length so that adding a sixth later does not break.
  const vals = useRef(null);
  if (!vals.current || vals.current.length !== ARC_ITEMS.length) {
    vals.current = ARC_ITEMS.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    if (!vals.current) return;
    if (open) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.stagger(
          45,
          vals.current.map((v) =>
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
        Animated.timing(progress, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        ...vals.current.map((v) =>
          Animated.timing(v, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          })
        ),
      ]).start();
    }
  }, [open, progress]);

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

  const total = ARC_ITEMS.length; // 5
  const spread = 64;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'box-none' : 'none'}
    >
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
        const t = total === 1 ? 0.5 : i / (total - 1);
        const angleDeg = -spread + 2 * spread * t;
        const rad = (angleDeg * Math.PI) / 180;
        const dx = Math.sin(rad) * RADIUS;
        const up = Math.cos(rad) * RADIUS;
        const v = vals.current[i];

        return (
          <Animated.View
            key={item.id}
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.column,
              {
                left: cx + dx - COL_W / 2,
                bottom: originFromBottom + up - SIZE / 2 - LABEL_BLOCK,
                opacity: v.interpolate({
                  inputRange: [0, 0.6, 1],
                  outputRange: [0, 1, 1],
                }),
                transform: [
                  {
                    translateX: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-dx, 0],
                    }),
                  },
                  {
                    translateY: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [up + ARC_GAP + LABEL_BLOCK / 2, 0],
                    }),
                  },
                  {
                    scale: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
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
              <Text
                style={[styles.label, { color: c.textPrimary }]}
                numberOfLines={1}
              >
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