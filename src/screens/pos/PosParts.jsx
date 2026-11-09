// src/screens/pos/PosParts.jsx
//
// Presentational components for the POS screen.

import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

/* ── Header ─────────────────────────────────────────────────── */

export function PosHeader({
  syncStatus,
  heldCount,
  totalQty,
  subtotal,
  onSearch,
  onHeld,
  onCart,
  onMenu,
  formatCurrency,
  c,
  styles,
}) {
  const dot =
    syncStatus === 'offline'
      ? c.danger
      : syncStatus === 'pending'
      ? '#F59E0B'
      : c.success;

  return (
    <View style={styles.header}>
      <View style={[styles.syncDot, { backgroundColor: dot }]} />

      <Pressable onPress={onSearch} style={styles.headerIcon} hitSlop={6}>
        <Ionicons name="search" size={22} color={c.textPrimary} />
      </Pressable>
      <View style={[styles.headerIcon, styles.iconBtnDisabled]}>
        <Ionicons name="barcode-outline" size={22} color={c.textMuted} />
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={onHeld} style={styles.headerIcon} hitSlop={6}>
        <Ionicons name="pause-circle-outline" size={24} color={c.textPrimary} />
        {heldCount > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{heldCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable onPress={onCart} style={styles.cartPill}>
        <Ionicons name="cart" size={20} color={c.textOnPrimary} />
        <Text style={styles.cartPillText}>
          {totalQty} · {formatCurrency(subtotal)}
        </Text>
      </Pressable>

      <Pressable onPress={onMenu} style={styles.headerIcon} hitSlop={6}>
        <Ionicons name="ellipsis-vertical" size={20} color={c.textPrimary} />
      </Pressable>
    </View>
  );
}

/* ── Search bar ─────────────────────────────────────────────── */

export function PosSearchBar({ query, setQuery, onClose, c, styles }) {
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable
          onPress={() => {
            setQuery('');
            onClose();
          }}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

/* ── Category chips ─────────────────────────────────────────── */

export function PosCategoryChips({ categories, active, onPick, c, styles }) {
  if (categories.length === 0) return null;
  const all = [null, ...categories];
  return (
    <View style={styles.chipsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {all.map((cat) => {
          const on = active === cat;
          return (
            <Pressable
              key={cat || '__all'}
              onPress={() => onPick(cat)}
              style={[styles.catChip, on && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, on && styles.catChipTextActive]}>
                {cat || 'All'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ── Product grid ───────────────────────────────────────────── */

export function PosProductGrid({
  products,
  inCart,
  searching,
  error,
  query,
  onAdd,
  onRetry,
  formatCurrency,
  c,
  styles,
}) {
  if (searching && products.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContent}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={c.danger} />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null
      }
      ListEmptyComponent={
        searching ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <View style={styles.emptyCart}>
            <Ionicons name="cube-outline" size={28} color={c.textMuted} />
            <Text style={styles.emptyTitle}>
              {query ? 'No products match' : 'No products yet'}
            </Text>
          </View>
        )
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
    />
  );
}

function PosProductTile({ product, qty, onAdd, formatCurrency, c, styles }) {
  const out = !product.isAvailable || product.stock <= 0;
  const low = product.stock > 0 && product.stock <= product.minStock;
  const multi = (product.units?.length || 0) > 1;

  return (
    <Pressable
      onPress={() => !out && onAdd(product)}
      disabled={out}
      style={({ pressed }) => [
        styles.tile,
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
      <Text style={[styles.tileName, out && styles.tileNameDisabled]} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.tileBottom}>
        <Text style={[styles.tilePrice, out && styles.tilePriceDisabled]} numberOfLines={1}>
          {out ? 'Out' : formatCurrency(product.price)}
        </Text>
        {multi ? (
          <Ionicons name="layers-outline" size={12} color={c.textMuted} />
        ) : low ? (
          <View style={styles.lowDot} />
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
  onUndo,
  onPayCash,
  onPayMpesa,
  formatCurrency,
  bottomInset,
  c,
  styles,
}) {
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <View style={styles.footerTop}>
        <View>
          <Text style={styles.footerKicker}>
            {totalQty} {totalQty === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.footerTotal}>{formatCurrency(subtotal)}</Text>
        </View>
        <Pressable
          onPress={onUndo}
          disabled={cartEmpty}
          style={[styles.undoBtn, cartEmpty && styles.payBtnDisabled]}
        >
          <Ionicons name="arrow-undo-outline" size={18} color={c.textPrimary} />
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      </View>
      <View style={styles.payRow}>
        <Pressable
          onPress={onPayCash}
          disabled={cartEmpty}
          style={[styles.payBtn, cartEmpty && styles.payBtnDisabled]}
        >
          <Ionicons name="cash-outline" size={20} color="#fff" />
          <Text style={styles.payBtnText}>Cash</Text>
        </Pressable>
        <Pressable
          onPress={onPayMpesa}
          disabled={cartEmpty}
          style={[styles.payBtn, styles.payBtnMpesa, cartEmpty && styles.payBtnDisabled]}
        >
          <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
          <Text style={styles.payBtnText}>M-Pesa</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Sale-saved snackbar ────────────────────────────────────── */

export function PosSnackbar({ visible, onReceipt, c, styles }) {
  if (!visible) return null;
  return (
    <Pressable onPress={onReceipt} style={styles.snackbar}>
      <Ionicons name="checkmark-circle" size={20} color={c.success} />
      <Text style={styles.snackText}>Sale saved</Text>
      <Text style={styles.snackAction}>Receipt</Text>
    </Pressable>
  );
}