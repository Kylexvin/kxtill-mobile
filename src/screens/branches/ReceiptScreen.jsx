// src/screens/branches/ReceiptScreen.jsx
//
// Image-share receipt. Also supports PDF export via expo-print.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  Animated,
  Share,
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';

/* ── helpers ────────────────────────────────────────────────── */

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function titleCase(s) {
  const str = String(s || '');
  if (!str) return '';
  return str.charAt(0) + str.slice(1).toLowerCase();
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEnvelope(env) {
  const shop = env?.shop || {};
  const receipt = env?.receipt || {};
  const saleMeta = env?.sale || {};
  const totals = env?.totals || {};
  const payments = Array.isArray(env?.payments) ? env.payments : [];
  const items = Array.isArray(env?.items) ? env.items : [];

  const paymentMethodRaw =
    payments[0]?.method || receipt?.defaultPaymentMethod || 'CASH';

  return {
    shop: {
      name: shop.name || '',
      address: shop.address || '',
      phone: shop.phone || '',
      email: shop.email || '',
      taxNumber: shop.taxNumber || '',
    },
    receipt: {
      number: receipt.number || saleMeta.reference || '',
      header: receipt.header || '',
      footer: receipt.footer || '',
      currency: receipt.currency || null,
      decimalPlaces:
        typeof receipt.decimalPlaces === 'number'
          ? receipt.decimalPlaces
          : null,
      showTax: receipt.showTax !== false,
      showCustomer: receipt.showCustomer !== false,
      showCashier: receipt.showCashier !== false,
    },
    sale: {
      id: saleMeta.id || '',
      reference: saleMeta.reference || receipt.number || '',
      createdAt: saleMeta.createdAt || '',
      status: saleMeta.status || '',
      customerName:
        saleMeta.customerName && saleMeta.customerName !== 'Walk-in'
          ? saleMeta.customerName
          : null,
      cashierName: saleMeta.cashierName || null,
      cashierId: saleMeta.cashierId || null,
      branchName: saleMeta.branchName || '',
      organizationName: saleMeta.organizationName || '',
    },
    items: items.map((it, i) => {
      const qty = Number(it.quantity ?? it.qty ?? 1);
      const unitPrice = Number(it.unitPrice ?? 0);
      const lineTotal = Number(it.total ?? qty * unitPrice);
      return {
        id: it.id || `${i}`,
        name: it.name || 'Item',
        sku: it.sku || null,
        unitAbbrev: it.unitAbbrev || '',
        qty,
        unitPrice,
        lineTotal,
      };
    }),
    totals: {
      subtotal: Number(totals.subtotal ?? 0),
      tax: Number(totals.tax ?? 0),
      taxRate: Number(totals.taxRate ?? 0),
      discount: Number(totals.discount ?? 0),
      total: Number(totals.total ?? 0),
    },
    paymentMethod: titleCase(paymentMethodRaw),
  };
}

/* ── skeleton ───────────────────────────────────────────────── */

function Sk({ width, height, r = 8, style, c }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
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
    <Animated.View
      style={[
        { backgroundColor: c.surfaceElevated, opacity: pulse },
        { width, height, borderRadius: r },
        style,
      ]}
    />
  );
}

function ReceiptSkeleton({ styles, c }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={false}>
        <View style={styles.paper}>
          <Sk width="50%" height={18} r={6} c={c} />
          <Sk width="70%" height={12} r={5} style={{ marginTop: 8 }} c={c} />
          <Sk
            width="100%"
            height={1}
            r={0}
            style={{ marginTop: 16, marginBottom: 12 }}
            c={c}
          />
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginVertical: 6,
              }}
            >
              <Sk width="55%" height={12} r={5} c={c} />
              <Sk width={60} height={12} r={5} c={c} />
            </View>
          ))}
          <Sk
            width="100%"
            height={1}
            r={0}
            style={{ marginTop: 12, marginBottom: 10 }}
            c={c}
          />
          <Sk width="40%" height={20} r={6} c={c} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── screen ─────────────────────────────────────────────────── */

export default function ReceiptScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const {
    formatCurrency,
    getShopName,
    getReceiptHeader,
    getReceiptFooter,
  } = useSettings();

  const saleId = route?.params?.saleId ?? null;

  const [envelope, setEnvelope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const mountedRef = useRef(true);
  const shotRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!activeOrganization?.id || !saleId) {
      setLoading(false);
      setError(!saleId ? 'No sale selected.' : 'No organization loaded.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/api/v1/organizations/${activeOrganization.id}/kxtill/sales/${saleId}/receipt`
      );
      const env = data?.receipt
        ? data
        : data?.data?.receipt
          ? data.data
          : data?.data || data;
      if (mountedRef.current) setEnvelope(env);
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e?.response?.data?.message ||
            e?.message ||
            'Could not load this receipt'
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [activeOrganization?.id, saleId]);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo(
    () => (envelope ? normalizeEnvelope(envelope) : null),
    [envelope]
  );

  const shopName =
    data?.shop?.name || getShopName() || activeOrganization?.name || '';
  const receiptHeader = data?.receipt?.header || getReceiptHeader() || '';
  const receiptFooter = data?.receipt?.footer || getReceiptFooter() || '';
  const branchName = data?.sale?.branchName || '';
  const reference = data?.sale?.reference || data?.receipt?.number || '—';
  const createdAt = data?.sale?.createdAt || '';
  const cashierName = data?.sale?.cashierName || '';
  const customerName = data?.sale?.customerName || '';
  const paymentMethod = data?.paymentMethod || 'Cash';

  const items = data?.items || [];
  const subtotal = data?.totals?.subtotal ?? 0;
  const tax = data?.totals?.tax ?? 0;
  const discount = data?.totals?.discount ?? 0;
  const total = data?.totals?.total ?? 0;

  const showCashier = data?.receipt?.showCashier !== false;
  const showCustomer = data?.receipt?.showCustomer !== false;
  const showTax = data?.receipt?.showTax !== false;

  const buildReceiptText = useCallback(() => {
    const lines = [];
    lines.push(receiptHeader || shopName);
    if (branchName) lines.push(branchName);
    lines.push('');
    lines.push(`Ref: ${reference}`);
    if (createdAt) lines.push(`Date: ${fmtDateTime(createdAt)}`);
    if (showCashier && cashierName) lines.push(`Cashier: ${cashierName}`);
    if (showCustomer && customerName) lines.push(`Customer: ${customerName}`);
    lines.push('—'.repeat(28));
    for (const it of items) {
      lines.push(
        `${it.name}  x${it.qty}  ${formatCurrency(it.lineTotal)}`
      );
    }
    lines.push('—'.repeat(28));
    lines.push(`Subtotal: ${formatCurrency(subtotal)}`);
    if (discount) lines.push(`Discount: -${formatCurrency(discount)}`);
    if (showTax && tax) lines.push(`Tax: ${formatCurrency(tax)}`);
    lines.push(`TOTAL: ${formatCurrency(total)}`);
    lines.push(`Paid via: ${paymentMethod}`);
    if (receiptFooter) {
      lines.push('');
      lines.push(receiptFooter);
    }
    return lines.join('\n');
  }, [
    receiptHeader,
    shopName,
    branchName,
    reference,
    createdAt,
    showCashier,
    cashierName,
    showCustomer,
    customerName,
    items,
    subtotal,
    discount,
    showTax,
    tax,
    total,
    paymentMethod,
    receiptFooter,
    formatCurrency,
  ]);

  /* ── HTML for PDF ───────────────────────────────────────── */

  const buildReceiptHtml = useCallback(() => {
    const itemRows = items
      .map((it) => {
        const metaParts = [`${it.qty}${it.unitAbbrev ? ` ${it.unitAbbrev}` : ''} × ${formatCurrency(it.unitPrice)}`];
        if (it.sku) metaParts.push(it.sku);
        return `
          <tr>
            <td class="item-name">
              <div class="name">${escapeHtml(it.name)}</div>
              <div class="meta">${escapeHtml(metaParts.join(' · '))}</div>
            </td>
            <td class="item-amount">${escapeHtml(formatCurrency(it.lineTotal))}</td>
          </tr>`;
      })
      .join('');

    const discountRow = discount
      ? `<tr><td>Discount</td><td class="right">-${escapeHtml(formatCurrency(discount))}</td></tr>`
      : '';
    const taxRow =
      showTax && tax
        ? `<tr><td>Tax</td><td class="right">${escapeHtml(formatCurrency(tax))}</td></tr>`
        : '';
    const cashierRow =
      showCashier && cashierName
        ? `<tr><td>Cashier</td><td>${escapeHtml(cashierName)}</td></tr>`
        : '';
    const customerRow =
      showCustomer && customerName
        ? `<tr><td>Customer</td><td>${escapeHtml(customerName)}</td></tr>`
        : '';
    const footerBlock = receiptFooter
      ? `<div class="footer">${escapeHtml(receiptFooter)}</div>`
      : '';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 24pt; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #111;
    font-size: 12px;
    margin: 0;
  }
  .header { text-align: center; margin-bottom: 16px; }
  .shop { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
  .branch { color: #666; margin-top: 2px; }
  .rule { border-top: 1px dashed #999; margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; vertical-align: top; }
  .meta td:first-child { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; width: 30%; }
  .item-name .name { font-weight: 700; }
  .item-name .meta { color: #666; font-size: 10px; margin-top: 2px; }
  .item-amount { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .totals td { font-size: 12px; }
  .totals .right { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row { margin-top: 8px; }
  .total-row td { font-size: 16px; font-weight: 800; }
  .pay { color: #666; font-size: 11px; margin-top: 10px; }
  .footer { text-align: center; color: #666; font-style: italic; margin-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="shop">${escapeHtml(receiptHeader || shopName)}</div>
    ${branchName ? `<div class="branch">${escapeHtml(branchName)}</div>` : ''}
  </div>

  <div class="rule"></div>

  <table class="meta">
    <tr><td>Date</td><td>${escapeHtml(fmtDateTime(createdAt) || '—')}</td></tr>
    <tr><td>Ref</td><td>${escapeHtml(reference)}</td></tr>
    ${cashierRow}
    ${customerRow}
  </table>

  <div class="rule"></div>

  <table>
    ${itemRows}
  </table>

  <div class="rule"></div>

  <table class="totals">
    <tr><td>Subtotal</td><td class="right">${escapeHtml(formatCurrency(subtotal))}</td></tr>
    ${discountRow}
    ${taxRow}
  </table>

  <div class="rule"></div>

  <table class="total-row">
    <tr><td>TOTAL</td><td class="right">${escapeHtml(formatCurrency(total))}</td></tr>
  </table>

  <div class="pay">Paid via ${escapeHtml(paymentMethod)}</div>

  ${footerBlock}
</body>
</html>`;
  }, [
    receiptHeader,
    shopName,
    branchName,
    reference,
    createdAt,
    showCashier,
    cashierName,
    showCustomer,
    customerName,
    items,
    subtotal,
    discount,
    showTax,
    tax,
    total,
    paymentMethod,
    receiptFooter,
    formatCurrency,
  ]);

  /* ── image capture + share ──────────────────────────────── */

  const shareImage = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if (!shotRef.current) throw new Error('Receipt not ready');
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'Cannot share',
          'Sharing is not available on this device.'
        );
        return;
      }
      const uri = await shotRef.current.capture({
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share receipt',
        UTI: 'public.png',
      });
    } catch (e) {
      try {
        await Share.share({
          title: 'Receipt',
          message: buildReceiptText(),
        });
      } catch {
        Alert.alert(
          'Share failed',
          e?.message || 'Could not share this receipt.'
        );
      }
    } finally {
      if (mountedRef.current) setSharing(false);
    }
  }, [sharing, buildReceiptText]);

  const sharePdf = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'Cannot share',
          'Sharing is not available on this device.'
        );
        return;
      }
      const html = buildReceiptHtml();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share receipt',
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert(
        'PDF failed',
        e?.message || 'Could not generate the PDF.'
      );
    } finally {
      if (mountedRef.current) setPdfBusy(false);
    }
  }, [pdfBusy, buildReceiptHtml]);

  const onSms = async () => {
    const text = encodeURIComponent(buildReceiptText());
    const url =
      Platform.OS === 'ios' ? `sms:&body=${text}` : `sms:?body=${text}`;
    try {
      await Linking.openURL(url);
    } catch {
      await Share.share({ message: buildReceiptText() });
    }
  };

  const onCopy = async () => {
    try {
      await Share.share({
        title: 'Receipt',
        message: buildReceiptText(),
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      Alert.alert('Copy failed', 'Could not open the share sheet.');
    }
  };

  if (loading && !data) {
    return <ReceiptSkeleton styles={styles} c={c} />;
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyState}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={c.danger}
          />
          <Text style={styles.emptyTitle}>Could not open receipt</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={load}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom:
              Math.max(insets.bottom, 16) + (items.length > 0 ? 220 : 160),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ViewShot
          ref={shotRef}
          options={{
            format: 'png',
            quality: 1,
            result: 'tmpfile',
            backgroundColor: c.background,
          }}
          style={{ backgroundColor: c.background, padding: 16 }}
        >
          <View style={styles.paper}>
            <View style={styles.paperHead}>
              <Text style={styles.shopName} numberOfLines={2}>
                {shopName}
              </Text>
              {branchName ? (
                <Text style={styles.shopSub} numberOfLines={2}>
                  {branchName}
                </Text>
              ) : null}
            </View>

            <View style={styles.dashed} />

            <View style={styles.metaGrid}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>DATE</Text>
                <Text style={styles.metaValue} numberOfLines={2}>
                  {fmtDateTime(createdAt) || '—'}
                </Text>
              </View>
              {showCashier && cashierName ? (
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>CASHIER</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {cashierName}
                  </Text>
                </View>
              ) : null}
            </View>

            {showCustomer && customerName ? (
              <View style={styles.metaGrid}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>CUSTOMER</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {customerName}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>REF</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {reference}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.dashed} />

            {items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {it.name}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {it.qty}
                    {it.unitAbbrev ? ` ${it.unitAbbrev}` : ''} ×{' '}
                    {formatCurrency(it.unitPrice)}
                    {it.sku ? ` · ${it.sku}` : ''}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>
                  {formatCurrency(it.lineTotal)}
                </Text>
              </View>
            ))}

            <View style={styles.dashed} />

            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(subtotal)}
              </Text>
            </View>
            {discount ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={[styles.totalsValue, { color: c.success }]}>
                  −{formatCurrency(discount)}
                </Text>
              </View>
            ) : null}
            {showTax && tax ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>
                  {formatCurrency(tax)}
                </Text>
              </View>
            ) : null}

            <View style={styles.dashed} />

            <View style={styles.totalBigRow}>
              <Text style={styles.totalBigLabel}>TOTAL</Text>
              <Text style={styles.totalBigValue} numberOfLines={1}>
                {formatCurrency(total)}
              </Text>
            </View>

            <View style={styles.payRow}>
              <Ionicons name="card-outline" size={14} color={c.textMuted} />
              <Text style={styles.payText} numberOfLines={1}>
                Paid via {paymentMethod}
              </Text>
            </View>

            {receiptFooter ? (
              <>
                <View style={styles.dashed} />
                <Text style={styles.footer}>{receiptFooter}</Text>
              </>
            ) : null}
          </View>
        </ViewShot>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.sharePrimary,
            (pressed || sharing) && { opacity: 0.9 },
          ]}
          onPress={shareImage}
          disabled={sharing || pdfBusy}
          accessibilityRole="button"
          accessibilityLabel="Share receipt"
        >
          <Ionicons
            name={sharing ? 'hourglass-outline' : 'share-outline'}
            size={18}
            color={c.textOnPrimary}
          />
          <Text style={styles.sharePrimaryText}>
            {sharing ? 'Preparing…' : 'Share receipt'}
          </Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <SecondaryButton
            c={c}
            icon="document-text-outline"
            label="PDF"
            color={c.primary}
            onPress={sharePdf}
            disabled={pdfBusy || sharing}
          />
          <SecondaryButton
            c={c}
            icon="logo-whatsapp"
            label="WhatsApp"
            color="#25D366"
            onPress={shareImage}
            disabled={sharing || pdfBusy}
          />
          <SecondaryButton
            c={c}
            icon="chatbubble-ellipses"
            label="SMS"
            color="#0A84FF"
            onPress={onSms}
            disabled={sharing || pdfBusy}
          />
          <SecondaryButton
            c={c}
            icon={copied ? 'checkmark' : 'copy-outline'}
            label={copied ? 'Copied' : 'Copy'}
            color={copied ? c.success : c.textSecondary}
            onPress={onCopy}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SecondaryButton({ c, icon, label, color, onPress, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.9,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };
  const onOut = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled}
        style={({ pressed }) => [
          {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surfaceElevated,
            borderWidth: 1,
            borderColor: c.border,
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={20} color={color} />
      </Pressable>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: c.textMuted,
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },

    paper: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
    },
    paperHead: { alignItems: 'center', marginBottom: spacing.md },
    shopName: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    shopSub: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'center',
    },

    dashed: {
      height: 1,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.borderStrong || c.border,
      borderRadius: 1,
      marginVertical: spacing.md,
    },

    metaGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      marginVertical: 4,
    },
    metaCol: { flex: 1 },
    metaLabel: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },
    metaValue: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },

    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingVertical: 8,
    },
    itemName: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    itemMeta: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    itemAmount: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },

    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    totalsLabel: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    totalsValue: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },

    totalBigRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    totalBigLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.4,
    },
    totalBigValue: {
      color: c.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums'],
    },

    payRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.md,
    },
    payText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },

    footer: {
      color: c.textSecondary,
      fontSize: 12,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 4,
    },

    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    sharePrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minHeight: 54,
      borderRadius: 14,
      backgroundColor: c.primary,
    },
    sharePrimaryText: {
      color: c.textOnPrimary,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    secondaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginTop: spacing.md,
    },

    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginTop: spacing.md,
    },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 280,
      marginBottom: spacing.md,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
  });