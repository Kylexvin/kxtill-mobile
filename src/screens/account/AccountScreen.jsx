// src/screens/account/AccountScreen.jsx
//
// Identity hero (accent-coloured, torn edge), business/branch context,
// APPEARANCE (mode + accent, where theme settings live), access summary,
// legal links, sign out.
//
// v3:
//   - Working HSV colour picker (drag to pick; no manual typing required)
//   - Fixed row layout (icon chip centred with text, truncation-safe)
//   - Hex input kept as a fallback with explicit Apply
//
// v4:
//   - Business row is a selector when the user belongs to 2+ orgs.
//     Tapping opens OrgPickerModal, which calls setActiveOrganization(id).
//     The whole app context re-fetches on switch.
//
// v5:
//   - ColorPicker rewritten for smooth dragging: no setState per frame,
//     thumbs are Animated.Values driven directly from PanResponder, and
//     onChange is throttled (~30 Hz while dragging, flushed on release).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   Pressable,
   StyleSheet,
   ScrollView,
   Animated,
   Easing,
   Alert,
   Platform,
   useWindowDimensions,
   PanResponder,
 } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { ACCENTS } from '../../styles/theme';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { usePermissions } from '../../hooks/usePermissions';
import OrgPickerModal from './OrgPickerModal';

const TOOTH = 16;
const MODES = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];
const HEX = /^#?[0-9a-fA-F]{6}$/;

/* ── colour maths ──────────────────────────────────────────── */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return '#F04000';
  const h = hex.replace('#', '').trim();
  if (h.length === 3)
    return `#${h
      .split('')
      .map((x) => x + x)
      .join('')}`.toUpperCase();
  if (h.length === 6) return `#${h}`.toUpperCase();
  return '#F04000';
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 240, g: 64, b: 0 };
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

/* ── Devices section (unchanged) ───────────────────────────── */

function DevicesSection({ c, styles }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    devices: [],
    pending: [],
  });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { api } = await import('../../services/api');
      const { data } = await api.get('/api/v1/auth/pairing/devices');
      setState({
        loading: false,
        error: null,
        devices: Array.isArray(data.devices) ? data.devices : [],
        pending: Array.isArray(data.pending) ? data.pending : [],
      });
    } catch (e) {
      setState({
        loading: false,
        error:
          e?.response?.data?.message ||
          e?.message ||
          'Could not load devices',
        devices: [],
        pending: [],
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = useCallback(
    async (id) => {
      setBusyId(id);
      try {
        const { api } = await import('../../services/api');
        await api.delete(`/api/v1/auth/pairing/${id}`);
        await load();
      } catch {
        /* silent — the row stays until the next refresh */
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const totalRows = state.devices.length + state.pending.length;

  return (
    <View style={styles.card}>
      {state.loading ? (
        <View style={styles.row}>
          <View style={styles.iconChip}>
            <Ionicons name="phone-portrait-outline" size={16} color={c.link} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Devices</Text>
            <Text style={styles.rowValue}>Loading…</Text>
          </View>
        </View>
      ) : state.error ? (
        <View style={styles.row}>
          <View style={styles.iconChip}>
            <Ionicons name="alert-circle-outline" size={16} color={c.danger} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Devices</Text>
            <Text style={styles.rowSub}>{state.error}</Text>
          </View>
          <Pressable onPress={load} hitSlop={8}>
            <Text style={styles.rowActionText}>Retry</Text>
          </Pressable>
        </View>
      ) : totalRows === 0 ? (
        <View style={styles.row}>
          <View style={styles.iconChip}>
            <Ionicons name="phone-portrait-outline" size={16} color={c.link} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Devices</Text>
            <Text style={styles.rowValue}>No paired devices</Text>
            <Text style={styles.rowSub}>Scan a QR from the POS to connect one.</Text>
          </View>
        </View>
      ) : (
        <>
          {state.devices.map((d, i) => (
            <View key={d.id}>
              {i > 0 || state.pending.length > 0 ? <Divider styles={styles} /> : null}
              <View style={styles.row}>
                <View style={styles.iconChip}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={16}
                    color={c.primary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Paired</Text>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {d.label}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {d.organization?.name || '—'}
                    {d.branch?.name ? ` · ${d.branch.name}` : ''}
                    {d.pairedAt
                      ? ` · ${new Date(d.pairedAt).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => revoke(d.id)}
                  disabled={busyId === d.id}
                  hitSlop={8}
                  style={{ opacity: busyId === d.id ? 0.5 : 1 }}
                >
                  <Text style={[styles.rowActionText, { color: c.danger }]}>
                    {busyId === d.id ? '…' : 'Unpair'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}

          {state.pending.map((p, i) => (
            <View key={p.id}>
              <Divider styles={styles} />
              <View style={styles.row}>
                <View style={styles.iconChip}>
                  <Ionicons name="qr-code-outline" size={16} color={c.warning} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Pending</Text>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {p.label}
                  </Text>
                  <Text style={styles.rowSub}>
                    Expires {new Date(p.expiresAt).toLocaleTimeString()}
                  </Text>
                </View>
                <Pressable
                  onPress={() => revoke(p.id)}
                  disabled={busyId === p.id}
                  hitSlop={8}
                  style={{ opacity: busyId === p.id ? 0.5 : 1 }}
                >
                  <Text style={[styles.rowActionText, { color: c.danger }]}>
                    {busyId === p.id ? '…' : 'Cancel'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

/* ── Screen ────────────────────────────────────────────────── */

export default function AccountScreen() {
  const { theme: c, mode, setMode, accent, setAccent } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const {
    activeOrganization,
    activeBranch,
    organizations,
    setActiveOrganization,
  } = useOrganizationContext();
  const { isOwner, permissions } = usePermissions();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState('');
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase())
      .join('') ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';
  const permCount = permissions.filter((p) => p !== '*').length;

  const presetValues = Object.values(ACCENTS);
  const isPreset = presetValues.some(
    (v) => v.toLowerCase() === accent.toLowerCase()
  );

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  const open = (url) => WebBrowser.openBrowserAsync(url).catch(() => {});

  const onCommitHex = () => {
    const raw = hexDraft.trim();
    if (HEX.test(raw)) {
      setAccent(raw.startsWith('#') ? raw : `#${raw}`);
    }
    setHexDraft('');
  };

  const canSwitchOrg = (organizations?.length || 0) > 1;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* paints the hero colour behind iOS overscroll */}
        <View pointerEvents="none" style={styles.overscroll} />

        {/* ── Hero ─────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View pointerEvents="none" style={styles.orbA} />
          <View pointerEvents="none" style={styles.orbB} />

          <View style={styles.heroTop}>
            <Text style={styles.kicker}>ACCOUNT</Text>
            {isOwner ? (
              <View style={styles.ownerPill}>
                <Ionicons
                  name="shield-checkmark"
                  size={12}
                  color={c.textOnPrimary}
                />
                <Text style={styles.ownerPillText}>Owner</Text>
              </View>
            ) : null}
          </View>

          {/* identity: avatar BESIDE the text block */}
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName || user?.email || 'Signed in'}
              </Text>
              {fullName ? (
                <Text style={styles.email} numberOfLines={1}>
                  {user?.email}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Ionicons
                name="business-outline"
                size={13}
                color={c.textOnPrimary}
              />
              <Text style={styles.chipText} numberOfLines={1}>
                {activeOrganization?.name || 'No business'}
              </Text>
            </View>
            {activeBranch?.name ? (
              <View style={styles.chip}>
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={c.textOnPrimary}
                />
                <Text style={styles.chipText} numberOfLines={1}>
                  {activeBranch.name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <TornEdge color={c.background} />

        {/* ── Body ─────────────────────────────────── */}
        <Animated.View
          style={[
            styles.body,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Appearance: theme settings */}
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mode</Text>
            <View style={styles.segment}>
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMode(m.key)}
                    style={[styles.segItem, active && styles.segItemActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={m.icon}
                      size={16}
                      color={active ? c.textOnPrimary : c.textSecondary}
                    />
                    <Text
                      style={[styles.segText, active && styles.segTextActive]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rule} />

            <View style={styles.swatchHeader}>
              <Text style={[styles.cardTitle, styles.cardTitleNoMargin]}>
                Accent colour
              </Text>
              <View style={styles.swatchValue}>
                <View
                  style={[styles.swatchMini, { backgroundColor: accent }]}
                />
                <Text style={styles.swatchValueText}>
                  {accent.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.swatchRow}>
              {Object.entries(ACCENTS).map(([name, hex]) => {
                const active = accent.toLowerCase() === hex.toLowerCase();
                const tickColor = ['#FFB000'].includes(hex)
                  ? '#14110F'
                  : '#FFFFFF';
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      setAccent(hex);
                      setPickerOpen(false);
                    }}
                    style={[
                      styles.swatchRing,
                      active && { borderColor: c.textPrimary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.swatch, { backgroundColor: hex }]}>
                      {active ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={tickColor}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

              {/* custom chip */}
              <Pressable
                onPress={() => setPickerOpen((v) => !v)}
                style={[
                  styles.swatchRing,
                  (pickerOpen || !isPreset) && { borderColor: c.textPrimary },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Custom colour"
                accessibilityState={{ expanded: pickerOpen }}
              >
                <View
                  style={[
                    styles.swatch,
                    styles.swatchCustom,
                    !isPreset && { backgroundColor: accent, borderWidth: 0 },
                  ]}
                >
                  <Ionicons
                    name={isPreset ? 'add' : 'checkmark'}
                    size={18}
                    color={isPreset ? c.textSecondary : c.textOnPrimary}
                  />
                </View>
              </Pressable>
            </View>

            {pickerOpen ? (
              <ColorPicker c={c} value={accent} onChange={setAccent} />
            ) : null}
          </View>

          {/* Context */}
          <Text style={styles.sectionLabel}>CURRENT CONTEXT</Text>
          <View style={styles.card}>
            <Row
              c={c}
              styles={styles}
              icon="business-outline"
              label="Business"
              value={activeOrganization?.name || '—'}
              sub={
                canSwitchOrg
                  ? `${organizations.length} businesses · tap to switch`
                  : null
              }
              onPress={
                canSwitchOrg ? () => setOrgPickerOpen(true) : undefined
              }
              actionLabel={canSwitchOrg ? 'Switch' : null}
            />
            <Divider styles={styles} />
            <Row
              c={c}
              styles={styles}
              icon="location-outline"
              label="Branch"
              value={activeBranch?.name || '—'}
              sub={activeBranch?.address || null}
            />
            <Divider styles={styles} />
            {/* <Row ... devices block commented out as before ... /> */}
          </View>

          {/* Access */}
          <Text style={styles.sectionLabel}>ACCESS</Text>
          <View style={styles.card}>
            <Row
              c={c}
              styles={styles}
              icon={isOwner ? 'shield-checkmark-outline' : 'key-outline'}
              label="Role"
              value={isOwner ? 'Owner' : 'Member'}
            />
            <Divider styles={styles} />
            <Row
              c={c}
              styles={styles}
              icon="lock-open-outline"
              label="Permissions"
              value={isOwner ? 'Full access' : `${permCount} permissions`}
            />
            {isOwner ? (
              <>
                <Divider styles={styles} />
                <Row
                  c={c}
                  styles={styles}
                  icon="settings-outline"
                  label="KxTill"
                  value="Product settings"
                  onPress={() => navigation.navigate(ROUTES.KXTILL_SETTINGS)}
                />
              </>
            ) : null}
          </View>

          {/* About */}
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <Row
              c={c}
              styles={styles}
              icon="document-text-outline"
              label="Legal"
              value="Terms of service"
              onPress={() => open('https://kxbyte.co.ke/terms-of-service')}
            />
            <Divider styles={styles} />
            <Row
              c={c}
              styles={styles}
              icon="shield-outline"
              label="Legal"
              value="Privacy policy"
              onPress={() => open('https://kxbyte.co.ke/privacy-policy')}
            />
          </View>

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={confirmSignOut}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={18} color={c.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>KxTill Mobile · by KXBYTE</Text>
        </Animated.View>
      </ScrollView>

      <OrgPickerModal
        visible={orgPickerOpen}
        organizations={organizations}
        currentOrgId={activeOrganization?.id || null}
        onPick={(id) => setActiveOrganization(id)}
        onClose={() => setOrgPickerOpen(false)}
      />
    </View>
  );
}

/* ── Colour picker (v5, performance rewrite) ───────────────── */

const CP_SV_HEIGHT = 170;
const CP_THUMB = 20;
const CP_THUMB_R = CP_THUMB / 2;
const CP_HUE_TRACK_H = 14;
const CP_HUE_THUMB = 22;
const CP_HUE_THUMB_R = CP_HUE_THUMB / 2;

function ColorPicker({ c, value, onChange }) {
  const initial = useMemo(() => hexToHsv(normalizeHex(value)), []);

  // HSV truth lives in a ref — no React re-render during a drag.
  const hsvRef = useRef(initial);

  // Animated values that drive the thumbs.
  const svX = useRef(new Animated.Value(0)).current;
  const svY = useRef(new Animated.Value(0)).current;
  const hueX = useRef(new Animated.Value(0)).current;

  // Measured sizes.
  const svDims = useRef({ w: 0, h: CP_SV_HEIGHT });
  const hueDims = useRef({ w: 0 });

  // The hue gradient background — only state that must re-render.
  const [hueHex, setHueHex] = useState(() => hsvToHex(initial.h, 1, 1));

  const draggingRef = useRef(false);

  /* Throttled emit so the parent at most re-renders ~30 Hz during drag. */
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

  /* Sync thumbs from hsvRef → Animated values. */
  const syncThumbs = useCallback(
    (animated = false) => {
      const { h, s, v } = hsvRef.current;
      const { w: svW, h: svH } = svDims.current;
      const { w: hueW } = hueDims.current;
      const x = s * svW;
      const y = (1 - v) * svH;
      const hx = (h / 360) * hueW;

      if (animated) {
        Animated.timing(svX, {
          toValue: x,
          duration: 120,
          useNativeDriver: false,
        }).start();
        Animated.timing(svY, {
          toValue: y,
          duration: 120,
          useNativeDriver: false,
        }).start();
        Animated.timing(hueX, {
          toValue: hx,
          duration: 120,
          useNativeDriver: false,
        }).start();
      } else {
        svX.setValue(x);
        svY.setValue(y);
        hueX.setValue(hx);
      }
    },
    [svX, svY, hueX]
  );

  /* External value sync — never clobber an in-progress drag. */
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

  /* SV pan */
  const svOriginRef = useRef({ x: 0, y: 0 });
  const svNodeRef = useRef(null);

  const handleSV = useCallback(
    (pageX, pageY, originX, originY) => {
      const { w, h } = svDims.current;
      if (!w || !h) return;
      const s = clamp((pageX - originX) / w, 0, 1);
      const v = clamp(1 - (pageY - originY) / h, 0, 1);
      hsvRef.current = { ...hsvRef.current, s, v };

      svX.setValue(s * w);
      svY.setValue((1 - v) * h);

      scheduleEmit(hsvToHex(hsvRef.current.h, s, v));
    },
    [scheduleEmit, svX, svY]
  );

  const svPan = useRef(
    createPanResponder({
      onGrant: (pageX, pageY) => {
        draggingRef.current = true;
        svNodeRef.current?.measureInWindow((x, y) => {
          svOriginRef.current = { x, y };
          handleSV(pageX, pageY, x, y);
        });
      },
      onMove: (pageX, pageY) => {
        handleSV(pageX, pageY, svOriginRef.current.x, svOriginRef.current.y);
      },
      onRelease: () => {
        draggingRef.current = false;
        flushEmit();
      },
    })
  ).current;

  /* Hue pan */
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
    createPanResponder({
      onGrant: (pageX) => {
        draggingRef.current = true;
        hueNodeRef.current?.measureInWindow((x) => {
          hueOriginRef.current = { x };
          handleHue(pageX, x);
        });
      },
      onMove: (pageX) => {
        handleHue(pageX, hueOriginRef.current.x);
      },
      onRelease: () => {
        draggingRef.current = false;
        flushEmit();
      },
    })
  ).current;

  /* Layout */
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

  const svThumbLeft = Animated.subtract(svX, CP_THUMB_R);
  const svThumbTop = Animated.subtract(svY, CP_THUMB_R);
  const hueThumbLeft = Animated.subtract(hueX, CP_HUE_THUMB_R);

  return (
    <View style={pickerStyles.wrap}>
      {/* SV square */}
      <View
        ref={svNodeRef}
        onLayout={onSVLayout}
        style={[pickerStyles.svWrap, { borderColor: c.border }]}
        {...svPan.panHandlers}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: hueHex }]}
        />
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
            pickerStyles.svThumb,
            { left: svThumbLeft, top: svThumbTop },
          ]}
        />
      </View>

      {/* Hue slider */}
      <View
        ref={hueNodeRef}
        onLayout={onHueLayout}
        style={pickerStyles.hueWrap}
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
          style={pickerStyles.hueTrack}
        />
        <Animated.View
          pointerEvents="none"
          style={[pickerStyles.hueThumb, { left: hueThumbLeft }]}
        />
      </View>
    </View>
  );
}

/* Small helper so both gestures share the same shape. */
function createPanResponder({ onGrant, onMove, onRelease }) {
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) =>
      onGrant(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPanResponderMove: (e) =>
      onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPanResponderRelease: () => onRelease?.(),
    onPanResponderTerminate: () => onRelease?.(),
  });
}

const pickerStyles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 14 },
  svWrap: {
    height: CP_SV_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
  },
  svThumb: {
    position: 'absolute',
    width: CP_THUMB,
    height: CP_THUMB,
    borderRadius: CP_THUMB_R,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  hueWrap: { height: 30, justifyContent: 'center' },
  hueTrack: { height: CP_HUE_TRACK_H, borderRadius: CP_HUE_TRACK_H / 2 },
  hueThumb: {
    position: 'absolute',
    top: (30 - CP_HUE_THUMB) / 2,
    width: CP_HUE_THUMB,
    height: CP_HUE_THUMB,
    borderRadius: CP_HUE_THUMB_R,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});

/* ── Pieces ────────────────────────────────────────────────── */

function TornEdge({ color }) {
  const { width } = useWindowDimensions();
  const count = Math.ceil(width / TOOTH) + 1;
  return (
    <View style={tornStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[tornStyles.tooth, { borderBottomColor: color }]}
        />
      ))}
    </View>
  );
}

const tornStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: -10,
  },
  tooth: {
    width: 0,
    height: 0,
    borderLeftWidth: TOOTH / 2,
    borderRightWidth: TOOTH / 2,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

function Row({ c, styles, icon, label, value, sub, onPress, actionLabel }) {
  const body = (
    <>
      <View style={styles.iconChip}>
        <Ionicons name={icon} size={16} color={c.link} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {onPress ? (
        <View style={styles.rowAction}>
          {actionLabel ? (
            <Text style={styles.rowActionText}>{actionLabel}</Text>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

function Divider({ styles }) {
  return <View style={styles.divider} />;
}

/* ── Styles ────────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 48 },
    overscroll: {
      position: 'absolute',
      top: -800,
      left: 0,
      right: 0,
      height: 800,
      backgroundColor: c.hero,
    },
    sectionLabelInline: {
      paddingTop: 12,
      paddingBottom: 4,
      paddingHorizontal: 4,
    },
    sectionLabelInlineText: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    hero: {
      backgroundColor: c.hero,
      paddingHorizontal: 22,
      paddingBottom: 30,
      overflow: 'hidden',
    },
    orbA: {
      position: 'absolute',
      top: -120,
      right: -90,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: c.heroOrbA,
      opacity: 0.55,
    },
    orbB: {
      position: 'absolute',
      bottom: -110,
      left: -110,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: c.heroOrbB,
      opacity: 0.6,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 22,
    },
    kicker: {
      color: c.onPrimaryMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.8,
    },
    ownerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.onPrimaryBorder,
    },
    ownerPillText: {
      color: c.textOnPrimary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.3,
    },

    identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: c.textOnPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: c.hero,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    identityText: { flex: 1, minWidth: 0 },
    name: {
      color: c.textOnPrimary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    email: { color: c.onPrimaryMuted, fontSize: 14, marginTop: 3 },

    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 20,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.onPrimaryBorder,
    },
    chipText: {
      color: c.textOnPrimary,
      fontSize: 13,
      fontWeight: '700',
      flexShrink: 1,
    },

    body: { paddingHorizontal: 20, paddingTop: 6 },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
      marginTop: 20,
      marginBottom: 8,
    },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    cardTitle: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 10,
      marginBottom: 10,
    },
    cardTitleNoMargin: { marginTop: 0, marginBottom: 0 },
    rule: {
      height: 1,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
      borderRadius: 1,
      marginTop: 16,
    },

    segment: {
      flexDirection: 'row',
      backgroundColor: c.surfaceElevated,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    segItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    segItemActive: { backgroundColor: c.primary },
    segText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    segTextActive: { color: c.textOnPrimary },

    swatchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 12,
    },
    swatchValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatchMini: {
      width: 14,
      height: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    swatchValueText: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    swatchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingBottom: 12,
    },
    swatchRing: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatch: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchCustom: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
    },

    hexRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
      borderBottomWidth: 2,
    },
    hash: { fontSize: 17, fontWeight: '700' },
    hexInput: {
      flex: 1,
      fontSize: 17,
      letterSpacing: 1.5,
      paddingVertical: 10,
    },
    hexApply: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      paddingVertical: 12,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    rowValue: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    rowAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
    },
    rowActionText: { color: c.link, fontSize: 13, fontWeight: '700' },
    divider: { height: 1, marginLeft: 50, backgroundColor: c.border },

    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.dangerSoft,
      borderRadius: 16,
      minHeight: 54,
      marginTop: 28,
    },
    signOutText: { color: c.danger, fontSize: 16, fontWeight: '800' },
    footer: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 22,
    },
  });