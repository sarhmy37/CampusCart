import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Alert, TextInput, ScrollView } from 'react-native';
import { ShoppingBag, MessageCircle, Search, Star, Sparkles } from 'lucide-react-native';
import { useChat } from '@/context/ChatContext';
import RouteMapModal from '@/components/RouteMapModal';
import { SCHOOL_COORDS } from '@/data/schoolCoords';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';
import { useReviewPrompt } from '@/context/ReviewPromptContext';

const TIMELINE_STEPS = ['Placed', 'Delivered', 'Received', 'Completed'];

export default function Orders({ period, isSeller, highlightOrder }: { period: string; isSeller: boolean; highlightOrder?: string }) {
  const colors = useColors();
  const { scheduleReviewCheck } = useReviewPrompt();
  const { openChat } = useChat();
  const [dataOrders, setDataOrders] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [confirmingItem, setConfirmingItem] = useState<any>(null);
  const [confirmingBookingId, setConfirmingBookingId] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [routeDest, setRouteDest] = useState<{ lat: number; lng: number } | null>(null);
  const [routeTitle, setRouteTitle] = useState('');

  const trackSeller = async (sellerId: any, name?: string) => {
    try {
      const res = await api.get(`/auth/seller-location/${sellerId}`);
      const fb = res.data?.school ? SCHOOL_COORDS[res.data.school] : undefined;
      const lat = res.data?.lat ?? fb?.lat;
      const lng = res.data?.lng ?? fb?.lng;
      if (lat == null || lng == null) {
        Toast.show({ type: 'error', text1: "This seller hasn't set a location yet." });
        return;
      }
      setRouteTitle(name || 'Seller');
      setRouteDest({ lat, lng });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not load the location' });
    }
  };
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const orderYRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (highlightOrder) setActiveHighlight(String(highlightOrder));
    else setActiveHighlight(null);
  }, [highlightOrder]);

  useEffect(() => {
    if (!activeHighlight) return;
    const t = setTimeout(() => {
      const y = orderYRef.current[activeHighlight];
      if (typeof y === 'number') {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [activeHighlight, orders]);

  const { status, data: orders, retry: loadOrders } = usePageReady({
    load: () => api.get('/orders/mine', { params: { period } }).then((res) => res.data),
    deps: [period],
  });

  const loadDataOrders = () => {
    api.get('/data-orders/mine').then((res) => setDataOrders(res.data)).catch(() => setDataOrders([]));
  };
  useEffect(loadDataOrders, []);

  const loadServiceOrders = () => {
    const endpoint = isSeller ? '/bookings/seller' : '/bookings/buyer';
    api.get(endpoint).then((res) => setServiceOrders(res.data)).catch(() => setServiceOrders([]));
  };
  useEffect(loadServiceOrders, [isSeller]);

  const handleConfirmReceived = async (itemId: any) => {
    setConfirmingItem(itemId);
    try {
      await api.post(`/orders/order-items/${itemId}/confirm`);
      Toast.show({ type: 'success', text1: 'Item confirmed as received! ✅' });
      loadOrders();
      scheduleReviewCheck();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to confirm' });
    } finally {
      setConfirmingItem(null);
    }
  };

  const promptConfirmReceived = (item: any) => {
    Alert.alert(
      'Confirm you received this item?',
      `Only confirm if "${item.title}" has reached you and you're happy with it.\n\nThis releases the payment to the seller and cannot be undone. If something is wrong, tap Cancel and report a problem instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: "Yes, I've received it", onPress: () => handleConfirmReceived(item.id) },
      ]
    );
  };

  const messageSeller = (order: any) => {
    const sellers: any[] = [];
    (order.items || []).forEach((i: any) => {
      if (i.seller_id && !sellers.find((s) => s.sellerId === i.seller_id)) {
        sellers.push({ sellerId: i.seller_id, sellerName: i.seller_name || 'Seller', productId: i.product_id });
      }
    });
    if (sellers.length === 0) return;

    const open = (s: any) =>
      openChat({
        sellerId: s.sellerId,
        sellerName: s.sellerName,
        productId: s.productId,
        draftMessage: `Hi, about my Order #${order.id}: `,
      });

    if (sellers.length === 1) return open(sellers[0]);

    Alert.alert('Message which seller?', undefined, [
      ...sellers.map((s) => ({ text: s.sellerName, onPress: () => open(s) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleReport = (orderId: any) => {
    Alert.alert(
      'Report a problem?',
      "Only report this if you haven't received your order. We'll review it and contact you and the seller.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/orders/${orderId}/report`);
              Toast.show({ type: 'success', text1: 'Report sent. We will review it.' });
              loadOrders();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to send report' });
            }
          },
        },
      ]
    );
  };

  const handleConfirmBooking = async (id: any) => {
    setConfirmingBookingId(id);
    try {
      await api.patch(`/bookings/${id}/confirm`);
      Toast.show({ type: 'success', text1: 'Booking confirmed!' });
      loadServiceOrders();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to confirm booking' });
    } finally {
      setConfirmingBookingId(null);
    }
  };

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error') return <ErrorState icon={ShoppingBag} text="Couldn't load your orders right now." onRetry={loadOrders} />;

  const hasAny = orders?.length > 0 || dataOrders.length > 0 || serviceOrders.length > 0;
  if (!hasAny) {
    return <EmptyState icon={ShoppingBag} text="No orders yet." cta="Browse listings" ctaLink="/browse" />;
  }

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

const q = search.trim().toLowerCase();
  const filteredOrders = !q
    ? orders || []
    : (orders || []).filter((o: any) =>
        String(o.id).includes(q) ||
        o.status?.toLowerCase().includes(q) ||
        o.items?.some((i: any) => i.title?.toLowerCase().includes(q)) ||
        o.items?.some((i: any) => i.seller_name?.toLowerCase().includes(q)) ||
        (o.created_at && formatOrderDate(o.created_at).toLowerCase().includes(q))
      );

  return (
    <View style={{ gap: 12 }}>
      {activeHighlight && (
        <Pressable
          onPress={() => setActiveHighlight(null)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
          pointerEvents="box-none"
        />
      )}
      <RouteMapModal visible={!!routeDest} destination={routeDest} title={routeTitle} onClose={() => setRouteDest(null)} />

      {/* SERVICE BOOKINGS */}
      {serviceOrders.length > 0 && (
        <>
          <SectionHeader label="Service Bookings" color={colors.success} colors={colors} />
          {serviceOrders.map((b) => (
            <View key={b.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{b.service_title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    {isSeller ? `Buyer: ${b.buyer_name} · ${b.buyer_email}` : `Seller: ${b.seller_name} · ${b.seller_email}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    📅 {new Date(b.booking_date).toLocaleDateString()} · ⏰ {b.booking_time?.slice(0, 5)}
                  </Text>
                  {b.message && (
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 4, fontStyle: 'italic' }}>"{b.message}"</Text>
                  )}
                </View>
                <View style={{ backgroundColor: b.status === 'confirmed' ? colors.successSoft : colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: b.status === 'confirmed' ? colors.success : colors.warning }}>
                    {b.status === 'confirmed' ? 'Confirmed ✅' : 'Awaiting payment'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 8 }}>
                Platform fee: GHS {parseFloat(b.platform_fee).toFixed(2)}
              </Text>
              {isSeller && b.status === 'confirmed' && (
                <Pressable
                  onPress={() => handleConfirmBooking(b.id)}
                  disabled={confirmingBookingId === b.id}
                  style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.info, opacity: confirmingBookingId === b.id ? 0.6 : 1 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>
                    {confirmingBookingId === b.id ? '...' : '✅ Confirm Booking'}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </>
      )}

      {/* DATA ORDERS */}
      {dataOrders.length > 0 && (
        <>
          <SectionHeader label="Data Orders" color={colors.textFaint} colors={colors} />
          {dataOrders.map((d) => (
            <View key={d.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {parseFloat(d.gb_amount)}GB {d.network}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>GHS {parseFloat(d.price).toFixed(2)}</Text>
                </View>
                <View style={{ backgroundColor: d.status === 'delivered' ? colors.successSoft : colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: d.status === 'delivered' ? colors.success : colors.warning }}>
                    {d.status === 'delivered' ? 'Received' : 'Pending'}
                  </Text>
                </View>
              </View>
              {d.status === 'pending' && (
                <Pressable onPress={() => Toast.show({ type: 'info', text1: 'Report coming soon' })} style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.error, textDecorationLine: 'underline' }}>
                    Report — haven't received this
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </>
      )}

      {/* REGULAR ORDERS */}
      {orders?.length > 0 && (
        <>
          {orders.length >= 3 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12 }}>
              <Search size={16} color={colors.textFaint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by Order #, Item, Seller, Date..."
                placeholderTextColor={colors.textFaint}
                style={{ flex: 1, paddingVertical: 10, fontSize: 13, color: colors.text }}
                returnKeyType="search"
                autoCorrect={false}
              />
            </View>
          )}
          <SectionHeader label="Orders" color={colors.textFaint} colors={colors} />
          {filteredOrders.length === 0 && (
            <Text style={{ fontSize: 12, color: colors.textFaint, textAlign: 'center', paddingVertical: 12 }}>
              No orders match your search.
            </Text>
          )}
          {filteredOrders.map((o: any) => {
            const sStyle = statusStyle(o.status);
            const isHighlighted = activeHighlight && String(activeHighlight) === String(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => { if (activeHighlight) setActiveHighlight(null); }}
                onLayout={(e) => { orderYRef.current[String(o.id)] = e.nativeEvent.layout.y; }}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: isHighlighted ? 2 : 1,
                  borderColor: isHighlighted ? colors.brand : colors.border,
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <OrderTimeline order={o} colors={colors} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Order #{o.id}</Text>
                  <View style={{ backgroundColor: sStyle.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: sStyle.text, textTransform: 'capitalize' }}>
                      {o.status}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 10 }}>
                  {o.items?.map((item: any) => (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
                      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                        {item.image && <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary }}>{item.title}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                          <Text style={{ fontSize: 11, color: colors.textFaint }}>Qty: {item.quantity}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>GHS {parseFloat(item.price_at_purchase).toFixed(2)}</Text>
                        </View>
                        {!!item.seller_name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textFaint, flexShrink: 1 }}>
                              Seller: {item.seller_name}
                            </Text>
                            <PlanIcon plan={item.seller_plan} />
                            {o.status === 'paid' && item.status !== 'cancelled' && !item.buyer_confirmed_at && !!item.seller_id && (
                              <Text
                                onPress={() => trackSeller(item.seller_id, item.seller_name)}
                                style={{ fontSize: 11, fontWeight: '700', color: colors.brand, textDecorationLine: 'underline' }}
                              >
                                📍 Track
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                      {o.status === 'paid' && !item.buyer_confirmed_at && item.status !== 'cancelled' && (
                        <Pressable
                          onPress={() => promptConfirmReceived(item)}
                          disabled={confirmingItem === item.id}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.success, opacity: confirmingItem === item.id ? 0.6 : 1 }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: 'white' }}>
                            {confirmingItem === item.id ? '...' : '✅ Confirm'}
                          </Text>
                        </Pressable>
                      )}
                      {item.status === 'cancelled' && (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.error }}>✕ Cancelled</Text>
                      )}
                      {o.status === 'paid' && item.buyer_confirmed_at && (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.success }}>✓ Confirmed</Text>
                      )}
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    Total: GHS {parseFloat(o.total_amount).toFixed(2)}
                  </Text>
                  {o.status !== 'pending' && (
                    <Pressable onPress={() => messageSeller(o)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MessageCircle size={14} color={colors.brand} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>Message seller</Text>
                    </Pressable>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                  {!!o.created_at ? (
                    <Text style={{ fontSize: 11, color: colors.textFaint, flexShrink: 1 }}>
                      Placed on {formatOrderDate(o.created_at)}
                    </Text>
                  ) : <View />}
                  {o.status === 'paid' && o.delivered_at && !o.reported_at && (
                    <Pressable onPress={() => handleReport(o.id)} hitSlop={8}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.error }}>Report a problem</Text>
                    </Pressable>
                  )}
                  {o.status === 'paid' && o.reported_at && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.warning }}>Problem reported</Text>
                  )}
                </View>


              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

function PlanIcon({ plan }: { plan?: string }) {
  const tier = plan?.toLowerCase();
  if (tier === 'premium') return <Sparkles size={12} color="#a855f7" fill="#a855f7" />;
  if (tier === 'pro') return <Star size={12} color="#3b82f6" fill="#3b82f6" />;
  return null;
}

function formatOrderDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function SectionHeader({ label, color, colors }: { label: string; color: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

function OrderTimeline({ order, colors }: { order: any; colors: any }) {
  if (order.status === 'pending') return null;

  const cancelled = order.status === 'cancelled' || order.status === 'refunded';
  const activeItems = order.items?.filter((i: any) => i.status !== 'cancelled') || [];
  const allConfirmed = activeItems.length > 0 && activeItems.every((i: any) => i.buyer_confirmed_at);

  let currentStep = 0;
  if (activeItems.length > 0 && activeItems.every((i: any) => i.delivered_at)) currentStep = 1;
  if (allConfirmed) currentStep = 2;
  if (order.status === 'completed') currentStep = 3;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      {TIMELINE_STEPS.map((step, i) => {
        const isCancelledStep = cancelled && i === 1;
        const done = cancelled ? i === 0 : i <= currentStep;
        const label = isCancelledStep ? 'Cancelled' : step;
        const circleBg = isCancelledStep ? colors.error : done ? colors.success : colors.chipBg;
        const labelColor = isCancelledStep ? colors.error : done ? colors.success : colors.textFaint;
        const lineColor = cancelled ? (i === 0 ? colors.error : colors.chipBg) : i < currentStep ? colors.success : colors.chipBg;
        return (
          <View key={step} style={{ flexDirection: 'row', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: circleBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: done || isCancelledStep ? 'white' : colors.textFaint }}>
                  {isCancelledStep ? '✕' : done ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={{ fontSize: 9, color: labelColor, fontWeight: done || isCancelledStep ? '600' : '400', marginTop: 4 }}>
                {label}
              </Text>
            </View>
            {i < TIMELINE_STEPS.length - 1 && (
              <View style={{ flex: 1, height: 2, backgroundColor: lineColor, marginHorizontal: 6, marginBottom: 16 }} />
            )}
          </View>
        );
      })}
    </View>
  );
}