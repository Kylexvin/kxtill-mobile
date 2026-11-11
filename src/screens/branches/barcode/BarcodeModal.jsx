// src/screens/branches/barcode/BarcodeModal.jsx
//
// Per-product barcode modal. Shows every unit, its barcode state, and an
// action (View if set, Generate if null and user has kxtill.inventory.update).
// No regenerate, no clear — backend supports neither.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import bwipjs from '@bwip-js/react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { useOrganizationContext } from '../../../context/OrganizationContext';
import { usePermissions } from '../../../hooks/usePermissions';
import inventoryService from '../../../services/inventory.service';

/* ── Barcode image render (JS → PNG data URL) ── */
function BarcodeImage({ value }) {
  const [uri, setUri] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);
    if (!value) return;
    bwipjs
      .toDataURL({ bcid: 'code128', text: String(value), scale: 3, height: 12 })
      .then((r) => {
        if (!cancelled) setUri(r.uri);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <Text style={{ color: '#B91C1C', fontSize: 12 }}>Could not render</Text>
    );
  }
  if (!uri) {
    return <ActivityIndicator color="#0F766E" />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: 280, height: 72 }}
      resizeMode="contain"
    />
  );
}

export default function BarcodeModal({
  visible,
  product,
  onClose,
  onUpdated,
}) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization } = useOrganizationContext();
  const { can } = usePermissions();

  const canGenerate = can('kxtill.inventory.update');

  const [generatingUnitId, setGeneratingUnitId] = useState(null);
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) {
      setGeneratingUnitId(null);
      setExpandedUnitId(null);
      setError(null);
    }
  }, [visible]);

  const generate = useCallback(
    async (unit) => {
      if (!product || !activeOrganization?.id || generatingUnitId) return;
      setError(null);
      setGeneratingUnitId(unit.id);
      try {
        const data = await inventoryService.generateBarcode(
          activeOrganization.id,
          product.id,
          unit.id
        );
        const updated = data?.unit;
        if (updated) {
          onUpdated?.(updated);
          setExpandedUnitId(updated.id);
        }
      } catch (e) {
        setError(
          e?.response?.data?.message ||
            e?.message ||
            'Could not generate barcode'
        );
      } finally {
        setGeneratingUnitId(null);
      }
    },
    [product, activeOrganization?.id, generatingUnitId, onUpdated]
  );

  if (!visible || !product) return null;

  const units = product.units || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {product.sku || 'no SKU'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={c.textPrimary} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={14} color={c.danger} />
              <Text style={styles.errText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          ) : null}

          {units.length === 0 ? (
            <Text style={styles.emptyText}>
              This product has no units yet.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              {units.map((u, i) => {
                const has = !!u.barcode;
                const expanded = expandedUnitId === u.id;
                const busy = generatingUnitId === u.id;
                const isBase = product.baseUnitId === u.id;
                const conversion = Number(u.conversionQty) || 1;
                return (
                  <View key={u.id} style={[styles.unitBlock, i > 0 && styles.unitDivider]}>
                    <View style={styles.unitRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.unitTitleRow}>
                          <Text style={styles.unitName} numberOfLines={1}>
                            {u.name}
                          </Text>
                          {isBase ? (
                            <View style={styles.basePill}>
                              <Text style={styles.basePillText}>BASE</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.unitMeta} numberOfLines={1}>
                          {u.abbreviation || 'u'}
                          {conversion !== 1 ? ` · ×${conversion}` : ''}
                          {has ? ` · ${u.barcode}` : ' · no barcode'}
                        </Text>
                      </View>

                      {has ? (
                        <Pressable
                          onPress={() =>
                            setExpandedUnitId(expanded ? null : u.id)
                          }
                          style={styles.actionBtn}
                          hitSlop={6}
                        >
                          <Text style={styles.actionText}>
                            {expanded ? 'Hide' : 'View'}
                          </Text>
                        </Pressable>
                      ) : canGenerate ? (
                        <Pressable
                          onPress={() => generate(u)}
                          disabled={busy}
                          style={[styles.actionBtn, busy && { opacity: 0.6 }]}
                          hitSlop={6}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={c.primary} />
                          ) : (
                            <Text style={styles.actionText}>Generate</Text>
                          )}
                        </Pressable>
                      ) : null}
                    </View>

                    {expanded && has ? (
                      <View style={styles.barcodeBox}>
                        <BarcodeImage value={u.barcode} />
                        <Text style={styles.barcodeNumber}>{u.barcode}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    title: { ...typography.h3, color: c.textPrimary },
    subtitle: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    errBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.dangerSoft,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    errText: { flex: 1, color: c.danger, fontSize: 12, fontWeight: '600' },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      paddingVertical: spacing.lg,
      textAlign: 'center',
    },

    unitBlock: { paddingVertical: spacing.sm },
    unitDivider: { borderTopWidth: 1, borderTopColor: c.border },
    unitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    unitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    unitName: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 15 },
    unitMeta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    basePill: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: c.primarySoft,
    },
    basePillText: {
      color: c.primary,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, minWidth: 72, alignItems: 'flex-end' },
    actionText: { color: c.primary, fontSize: 13, fontWeight: '800' },

    barcodeBox: {
      marginTop: spacing.sm,
      backgroundColor: '#FFF',
      borderRadius: 10,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    barcodeNumber: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginTop: 6,
      marginBottom: 4,
    },
  });