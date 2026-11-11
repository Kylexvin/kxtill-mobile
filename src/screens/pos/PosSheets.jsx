// src/screens/pos/PosSheets.jsx

import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { PAYMENT_METHODS, needsReference } from './usePos';

const NOTES = [50, 100, 200, 500, 1000, 2000];

export function PosPaymentModal({
  visible,
  submitting,
  subtotal,
  customer,
  method,
  setMethod,
  reference,
  setReference,
  mpesa,
  phone,
  setPhone,
  onSendPrompt,
  onCancelPrompt,
  onClose,
  onConfirm,
  startWithMethods,
  formatCurrency,
  c,
  styles,
}) {
  const insets = useSafeAreaInsets();
  const [tendered, setTendered] = useState('');
  const [manual, setManual] = useState(false);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    if (visible) {
      setTendered('');
      setManual(false);
      setShowMethods(!!startWithMethods);
    }
  }, [visible, startWithMethods]);

  const waiting = mpesa.phase === 'waiting';
  const busy = submitting || waiting;
  const creditAllowed = !!customer;
  const total = Number(subtotal.toFixed(2));
  const given = Number(tendered) || 0;
  const change = given - total;
  const short = method === 'CASH' && given > 0 && change < 0;
  const quick = NOTES.filter((n) => n >= total).slice(0, 4);
  const showConfirm =
    method !== 'MPESA' || manual || mpesa.phase === 'success';

  const methodLabel =
    PAYMENT_METHODS.find((m) => m.key === method)?.label || method;

  const referenceInput = (
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
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !busy && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.sheetBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Pressable style={{ flex: 1 }} onPress={() => !busy && onClose()} />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(
                32,
                insets.bottom + 16,
                // extra room so the last input isn't right against the keyboard
                0
              ),
            },
          ]}
        >
          {/* Scrollable inner so inputs stay reachable when the keyboard
              shrinks the sheet on Android. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTotal}>{formatCurrency(subtotal)}</Text>

            {showMethods ? (
              <View style={styles.methodGrid}>
                {PAYMENT_METHODS.map((m) => {
                  const disabled =
                    busy || (m.key === 'CREDIT' && !creditAllowed);
                  const active = method === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      disabled={disabled}
                      onPress={() => {
                        setMethod(m.key);
                        setShowMethods(false);
                      }}
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
            ) : (
              <View style={styles.rowBetween}>
                <Text style={styles.sheetTitle}>{methodLabel} payment</Text>
                <Pressable
                  onPress={() => setShowMethods(true)}
                  disabled={busy}
                  hitSlop={8}
                >
                  <Text style={styles.walkinText}>Change method</Text>
                </Pressable>
              </View>
            )}

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
                    <Text
                      style={[styles.changeValue, short && { color: c.danger }]}
                    >
                      {formatCurrency(Math.abs(change))}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {method === 'MPESA' ? (
              <MpesaBody
                mpesa={mpesa}
                phone={phone}
                setPhone={setPhone}
                manual={manual}
                setManual={setManual}
                onSendPrompt={onSendPrompt}
                onCancelPrompt={onCancelPrompt}
                referenceInput={referenceInput}
                formatCurrency={formatCurrency}
                c={c}
                styles={styles}
              />
            ) : needsReference(method) && method !== 'MPESA' ? (
              referenceInput
            ) : null}

            {showConfirm && !waiting ? (
              <Pressable
                onPress={onConfirm}
                disabled={submitting || short}
                style={[
                  styles.confirmBtn,
                  (submitting || short) && { opacity: 0.6 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <>
                    <Text style={styles.confirmText}>Confirm sale</Text>
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={c.textOnPrimary}
                    />
                  </>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* M-Pesa body — extracted so state transitions can animate cleanly. */
/* M-Pesa body — Waiting → Success, animated. */

function MpesaBody({
  mpesa,
  phone,
  setPhone,
  manual,
  setManual,
  onSendPrompt,
  onCancelPrompt,
  referenceInput,
  formatCurrency,
  c,
  styles,
}) {
  const waiting = mpesa.phase === 'waiting';
  const success = mpesa.phase === 'success';

  // Fade whole slot on phase change.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [mpesa.phase, fade]);

  // Pulse the ring while waiting.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!waiting) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [waiting, pulse]);

  // Pop the check on success.
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!success) {
      pop.setValue(0);
      return;
    }
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [success, pop]);

  return (
    <Animated.View style={{ opacity: fade, gap: 4 }}>
      {success ? (
        <View style={styles.mpesaSuccess}>
          <Animated.View
            style={[
              styles.mpesaSuccessIcon,
              {
                backgroundColor: c.successSoft || c.primarySoft,
                transform: [{ scale: pop }],
              },
            ]}
          >
            <Ionicons
              name="checkmark"
              size={42}
              color={c.success}
            />
          </Animated.View>
          <Text style={styles.mpesaSuccessTitle}>Payment received</Text>
          <Text style={styles.mpesaSuccessSub}>
            {formatCurrency(mpesa.amount || mpesa.total || 0)}
          </Text>
          <View style={styles.mpesaCodePill}>
            <Ionicons
              name="receipt-outline"
              size={14}
              color={c.link}
            />
            <Text style={styles.mpesaCodeText}>{mpesa.receipt}</Text>
          </View>
        </View>
      ) : waiting ? (
        <View style={styles.mpesaWaiting}>
          <View style={styles.mpesaPulseWrap}>
            <Animated.View
              style={[
                styles.mpesaPulseRing,
                {
                  borderColor: c.primary,
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 0],
                  }),
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1.6],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View
              style={[
                styles.mpesaPulseCore,
                { backgroundColor: c.primary },
              ]}
            >
              <ActivityIndicator color={c.textOnPrimary} />
            </View>
          </View>
          <Text style={styles.mpesaWaitTitle}>
            Waiting for PIN
          </Text>
          <Text style={styles.mpesaWaitHint}>
            A prompt was sent to {phone || 'the customer'}. They have about
            60 seconds to enter their M-Pesa PIN.
          </Text>
          <Pressable
            onPress={onCancelPrompt}
            style={styles.mpesaCancelBtn}
          >
            <Text style={styles.mpesaCancelText}>Cancel prompt</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sheetKicker}>Customer phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07XX XXX XXX"
            placeholderTextColor={c.textMuted}
            keyboardType="phone-pad"
            style={styles.sheetInput}
          />
          {mpesa.error ? (
            <Text
              style={{
                color: c.danger,
                fontSize: 13,
                fontWeight: '700',
                marginTop: 4,
              }}
            >
              {mpesa.error}
            </Text>
          ) : null}
          <Pressable onPress={onSendPrompt} style={styles.confirmBtn}>
            <Text style={styles.confirmText}>Send M-Pesa prompt</Text>
            <Ionicons
              name="paper-plane-outline"
              size={18}
              color={c.textOnPrimary}
            />
          </Pressable>
          <Pressable
            onPress={() => setManual((v) => !v)}
            style={styles.walkinRow}
          >
            <Text style={styles.walkinText}>
              {manual ? 'Hide code entry' : 'Already paid? Enter code'}
            </Text>
          </Pressable>
          {manual ? referenceInput : null}
        </>
      )}
    </Animated.View>
  );
}

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
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(32, insets.bottom + 16) },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.rowBetween}>
            <Text style={styles.sheetTitle}>Cart</Text>
            <Text style={styles.cartTotal}>{formatCurrency(subtotal)}</Text>
          </View>

          <FlatList
            data={cart}
            keyExtractor={(l) => l.key}
            style={{ maxHeight: 340 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Cart is empty</Text>
            }
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
                  {formatCurrency(
                    l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100)
                  )}
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
              style={[
                styles.secondaryBtn,
                { flex: 1 },
                cart.length === 0 && { opacity: 0.4 },
              ]}
            >
              <Ionicons
                name="pause-circle-outline"
                size={16}
                color={c.link}
              />
              <Text style={styles.secondaryBtnText}>Hold</Text>
            </Pressable>
            <Pressable
              onPress={onClear}
              disabled={cart.length === 0}
              style={[
                styles.secondaryBtn,
                { flex: 1 },
                cart.length === 0 && { opacity: 0.4 },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={c.danger} />
              <Text style={[styles.secondaryBtnText, { color: c.danger }]}>
                Clear
              </Text>
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
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(32, insets.bottom + 16) },
          ]}
        >
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
                  s +
                  l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
                0
              );
              return (
                <Pressable
                  onPress={() => onRecall(h.id)}
                  style={styles.resultRow}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {qty} {qty === 1 ? 'item' : 'items'} ·{' '}
                      {formatCurrency(total)}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {new Date(h.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {h.customer?.name ? ` · ${h.customer.name}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      onDiscard(h.id);
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={c.danger}
                    />
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

/* ── Shift (open / close) ───────────────────────────────────── */

export function PosShiftModal({
  visible,
  mode,              // 'open' | 'close' | 'blocked-close'
  shift,             // for close/blocked-close: the shift to close
  branchName,        // for open-mode display
  submitting,
  onClose,
  onOpenShift,       // (openingFloat: number) => Promise
  onCloseShift,      // (declaredCash: number) => Promise
  formatCurrency,
  c,
  styles,
}) {
  const [openingFloat, setOpeningFloat] = useState('');
  const [declaredCash, setDeclaredCash] = useState('');

  useEffect(() => {
    if (visible) {
      setOpeningFloat('');
      setDeclaredCash('');
    }
  }, [visible, mode, shift?.id]);

  if (!visible) return null;

  const isOpenMode = mode === 'open';
  const shiftLabel = shift?.branch?.name || branchName || 'this branch';
  const openingFloatNum = Number(openingFloat) || 0;
  const declaredNum = Number(declaredCash);
  const declaredValid = Number.isFinite(declaredNum) && declaredNum >= 0;

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

          {isOpenMode ? (
            <>
              <Text style={styles.sheetTitle}>Open shift</Text>
              <Text style={styles.shiftSub}>
                Start your shift at {shiftLabel}. Enter the cash float you&apos;re
                starting with.
              </Text>

              <Text style={styles.sheetKicker}>Opening float</Text>
              <TextInput
                value={openingFloat}
                onChangeText={setOpeningFloat}
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
                style={styles.sheetInput}
              />

              <Pressable
                onPress={() => onOpenShift(openingFloatNum)}
                disabled={submitting}
                style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.confirmText}>Open shift</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => !submitting && onClose()}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sheetTitle}>
                {mode === 'blocked-close'
                  ? `Close shift at ${shiftLabel}`
                  : 'Close shift'}
              </Text>
              {shift?.openedAt ? (
                <Text style={styles.shiftSub}>
                  Opened {new Date(shift.openedAt).toLocaleString()}
                </Text>
              ) : null}

              <Text style={styles.sheetKicker}>Declared cash</Text>
              <TextInput
                value={declaredCash}
                onChangeText={setDeclaredCash}
                placeholder="Amount in the till"
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
                style={styles.sheetInput}
              />

              <Pressable
                onPress={() => onCloseShift(declaredNum)}
                disabled={submitting || !declaredValid}
                style={[
                  styles.confirmBtn,
                  (submitting || !declaredValid) && { opacity: 0.6 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.confirmText}>Close shift</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => !submitting && onClose()}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}