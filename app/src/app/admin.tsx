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
      <View style={{ height: insets.top }} />

      {/* TAB BAR */}
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          ref={tabBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => { tabBarWidth.current = e.nativeEvent.layout.width; }}
          onContentSizeChange={(w) => { tabBarContentWidth.current = w; }}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 10 }}
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
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? colors.brandSoft : 'transparent',
                }}
              >
                <View>
                  <Icon size={13} color={active ? colors.brand : colors.textMuted} />
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
                    fontSize: 14,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.brand : colors.textMuted,
                  }}
                >
                  {TAB_LABELS[t]}
                </Text>
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
          <View style={{ backgroundColor: 'rgb(15,23,42)', borderRadius: 20, padding: 16 }}>
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

            <Text style={{ fontSize: 26, fontWeight: '800', color: 'white', marginTop: 16 }}>
              Admin Dashboard
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              Manage users, listings, and orders
            </Text>

            {loadingStats ? (
              <View style={{ marginTop: 16, height: 100, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            ) : stats ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <StatCard icon={Users} label="Users" value={stats.total_users} />
                  <StatCard icon={DollarSign} label="Revenue" value={`GHS ${stats.total_revenue.toFixed(2)}`} />
                  {earnings && (
                    <StatCard icon={TrendingUp} label="Net Earnings" value={`GHS ${earnings.netProfit}`} highlight />
                  )}
                </View>

                {earnings && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      2% Buyer: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.totalBuyerFees}</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      1.5% Seller: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.totalSellerFees}</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Paystack: <Text style={{ color: 'white', fontWeight: '700' }}>-GHS {earnings.paystackDeduction}</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      Gross: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.grossProfit}</Text>
                    </Text>
                  </View>
                )}

                <View style={{ marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Wifi size={17} color="#fbbf24" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 17, fontWeight: '800' }}>Mobile Data Seller</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
                        Assign the single account that manages data bundles and provider payments.
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <Search size={15} color="rgba(255,255,255,0.55)" />
                    <TextInput
                      value={dataSellerSearch}
                      onChangeText={setDataSellerSearch}
                      placeholder="Search by name or email"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      style={{ flex: 1, color: 'white', fontSize: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)' }}
                    />
                  </View>
                  {dataSellerLoading ? (
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 12 }}>Loading users…</Text>
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
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>{candidate.name}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>{candidate.university_email}</Text>
                          </View>
                          <Text style={{ color: candidate.is_data_seller ? '#34d399' : '#fbbf24', fontSize: 13, fontWeight: '800' }}>
                            {candidate.is_data_seller ? 'Active' : 'Assign'}
                          </Text>
                        </Pressable>
                      ))
                  )}
                </View>
              </>
            ) : null}
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