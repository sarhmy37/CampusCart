import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { AlertTriangle, X } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { Tag, SkeletonList, EmptyState, cardStyle } from './shared';

const REASON_LABELS: Record<string, string> = {
  reported: 'Buyer reported a problem',
  unconfirmed: 'Delivered, buyer silent for 3 days',
  not_delivered: 'Missed delivery',
};

export default function OverdueTab() {
  const colors = useColors();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/orders/overdue')
      .then((res) => setOrders(res.data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleRelease = (order: any) => {
    Alert.alert(
      'Release payment to seller?',
      `Mark Order #${String(order.id).slice(0, 8)} as received and pay the seller. Only do this after you've checked with the buyer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          onPress: async () => {
            try {
              await api.post(`/admin/orders/${order.id}/release`);
              Toast.show({ type: 'success', text1: 'Payment released to seller' });
              load();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to release' });
            }
          },
        },
      ]
    );
  };

  if (loading) return <SkeletonList />;

  if (orders.length === 0) {
    return <EmptyState icon={AlertTriangle} text="No overdue orders flagged right now." />;
  }

  return (
    <View>
      <Text style={{ fontSize: 13, color: colors.textFaint, marginBottom: 10 }}>
        {orders.length} order{orders.length === 1 ? '' : 's'} need your review
      </Text>

      <View style={{ gap: 8 }}>
        {orders.map((o) => (
          <View
            key={o.id}
            style={{
              ...cardStyle(colors),
              borderColor: colors.warning,
              borderWidth: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'monospace' }} numberOfLines={1}>
                  #{String(o.id).slice(0, 8)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                  {o.buyer_name} · {o.buyer_email}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: o.overdue_reason === 'reported' ? colors.error : colors.warning, marginTop: 4 }}>
                  {REASON_LABELS[o.overdue_reason] || 'Overdue'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.warning }}>
                  Flagged {new Date(o.flagged_at).toLocaleString()}
                </Text>
                {o.buyer_whatsapp && (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>WhatsApp: {o.buyer_whatsapp}</Text>
                )}
                <Text style={{ fontSize: 11, color: colors.textFaint }}>
                  Placed {new Date(o.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                  GHS {parseFloat(o.total_amount).toFixed(2)}
                </Text>
                <Pressable
                  onPress={() => setRefundTarget(o)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: colors.error,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Refund</Text>
                </Pressable>
                {o.delivered_at && (
                  <Pressable
                    onPress={() => handleRelease(o)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.success }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Release to seller</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {refundTarget && (
        <RefundModal
          order={refundTarget}
          onClose={() => setRefundTarget(null)}
          onSuccess={() => { setRefundTarget(null); load(); }}
        />
      )}
    </View>
  );
}

// ─── REFUND MODAL ────────────────────────────────────────────────────
function RefundModal({
  order, onClose, onSuccess,
}: { order: any; onClose: () => void; onSuccess: () => void }) {
  const colors = useColors();
  const [percent, setPercent] = useState(100);
  const [noItemsReceived, setNoItemsReceived] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const handleRefund = async () => {
    setRefunding(true);
    try {
      const res = await api.post(`/admin/orders/${order.id}/refund`, {
        percent,
        noItemsReceived,
      });
      Toast.show({ type: 'success', text1: `Refunded GHS ${res.data.refundAmount.toFixed(2)}` });
      onSuccess();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to refund' });
    } finally {
      setRefunding(false);
    }
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        marginHorizontal: -16,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        onPress={() => !refunding && onClose()}
        style={{
          position: 'fixed' as any,
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          zIndex: 99,
        }}
      />
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 100,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>
              Refund order #{String(order.id).slice(0, 8)}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
              {order.buyer_name} · GHS {parseFloat(order.total_amount).toFixed(2)} total
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 6 }} disabled={refunding}>
            <X size={18} color={colors.textFaint} />
          </Pressable>
        </View>

        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>
          Refund amount
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[25, 50, 75, 100].map((p) => {
            const active = percent === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPercent(p)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brand : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? colors.textOnGold : colors.textMuted }}>
                  {p}%
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setNoItemsReceived((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 }}
        >
          <View
            style={{
              width: 18, height: 18, borderRadius: 4,
              borderWidth: 1.5,
              borderColor: noItemsReceived ? colors.brand : colors.textFaint,
              backgroundColor: noItemsReceived ? colors.brand : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginTop: 2,
            }}
          >
            {noItemsReceived && (
              <Text style={{ color: colors.textOnGold, fontSize: 13, fontWeight: '900' }}>✓</Text>
            )}
          </View>
          <Text style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 19 }}>
            Buyer received no items at all — also refund the delivery fee
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <Pressable
            onPress={onClose}
            disabled={refunding}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleRefund}
            disabled={refunding}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.error,
              alignItems: 'center',
              opacity: refunding ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
              {refunding ? 'Refunding…' : 'Confirm refund'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}