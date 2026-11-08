import { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Package, Calendar, Wifi, ChevronRight } from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const goToOrders = (router: any) =>
  router.push({ pathname: '/dashboard', params: { tab: 'orders' } });

export default function ActiveOrders() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [counts, setCounts] = useState({ confirm: 0, bookings: 0, data: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let alive = true;
      Promise.all([
        api.get('/orders/mine', { params: { period: 'all' } }).then((r) => r.data || []).catch(() => []),
        api.get('/bookings/buyer').then((r) => r.data || []).catch(() => []),
        api.get('/data-orders/mine').then((r) => r.data || []).catch(() => []),
      ]).then(([orders, bookings, dataOrders]) => {
        if (!alive) return;
        setCounts({
          confirm: orders.filter(
            (o: any) =>
              o.status === 'paid' &&
              o.items?.some((i: any) => !i.buyer_confirmed_at && i.status !== 'cancelled'),
          ).length,
          bookings: bookings.filter((b: any) => b.status === 'confirmed').length,
          data: dataOrders.filter((d: any) => d.status === 'pending').length,
        });
      });
      return () => { alive = false; };
    }, [user?.id]),
  );

  const rows = [
    { key: 'confirm', Icon: Package, n: counts.confirm, text: (n: number) => `${n} ${n === 1 ? 'order' : 'orders'} to confirm once received` },
    { key: 'bookings', Icon: Calendar, n: counts.bookings, text: (n: number) => `${n} active ${n === 1 ? 'booking' : 'bookings'}` },
    { key: 'data', Icon: Wifi, n: counts.data, text: (n: number) => `${n} data ${n === 1 ? 'order' : 'orders'} pending` },
  ].filter((r) => r.n > 0);

  if (!user || rows.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 12 }}>
          Your orders
        </Text>
        {rows.map(({ key, Icon, n, text }, idx) => (
          <Pressable
            key={key}
            onPress={() => goToOrders(router)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.borderMuted,
            }}
          >
            <Icon size={20} color={colors.brand} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{text(n)}</Text>
            <ChevronRight size={18} color={colors.textFaint} />
          </Pressable>
        ))}
        <View style={{ height: 4 }} />
      </View>
    </View>
  );
}