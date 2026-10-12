import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, Dimensions, Platform, StyleSheet,
} from 'react-native';
import Orders from '@/components/dashboard/Orders';
import Listings from '@/components/dashboard/Listings';
import Payouts from '@/components/dashboard/Payouts';
import Sales from '@/components/dashboard/Sales';
import Saved from '@/components/dashboard/Saved';
import Reports from '@/components/dashboard/Reports';
import Deliveries from '@/components/dashboard/Deliveries';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import Overview from '@/components/dashboard/Overview';

import {
  ChevronLeft, ChevronDown, Plus, ShoppingBag, TrendingUp, Tag, Wallet,
  Store, Package, Truck, Flag, Bookmark, CheckCircle,
} from 'lucide-react-native';
import api from '@/api/client';
import { requestDrawerReopen } from '@/utils/drawerSignal';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_VIDEO } from '@/data/media';
import { useColors } from '@/hooks/useColors';
import { usePageReady } from '@/hooks/usePageReady';
import FullPageLoader from '@/components/FullPageLoader';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

function GlassButton({ onPress, style, children, tint }: any) {
  if (GLASS) {
    const { backgroundColor, borderWidth, borderColor, alignSelf, ...rest } = StyleSheet.flatten(style) as any;
    return (
      <Pressable onPress={onPress} style={{ alignSelf }}>
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={tint}
          style={rest}
        >
          {children}
        </GlassView>
      </Pressable>
    );
  }
  return <Pressable onPress={onPress} style={style}>{children}</Pressable>;
}

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '6months', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  listings: 'Listings',
  payouts: 'Payouts',
  orders: 'Orders',
  deliveries: 'Deliveries',
  completed: 'Completed\nOrders',
  sales: 'Sales',
  reports: 'Reports',
  saved: 'Saved',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Dashboard() {
  const colors = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();

useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', () => {
    console.log('[dashboard] beforeRemove fired');
    requestDrawerReopen();
  });
  return unsubscribe;
}, [navigation]);

  const isSeller = user?.account_type === 'seller';
  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  const tabs = isSeller
    ? ['overview', 'listings', 'payouts', 'orders', 'completed', 'deliveries', 'sales', 'reports']
    : [...(isPlanActive ? ['saved'] : []), 'orders', 'completed', 'reports'];

  const { tab: paramTab, highlightOrder } = useLocalSearchParams<{ tab?: string; highlightOrder?: string }>();

  const defaultTab = isSeller ? 'payouts' : 'orders';
  const initialTab = paramTab && tabs.includes(String(paramTab)) ? String(paramTab) : defaultTab;
  const [tab, setTab] = useState(initialTab);
  const [period, setPeriod] = useState('month');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set([initialTab]));
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  useEffect(() => {
    if (paramTab && tabs.includes(String(paramTab))) {
      setVisitedTabs((prev) => new Set(prev).add(String(paramTab)));
      setTab(String(paramTab));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTab]);

  const { status: pageStatus, data: pageData, retry: retryPage } = usePageReady({
    load: () => {
      if (isSeller) {
        return Promise.all([
          api.get('/products/mine').catch(() => ({ data: [] })),
          api.get('/orders/sales').catch(() => ({ data: [] })),
          api.get('/orders/deliveries').catch(() => ({ data: [] })),
        ]).then(([listings, sales, activeOrders]) => ({
          listings: listings.data.length,
          orders: activeOrders.data.length,
                    sales: sales.data.filter((x: any) => x.status !== 'cancelled').length,
          completed: 0,
          pending: 0,
        }));
      }
      return api.get('/orders/mine').catch(() => ({ data: [] })).then((res) => {
        const orders = res.data;
        return {
          listings: 0,
          orders: orders.length,
          sales: 0,
          completed: orders.filter((o: any) => o.status === 'completed').length,
          pending: orders.filter((o: any) => o.status !== 'completed').length,
        };
      });
    },
    videos: [DASHBOARD_VIDEO],
    deps: [isSeller],
  });

  const stats = pageData || { listings: 0, orders: 0, sales: 0, completed: 0, pending: 0 };

  const scrollRef = useRef<ScrollView>(null);
  const deliveriesScrollRef = useRef<ScrollView>(null);
  const tabBarRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const tabBarWidth = useRef(0);
  const tabBarContentWidth = useRef(0);

  const centerTab = (t: string) => {
    const layout = tabLayouts.current[t];
    if (!layout || !tabBarRef.current) return;
    const maxScroll = Math.max(0, tabBarContentWidth.current - tabBarWidth.current);
    const target = layout.x + layout.width / 2 - tabBarWidth.current / 2;
    tabBarRef.current.scrollTo({ x: Math.min(maxScroll, Math.max(0, target)), animated: true });
  };

  useEffect(() => {
    centerTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const currentIndex = tabs.indexOf(tab);
  const didMountRef = useRef(false);
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (scrollRef.current && currentIndex >= 0) {
      scrollRef.current.scrollTo({ x: currentIndex * SCREEN_WIDTH, animated: didMountRef.current });
      didMountRef.current = true;
    }
  }, [currentIndex]);

  const changeTab = (nextTab: string) => {
    setVisitedTabs((prev) => new Set(prev).add(nextTab));
    setTab(nextTab);
  };

  const onMomentumEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_WIDTH);
    const nextTab = tabs[idx];
    if (nextTab && nextTab !== tab) {
      setVisitedTabs((prev) => new Set(prev).add(nextTab));
      setTab(nextTab);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'User';
  const currentPeriodLabel = PERIODS.find((p) => p.value === period)?.label || 'This month';

  if (pageStatus === 'loading' || pageStatus === 'error') {
    return <FullPageLoader screen="dashboard" status={pageStatus} onRetry={retryPage} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER with video */}
      <View style={{ position: 'relative', overflow: 'hidden', height: 260 }}>
        <DashboardVideo uri={DASHBOARD_VIDEO} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.headerOverlay }} />

        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          {/* Back + greeting */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <GlassButton
              onPress={() => router.replace('/profile')}
              style={{
                width: 28, height: 48, borderRadius: 12,
                backgroundColor: colors.headerPill,
                borderWidth: 1, borderColor: colors.headerPillBorder,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={18} color="white" />
            </GlassButton>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: 'white' }} numberOfLines={1}>
                Hi, {firstName} 👋
              </Text>
              <Text style={{ fontSize: 15, color: colors.headerMuted, marginTop: 2 }} numberOfLines={1}>
                {user?.university_email}
              </Text>
            </View>
          </View>

          {/* Period picker + New Listing */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 40 }}>
            <GlassButton
              onPress={() => setShowPeriodPicker((v) => !v)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: colors.headerPill,
                borderWidth: 1, borderColor: colors.headerPillBorder,
                height: 32, paddingHorizontal: 12, borderRadius: 999,
              }}
            >
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>{currentPeriodLabel}</Text>
              {showPeriodPicker ? <ChevronUp size={12} color="white" /> : <ChevronDown size={12} color="white" />}
            </GlassButton>

            {isSeller && (
              <GlassButton
                tint="white"
                onPress={() => router.push({ pathname: '/sell', params: { from: 'dashboard' } })}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1,
                  backgroundColor: 'white',
                  borderWidth: 1, borderColor: 'white',
                  height: 29, paddingHorizontal: 12, borderRadius: 999,
                }}
              >
                <Plus size={12} color={colors.brandDark} />
                <Text style={{ color: colors.brandDark, fontSize: 14, fontWeight: '700' }}>New Listing</Text>
              </GlassButton>
            )}
          </View>

          {/* Stats cards */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            {isSeller ? (
              <>
                <StatCard icon={<Tag size={14} color={colors.headerMuted} />} label="Listings" value={stats.listings} />
                <StatCard icon={<ShoppingBag size={14} color={colors.headerMuted} />} label="Orders" value={stats.orders} />
                <StatCard icon={<TrendingUp size={14} color={colors.headerMuted} />} label="Sales" value={stats.sales} />
              </>
            ) : (
              <>
                <StatCard icon={<ShoppingBag size={14} color={colors.headerMuted} />} label="Total orders" value={stats.orders} />
                <StatCard icon={<Package size={14} color={colors.headerMuted} />} label="Completed" value={stats.completed} />
                <StatCard icon={<TrendingUp size={14} color={colors.headerMuted} />} label="Pending" value={stats.pending} />
              </>
            )}
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          ref={tabBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => { tabBarWidth.current = e.nativeEvent.layout.width; }}
          onContentSizeChange={(w) => { tabBarContentWidth.current = w; setTimeout(() => centerTab(tab), 0); }}
          contentContainerStyle={{ paddingHorizontal: 12, flexGrow: 1, justifyContent: 'center' }}
        >
          {tabs.map((t) => {
            const active = t === tab;
            const Icon = TAB_ICONS[t];
            return (
              <Pressable
                key={t}
                onPress={() => changeTab(t)}
                onLayout={(e) => {
                  tabLayouts.current[t] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                  if (t === tab) setTimeout(() => centerTab(t), 0);
                }}
                style={{
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  paddingHorizontal: 18, height: 40,
                }}
              >
                 {Icon && <Icon size={13} color={active ? colors.brand : colors.textFaint} strokeWidth={active ? 2.4 : 2} />}
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.brand : colors.textFaint,
                    textAlign: 'center',
                  }}
                >
                  {TAB_LABELS[t]}
                </Text>
                {active && (
                  <View
                    style={{
                      position: 'absolute', bottom: -1, alignSelf: 'center',
                      height: 3, width: 28, borderRadius: 999, backgroundColor: colors.brand,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Swipeable panels */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        onContentSizeChange={() => {
          if (!didInitialScroll.current && currentIndex > 0) {
            scrollRef.current?.scrollTo({ x: currentIndex * SCREEN_WIDTH, animated: false });
            didInitialScroll.current = true;
          }
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {tabs.map((t) => (
          <View key={t} style={{ width: SCREEN_WIDTH, flex: 1 }}>
            <ScrollView ref={t === 'deliveries' ? deliveriesScrollRef : undefined} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              {visitedTabs.has(t) ?<TabPanel tab={t} period={period} isSeller={isSeller} active={t === tab} onScrollToY={(y: number) => deliveriesScrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })} highlightOrder={(t === 'deliveries' || t === 'orders') ? (highlightOrder ? String(highlightOrder) : undefined) : undefined} /> : <View style={{ height: 200 }} />}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      {tabs.length > 1 && (
        <View
          style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            flexDirection: 'row', justifyContent: 'center', gap: 6,
            pointerEvents: 'box-none',
          }}
        >
          <View style={{ flexDirection: 'row', gap: 6, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
            {tabs.map((t) => (
              <Pressable
                key={t}
                onPress={() => changeTab(t)}
                style={{
                  width: t === tab ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: t === tab ? colors.brand : colors.textFaint,
                }}
              />
            ))}
          </View>
        </View>
      )}

      {/* Period dropdown */}
      {showPeriodPicker && (
        <>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
            onPress={() => setShowPeriodPicker(false)}
          />
          <PeriodDropdown
            colors={colors}
            period={period}
            onSelect={(v: string) => { setPeriod(v); setShowPeriodPicker(false); }}
          />
        </>
      )}
    </View>
  );
}

// ---- Helpers ----

const TAB_ICONS: Record<string, any> = {
  overview: Store,
  listings: Tag,
  payouts: Wallet,
  orders: ShoppingBag,
  deliveries: Truck,
  completed: CheckCircle,
  sales: TrendingUp,
  reports: Flag,
  saved: Bookmark,
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 10 }}>
      {icon}
      <Text style={{ fontSize: 22, fontWeight: '800', color: 'white', marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function PeriodDropdown({ colors, period, onSelect }: { colors: any; period: string; onSelect: (v: string) => void }) {
  const items = PERIODS.map((p) => {
    const active = p.value === period;
    return (
      <Pressable
        key={p.value}
        onPress={() => onSelect(p.value)}
        style={{
          paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, marginHorizontal: 6,
          backgroundColor: active ? colors.brandSoft : 'transparent',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: active ? '700' : '500', color: active ? colors.brand : colors.textSecondary }}>
          {p.label}
        </Text>
      </Pressable>
    );
  });

  const box = { position: 'absolute' as const, top: 146, left: 16, zIndex: 100, minWidth: 190 };

  if (GLASS) {
    return (
      <View style={box}>
        <GlassView glassEffectStyle="regular" isInteractive style={{ borderRadius: 12, overflow: 'hidden', paddingVertical: 6 }}>
          {items}
        </GlassView>
      </View>
    );
  }
  return (
    <View style={[box, { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingVertical: 6 }]}>
      {items}
    </View>
  );
}

function DashboardVideo({ uri }: { uri: string | number }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => { player.play(); }, [player]);
  return (
    <VideoView
      player={player}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function TabPanel({ tab, period, isSeller, active, highlightOrder, onScrollToY }: { tab: string; period: string; isSeller: boolean; active: boolean; highlightOrder?: string; onScrollToY?: (y: number) => void }) {  if (tab === 'overview') return <Overview period={period} />;
  if (tab === 'listings') return <Listings />;
  if (tab === 'payouts') return <Payouts period={period} active={active} />;
  if (tab === 'orders') return <Orders period={period} isSeller={isSeller} highlightOrder={highlightOrder} />;
  if (tab === 'completed') return <Orders period={period} isSeller={isSeller} mode="completed" />;
  if (tab === 'deliveries') return <Deliveries highlightOrder={highlightOrder} onScrollToY={onScrollToY} />;
  if (tab === 'sales') return <Sales />;
  if (tab === 'reports') return <Reports />;
  if (tab === 'saved') return <Saved />;
  return null;
}