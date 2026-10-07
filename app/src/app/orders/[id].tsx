import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, XCircle, MapPin, Truck, ChevronLeft } from 'lucide-react-native';
import api from '@/api/client';
import { useCart } from '@/context/CartContext';
import { useColors } from '@/hooks/useColors';

export default function OrderConfirmation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { removeItem } = useCart();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Only drop this order's items from the cart once payment actually went through
  useEffect(() => {
    if (!order || clearedRef.current) return;
    const paidStatuses = ['paid', 'completed'];
    if (paidStatuses.includes(order.status)) {
      order.items.forEach((item: any) => {
        if (item.product_id) removeItem(item.product_id);
      });
      clearedRef.current = true;
    }
  }, [order, removeItem]);

  const STATUS = {
    paid: { icon: CheckCircle2, color: colors.success, bg: colors.successSoft, label: 'Payment confirmed' },
    completed: { icon: CheckCircle2, color: colors.success, bg: colors.successSoft, label: 'Order completed' },
    pending: { icon: Clock, color: colors.warning, bg: colors.warningSoft, label: 'Payment pending' },
    cancelled: { icon: XCircle, color: colors.textMuted, bg: colors.chipBg, label: 'Order cancelled' },
    refunded: { icon: XCircle, color: colors.error, bg: colors.errorSoft, label: 'Order refunded' },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>We couldn't find that order.</Text>
        <Pressable onPress={() => router.replace('/dashboard')} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 14 }}>
            Go to your dashboard →
          </Text>
        </Pressable>
      </View>
    );
  }

  const config = STATUS[order.status as keyof typeof STATUS] || STATUS.pending;
  const StatusIcon = config.icon;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}>

        <Pressable
          onPress={() => router.replace('/dashboard')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}
        >
          <ChevronLeft size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
            Back to dashboard
          </Text>
        </Pressable>

        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: config.bg,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <StatusIcon size={32} color={config.color} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
            {config.label}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 4 }}>
            Order #{String(order.id).slice(0, 8)}
          </Text>

          {/* Items */}
          <View style={{ width: '100%', marginTop: 24, gap: 10 }}>
            {order.items.map((item: any) => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13 }}>
                  {item.title} × {item.quantity}
                </Text>
                <Text style={{ fontWeight: '600', color: colors.text, fontSize: 13 }}>
                  GHS {(parseFloat(item.price_at_purchase) * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View
            style={{
              width: '100%',
              borderTopWidth: 1,
              borderTopColor: colors.borderMuted,
              marginTop: 18,
              paddingTop: 18,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Subtotal</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                GHS {parseFloat(order.subtotal).toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Delivery</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {parseFloat(order.delivery_fee) > 0 ? `GHS ${parseFloat(order.delivery_fee).toFixed(2)}` : 'Free'}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: colors.borderMuted,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Total</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                GHS {parseFloat(order.total_amount).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Delivery info */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 20,
            }}
          >
            {order.delivery_method === 'delivery' ? (
              <Truck size={14} color={colors.textFaint} />
            ) : (
              <MapPin size={14} color={colors.textFaint} />
            )}
            <Text style={{ fontSize: 12, color: colors.textFaint }}>
              {order.delivery_method === 'delivery'
                ? 'Delivery within 1–3 working days'
                : 'Arrange pickup with the seller on campus'}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => router.replace('/browse')} style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ color: colors.brand, fontSize: 14, fontWeight: '600' }}>
            Continue browsing →
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}