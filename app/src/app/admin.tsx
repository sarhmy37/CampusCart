import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import MessagesTab from '@/components/admin/MessagesTab';

import {
  Users, Package, ShoppingBag, DollarSign, TrendingUp, LayoutDashboard,
  Flag, MessageCircle, Trash2, AlertTriangle, ChevronLeft, MessageSquare, Wifi, Search,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { DASHBOARD_VIDEO } from '@/data/media';
import { StatCard } from '@/components/admin/shared';
import UsersTab from '@/components/admin/UsersTab';
import ListingsTab from '@/components/admin/ListingsTab';
import OrdersTab from '@/components/admin/OrdersTab';
import OverdueTab from '@/components/admin/OverdueTab';
import ReportsTab from '@/components/admin/ReportsTab';
import SupportTab from '@/components/admin/SupportTab';
import DeletedChatsTab from '@/components/admin/DeletedChatsTab';

const ADMIN_TABS = ['overview', 'users', 'listings', 'orders', 'overdue', 'reports', 'support', 'deleted chats', 'messages'] as const;
type AdminTab = typeof ADMIN_TABS[number];

const TAB_LABELS: Record<AdminTab, string> = {
  overview: 'Overview',
  users: 'Users',
  listings: 'Listings',
  orders: 'Orders',
  overdue: 'Overdue',
  reports: 'Reports',
  support: 'Support',
  'deleted chats': 'Deleted',
  messages: 'Messages',
};

const TAB_ICONS: Record<AdminTab, any> = {
  overview: LayoutDashboard,
  users: Users,
  listings: Package,
  orders: ShoppingBag,
  overdue: AlertTriangle,
  reports: Flag,
  support: MessageCircle,
  'deleted chats': Trash2,
  messages: MessageSquare,
};

export default function Admin() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dataSellerUsers, setDataSellerUsers] = useState<any[]>([]);
  const [dataSellerSearch, setDataSellerSearch] = useState('');
  const [dataSellerLoading, setDataSellerLoading] = useState(false);

  const [badges, setBadges] = useState<{ support: number; overdue: number; reports: number }>({ support: 0, overdue: 0, reports: 0 });
  const seenRef = useRef<{ support: string; overdue: string; reports: string }>({ support: '', overdue: '', reports: '' });

  const loadBadges = async () => {
    try {
      const res = await api.get('/admin/badge-counts', { params: seenRef.current });
      setBadges({ support: res.data.support, overdue: res.data.overdue, reports: res.data.reports });
    } catch {}
  };

  const markSeen = async (t: string) => {
    if (t !== 'support' && t !== 'overdue' && t !== 'reports') return;
    const now = new Date().toISOString();
    seenRef.current = { ...seenRef.current, [t]: now };
    setBadges((b) => ({ ...b, [t]: 0 }));
    try { await AsyncStorage.setItem(`admin_seen_${t}`, now); } catch {}
  };

  useEffect(() => {
    if (user?.role !== 'admin') return;
    (async () => {
      try {
        const [s, o, r] = await Promise.all([
          AsyncStorage.getItem('admin_seen_support'),
          AsyncStorage.getItem('admin_seen_overdue'),
          AsyncStorage.getItem('admin_seen_reports'),
        ]);
        seenRef.current = { support: s || '', overdue: o || '', reports: r || '' };
      } catch {}
      loadBadges();
    })();
    const interval = setInterval(loadBadges, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (tab !== 'overview') return;
    setDataSellerLoading(true);
    api.get('/admin/users')
      .then((res) => setDataSellerUsers(res.data))
      .catch(() => setDataSellerUsers([]))
      .finally(() => setDataSellerLoading(false));
  }, [tab]);

  const assignDataSeller = async (id: string, enabled: boolean) => {
    try {
      await api.post(`/admin/users/${id}/set-data-seller`, { enabled });
      const res = await api.get('/admin/users');
      setDataSellerUsers(res.data);
      Toast.show({ type: 'success', text1: enabled ? 'Data seller assigned' : 'Data seller removed' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to update data seller' });
    }
  };

  useEffect(() => {
    markSeen(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/');
      return;
    }
    Promise.all([
      api.get('/admin/stats').catch(() => ({ data: null })),
      api.get('/admin/net-earnings').catch(() => ({ data: null })),
    ]).then(([statsRes, earningsRes]) => {
      setStats(statsRes.data);
      setEarnings(earningsRes.data);
    }).finally(() => setLoadingStats(false));
  }, [user]);

  if (user?.role !== 'admin') return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* TAB BAR */}
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          ref={tabBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => { tabBarWidth.current = e.nativeEvent.layout.width; }}
          onContentSizeChange={(w) => { tabBarContentWidth.current = w; }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 18 }}
        >
          {ADMIN_TABS.map((t) => {
            const active = t === tab;
            const Icon = TAB_ICONS[t];
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                onLayout={(e) => {
                  tabLayouts.current[t] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                }}
                style={{
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  paddingHorizontal: 2, paddingTop: 7, paddingBottom: active ? 9 : 10,
                  minWidth: 42,
                }}
              >
                <View>
                  <Icon size={active ? 18 : 12} color={active ? colors.brand : colors.textFaint} />
                  {(t === 'support' || t === 'overdue' || t === 'reports') && badges[t] > 0 && (
                    <View
                      style={{
                        position: 'absolute', top: -7, right: -9,
                        minWidth: 15, height: 15, borderRadius: 8,
                        backgroundColor: colors.brand, paddingHorizontal: 3,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>
                        {badges[t] > 99 ? '99+' : badges[t]}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: active ? 14 : 11.5,
                    fontWeight: active ? '800' : '500',
                    color: active ? colors.brand : colors.textFaint,
                  }}
                >
                  {TAB_LABELS[t]}
                </Text>
                {active && <View style={{ position: 'absolute', bottom: -1, alignSelf: 'center', height: 3, width: 33, borderRadius: 999, backgroundColor: colors.brand }} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* TAB CONTENT */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'overview' && (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: 'rgb(15,23,42)', borderRadius: 24, padding: 18, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -34, top: -42, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(245,158,11,0.18)' }} />
              <View style={{ position: 'absolute', right: 34, bottom: -70, width: 190, height: 150, borderRadius: 95, backgroundColor: 'rgba(59,130,246,0.12)' }} />
            <Pressable
              onPress={() => router.replace('/')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                alignSelf: 'flex-start',
              }}
            >
              <ChevronLeft size={14} color="white" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Home</Text>
            </Pressable>

            <Text style={{ fontSize: 27, fontWeight: '900', color: 'white', marginTop: 18 }}>
              Antika command center
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              A live view of the marketplace, money flow, and moderation queue.
            </Text>

            {loadingStats ? (
              <View style={{ marginTop: 16, height: 100, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            ) : stats ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                  {[
                    { icon: Users, label: 'Community', value: stats.total_users, color: '#fbbf24' },
                    { icon: ShoppingBag, label: 'Completed orders', value: stats.total_orders, color: '#60a5fa' },
                    { icon: DollarSign, label: 'Revenue', value: `GHS ${Number(stats.total_revenue).toFixed(2)}`, color: '#34d399' },
                    ...(earnings ? [{ icon: TrendingUp, label: 'Net earnings', value: `GHS ${earnings.netProfit}`, color: '#c084fc' }] : []),
                  ].map((metric) => {
                    const MetricIcon = metric.icon;
                    return (
                      <View key={metric.label} style={{ flexGrow: 1, flexBasis: '44%', minWidth: 130, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                        <MetricIcon size={17} color={metric.color} />
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginTop: 9 }} numberOfLines={1}>{metric.value}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12, marginTop: 2 }}>{metric.label}</Text>
                      </View>
                    );
                  })}
                </View>

                {earnings && (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.16)' }}>
                    <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>Money flow</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Buyer fees: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.totalBuyerFees}</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Seller fees: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.totalSellerFees}</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Paystack: <Text style={{ color: 'white', fontWeight: '700' }}>-GHS {earnings.paystackDeduction}</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Gross: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.grossProfit}</Text>
                    </Text>
                    </View>
                  </View>
                )}
              </>
            ) : null}
            </View>

            <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Quick operations</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>Jump directly to the areas that need attention.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {([
                      ['users', 'Manage users', Users],
                      ['listings', 'Review listings', Package],
                      ['orders', 'Inspect orders', ShoppingBag],
                      ['reports', 'Moderate reports', Flag],
                    ] as const).map(([target, label, QuickIcon]) => (
                      <Pressable key={target} onPress={() => setTab(target as AdminTab)} style={{ flexGrow: 1, flexBasis: '44%', padding: 12, borderRadius: 14, backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.border }}>
                        <QuickIcon size={17} color={colors.brand} />
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, marginTop: 8 }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Wifi size={17} color="#fbbf24" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>Mobile Data Seller</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                        Assign the single account that manages data bundles and provider payments.
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <Search size={15} color={colors.textFaint} />
                    <TextInput
                      value={dataSellerSearch}
                      onChangeText={setDataSellerSearch}
                      placeholder="Search by name or email"
                      placeholderTextColor={colors.textFaint}
                      style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    />
                  </View>
                  {dataSellerLoading ? (
                    <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12 }}>Loading users…</Text>
                  ) : (
                    dataSellerUsers
                      .filter((candidate) => {
                        const q = dataSellerSearch.trim().toLowerCase();
                        return !q || candidate.name?.toLowerCase().includes(q) || candidate.university_email?.toLowerCase().includes(q);
                      })
                      .slice(0, 5)
                      .map((candidate) => (
                        <Pressable
                          key={candidate.id}
                          onPress={() => assignDataSeller(candidate.id, !candidate.is_data_seller)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{candidate.name}</Text>
                            <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 2 }}>{candidate.university_email}</Text>
                          </View>
                          <Text style={{ color: candidate.is_data_seller ? '#34d399' : '#fbbf24', fontSize: 13, fontWeight: '800' }}>
                            {candidate.is_data_seller ? 'Active' : 'Assign'}
                          </Text>
                        </Pressable>
                      ))
                  )}
                </View>
                </View>
        )}
        {tab === 'users' && <UsersTab />}
        {tab === 'listings' && <ListingsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'overdue' && <OverdueTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'support' && <SupportTab />}
        {tab === 'deleted chats' && <DeletedChatsTab />}
        {tab === 'messages' && <MessagesTab />}
      </ScrollView>
    </View>
  );
}

function AdminVideo({ uri }: { uri: string }) {
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