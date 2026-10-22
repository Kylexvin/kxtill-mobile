// src/screens/account/ColorPicker.jsx
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/* ── colour maths (same as before) ─────────────────────────── */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h.split('').map((x) => x + x).join('')
      : h,
    16
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
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
  const rr = r / 255, gg = g / 255, bb = b / 255;
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

/* ── Picker ────────────────────────────────────────────────── */

export default function ColorPicker({ value, onChange }) {
  // internal HSV is the source of truth while dragging
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#F04000'));
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  // if the external accent changes from outside, resync (guard against loops)
  useEffect(() => {
    const currentHex = hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v);
    if (currentHex.toLowerCase() !== value.toLowerCase()) {
      setHsv(hexToHsv(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next) => {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  /* ── SV square ─────────────────────────────────────────── */

  const svRef = useRef(null);
  const svSize = useRef({ w: 1, h: 1 });
  const svOrigin = useRef({ x: 0, y: 0 });

  const measureSV = () => {
    const node = svRef.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => {
      svOrigin.current = { x, y };
      svSize.current = { w: w || 1, h: h || 1 };
    });
  };

  const handleSV = (pageX, pageY) => {
    const { x, y } = svOrigin.current;
    const { w, h } = svSize.current;
    const s = clamp((pageX - x) / w, 0, 1);
    const v = clamp(1 - (pageY - y) / h, 0, 1);
    const next = { ...hsvRef.current, s, v };
    commit(next);
  };

  const svPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) =>
        handleSV(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) =>
        handleSV(e.nativeEvent.pageX, e.nativeEvent.pageY),
    })
  ).current;

  /* ── Hue slider ────────────────────────────────────────── */

  const hueRef = useRef(null);
  const hueSize = useRef({ w: 1 });
  const hueOrigin = useRef({ x: 0 });

  const measureHue = () => {
    const node = hueRef.current;
    if (!node) return;
    node.measureInWindow((x, _y, w) => {
      hueOrigin.current = { x };
      hueSize.current = { w: w || 1 };
    });
  };

  const handleHue = (pageX) => {
    const { x } = hueOrigin.current;
    const { w } = hueSize.current;
    const h = clamp((pageX - x) / w, 0, 1) * 360;
    commit({ ...hsvRef.current, h });
  };

  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleHue(e.nativeEvent.pageX),
      onPanResponderMove: (e) => handleHue(e.nativeEvent.pageX),
    })
  ).current;

  /* ── render ────────────────────────────────────────────── */

  // dynamic sizes for the thumbs (read refs after layout)
  const [svW, setSvW] = useState(1);
  const [svH, setSvH] = useState(1);
  const [hueW, setHueW] = useState(1);

  const hueHex = hsvToHex(hsv.h, 1, 1);
  const thumbLeft = hsv.s * svW;
  const thumbTop = (1 - hsv.v) * svH;
  const hueThumbLeft = (hsv.h / 360) * hueW;

  return (
    <View style={s.wrap}>
      {/* SV square */}
      <View
        ref={svRef}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSvW(width || 1);
          setSvH(height || 1);
          svSize.current = { w: width || 1, h: height || 1 };
          // window origin only known after layout
          requestAnimationFrame(measureSV);
        }}
        style={s.svWrap}
        {...svPan.panHandlers}
      >
        {/* base hue */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hueHex }]} />

        {/* white → transparent (saturation) */}
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFFFF', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        {/* transparent → black (value) */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', '#000000']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* thumb */}
        <View
          pointerEvents="none"
          style={[
            s.svThumb,
            { left: thumbLeft - 9, top: thumbTop - 9 },
          ]}
        />
      </View>

      {/* Hue slider */}
      <View
        ref={hueRef}
        onLayout={(e) => {
          const { width } = e.nativeEvent.layout;
          setHueW(width || 1);
          hueSize.current = { w: width || 1 };
          requestAnimationFrame(measureHue);
        }}
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
        <View
          pointerEvents="none"
          style={[s.hueThumb, { left: hueThumbLeft - 11 }]}
        />
      </View>
    </View>
  );
}

/* ── styles ────────────────────────────────────────────────── */

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },

  svWrap: {
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  svThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
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
    height: 14,
    borderRadius: 7,
  },
  hueThumb: {
    position: 'absolute',
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});