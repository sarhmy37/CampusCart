import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, Dimensions,
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
  completed: 'Completed',
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
            <Pressable
              onPress={() => router.replace('/profile')}
              style={{
                width: 28, height: 48, borderRadius: 12,
                backgroundColor: colors.headerPill,
                borderWidth: 1, borderColor: colors.headerPillBorder,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={18} color="white" />
            </Pressable>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: 'white' }} numberOfLines={1}>
                Hi, {firstName} 👋
              </Text>
              <Text style={{ fontSize: 13, color: colors.headerMuted, marginTop: 2 }} numberOfLines={1}>
                {user?.university_email}
              </Text>
            </View>
          </View>

          {/* Period picker + New Listing */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 40 }}>
            <Pressable
              onPress={() => setShowPeriodPicker(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.headerPill,
                borderWidth: 1, borderColor: colors.headerPillBorder,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{currentPeriodLabel}</Text>
              <ChevronDown size={12} color="white" />
            </Pressable>

            {isSeller && (
              <Pressable
                onPress={() => router.push({ pathname: '/sell', params: { from: 'dashboard' } })}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: 'white',
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                }}
              >
                <Plus size={14} color={colors.brandDark} />
                <Text style={{ color: colors.brandDark, fontSize: 12, fontWeight: '700' }}>New Listing</Text>
              </Pressable>
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
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, flexGrow: 1, justifyContent: 'center' }}
        >
          {tabs.map((t) => {
            const active = t === tab;
            const Icon = TAB_ICONS[t];
            return (
              <Pressable
                key={t}
                onPress={() => changeTab(t)}
                style={{
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  paddingHorizontal: 18, height: 40,
                }}
              >
                 {Icon && <Icon size={13} color={active ? colors.brand : colors.textFaint} strokeWidth={active ? 2.4 : 2} />}
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.brand : colors.textFaint,
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
              {visitedTabs.has(t) ?<TabPanel tab={t} period={period} isSeller={isSeller} active={t === tab} onScrollToY={(y: number) => deliveriesScrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })} highlightOrder={t === 'deliveries' ? (highlightOrder ? String(highlightOrder) : undefined) : undefined} /> : <View style={{ height: 200 }} />}
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

      {/* Period picker modal */}
      {showPeriodPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.overlayLight, zIndex: 100 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowPeriodPicker(false)} />
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingVertical: 8, minWidth: 220, borderWidth: 1, borderColor: colors.border }}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => { setPeriod(p.value); setShowPeriodPicker(false); }}
                style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: p.value === period ? colors.brandSoft : 'transparent' }}
              >
                <Text style={{ fontSize: 14, fontWeight: p.value === period ? '700' : '500', color: p.value === period ? colors.brand : colors.textSecondary }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
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
      <Text style={{ fontSize: 20, fontWeight: '800', color: 'white', marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{label}</Text>
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