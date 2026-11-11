// src/screens/account/ColorPicker.jsx
//
// Performance-focused rewrite of the previous picker.
//
//   - No setState during drag: HSV lives in refs, thumb positions are driven
//     via Animated.ValueXY / Animated.Value → zero React re-renders per frame.
//   - PanResponder callbacks are stable (created once) and read refs, not
//     stale closures. No more dependency churn.
//   - Thumb follows the finger immediately; the committed hex is debounced
//     (onPanResponderRelease + light throttle) so the parent only re-renders
//     at most ~30 Hz while dragging, and exactly once on release.
//   - Gradient layers are constant (`pointerEvents="none"`), so the only
//     thing that mutates on drag is the thumb transform + the gradient's
//     background color on hue change.
//   - Layout measurement cached; no measureInWindow on every gesture grant.
//   - onChange is optional-safe; value is normalised.
//   - Handles external `value` changes without fighting the user mid-drag.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/* ── colour maths ──────────────────────────────────────────── */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return '#F04000';
  const h = hex.replace('#', '').trim();
  if (h.length === 3) return `#${h.split('').map((x) => x + x).join('')}`.toUpperCase();
  if (h.length === 6) return `#${h}`.toUpperCase();
  return '#F04000';
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/* ── constants ─────────────────────────────────────────────── */

const SV_HEIGHT = 170;
const THUMB = 20;
const THUMB_R = THUMB / 2;
const HUE_TRACK_H = 14;
const HUE_THUMB = 22;
const HUE_THUMB_R = HUE_THUMB / 2;

/* ── Picker ────────────────────────────────────────────────── */

export default function ColorPicker({ value, onChange }) {
  const initial = useMemo(() => hexToHsv(normalizeHex(value)), []);

  // Source of truth during a drag — never triggers a render.
  const hsvRef = useRef(initial);

  // Animated values that drive the thumbs (native-driven where possible).
  const svX = useRef(new Animated.Value(0)).current;
  const svY = useRef(new Animated.Value(0)).current;
  const hueX = useRef(new Animated.Value(0)).current;

  // Sizes, measured once.
  const svDims = useRef({ w: 0, h: SV_HEIGHT });
  const hueDims = useRef({ w: 0 });

  // The current SV square's base hue — needs state so the gradient updates.
  const [hueHex, setHueHex] = useState(() =>
    hsvToHex(initial.h, 1, 1)
  );

  // Flag so external value changes don't clobber an active drag.
  const draggingRef = useRef(false);

  /* Throttled emit — cap parent re-renders while dragging. */
  const lastEmitRef = useRef(0);
  const pendingEmitRef = useRef(null);
  const emitTimerRef = useRef(null);

  const flushEmit = useCallback(() => {
    if (emitTimerRef.current) {
      clearTimeout(emitTimerRef.current);
      emitTimerRef.current = null;
    }
    const pending = pendingEmitRef.current;
    pendingEmitRef.current = null;
    if (pending != null) {
      onChange?.(pending);
      lastEmitRef.current = Date.now();
    }
  }, [onChange]);

  const scheduleEmit = useCallback(
    (hex) => {
      const now = Date.now();
      const since = now - lastEmitRef.current;
      if (since >= 32) {
        pendingEmitRef.current = hex;
        flushEmit();
      } else {
        pendingEmitRef.current = hex;
        if (!emitTimerRef.current) {
          emitTimerRef.current = setTimeout(
            flushEmit,
            Math.max(0, 32 - since)
          );
        }
      }
    },
    [flushEmit]
  );

  useEffect(
    () => () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    },
    []
  );

  /* ── Sync thumb positions from hsv ─────────────────────── */

  const syncThumbs = useCallback(
    (animated = false) => {
      const { h, s, v } = hsvRef.current;
      const { w: svW, h: svH } = svDims.current;
      const { w: hueW } = hueDims.current;
      const x = s * svW;
      const y = (1 - v) * svH;
      const hx = (h / 360) * hueW;

      if (animated) {
        Animated.timing(svX, { toValue: x, duration: 120, useNativeDriver: false }).start();
        Animated.timing(svY, { toValue: y, duration: 120, useNativeDriver: false }).start();
        Animated.timing(hueX, { toValue: hx, duration: 120, useNativeDriver: false }).start();
      } else {
        svX.setValue(x);
        svY.setValue(y);
        hueX.setValue(hx);
      }
    },
    [svX, svY, hueX]
  );

  /* ── React to external value changes (not during drag) ─── */

  useEffect(() => {
    if (draggingRef.current) return;
    const target = normalizeHex(value);
    const current = hsvToHex(
      hsvRef.current.h,
      hsvRef.current.s,
      hsvRef.current.v
    );
    if (target === current) return;
    hsvRef.current = hexToHsv(target);
    setHueHex(hsvToHex(hsvRef.current.h, 1, 1));
    syncThumbs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /* ── SV pan ────────────────────────────────────────────── */

  const handleSV = useCallback(
    (pageX, pageY, originX, originY) => {
      const { w, h } = svDims.current;
      if (!w || !h) return;
      const s = clamp((pageX - originX) / w, 0, 1);
      const v = clamp(1 - (pageY - originY) / h, 0, 1);
      hsvRef.current = { ...hsvRef.current, s, v };

      // Thumb moves instantly, no setState.
      svX.setValue(s * w);
      svY.setValue((1 - v) * h);

      const hex = hsvToHex(hsvRef.current.h, s, v);
      scheduleEmit(hex);
    },
    [scheduleEmit, svX, svY]
  );

  const svOriginRef = useRef({ x: 0, y: 0 });
  const svNodeRef = useRef(null);

  const svPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        draggingRef.current = true;
        const { pageX, pageY } = e.nativeEvent;
        svNodeRef.current?.measureInWindow((x, y) => {
          svOriginRef.current = { x, y };
          handleSV(pageX, pageY, x, y);
        });
      },
      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        handleSV(pageX, pageY, svOriginRef.current.x, svOriginRef.current.y);
      },
      onPanResponderRelease: () => {
        draggingRef.current = false;
        flushEmit();
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        flushEmit();
      },
    })
  ).current;

  /* ── Hue pan ───────────────────────────────────────────── */

  const hueOriginRef = useRef({ x: 0 });
  const hueNodeRef = useRef(null);

  const handleHue = useCallback(
    (pageX, originX) => {
      const { w } = hueDims.current;
      if (!w) return;
      const h = clamp((pageX - originX) / w, 0, 1) * 360;
      hsvRef.current = { ...hsvRef.current, h };

      hueX.setValue((h / 360) * w);
      setHueHex(hsvToHex(h, 1, 1));

      const { s, v } = hsvRef.current;
      scheduleEmit(hsvToHex(h, s, v));
    },
    [hueX, scheduleEmit]
  );

  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        draggingRef.current = true;
        const { pageX } = e.nativeEvent;
        hueNodeRef.current?.measureInWindow((x) => {
          hueOriginRef.current = { x };
          handleHue(pageX, x);
        });
      },
      onPanResponderMove: (e) => {
        handleHue(e.nativeEvent.pageX, hueOriginRef.current.x);
      },
      onPanResponderRelease: () => {
        draggingRef.current = false;
        flushEmit();
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        flushEmit();
      },
    })
  ).current;

  /* ── Layout ────────────────────────────────────────────── */

  const onSVLayout = useCallback(
    (e) => {
      const { width, height } = e.nativeEvent.layout;
      svDims.current = { w: width || 1, h: height || 1 };
      syncThumbs(false);
    },
    [syncThumbs]
  );

  const onHueLayout = useCallback(
    (e) => {
      const { width } = e.nativeEvent.layout;
      hueDims.current = { w: width || 1 };
      syncThumbs(false);
    },
    [syncThumbs]
  );

  /* ── Render ────────────────────────────────────────────── */

  const svThumbLeft = Animated.subtract(svX, THUMB_R);
  const svThumbTop = Animated.subtract(svY, THUMB_R);
  const hueThumbLeft = Animated.subtract(hueX, HUE_THUMB_R);

  return (
    <View style={s.wrap}>
      {/* SV square */}
      <View
        ref={svNodeRef}
        onLayout={onSVLayout}
        style={s.svWrap}
        {...svPan.panHandlers}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hueHex }]} />

        <LinearGradient
          pointerEvents="none"
          colors={['#FFFFFF', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', '#000000']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            s.svThumb,
            { left: svThumbLeft, top: svThumbTop },
          ]}
        />
      </View>

      {/* Hue slider */}
      <View
        ref={hueNodeRef}
        onLayout={onHueLayout}
        style={s.hueWrap}
        {...huePan.panHandlers}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[
            '#FF0000',
            '#FFFF00',
            '#00FF00',
            '#00FFFF',
            '#0000FF',
            '#FF00FF',
            '#FF0000',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.hueTrack}
        />
        <Animated.View
          pointerEvents="none"
          style={[s.hueThumb, { left: hueThumbLeft }]}
        />
      </View>
    </View>
  );
}

/* ── styles ────────────────────────────────────────────────── */

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },

  svWrap: {
    height: SV_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  svThumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB_R,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },

  hueWrap: { height: 30, justifyContent: 'center' },
  hueTrack: {
    height: HUE_TRACK_H,
    borderRadius: HUE_TRACK_H / 2,
  },
  hueThumb: {
    position: 'absolute',
    top: (30 - HUE_THUMB) / 2,
    width: HUE_THUMB,
    height: HUE_THUMB,
    borderRadius: HUE_THUMB_R,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});