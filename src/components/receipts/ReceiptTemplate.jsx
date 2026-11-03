// src/components/receipts/ReceiptTemplate.jsx
//
// Pure presentational receipt. No data fetching, no navigation.
// Shared between ReceiptScreen (for preview + capture) and any future
// PDF renderer. Reads exactly what /sales/:id/receipt returns.
//
// Field naming mirrors the backend response: shop, receipt, sale, items,
// totals, payments. Do not reshape.

import { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography } from '../../styles/typography';

function fmtAmount(amount, currency, decimals) {
  const n = Number(amount || 0);
  const d = Number.isFinite(decimals) ? decimals : 2;
  const fixed = n.toFixed(d);
  const [intPart, decPart = ''] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = d > 0 ? `${withCommas}.${decPart}` : withCommas;
  return currency ? `${currency} ${body}` : body;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ReceiptTemplate = forwardRef(function ReceiptTemplate({ data }, ref) {
  const styles = useMemo(() => makeStyles(), []);
  if (!data) return null;

  const {
    shop = {},
    receipt = {},
    sale = {},
    items = [],
    totals = {},
    payments = [],
  } = data;

  const currency = receipt.currency || null;
  const decimals = receipt.decimalPlaces ?? 2;

  const amount = (v) => fmtAmount(v, currency, decimals);
  const receiptNo = receipt.number || sale.reference || sale.id || '';
  const headerText = receipt.header || shop.name || '';
  const footerText = receipt.footer || '';

  return (
    <View ref={ref} style={styles.paper} collapsable={false}>
      {/* Header */}
      <View style={styles.center}>
        <Text style={styles.shopName}>{shop.name || 'Business'}</Text>
        {shop.address ? (
          <Text style={styles.shopMeta}>{shop.address}</Text>
        ) : null}
        {shop.phone ? (
          <Text style={styles.shopMeta}>{shop.phone}</Text>
        ) : null}
        {shop.email ? (
          <Text style={styles.shopMeta}>{shop.email}</Text>
        ) : null}
        {shop.taxNumber ? (
          <Text style={styles.shopMeta}>PIN: {shop.taxNumber}</Text>
        ) : null}
      </View>

      {headerText ? (
        <Text style={[styles.center, styles.headerText]}>{headerText}</Text>
      ) : null}

      <View style={styles.rule} />

      {/* Meta */}
      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Receipt</Text>
          <Text style={styles.metaValue}>{receiptNo}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{fmtDate(sale.createdAt)}</Text>
        </View>
        {receipt.showCustomer && sale.customerName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Customer</Text>
            <Text style={styles.metaValue}>{sale.customerName}</Text>
          </View>
        ) : null}
        {receipt.showCashier && sale.cashierName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Cashier</Text>
            <Text style={styles.metaValue}>{sale.cashierName}</Text>
          </View>
        ) : null}
        {sale.branchName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Branch</Text>
            <Text style={styles.metaValue}>{sale.branchName}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.rule} />

      {/* Items */}
      <View style={styles.items}>
        {items.map((item, i) => (
          <View
            key={item.id || `${item.name}-${i}`}
            style={styles.itemRow}
          >
            <View style={styles.itemLeft}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemMeta}>
                {item.quantity} × {amount(item.unitPrice)}
                {item.unitAbbrev ? ` ${item.unitAbbrev}` : ''}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{amount(item.total)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.rule} />

      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{amount(totals.subtotal)}</Text>
        </View>
        {receipt.showTax && Number(totals.tax) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Tax{Number(totals.taxRate) ? ` (${totals.taxRate}%)` : ''}
            </Text>
            <Text style={styles.totalValue}>{amount(totals.tax)}</Text>
          </View>
        ) : null}
        {Number(totals.discount) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={styles.totalValue}>
              −{amount(totals.discount)}
            </Text>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{amount(totals.total)}</Text>
        </View>
      </View>

      <View style={styles.rule} />

      {/* Payments */}
      <View style={styles.payments}>
        {payments.map((p, i) => (
          <View
            key={`${p.method}-${i}`}
            style={styles.totalRow}
          >
            <Text style={styles.totalLabel}>{p.method}</Text>
            <Text style={styles.totalValue}>{amount(p.amount)}</Text>
          </View>
        ))}
      </View>

      {footerText ? (
        <>
          <View style={styles.rule} />
          <Text style={[styles.center, styles.footer]}>{footerText}</Text>
        </>
      ) : null}

      <Text style={[styles.center, styles.brand]}>Powered by KxTill</Text>
    </View>
  );
});

const makeStyles = () =>
  StyleSheet.create({
    // Light sheet — a receipt is white paper, not dark surface.
    // Fixed colours on purpose: the receipt is a document, not a screen.
    paper: {
      backgroundColor: '#FFFFFF',
      padding: 20,
      borderRadius: 12,
      width: '100%',
    },
    center: { textAlign: 'center' },
    shopName: {
      color: '#0A0A0A',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    shopMeta: {
      color: '#4A4A4A',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 2,
    },
    headerText: {
      color: '#0A0A0A',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 12,
    },
    rule: {
      height: 1,
      backgroundColor: '#E0E0E0',
      marginVertical: 12,
    },
    metaGrid: { gap: 4 },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    metaLabel: { color: '#6E6E6E', fontSize: 12 },
    metaValue: {
      color: '#0A0A0A',
      fontSize: 12,
      fontWeight: '600',
      maxWidth: '65%',
      textAlign: 'right',
    },
    items: { gap: 10 },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    itemLeft: { flex: 1, minWidth: 0 },
    itemName: {
      color: '#0A0A0A',
      fontSize: 13,
      fontWeight: '600',
    },
    itemMeta: {
      color: '#6E6E6E',
      fontSize: 11,
      marginTop: 2,
    },
    itemTotal: {
      color: '#0A0A0A',
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    totals: { gap: 4 },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    totalLabel: { color: '#4A4A4A', fontSize: 12 },
    totalValue: {
      color: '#0A0A0A',
      fontSize: 12,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    grandRow: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: '#E0E0E0',
    },
    grandLabel: {
      color: '#0A0A0A',
      fontSize: 15,
      fontWeight: '900',
    },
    grandValue: {
      color: '#0A0A0A',
      fontSize: 15,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    payments: { gap: 4 },
    footer: {
      color: '#4A4A4A',
      fontSize: 12,
      lineHeight: 16,
    },
    brand: {
      color: '#B0B0B0',
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 14,
    },
  });

export default ReceiptTemplate;