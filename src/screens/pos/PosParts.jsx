// src/screens/pos/PosParts.jsx

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { BRAND_ICONS } from '../../constants/config';

/* ── Header ─────────────────────────────────────────────────── */

function HeaderAction({ icon, label, labelStyle, badge, onPress, c, styles }) {
  return (
    <Pressable onPress={onPress} style={styles.actionWrap} hitSlop={4}>
      <View style={styles.actionBtn}>
        <Ionicons name={icon} size={22} color={c.textPrimary} />
        {badge > 0 ? (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.actionLabel, labelStyle]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PosHeader({
  syncStatus,
  pendingCount,
  heldCount,
  totalQty,
  subtotal,
  onScan,
  onHeld,
  onCart,
  onCloseShift,
  formatCurrency,
  c,
  styles,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const tone = syncStatus === 'pending' ? c.warning : c.success;
  const statusLabel =
    syncStatus === 'pending'
      ? `${pendingCount || 0} syncing`
      : 'Online';

  return (
    <View style={styles.header}>
      <View style={styles.brandWrap}>
        <View style={styles.markWrap}>
          <View style={styles.logoTile}>
            <Image
              source={BRAND_ICONS.kxtill}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {!compact ? <View style={styles.brandDivider} /> : null}

        <View style={styles.statusRow}>
          <Text style={styles.statusText} numberOfLines={1}>
            KxTill
          </Text>
          <View style={[styles.statusDot, { backgroundColor: tone }]} />
          {!compact ? (
            <Text
              style={[styles.statusText, { fontWeight: '600' }]}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.headerActions}>
        <HeaderAction
          icon="scan-outline"
          label="Scan"
          onPress={onScan}
          c={c}
          styles={styles}
        />
        <HeaderAction
          icon="pause-circle-outline"
          label="Paused"
          badge={heldCount}
          onPress={onHeld}
          c={c}
          styles={styles}
        />
        <Pressable
          onPress={onCart}
          onLongPress={onCloseShift}
          delayLongPress={600}
          style={styles.actionWrap}
          hitSlop={4}
        >
          <View style={styles.actionBtn}>
            <Ionicons name="cart-outline" size={22} color={c.textPrimary} />
            {totalQty > 0 ? (
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{totalQty}</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.actionLabel, { fontWeight: '800' }]}
            numberOfLines={1}
          >
            {formatCurrency(subtotal)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PosSearchBar({ query, setQuery, c, styles }) {
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={22} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products by name, barcode or SKU"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ── Category chips ─────────────────────────────────────────── */

const MAX_VISIBLE_CATS = 5;

function catIcon(name) {
  const n = String(name || '').toLowerCase();
  if (!name) return 'grid-outline';
  if (/bever|drink|juice|soda|water/.test(n)) return 'beer-outline';
  if (/snack|crisp|biscuit/.test(n)) return 'fast-food-outline';
  if (/bak|bread/.test(n)) return 'pizza-outline';
  if (/dairy|milk|yog/.test(n)) return 'water-outline';
  if (/house|clean/.test(n)) return 'home-outline';
  if (/antibio|pharm|medic|drug/.test(n)) return 'medkit-outline';
  return 'pricetag-outline';
}

export function PosCategoryChips({ categories, active, onPick, c, styles }) {
  const [moreOpen, setMoreOpen] = useState(false);
  if (categories.length === 0) return null;

  const visible = categories.slice(0, MAX_VISIBLE_CATS);
  const rest = categories.slice(MAX_VISIBLE_CATS);
  const activeInRest = rest.includes(active);

  const chip = (cat, label, on, onPress, icon) => (
    <Pressable
      key={cat || '__all'}
      onPress={onPress}
      style={[styles.catChip, on && styles.catChipActive]}
    >
      <Ionicons name={icon} size={16} color={on ? c.primary : c.textPrimary} />
      <Text style={[styles.catChipText, on && styles.catChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.chipsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {chip(null, 'All', active === null, () => onPick(null), 'grid-outline')}
        {visible.map((cat) =>
          chip(cat, cat, active === cat, () => onPick(cat), catIcon(cat))
        )}
        {rest.length > 0 ? (
          <Pressable
            onPress={() => setMoreOpen(true)}
            style={[styles.catChip, activeInRest && styles.catChipActive]}
          >
            <Text
              style={[styles.catChipText, activeInRest && styles.catChipTextActive]}
            >
              {activeInRest ? active : 'More'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={activeInRest ? c.primary : c.textPrimary}
            />
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={moreOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMoreOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setMoreOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Categories</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {rest.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => {
                    onPick(cat);
                    setMoreOpen(false);
                  }}
                  style={styles.resultRow}
                >
                  <Ionicons name={catIcon(cat)} size={18} color={c.textPrimary} />
                  <Text style={[styles.resultName, { flex: 1 }]}>{cat}</Text>
                  {active === cat ? (
                    <Ionicons name="checkmark-circle" size={22} color={c.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setMoreOpen(false)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Skeleton grid ──────────────────────────────────────────── */

function SkeletonTile({ pulse, styles }) {
  return (
    <Animated.View
      style={[
        styles.tile,
        styles.tileSkeleton,
        { opacity: pulse },
      ]}
    >
      <View style={styles.skName} />
      <View style={styles.skNameShort} />
      <View style={styles.tileBottom}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.skPrice} />
          <View style={styles.skStock} />
        </View>
      </View>
    </Animated.View>
  );
}

function ProductGridSkeleton({ c, styles }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.gridContent}>
      <View style={styles.gridRowWrap}>
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonTile key={i} pulse={pulse} styles={styles} />
        ))}
      </View>
    </View>
  );
}

/* ── Product grid ───────────────────────────────────────────── */

export function PosProductGrid({
  products,
  inCart,
  searching,
  loadedOnce,
  error,
  query,
  onAdd,
  onRetry,
  formatCurrency,
  c,
  styles,
}) {
  if (!loadedOnce) {
    return <ProductGridSkeleton styles={styles} />;
  }

  if (searching && products.length === 0 && !query) {
    return (
      <View style={styles.gridCenter}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={styles.gridRowWrap}
      contentContainerStyle={styles.gridContent}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={c.danger}
            />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <PosProductTile
          product={item}
          qty={inCart[item.id] || 0}
          onAdd={onAdd}
          formatCurrency={formatCurrency}
          c={c}
          styles={styles}
        />
      )}
      ListEmptyComponent={
        searching ? (
          <View style={styles.gridCenter}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <View style={styles.emptyCart}>
            <Ionicons
              name="cube-outline"
              size={32}
              color={c.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {query ? 'No products match' : 'No products yet'}
            </Text>
          </View>
        )
      }
    />
  );
}

function PosProductTile({ product, qty, onAdd, formatCurrency, c, styles }) {
  const out = !product.isAvailable || product.stock <= 0;
  const low = product.stock > 0 && product.stock <= product.minStock;
  const multi = (product.units?.length || 0) > 1;

  const borderTone = out
    ? c.danger
    : low
      ? c.warning
      : c.primary;

  return (
    <Pressable
      onPress={() => !out && onAdd(product)}
      disabled={out}
      style={({ pressed }) => [
        styles.tile,
       { borderColor: borderTone, borderWidth: 1 },
        qty > 0 && styles.tileActive,
        pressed && !out && styles.tilePressed,
        out && styles.tileDisabled,
      ]}
    >
      {qty > 0 ? (
        <View style={styles.tileQty}>
          <Text style={styles.tileQtyText}>{qty}</Text>
        </View>
      ) : null}

      <Text
        style={[styles.tileName, out && styles.tileNameDisabled]}
        numberOfLines={2}
      >
        {product.name}
      </Text>

      <View style={styles.tileBottom}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.tilePrice, out && styles.tilePriceDisabled]}>
            {out ? 'Out of stock' : formatCurrency(product.price)}
          </Text>

          {!out ? (
            <Text style={[styles.tileStock, low && styles.tileStockLow]}>
              {product.stock} in stock
            </Text>
          ) : null}
        </View>

        {multi ? (
          <View style={styles.unitBadge}>
            <Text style={styles.unitBadgeText}>Multi</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ── Footer ─────────────────────────────────────────────────── */

export function PosFooter({
  totalQty,
  subtotal,
  cartEmpty,
  onPayCash,
  onPayMpesa,
  onCloseShift,
  formatCurrency,
  bottomInset,
  c,
  styles,
}) {
  const [contentHeight, setContentHeight] = useState(0);
  const anim = useRef(new Animated.Value(cartEmpty ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: cartEmpty ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [cartEmpty, anim]);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 1],
  });

  const sharedProps = {
    totalQty,
    subtotal,
    cartEmpty,
    onPayCash,
    onPayMpesa,
    onCloseShift,
    formatCurrency,
    bottomInset,
    c,
    styles,
  };

  return (
    <Animated.View
      style={[styles.footerWrapper, { height }]}
      pointerEvents={cartEmpty ? 'none' : 'auto'}
    >
      <View
        style={{ position: 'absolute', left: 0, right: 0, opacity: 0 }}
        pointerEvents="none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && h !== contentHeight) setContentHeight(h);
        }}
      >
        <FooterContent {...sharedProps} />
      </View>

      <Animated.View style={{ opacity: anim }}>
        <FooterContent {...sharedProps} />
      </Animated.View>
    </Animated.View>
  );
}

function FooterContent({
  totalQty,
  subtotal,
  cartEmpty,
  onPayCash,
  onPayMpesa,
  onCloseShift,
  formatCurrency,
  bottomInset,
  c,
  styles,
}) {
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <Pressable
        onLongPress={onCloseShift}
        delayLongPress={600}
        style={styles.footerTop}
      >
        <Text style={styles.footerKicker}>
          {totalQty} {totalQty === 1 ? 'item' : 'items'}
        </Text>
        <Text style={styles.footerTotal}>{formatCurrency(subtotal)}</Text>
      </Pressable>
      <View style={styles.payRow}>
        <Pressable
          onPress={onPayCash}
          disabled={cartEmpty}
          style={[styles.payBtn, cartEmpty && styles.payBtnDisabled]}
        >
          <Ionicons name="cash-outline" size={24} color={c.textOnPrimary} />
          <Text style={styles.payBtnText}>Cash</Text>
        </Pressable>
<Pressable
  onPress={onPayMpesa}
  disabled={cartEmpty}
  style={[
    styles.payBtn,
    styles.payBtnMpesa,
    cartEmpty && styles.payBtnDisabled,
  ]}
>
  <Image
    source={BRAND_ICONS.mpesa}
    style={{ width: 24, height: 24, tintColor: '#FFFFFF' }}
    resizeMode="contain"
  />
  <Text style={styles.payBtnText}>M-Pesa</Text>
</Pressable>
      </View>
    </View>
  );
}

/* ── Snackbar ───────────────────────────────────────────────── */

export function PosSnackbar({ visible, onReceipt, c, styles }) {
  if (!visible) return null;
  return (
    <Pressable onPress={onReceipt} style={styles.snackbar}>
      <Ionicons name="checkmark-circle" size={20} color={c.primary} />
      <Text style={styles.snackText}>Sale saved</Text>
      <Text style={styles.snackAction}>Receipt</Text>
    </Pressable>
  );
}