import { View, Text } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';

export default function Sales() {
  const colors = useColors();
  const { status, data: sales, retry } = usePageReady({
    load: () => api.get('/orders/sales').then((res) => res.data),
  });

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error') return <ErrorState icon={TrendingUp} text="Couldn't load your sales right now." onRetry={retry} />;
  if (!sales || sales.length === 0) return <EmptyState icon={TrendingUp} text="No sales yet." />;

  const statusStyle = (s: string) => {
    switch (s) {
      case 'completed': return { bg: colors.successSoft, text: colors.success };
      case 'paid': return { bg: colors.infoSoft, text: colors.info };
      case 'pending': return { bg: colors.warningSoft, text: colors.warning };
      case 'refunded':
      case 'cancelled': return { bg: colors.errorSoft, text: colors.error };
      default: return { bg: colors.chipBg, text: colors.textMuted };
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {sales.map((s: any) => {
        const saleAmount = parseFloat(s.price_at_purchase) * s.quantity;
        const feePct = saleAmount > 0 ? ((parseFloat(s.platform_fee) / saleAmount) * 100).toFixed(1) : null;
        const sStyle = statusStyle(s.status);

        return (
          <View key={s.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{s.title}</Text>
                <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>
                  Buyer: {s.buyer_name} · Qty {s.quantity} · {new Date(s.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ backgroundColor: sStyle.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: sStyle.text, textTransform: 'capitalize' }}>
                  {s.status}
                </Text>
              </View>
            </View>

            {s.status === 'cancelled' ? (
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.error, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
                ✕ Cancelled · GHS {saleAmount.toFixed(2)} refunded to buyer, no earnings
              </Text>
            ) : (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>Sale amount</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                  GHS {saleAmount.toFixed(2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>
                  Platform fee{feePct ? ` (${feePct}%)` : ''}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                  GHS {parseFloat(s.platform_fee).toFixed(2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>Your earnings</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand, marginTop: 2 }}>
                  GHS {parseFloat(s.seller_earnings).toFixed(2)}
                </Text>
              </View>
            </View>
            )}

            {s.reward_contributed && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.warning, marginTop: 10 }}>
                🏆 Counted toward a reward milestone
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}