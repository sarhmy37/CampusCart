import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { Search, X } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { Tag, SkeletonList, EmptyState, cardStyle, inputStyle } from './shared';

export default function OrdersTab() {
  const colors = useColors();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/admin/orders').then((res) => setOrders(res.data)).catch(() => setOrders([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const runSearch = async () => {
    if (!search.trim()) {
      setSearching(false);
      load();
      return;
    }
    setSearching(true);
    setLoading(true);
    try {
      const res = await api.get('/admin/orders/search', { params: { q: search.trim() } });
      setOrders(res.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Search failed' });
    } finally {
      setLoading(false);
    }
  };

  const openOrder = async (id: string) => {
    setLoadingDetail(true);
    setSelectedOrder({ id });
    try {
      const res = await api.get(`/admin/orders/${id}`);
      setSelectedOrder(res.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load order' });
      setSelectedOrder(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <View>
      {/* Search */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <Search size={16} color={colors.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={runSearch}
            placeholder="Order ID, buyer, email, item…"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, color: colors.text, fontSize: 15 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={{ padding: 4 }}>
              <X size={14} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={runSearch}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.brand,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>Search</Text>
        </Pressable>
      </View>

      {loading ? (
        <SkeletonList />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Search}
          text={searching ? `No orders found for "${search}".` : 'No orders yet.'}
        />
      ) : (
        <View style={{ gap: 8 }}>
          {orders.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => openOrder(o.id)}
              style={{
                ...cardStyle(colors),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: 'monospace' }} numberOfLines={1}>
                  #{String(o.id).slice(0, 8)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }} numberOfLines={1}>
                  {o.buyer_name} · {o.delivery_method} · {new Date(o.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  GHS {parseFloat(o.total_amount).toFixed(2)}
                </Text>
                <Tag color={o.status === 'completed' ? 'emerald' : o.status === 'paid' ? 'blue' : 'amber'}>
                  {o.status}
                </Tag>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          loading={loadingDetail}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </View>
  );
}

// ─── ORDER DETAIL MODAL ──────────────────────────────────────────────
function OrderDetailModal({
  order, loading, onClose,
}: { order: any; loading: boolean; onClose: () => void }) {
  const colors = useColors();

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
        onPress={onClose}
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
          maxHeight: 600,
        }}
      >
        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontFamily: 'monospace', color: colors.textFaint }}>
                  #{String(order.id).slice(0, 12)}
                </Text>
                <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 4 }}>
                  Order details
                </Text>
              </View>
              <Pressable onPress={onClose} style={{ padding: 6 }}>
                <X size={18} color={colors.textFaint} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Tag color={order.status === 'completed' ? 'emerald' : order.status === 'paid' ? 'blue' : 'amber'}>
                {order.status}
              </Tag>
              <Tag color="slate">{order.delivery_method}</Tag>
            </View>

            {/* Buyer */}
            <View style={{ backgroundColor: colors.chipBg, borderRadius: 14, padding: 12, marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Buyer
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{order.buyer_name}</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{order.buyer_email}</Text>
              {order.buyer_whatsapp && (
                <Text style={{ fontSize: 13, color: colors.textMuted }}>WhatsApp: {order.buyer_whatsapp}</Text>
              )}
              {order.buyer_location && (
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Location: {order.buyer_location}</Text>
              )}
            </View>

            {/* Timing */}
            <View style={{ backgroundColor: colors.chipBg, borderRadius: 14, padding: 12, marginTop: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Timing
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Placed: {new Date(order.created_at).toLocaleString()}
              </Text>
              {order.completed_at && (
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  Completed: {new Date(order.completed_at).toLocaleString()}
                </Text>
              )}
              {order.payment_reference && (
                <Text style={{ fontSize: 12, fontFamily: 'monospace', color: colors.textFaint, marginTop: 4 }}>
                  Ref: {order.payment_reference}
                </Text>
              )}
            </View>

            {/* Items */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>
              Items ({order.items?.length || 0})
            </Text>
            <View style={{ gap: 8 }}>
              {order.items?.map((item: any) => (
                <View key={item.id} style={{ backgroundColor: colors.chipBg, borderRadius: 14, padding: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Tag color={item.status === 'completed' ? 'emerald' : item.status === 'refunded' ? 'red' : 'slate'}>
                      {item.status}
                    </Tag>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    Qty {item.quantity} · GHS {parseFloat(item.price_at_purchase).toFixed(2)} each
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint }}>Seller</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                        {item.seller_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textFaint }} numberOfLines={1}>
                        {item.seller_email}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textFaint }}>Fee</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                        GHS {parseFloat(item.platform_fee).toFixed(2)}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textFaint }}>Earnings</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>
                        GHS {parseFloat(item.seller_earnings).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, marginTop: 16, paddingTop: 12, gap: 6 }}>
              <Row label="Subtotal" value={`GHS ${parseFloat(order.subtotal).toFixed(2)}`} colors={colors} />
              <Row label="Delivery fee" value={`GHS ${parseFloat(order.delivery_fee).toFixed(2)}`} colors={colors} />
              {parseFloat(order.credit_applied || 0) > 0 && (
                <Row label="Credit applied" value={`−GHS ${parseFloat(order.credit_applied).toFixed(2)}`} colors={colors} highlight />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderMuted, marginTop: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Total paid</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                  GHS {parseFloat(order.total_amount).toFixed(2)}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Close</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function Row({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: highlight ? colors.success : colors.text }}>
        {value}
      </Text>
    </View>
  );
}