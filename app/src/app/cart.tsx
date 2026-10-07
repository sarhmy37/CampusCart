import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Modal, TextInput, Linking, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import Toast from 'react-native-toast-message';
import {
  Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Truck,
  Loader2, Send, X, MessageCircle,
} from 'lucide-react-native';
import api from '@/api/client';
import { useChat } from '@/context/ChatContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { calcDeliveryFee, SCHOOL_COORDS, haversineKm } from '@/utils/distance';
import { CART_VIDEO } from '@/data/media';
import { useColors } from '@/hooks/useColors';
import PaystackCheckout from '@/components/PaystackCheckout';

const FALLBACK_DELIVERY_FEE = 15;

function formatWhatsAppNumber(raw: string | null | undefined) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '233' + digits.slice(1);
  return digits;
}

function buildPurchaseDraft(sellerItems: any[]) {
  if (!sellerItems || sellerItems.length === 0) return '';
  const lines = sellerItems.map(
    (i) => `• ${i.quantity}x ${i.title} (GHS ${(parseFloat(i.price) * i.quantity).toFixed(2)})`
  );
  const subtotal = sellerItems.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2);
  return `Hi, I'd like to buy:\n${lines.join('\n')}\n\nSubtotal: GHS ${subtotal}`;
}

function buildWhatsAppMessage(sellerName: string | null | undefined, sellerItems: any[]) {
  const lines = [
    `Hello ${sellerName || 'there'} 👋`,
    '',
    `I found the following on Tre-X and I'd love to place an order:`,
    '',
    ...sellerItems.map(
      (i) => `🛍️ ${i.title} × ${i.quantity} — GHS ${(parseFloat(i.price) * i.quantity).toFixed(2)}`
    ),
    '',
    `💰 Total: GHS ${sellerItems.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2)}`,
    '',
    `🤝 I'll pick it up on campus, kindly let me know a convenient meeting point.`,
    '',
    'Please confirm if this is still available. Thank you!',
  ];
  return lines.join('\n');
}

export default function CartScreen() {
  const colors = useColors();
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, total } = useCart();
  const { user } = useAuth();
  const { openChat, broadcastToSellers, openConversationDirect } = useChat();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = 200;
  const contentH = useRef(0);
  const layoutH = useRef(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const updateMax = () => setMaxScroll(Math.max(0, contentH.current - layoutH.current));
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTextOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const backButtonOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [paying, setPaying] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const [buyerCoords, setBuyerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [onCampusChecked, setOnCampusChecked] = useState(false);
  const [verifyingCampus, setVerifyingCampus] = useState(false);
  const [confirmedOnCampus, setConfirmedOnCampus] = useState<boolean | null>(null);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const sellerGroups = items.reduce((groups: any, item: any) => {
    const key = item.seller_id || item.seller_whatsapp || item.seller_name || 'unknown';
    if (!groups[key]) {
      groups[key] = { sellerName: item.seller_name, whatsapp: item.seller_whatsapp, school: item.seller_school, items: [] };
    }
    groups[key].items.push(item);
    return groups;
  }, {});

  const sellersForChat = Object.values(sellerGroups)
    .map((group: any) => ({
      sellerId: group.items[0]?.seller_id,
      sellerName: group.sellerName,
      productId: group.items[0]?.product_id,
      items: group.items,
    }))
    .filter((s: any) => s.sellerId);

  // Auto-detect location when delivery selected
  useEffect(() => {
    if (deliveryMethod !== 'delivery' || buyerCoords || locationDenied) return;
    (async () => {
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationDenied(true);
          setLocating(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setBuyerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setLocationDenied(true);
      } finally {
        setLocating(false);
      }
    })();
  }, [deliveryMethod, buyerCoords, locationDenied]);

  const sellerSchoolsInCart = [...new Set(items.map((i: any) => i.seller_school).filter(Boolean))];

  const handleOnCampusToggle = async () => {
    if (onCampusChecked) {
      setOnCampusChecked(false);
      setConfirmedOnCampus(null);
      return;
    }
    setOnCampusChecked(true);
    setVerifyingCampus(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: "Couldn't verify your location" });
        setOnCampusChecked(false);
        setVerifyingCampus(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      const isOnCampus = (sellerSchoolsInCart as string[]).some((school) => {
        const coords = (SCHOOL_COORDS as any)[school];
        if (!coords) return false;
        return haversineKm(latitude, longitude, coords.lat, coords.lng) <= 2;
      });
      setBuyerCoords({ lat: latitude, lng: longitude });
      setConfirmedOnCampus(isOnCampus);
      if (!isOnCampus) {
        Toast.show({ type: 'error', text1: "You don't appear to be on campus right now" });
      }
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't verify your location" });
      setOnCampusChecked(false);
    } finally {
      setVerifyingCampus(false);
    }
  };

  const openBroadcastModal = () => {
    const sellerCount = sellersForChat.length;
    Toast.show({
      type: 'info',
      text1: `You're purchasing from ${sellerCount} different sellers`,
      text2: 'This message will be sent to all of them',
      visibilityTime: 4500,
    });
    setShowBroadcastModal(true);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() || sendingBroadcast) return;
    setSendingBroadcast(true);
    try {
      const conversations = await broadcastToSellers(sellersForChat, broadcastMessage);
      if (conversations.length > 0) {
        Toast.show({
          type: 'success',
          text1: `Message sent to ${conversations.length} seller${conversations.length > 1 ? 's' : ''}`,
        });
        setShowBroadcastModal(false);
        setBroadcastMessage('');
        openConversationDirect(conversations[0]);
      }
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Empty state
  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CartHeader count={0} colors={colors} onBack={() => router.push('/browse')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 60 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <ShoppingBag size={28} color={colors.brand} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Your cart is empty</Text>
          <Text style={{ fontSize: 14, color: colors.textFaint, marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
            Browse listings from students on your campus and add something you like.
          </Text>
          <Pressable
            onPress={() => router.push('/browse')}
            style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}
          >
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>Browse listings →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const itemCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const subtotal = total;

  let deliveryFee = 0;
  if (deliveryMethod === 'delivery') {
    Object.values(sellerGroups).forEach((group: any) => {
      const sellerPrices = {
        delivery_fee_on_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_on_campus || 0)),
        delivery_fee_near_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_near_campus || 0)),
        delivery_fee_far_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_far_campus || 0)),
      };

      if (confirmedOnCampus === true) {
        deliveryFee += sellerPrices.delivery_fee_on_campus;
      } else if (buyerCoords) {
        const { fee } = calcDeliveryFee(buyerCoords.lat, buyerCoords.lng, group.school, sellerPrices);
        deliveryFee += fee;
      } else {
        deliveryFee += sellerPrices.delivery_fee_far_campus || FALLBACK_DELIVERY_FEE;
      }
    });
  }

  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
  const deliveryDiscountRate = isPlanActive
    ? (user.plan.toLowerCase() === 'premium' ? 0.18 : user.plan.toLowerCase() === 'pro' ? 0.10 : 0)
    : 0;
  const deliveryDiscount = deliveryFee * deliveryDiscountRate;
  const discountedDeliveryFee = deliveryFee - deliveryDiscount;

  const grandTotal = subtotal + discountedDeliveryFee;

  const handleAction = async () => {
    if (!user) return router.push('/login');

    if (deliveryMethod === 'pickup') {
      if (sellersForChat.length === 0) return;

      if (sellersForChat.length === 1) {
        const seller: any = sellersForChat[0];
        openChat({ ...seller, draftMessage: buildPurchaseDraft(seller.items) });
      } else {
        openBroadcastModal();
      }
      return;
    }

    setPaying(true);
    try {
      const res = await api.post('/orders', {
        items: items.map((i: any) => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_method: deliveryMethod,
        buyer_lat: buyerCoords?.lat ?? null,
        buyer_lng: buyerCoords?.lng ?? null,
      });
      setCheckoutUrl(res.data.authorization_url);
    } catch (err: any) {
      if (err.response?.data?.needs_verification) {
        Toast.show({ type: 'error', text1: 'Please verify your email before placing an order' });
        router.replace('/');
      } else {
        Toast.show({ type: 'error', text1: err.response?.data?.error || 'Checkout failed' });
      }
      setPaying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* FIXED VIDEO BACKGROUND */}
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, overflow: 'hidden', backgroundColor: '#000',
        }}
      >
        <CartVideo uri={CART_VIDEO} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.headerOverlay }} />
        <LinearGradient
          colors={['transparent', '#000']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 50 }}
        />
      </View>

      {/* HEADER TEXT (fades on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, paddingHorizontal: 16, paddingTop: 16,
          opacity: headerTextOpacity,
        }}
      >
        <View style={{ height: 30 }} />
        <Text style={{ fontSize: 26, fontWeight: '800', color: 'white', marginTop: 40 }}>Your Cart</Text>
        <Text style={{ fontSize: 14, color: colors.headerMuted, marginTop: 4 }}>
          {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? 's' : ''} ready for checkout` : 'Nothing here yet'}
        </Text>
      </Animated.View>

      {/* BACK BUTTON (fades on scroll) */}
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, opacity: backButtonOpacity }}
      >
        <Pressable
          onPress={() => router.push('/browse')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.headerPill, borderWidth: 1, borderColor: colors.headerPillBorder, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={14} color="white" />
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Continue browsing</Text>
        </Pressable>
      </Animated.View>

      {/* SCROLLABLE BODY (scrolls over the video) */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => { layoutH.current = e.nativeEvent.layout.height; updateMax(); }}
        onContentSizeChange={(_, h) => { contentH.current = h; updateMax(); }}
        contentContainerStyle={{ paddingTop: heroHeight - 24 }}
      >
        <Animated.View
          style={{
            transform: [{
              translateY: scrollY.interpolate({
                inputRange: [maxScroll, maxScroll + 300],
                outputRange: [0, 300],
                extrapolateLeft: 'clamp',
              }),
            }],
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 12,
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
            gap: 12,
            minHeight: height - heroHeight + 24,
          }}
        >
        {/* ITEMS */}
        {items.map((item: any) => (
          <View
            key={item.product_id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
              borderRadius: 16, padding: 10,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                        {item.image && <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} cachePolicy="disk" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{item.title}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand, marginTop: 2 }}>
                GHS {parseFloat(item.price).toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.cardAlt, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 }}>
              <Pressable onPress={() => updateQuantity(item.product_id, item.quantity - 1)} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={12} color={colors.textSecondary} />
              </Pressable>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, minWidth: 16, textAlign: 'center' }}>{item.quantity}</Text>
              <Pressable onPress={() => updateQuantity(item.product_id, item.quantity + 1)} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={12} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable onPress={() => removeItem(item.product_id)} style={{ padding: 4 }}>
              <Trash2 size={16} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}

        {/* SELLER CONTACT — only for pickup */}
        {deliveryMethod === 'pickup' && (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Chat with sellers
            </Text>
            <View style={{ gap: 8 }}>
              {Object.values(sellerGroups).map((group: any) => {
                const number = formatWhatsAppNumber(group.whatsapp);
                const message = buildWhatsAppMessage(group.sellerName, group.items);
                const waUrl = number
                  ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
                  : null;
                const sellerId = group.items[0]?.seller_id;

                return (
                  <View key={group.sellerName + (group.whatsapp || '')} style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        if (!user) return router.push('/login');
                        if (!sellerId) return Toast.show({ type: 'error', text1: 'Could not identify this seller' });
                        openChat({
                          sellerId,
                          sellerName: group.sellerName,
                          productId: group.items[0]?.product_id,
                          draftMessage: buildPurchaseDraft(group.items),
                        });
                      }}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandSoft }}
                    >
                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>
                        Message {group.sellerName} in-app
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (!user) return router.push('/login');
                        if (!waUrl) return Toast.show({ type: 'info', text1: `${group.sellerName} hasn't added a WhatsApp number yet.` });
                        Linking.openURL(waUrl);
                      }}
                      style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: waUrl ? colors.success : colors.border, backgroundColor: waUrl ? colors.successSoft : colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MessageCircle size={18} color={waUrl ? colors.success : colors.textFaint} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* SUMMARY */}
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Order summary</Text>

          {/* Delivery method toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, alignSelf: 'center', marginBottom: 16, gap: 4 }}>
            {(['pickup', 'delivery'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setDeliveryMethod(m)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: deliveryMethod === m ? colors.card : 'transparent' }}
              >
                {m === 'pickup' ? <MapPin size={13} color={deliveryMethod === m ? colors.brand : colors.textMuted} /> : <Truck size={13} color={deliveryMethod === m ? colors.brand : colors.textMuted} />}
                <Text style={{ fontSize: 12, fontWeight: '600', color: deliveryMethod === m ? colors.brand : colors.textMuted }}>
                  {m === 'pickup' ? 'Meet on campus' : 'Delivery'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* On-campus checkbox (delivery only) */}
          {deliveryMethod === 'delivery' && (
            <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, marginBottom: 12 }}>
              <Pressable onPress={handleOnCampusToggle} disabled={verifyingCampus} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: onCampusChecked ? colors.brand : colors.textFaint, backgroundColor: onCampusChecked ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {onCampusChecked && <Text style={{ color: colors.textOnGold, fontSize: 12, fontWeight: '900' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>Are you on campus?</Text>
              </Pressable>

              {verifyingCampus && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <ActivityIndicator size="small" color={colors.textFaint} />
                  <Text style={{ fontSize: 12, color: colors.textFaint }}>Checking your location…</Text>
                </View>
              )}
              {!verifyingCampus && confirmedOnCampus === true && (
                <Text style={{ fontSize: 12, color: colors.success, marginTop: 8 }}>
                  ✓ You're on campus — delivery fee applied.
                </Text>
              )}
              {!verifyingCampus && confirmedOnCampus === false && (
                <Text style={{ fontSize: 12, color: colors.error, marginTop: 8 }}>
                  You are not on campus. Standard delivery rates apply based on your distance.
                </Text>
              )}
            </View>
          )}

          {deliveryMethod === 'delivery' && confirmedOnCampus !== true && (
            <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 8 }}>Delivered within 1–3 working days.</Text>
          )}

          {/* Subtotal */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Subtotal ({itemCount} item{itemCount > 1 ? 's' : ''})</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>GHS {subtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>Delivery</Text>
                {deliveryDiscountRate > 0 && deliveryFee > 0 && (
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.success }}>
                    -{Math.round(deliveryDiscountRate * 100)}%
                  </Text>
                )}
              </View>
              {deliveryFee > 0 ? (
                deliveryDiscountRate > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.textFaint, textDecorationLine: 'line-through' }}>
                      GHS {deliveryFee.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted }}>GHS {discountedDeliveryFee.toFixed(2)}</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>GHS {deliveryFee.toFixed(2)}</Text>
                )
              ) : (
                <Text style={{ fontSize: 14, color: colors.textMuted }}>Free</Text>
              )}
            </View>
          </View>

          {/* Total */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, marginTop: 16, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>GHS {grandTotal.toFixed(2)}</Text>
          </View>

          {deliveryMethod === 'delivery' && (
            <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 6 }}>
              A 2% payment processing fee is added at checkout.
            </Text>
          )}

          {/* Action button */}
          <Pressable
            onPress={handleAction}
            disabled={paying || (deliveryMethod === 'delivery' && locating)}
            style={{ marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: paying || (deliveryMethod === 'delivery' && locating) ? 0.6 : 1 }}
          >
            {deliveryMethod === 'delivery' && locating && !paying && (
              <ActivityIndicator size="small" color={colors.textOnGold} />
            )}
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
              {paying
                ? 'Redirecting to payment…'
                : deliveryMethod === 'delivery' && locating
                  ? 'Checking location…'
                  : deliveryMethod === 'pickup'
                    ? 'Chat with Seller(s)'
                    : `Pay · GHS ${grandTotal.toFixed(2)}`}
            </Text>
          </Pressable>

          {!user && (
            <Text style={{ fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 12 }}>
              You'll need to log in first
            </Text>
          )}
        </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* PAYSTACK CHECKOUT (in-app) */}
      <PaystackCheckout
        key={checkoutUrl ?? 'none'}
        visible={!!checkoutUrl}
        authorizationUrl={checkoutUrl}
        callbackUrl="https://campuscart-tdfn.onrender.com/paystack/callback"
        onSuccess={async (reference) => {
          setCheckoutUrl(null);
          setPaying(false);
          try {
            Toast.show({ type: 'success', text1: 'Payment received', text2: 'Your order is being confirmed' });
            clearCart();
            router.replace('/dashboard?tab=orders');
          } catch {}
        }}
        onClose={() => {
          setCheckoutUrl(null);
          setPaying(false);
        }}
      />

      {/* BROADCAST MODAL */}
      <Modal visible={showBroadcastModal} transparent animationType="slide" onRequestClose={() => setShowBroadcastModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight, justifyContent: 'flex-end' }} onPress={() => !sendingBroadcast && setShowBroadcastModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={17} color={colors.brand} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Message all sellers</Text>
              </View>
              <Pressable onPress={() => !sendingBroadcast && setShowBroadcastModal(false)} style={{ padding: 6 }}>
                <X size={18} color={colors.textFaint} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 16 }}>
              This will start (or continue) a chat with each of the {sellersForChat.length} sellers below and send them the same message.
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {sellersForChat.map((s: any) => (
                <View key={s.sellerId} style={{ backgroundColor: colors.chipBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{s.sellerName}</Text>
                </View>
              ))}
            </View>

            <TextInput
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              placeholder="Hi, I'd like to arrange pickup for my order..."
              placeholderTextColor={colors.textFaint}
              multiline
              editable={!sendingBroadcast}
              style={{
                paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
                borderWidth: 1, borderColor: colors.border,
                backgroundColor: colors.inputBg, color: colors.text, fontSize: 14,
                minHeight: 90, textAlignVertical: 'top',
              }}
            />

            <Pressable
              onPress={handleSendBroadcast}
              disabled={!broadcastMessage.trim() || sendingBroadcast}
              style={{ marginTop: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: !broadcastMessage.trim() || sendingBroadcast ? 0.6 : 1 }}
            >
              {sendingBroadcast ? (
                <>
                  <ActivityIndicator size="small" color={colors.textOnGold} />
                  <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>Sending…</Text>
                </>
              ) : (
                <>
                  <Send size={16} color={colors.textOnGold} />
                  <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                    Send to {sellersForChat.length} sellers
                  </Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CartHeader({ count, colors, onBack }: { count: number; colors: any; onBack: () => void }) {
  return (
    <View style={{ position: 'relative', overflow: 'hidden', height: 160 }}>
      <CartVideo uri={CART_VIDEO} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.headerOverlay }} />

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.headerPill, borderWidth: 1, borderColor: colors.headerPillBorder, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={14} color="white" />
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Continue browsing</Text>
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: '800', color: 'white', marginTop: 36 }}>Your Cart</Text>
        <Text style={{ fontSize: 14, color: colors.headerMuted, marginTop: 4 }}>
          {count > 0 ? `${count} item${count > 1 ? 's' : ''} ready for checkout` : 'Nothing here yet'}
        </Text>
      </View>
    </View>
  );
}

function CartVideo({ uri }: { uri: string | number }) {
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