import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import MessagesTab from '@/components/admin/MessagesTab';
import {
  Users, Package, ShoppingBag, DollarSign, TrendingUp,
  Flag, MessageCircle, Trash2, AlertTriangle, ChevronLeft, MessageSquare,
} from 'lucide-react-native';
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

const ADMIN_TABS = ['users', 'listings', 'orders', 'overdue', 'reports', 'support', 'deleted chats' , 'messages'] as const;
type AdminTab = typeof ADMIN_TABS[number];

const TAB_LABELS: Record<AdminTab, string> = {
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

  const [tab, setTab] = useState<AdminTab>('users');
  const [stats, setStats] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

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
      {/* HEADER with video */}
      <View style={{ position: 'relative', overflow: 'hidden', minHeight: 260 }}>
        <AdminVideo uri={DASHBOARD_VIDEO as string} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.72)' }} />

        <View style={{ paddingHorizontal: 16, paddingTop: insets.top - 20, paddingBottom: 20 }}>
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
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Home</Text>
          </Pressable>

          <Text style={{ fontSize: 24, fontWeight: '800', color: 'white', marginTop: 16 }}>
            Admin Dashboard
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Manage users, listings, and orders
          </Text>

          {/* Stats grid */}
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
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    2% Buyer: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.totalBuyerFees}</Text>
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    1.5% Seller: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.totalSellerFees}</Text>
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    Paystack: <Text style={{ color: 'white', fontWeight: '700' }}>-GHS {earnings.paystackDeduction}</Text>
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    Gross: <Text style={{ color: 'white', fontWeight: '700' }}>GHS {earnings.grossProfit}</Text>
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </View>
      </View>

      {/* TAB BAR */}
      <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 10 }}
        >
          {ADMIN_TABS.map((t) => {
            const active = t === tab;
            const Icon = TAB_ICONS[t];
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? colors.brandSoft : 'transparent',
                }}
              >
                <Icon size={13} color={active ? colors.brand : colors.textMuted} />
                <Text
                  style={{
                    fontSize: 12,
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