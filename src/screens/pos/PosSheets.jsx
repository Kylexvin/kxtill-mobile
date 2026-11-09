// src/screens/pos/PosSheets.jsx
//
// Payment, Cart and Held-orders sheets for the POS screen.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { PAYMENT_METHODS, needsReference } from './usePos';

const NOTES = [50, 100, 200, 500, 1000, 2000];

/* ── Payment ────────────────────────────────────────────────── */

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
  const [tendered, setTendered] = useState('');
  useEffect(() => {
    if (visible) setTendered('');
  }, [visible]);

  const creditAllowed = !!customer;
  const total = Number(subtotal.toFixed(2));
  const given = Number(tendered) || 0;
  const change = given - total;
  const short = method === 'CASH' && given > 0 && change < 0;
  const quick = NOTES.filter((n) => n >= total).slice(0, 4);

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
        <Pressable style={{ flex: 1 }} onPress={() => !submitting && onClose()} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTotal}>{formatCurrency(subtotal)}</Text>

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

          {method === 'CASH' ? (
            <>
              <Text style={styles.sheetKicker}>Received</Text>
              <View style={styles.methodGrid}>
                <Pressable
                  onPress={() => setTendered(String(total))}
                  style={styles.quickChip}
                >
                  <Text style={styles.quickChipText}>Exact</Text>
                </Pressable>
                {quick.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setTendered(String(n))}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickChipText}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={tendered}
                onChangeText={setTendered}
                placeholder="Amount received"
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
                style={styles.sheetInput}
              />
              {given > 0 ? (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>
                    {short ? 'Short by' : 'Change'}
                  </Text>
                  <Text style={[styles.changeValue, short && { color: c.danger }]}>
                    {formatCurrency(Math.abs(change))}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

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
            disabled={submitting || short}
            style={[styles.confirmBtn, (submitting || short) && { opacity: 0.6 }]}
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

/* ── Cart ───────────────────────────────────────────────────── */

export function PosCartModal({
  visible,
  cart,
  customer,
  subtotal,
  onChangeQty,
  onCustomer,
  onHold,
  onClear,
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
          <View style={styles.rowBetween}>
            <Text style={styles.sheetTitle}>Cart</Text>
            <Text style={styles.cartTotal}>{formatCurrency(subtotal)}</Text>
          </View>

          <FlatList
            data={cart}
            keyExtractor={(l) => l.key}
            style={{ maxHeight: 340 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Cart is empty</Text>}
            renderItem={({ item: l }) => (
              <View style={styles.cartRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cartRowName} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <Text style={styles.cartRowMeta}>
                    {formatCurrency(l.unitPrice)}
                    {l.unitAbbrev ? ` / ${l.unitAbbrev}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onChangeQty(l.key, -1)}
                  style={styles.qtyBtn}
                  hitSlop={6}
                >
                  <Ionicons name="remove" size={20} color={c.textPrimary} />
                </Pressable>
                <Text style={styles.qtyText}>{l.quantity}</Text>
                <Pressable
                  onPress={() => onChangeQty(l.key, 1)}
                  style={styles.qtyBtn}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={20} color={c.textPrimary} />
                </Pressable>
                <Text style={styles.cartRowTotal}>
                  {formatCurrency(l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100))}
                </Text>
              </View>
            )}
          />

          <Pressable onPress={onCustomer} style={styles.walkinRow}>
            <Ionicons name="person-outline" size={18} color={c.link} />
            <Text style={styles.walkinText}>
              {customer?.name || 'Walk-in'} · change
            </Text>
          </Pressable>

          <View style={styles.rowGap}>
            <Pressable
              onPress={onHold}
              disabled={cart.length === 0}
              style={[styles.secondaryBtn, { flex: 1 }, cart.length === 0 && { opacity: 0.4 }]}
            >
              <Ionicons name="pause-circle-outline" size={16} color={c.link} />
              <Text style={styles.secondaryBtnText}>Hold</Text>
            </Pressable>
            <Pressable
              onPress={onClear}
              disabled={cart.length === 0}
              style={[styles.secondaryBtn, { flex: 1 }, cart.length === 0 && { opacity: 0.4 }]}
            >
              <Ionicons name="trash-outline" size={16} color={c.danger} />
              <Text style={[styles.secondaryBtnText, { color: c.danger }]}>Clear</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={styles.confirmBtn}>
            <Text style={styles.confirmText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ── Held orders ────────────────────────────────────────────── */

export function PosHeldModal({
  visible,
  held,
  onRecall,
  onDiscard,
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
          <Text style={styles.sheetTitle}>Held orders</Text>
          <FlatList
            data={held}
            keyExtractor={(h) => h.id}
            style={{ maxHeight: 360 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No held orders</Text>
            }
            renderItem={({ item: h }) => {
              const qty = h.cart.reduce((s, l) => s + l.quantity, 0);
              const total = h.cart.reduce(
                (s, l) =>
                  s + l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
                0
              );
              return (
                <Pressable onPress={() => onRecall(h.id)} style={styles.resultRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {qty} {qty === 1 ? 'item' : 'items'} · {formatCurrency(total)}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {new Date(h.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {h.customer?.name ? ` · ${h.customer.name}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => onDiscard(h.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={c.danger} />
                  </Pressable>
                </Pressable>
              );
            }}
          />
          <Pressable onPress={onClose} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}