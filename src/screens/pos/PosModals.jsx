// src/screens/pos/PosModals.jsx
//
// Modal components for the POS screen. Presentational only.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { PAYMENT_METHODS, needsReference } from './usePos';

/* ── Customer modal ─────────────────────────────────────────── */

export function PosCustomerModal({
  visible,
  onClose,
  orgId,
  selected,
  onSelect,
  c,
  styles,
}) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !orgId) return undefined;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { api } = await import('../../services/api');
        const res = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/customers`,
          { params: { search: q.trim() || undefined, limit: 20 } }
        );
        const items = res.data?.items || res.data?.customers || [];
        setList(items);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [visible, q, orgId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Customer</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={c.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search by name or phone"
              placeholderTextColor={c.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          <Pressable onPress={() => onSelect(null)} style={styles.walkinRow}>
            <Ionicons name="person-add-outline" size={18} color={c.link} />
            <Text style={styles.walkinText}>Use Walk-in</Text>
          </Pressable>
          {loading ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No customers found</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect({ id: item.id, name: item.name })}
                  style={styles.resultRow}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.phone ? (
                      <Text style={styles.resultMeta}>{item.phone}</Text>
                    ) : null}
                  </View>
                  {selected?.id === item.id ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={c.primary}
                    />
                  ) : null}
                </Pressable>
              )}
            />
          )}
          <Pressable onPress={onClose} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ── Payment modal ──────────────────────────────────────────── */

export function PosPaymentModal({
  visible,
  submitting,
  subtotal,
  customer,
  method,
  setMethod,
  reference,
  setReference,
  onClose,
  onConfirm,
  formatCurrency,
  c,
  styles,
}) {
  const creditAllowed = !!customer;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !submitting && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.sheetBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => !submitting && onClose()}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Take payment</Text>
          <Text style={styles.sheetTotal}>{formatCurrency(subtotal)}</Text>

          <Text style={styles.sheetKicker}>Method</Text>
          <View style={styles.methodGrid}>
            {PAYMENT_METHODS.map((m) => {
              const disabled = m.key === 'CREDIT' && !creditAllowed;
              const active = method === m.key;
              return (
                <Pressable
                  key={m.key}
                  disabled={disabled}
                  onPress={() => setMethod(m.key)}
                  style={[
                    styles.methodChip,
                    active && styles.methodChipActive,
                    disabled && styles.methodChipDisabled,
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={
                      active
                        ? c.textOnPrimary
                        : disabled
                        ? c.textMuted
                        : c.textPrimary
                    }
                  />
                  <Text
                    style={[
                      styles.methodText,
                      active && styles.methodTextActive,
                      disabled && styles.methodTextDisabled,
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {needsReference(method) ? (
            <>
              <Text style={styles.sheetKicker}>Reference</Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder={`${method} reference`}
                placeholderTextColor={c.textMuted}
                style={styles.sheetInput}
                autoCapitalize="characters"
              />
            </>
          ) : null}

          <Pressable
            onPress={onConfirm}
            disabled={submitting}
            style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.confirmText}>Confirm sale</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Receipt modal ──────────────────────────────────────────── */

export function PosReceiptModal({
  visible,
  loading,
  receipt,
  onClose,
  formatCurrency,
  c,
  styles,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Receipt</Text>
          {loading || !receipt ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.receiptHeader}>
                {receipt.receipt?.header || receipt.shop?.name}
              </Text>
              <Text style={styles.receiptMeta}>
                {receipt.sale?.reference}
                {receipt.sale?.createdAt
                  ? ` · ${new Date(receipt.sale.createdAt).toLocaleString()}`
                  : ''}
              </Text>
              <View style={styles.receiptRule} />
              {receipt.items?.map((it) => (
                <View key={it.id} style={styles.receiptRow}>
                  <Text style={styles.receiptItem} numberOfLines={1}>
                    {it.quantity}× {it.name}
                  </Text>
                  <Text style={styles.receiptAmount}>
                    {formatCurrency(it.total)}
                  </Text>
                </View>
              ))}
              <View style={styles.receiptRule} />
              <View style={styles.receiptRow}>
                <Text style={styles.receiptTotalLabel}>Total</Text>
                <Text style={styles.receiptTotalValue}>
                  {formatCurrency(receipt.totals?.total)}
                </Text>
              </View>
              {receipt.payments?.map((p, i) => (
                <View key={i} style={styles.receiptRow}>
                  <Text style={styles.receiptItem}>{p.method}</Text>
                  <Text style={styles.receiptAmount}>
                    {formatCurrency(p.amount)}
                  </Text>
                </View>
              ))}
              {receipt.receipt?.showCustomer && receipt.sale?.customerName ? (
                <Text style={styles.receiptFooter}>
                  Customer: {receipt.sale.customerName}
                </Text>
              ) : null}
              {receipt.receipt?.showCashier && receipt.sale?.cashierName ? (
                <Text style={styles.receiptFooter}>
                  Cashier: {receipt.sale.cashierName}
                </Text>
              ) : null}
              {receipt.receipt?.footer ? (
                <Text style={styles.receiptFooter}>
                  {receipt.receipt.footer}
                </Text>
              ) : null}
            </ScrollView>
          )}

          <Pressable onPress={onClose} style={styles.confirmBtn}>
            <Text style={styles.confirmText}>Done</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Share receipt', 'Coming soon.')}
            style={styles.secondaryBtn}
          >
            <Ionicons name="share-outline" size={16} color={c.link} />
            <Text style={styles.secondaryBtnText}>Share</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ── Variant (unit) picker ──────────────────────────────────── */

export function PosVariantModal({
  visible,
  product,
  onClose,
  onPick,
  formatCurrency,
  c,
  styles,
}) {
  if (!product) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.variantSub}>Choose a unit</Text>

          <FlatList
            data={product.units || []}
            keyExtractor={(u) => u.id}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const stock = Number(product.stock) || 0;
              const canSell = stock > 0;
              return (
                <Pressable
                  onPress={() => canSell && onPick(product, item)}
                  disabled={!canSell}
                  style={({ pressed }) => [
                    styles.variantRow,
                    pressed && canSell && styles.variantRowPressed,
                    !canSell && styles.variantRowDisabled,
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.variantName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.variantMeta} numberOfLines={1}>
                      {item.abbreviation || 'unit'}
                      {Number(item.conversionQty) > 1
                        ? ` · ×${item.conversionQty} base`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.variantPrice}>
                    {formatCurrency(item.price)}
                  </Text>
                  <Ionicons
                    name="add-circle"
                    size={24}
                    color={canSell ? c.primary : c.textMuted}
                  />
                </Pressable>
              );
            }}
          />

          <Pressable onPress={onClose} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}