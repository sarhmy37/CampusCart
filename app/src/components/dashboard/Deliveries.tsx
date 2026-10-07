import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Truck, MapPin, MessageCircle, AlertTriangle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';
import { useChat } from '@/context/ChatContext';
import RouteMapModal from '@/components/RouteMapModal';
import { SCHOOL_COORDS } from '@/data/schoolCoords';
import RouteMapModal from '@/components/RouteMapModal';

export default function Deliveries({ highlightOrder, onScrollToY }: { highlightOrder?: string; onScrollToY?: (y: number) => void }) {
  const colors = useColors();
  const { openChat } = useChat();
  const [dataOrders, setDataOrders] = useState<any[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const orderYRef = useRef<Record<string, number>>({});
  const blink = useRef(new Animated.Value(0)).current;
  const [marking, setMarking] = useState<any>(null);
  const [markingDataOrder, setMarkingDataOrder] = useState<any>(null);
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelling, setCancelling] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [routeDest, setRouteDest] = useState<{ lat: number; lng: number } | null>(null);
  const [routeTitle, setRouteTitle] = useState('');

  const trackBuyer = async (orderId: any, label: string) => {
    try {
      const res = await api.get(`/locations/order/${orderId}`);
      if (res.data?.lat == null || res.data?.lng == null) {
        Toast.show({ type: 'error', text1: "This buyer hasn't pinned their location yet." });
        return;
      }
      setRouteTitle(label);
      setRouteDest({ lat: res.data.lat, lng: res.data.lng });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not load the location' });
    }
  };
    const { status, data: deliveries, retry } = usePageReady({
    load: () => api.get('/orders/deliveries').then((res) => res.data),
  });

  useEffect(() => {
    if (!highlightOrder || status === 'loading' || status === 'error') return;
    const id = String(highlightOrder);
    setActiveHighlight(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const scrollTimer = setTimeout(() => {
      const y = orderYRef.current[id];
      if (typeof y === 'number') onScrollToY?.(y);
    }, 300);

    blink.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 330, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 330, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    );
    anim.start();

    const endTimer = setTimeout(() => setActiveHighlight(null), 2000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(endTimer);
      anim.stop();
    };
  }, [highlightOrder, status]);

  // Tick every second so the countdown under each card stays live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadDataOrders = () => {
    api.get('/data-orders/pending').then((res) => setDataOrders(res.data || [])).catch(() => setDataOrders([]));
  };
  useEffect(loadDataOrders, []);

  const handleMarkDelivered = async () => {
    if (!confirmTarget) return;
    setMarking(confirmTarget);
    try {
      await api.post(`/orders/${confirmTarget}/mark-delivered`);
      Toast.show({ type: 'success', text1: "Marked as delivered — buyer notified." });
      setConfirmTarget(null);
      retry();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to mark as delivered' });
    } finally {
      setMarking(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    setCancelling(cancelTarget);
    try {
      await api.post(`/orders/${cancelTarget}/cancel`);
      Toast.show({ type: 'success', text1: 'Order cancelled. Buyer refunded.' });
      setCancelTarget(null);
      retry();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to cancel order' });
    } finally {
      setCancelling(null);
    }
  };

  const handleMarkDataDelivered = async (id: any) => {
    setMarkingDataOrder(id);
    try {
      await api.post(`/data-orders/${id}/mark-delivered`);
      Toast.show({ type: 'success', text1: 'Marked as delivered' });
      loadDataOrders();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to mark as delivered' });
    } finally {
      setMarkingDataOrder(null);
    }
  };

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error') return <ErrorState icon={Truck} text="Couldn't load your deliveries right now." onRetry={retry} />;
  if (deliveries.length === 0 && dataOrders.length === 0) {
    return <EmptyState icon={Truck} text="No deliveries pending right now." />;
  }

  const cardStyle = {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16,
  };

  return (
    <View style={{ gap: 12 }}>
      {deliveries.map((d: any) => {
        const isHighlighted = activeHighlight && String(activeHighlight) === String(d.order_id);
        const deadline = new Date(d.created_at);
        deadline.setDate(deadline.getDate() + 3);
        const msLeft = deadline.getTime() - now;
        const totalSecLeft = Math.max(0, Math.floor(msLeft / 1000));
        const hh = Math.floor(totalSecLeft / 3600);
        const mm = Math.floor((totalSecLeft % 3600) / 60);
        const ss = totalSecLeft % 60;

        const daysLeftCeil = Math.max(0, Math.ceil(totalSecLeft / 86400));
        const urgencyColor =
          totalSecLeft <= 0 ? colors.error
          : daysLeftCeil <= 1 ? colors.error
          : daysLeftCeil === 2 ? colors.warning
          : colors.success;
        const urgencyBg =
          totalSecLeft <= 0 ? colors.errorSoft
          : daysLeftCeil <= 1 ? colors.errorSoft
          : daysLeftCeil === 2 ? colors.warningSoft
          : colors.successSoft;

        return (
          <View
            key={d.order_id}
            onLayout={(e) => { orderYRef.current[String(d.order_id)] = e.nativeEvent.layout.y; }}
            style={[
              cardStyle,
              isHighlighted && { borderWidth: 2, borderColor: colors.brand },
            ]}
          >
            {isHighlighted && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 16,
                  backgroundColor: colors.brand,
                  opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
                }}
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Order #{d.order_id}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Buyer: {d.buyer_name}</Text>
              </View>
              {d.delivered_at ? (
                <View style={{ backgroundColor: colors.infoSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.info }}>Awaiting buyer confirmation</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: urgencyBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: urgencyColor }}>
                    {d.delivery_method === 'delivery'
                      ? (totalSecLeft > 0 ? 'Time left' : 'Overdue')
                      : 'Awaiting pickup'}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted, flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                {d.items.map((item: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                      {item.image && <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary }}>
                        {item.title} × {item.quantity}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 2, textTransform: 'capitalize' }}>
                        Method: {d.delivery_method === 'delivery' ? 'Delivery' : 'Campus pickup'}
                      </Text>
                      {d.delivery_method === 'delivery' && !d.delivered_at && (
                        <Text style={{ fontSize: 11, color: urgencyColor, marginTop: 2, fontWeight: '700' }}>
                          {totalSecLeft > 0
                            ? `${hh}h ${mm}m ${ss}s left`
                            : 'Overdue'}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ maxWidth: '45%', alignItems: 'flex-end', gap: 6 }}>
                {/* Location row — text on the left, icon pinned to the far right */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 6, width: '100%' }}>
                  <Text
                    onPress={d.buyer_location ? () => trackBuyer(d.order_id, d.buyer_location) : undefined}
                    style={{ flexShrink: 1, fontSize: 11, color: d.buyer_location ? colors.brand : colors.textMuted, textAlign: 'right', textDecorationLine: d.buyer_location ? 'underline' : 'none' }}
                  >
                    {d.buyer_location || 'No location provided'}
                  </Text>
                  <MapPin size={12} color={colors.textFaint} style={{ marginTop: 2 }} />
                </View>

                {d.buyer_whatsapp && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: '100%' }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'right' }}>{d.buyer_whatsapp}</Text>
                    <MessageCircle size={12} color={colors.textFaint} />
                  </View>
                )}

                <Pressable
                  onPress={() => openChat({ sellerId: d.buyer_id, sellerName: d.buyer_name })}
                  hitSlop={8}
                  style={{ marginTop: 2 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>Message buyer</Text>
                </Pressable>
              </View>
            </View>

            {!d.delivered_at && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={() => setConfirmTarget(d.order_id)}
                  disabled={marking === d.order_id}
                  style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.success, opacity: marking === d.order_id ? 0.6 : 1 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>
                    {marking === d.order_id ? 'Marking…' : '✅ Mark as Delivered'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCancelTarget(d.order_id)}
                  disabled={cancelling === d.order_id}
                  style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.errorSoft, opacity: cancelling === d.order_id ? 0.6 : 1 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.error }}>✕ Cancel Order</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {dataOrders.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Data Orders
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          {dataOrders.map((d) => (
            <View key={d.id} style={cardStyle}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {parseFloat(d.gb_amount)}GB {d.network}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Buyer: {d.buyer_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Number: {d.buyer_momo_number}</Text>
                  <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>GHS {parseFloat(d.price).toFixed(2)}</Text>
                </View>
                <View style={{ backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.warning }}>Pending</Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleMarkDataDelivered(d.id)}
                disabled={markingDataOrder === d.id}
                style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.success, opacity: markingDataOrder === d.id ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>
                  {markingDataOrder === d.id ? 'Marking…' : '✅ Mark as Delivered'}
                </Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <RouteMapModal visible={!!routeDest} destination={routeDest} title={routeTitle} onClose={() => setRouteDest(null)} />

      {/* Cancel order modal */}
      <Modal visible={!!cancelTarget} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setCancelTarget(null)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertTriangle size={20} color={colors.error} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Cancel this order?</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19 }}>
              The buyer will be refunded for your items in this order, including your delivery fee share. You won't be paid for them. Other sellers' items in the order are not affected. This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <Pressable onPress={() => setCancelTarget(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Keep order</Text>
              </Pressable>
              <Pressable onPress={handleCancelOrder} disabled={!!cancelling} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.error, alignItems: 'center', opacity: cancelling ? 0.6 : 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>
                  {cancelling ? 'Cancelling…' : 'Yes, cancel order'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm delivery modal */}
      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setConfirmTarget(null)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertTriangle size={20} color={colors.warning} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Confirm delivery</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19 }}>
              Only mark this as delivered if the buyer has genuinely received the item. Falsely marking an order as delivered can result in an account ban and loss of your funds. Are you sure you've delivered this order?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <Pressable onPress={() => setConfirmTarget(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleMarkDelivered} disabled={!!marking} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', opacity: marking ? 0.6 : 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>
                  {marking ? 'Marking…' : "Yes, I've delivered it"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}