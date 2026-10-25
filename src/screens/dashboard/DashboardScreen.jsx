// src/screens/dashboard/DashboardScreen.jsx
//
// Home tab. Renders the mobile dashboard from GET .../kxtill/mobile/dashboard.
// Sections are shown only when the backend returns them (null = hidden).
//
// Currency is read from SettingsContext (KxTill setting, falling back to
// the organization currency), never from the sales payload.

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useNotificationsUnread } from '../../hooks/useNotificationsUnread';
import { useSettings } from '../../context/SettingsContext';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { ROUTES } from '../../constants/routes';

import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardSearch } from './hooks/useDashboardSearch';
import { useDashboardScope } from './hooks/useDashboardScope';

import DashboardHeader from './components/DashboardHeader';
import SalesHeroCard from './components/SalesHeroCard';
import PulseRow from './components/PulseRow';
import Section from './components/Section';
import AttentionList from './components/AttentionList';
import QuickActions from './components/QuickActions';
import BranchPerformance from './components/BranchPerformance';
import ShiftCard from './components/ShiftCard';
import PaymentMix from './components/PaymentMix';
import TopProducts from './components/TopProducts';
import RecentActivity from './components/RecentActivity';
import ScopePickerModal from './components/ScopePickerModal';
import EmptyState from './components/EmptyState';
import DashboardSkeleton from './components/skeletons/DashboardSkeleton';

const pickAttention = (a) => [a.title, a.body];
const pickAction = (a) => [a.label];
const pickBranch = (b) => [b.name];
const pickProduct = (p) => [p.name];
const pickRecent = (r) => [r.title, r.sub];

export default function DashboardScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isOwner } = usePermissions();
  const { activeOrganization, branches: orgBranches } = useOrganizationContext();
  const { getCurrency } = useSettings();
  const unreadCount = useNotificationsUnread();

  const [scopeModalOpen, setScopeModalOpen] = useState(false);

  // Scope FIRST — no data dependency.
  const {
    viewBranchId,
    scopeLabel,
    scopeOptions,
    canSeeOrgWide,
    pickScope,
  } = useDashboardScope({ isOwner });

  // Data SECOND — depends on viewBranchId.
  const { data, loading, refreshing, error, staleError, refresh, reload } =
    useDashboardData({
      organizationId: activeOrganization?.id,
      branchId: viewBranchId,
    });

  // Search.
  const {
    input: query,
    setInput: setQuery,
    searching,
    filter,
    clear: clearQuery,
  } = useDashboardSearch();

  const effectiveCanSeeOrgWide =
    canSeeOrgWide || data?.scope?.isOrgWide === true;

  const firstName =
    user?.firstName || user?.name?.split?.(' ')?.[0] || 'there';
  const initial = firstName.trim().charAt(0).toUpperCase() || '?';

  // ── Derived payload slices ──────────────────────────────────────
  const sales = data?.sales || null;
  const pulse = data?.pulse || null;
  const attentionAll = Array.isArray(data?.attention) ? data.attention : [];
  const branchesAll = Array.isArray(data?.branches) ? data.branches : [];
  const productsAll = Array.isArray(data?.products) ? data.products : [];
  const recentAll = Array.isArray(data?.recent) ? data.recent : [];
  const shortcutsAll = Array.isArray(data?.shortcuts) ? data.shortcuts : [];
  const shift = data?.shift || null;
  const payments = data?.payments || null;

  const attention = filter(attentionAll, pickAttention);
  const actions = filter(shortcutsAll, pickAction);
  const branches = filter(branchesAll, pickBranch);
  const products = filter(productsAll, pickProduct);
  const recent = filter(recentAll, pickRecent);

  const noResults =
    searching &&
    !attention.length &&
    !actions.length &&
    !branches.length &&
    !products.length &&
    !recent.length;

  // Currency comes from SettingsContext — KxTill setting, then org fallback.
  const currency = getCurrency();
  const gross = Number(sales?.gross || 0);
  const delta = sales?.deltaPct;

  const showAggregates = !searching && !error;
  const showStaleChip = !!staleError && !!data;

  // ── Handlers ────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const onOpenScope = useCallback(() => {
    if (!effectiveCanSeeOrgWide) return;
    setScopeModalOpen(true);
  }, [effectiveCanSeeOrgWide]);

  const onCloseScope = useCallback(() => setScopeModalOpen(false), []);

  const onPickScope = useCallback(
    (id) => {
      setScopeModalOpen(false);
      pickScope(id);
    },
    [pickScope]
  );

  const onPressBell = useCallback(() => {
    navigation.navigate(ROUTES.TAB_NOTIFICATIONS);
  }, [navigation]);

  const onPressAttention = useCallback(
    (item) => {
      navigation.navigate(ROUTES.TAB_NOTIFICATIONS, {
        scopeBranchId: item?.metadata?.branchId || viewBranchId || null,
      });
    },
    [navigation, viewBranchId]
  );

  const onPressSeeAttention = useCallback(() => {
    navigation.navigate(ROUTES.TAB_NOTIFICATIONS, {
      scopeBranchId: viewBranchId || null,
    });
  }, [navigation, viewBranchId]);

  const onPressAction = useCallback(
    (action) => {
      if (!action) return;

      if (action.id === 'branches') {
        navigation.navigate(ROUTES.TAB_BUSINESS);
        return;
      }

      if (action.id === 'stock') {
        if (viewBranchId) {
          navigation.navigate(ROUTES.TAB_BUSINESS, {
            screen: ROUTES.BRANCH_STOCK,
            params: {
              branchId: viewBranchId,
              branchName:
                orgBranches?.find((b) => b.id === viewBranchId)?.name || null,
            },
          });
          return;
        }
        navigation.navigate(ROUTES.TAB_BUSINESS);
        return;
      }

    
    },
    [navigation, viewBranchId, orgBranches]
  );



  // ── Early returns ───────────────────────────────────────────────
  if (loading && !data && !error) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errorWrap}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load dashboard"
            body={error}
            actionLabel="Try again"
            onAction={() => reload()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      >
        <DashboardHeader
          firstName={firstName}
          initial={initial}
          orgName={activeOrganization?.name}
          scopeLabel={scopeLabel}
          canSeeOrgWide={effectiveCanSeeOrgWide}
          onOpenScope={onOpenScope}
          query={query}
          onQueryChange={setQuery}
          onClearQuery={clearQuery}
          onPressBell={onPressBell}
          unreadCount={unreadCount}
        />

        <View style={styles.body}>
          {showStaleChip ? (
            <View style={styles.staleChip}>
              <Ionicons
                name="cloud-offline-outline"
                size={14}
                color={c.warning || c.textSecondary}
              />
              <Text style={styles.staleText} numberOfLines={2}>
                Showing last saved data · {staleError}
              </Text>
            </View>
          ) : null}

          {showAggregates && sales ? (
            <SalesHeroCard
              currency={currency}
              gross={gross}
              delta={delta}
            />
          ) : null}

          {showAggregates && pulse ? <PulseRow pulse={pulse} /> : null}

          {attention.length > 0 ? (
            <Section
              title="Needs attention"
              badge={String(attention.length)}
              action={searching ? null : 'See all'}
              onAction={searching ? null : onPressSeeAttention}
            >
              <AttentionList
                items={attention}
                onPressItem={onPressAttention}
              />
            </Section>
          ) : null}

          {actions.length > 0 ? (
            <Section title="Quick actions">
              <QuickActions items={actions} onPress={onPressAction} />
            </Section>
          ) : null}

          {branches.length > 0 ? (
<Section
  title="Branch performance"

>
              <BranchPerformance currency={currency} branches={branches} />
            </Section>
          ) : null}

          {shift ? (
            <Section title="Your shift">
              <ShiftCard currency={currency} shift={shift} />
            </Section>
          ) : null}

          {showAggregates && payments?.methods?.length ? (
            <Section title="Payment mix">
              <PaymentMix methods={payments.methods} />
            </Section>
          ) : null}

          {products.length > 0 ? (
            <Section
              title="Top products"
           
            >
              <TopProducts currency={currency} products={products} />
            </Section>
          ) : null}

          {recent.length > 0 ? (
            <Section title="Recent activity">
              <RecentActivity currency={currency} items={recent} />
            </Section>
          ) : null}

          {noResults ? (
            <EmptyState
              icon="search-outline"
              title={`No matches for "${query.trim()}"`}
              body="Try a different product, branch or person."
            />
          ) : null}
        </View>
      </ScrollView>

      <ScopePickerModal
        visible={scopeModalOpen}
        options={scopeOptions}
        value={viewBranchId}
        onPick={onPickScope}
        onClose={onCloseScope}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.hero },
    scrollView: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxxl },
    body: { paddingHorizontal: spacing.xl },
    errorWrap: { flex: 1, justifyContent: 'center' },
    staleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    staleText: {
      ...typography.caption,
      color: c.textSecondary,
      flex: 1,
      fontWeight: '600',
    },
  });