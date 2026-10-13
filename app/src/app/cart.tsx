import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import Toast from 'react-native-toast-message';

import {
  Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Truck,
} from 'lucide-react-native';
import api from '@/api/client';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { calcDeliveryFee, getDistanceTier } from '@/utils/distance';
import { CART_VIDEO } from '@/data/media';
import { useColors } from '@/hooks/useColors';
import PaystackCheckout from '@/components/PaystackCheckout';

const FALLBACK_DELIVERY_FEE = 15;
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

function ContinueBrowsingButton({ onPress, colors }: { onPress: () => void; colors: any }) {
  const Wrapper: any = GLASS ? GlassView : View;
  return (
    <Pressable onPress={onPress} style={{ alignSelf: 'flex-start' }}>
      <Wrapper
        {...(GLASS ? { glassEffectStyle: 'regular', isInteractive: true } : {})}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          ...(GLASS
            ? { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }
            : {
                backgroundColor: colors.headerPill,
                borderWidth: 1, borderColor: colors.headerPillBorder,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              }),
        }}
      >
        <ArrowLeft size={14} color="white" />
        <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Continue browsing</Text>
      </Wrapper>
    </Pressable>
  );
}

export default function CartScreen() {
  const colors = useColors();
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, total } = useCart();
  const { user } = useAuth();
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

  const [deliveryMethod, setDeliveryMethod] = useState<'on_campus' | 'delivery'>('on_campus');
  const [paying, setPaying] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const [buyerCoords, setBuyerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // Empty state
  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CartHeader count={0} colors={colors} onBack={() => router.push('/browse')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 60 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <ShoppingBag size={28} color={colors.brand} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Your cart is empty</Text>
          <Text style={{ fontSize: 16, color: colors.textFaint, marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
            Browse listings from students on your campus and add something you like.
          </Text>
          <Pressable
            onPress={() => router.push('/browse')}
            style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}
          >
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 16 }}>Browse listings →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const itemCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const subtotal = total;
  const sellerGroups = items.reduce((groups: any, item: any) => {
    const key = item.seller_id || item.seller_name || 'unknown';
    if (!groups[key]) {
      groups[key] = { school: item.seller_school, items: [] };
    }
    groups[key].items.push(item);
    return groups;
  }, {});

  let deliveryFee = 0;
  if (deliveryMethod === 'on_campus' || deliveryMethod === 'delivery') {
    Object.values(sellerGroups).forEach((group: any) => {
      const sellerPrices = {
        delivery_fee_on_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_on_campus || 0)),
        delivery_fee_near_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_near_campus || 0)),
        delivery_fee_far_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_far_campus || 0)),
      };

      if (deliveryMethod === 'on_campus') {
        deliveryFee += sellerPrices.delivery_fee_on_campus;
      } else if (buyerCoords) {
        const distance = getDistanceTier(buyerCoords.lat, buyerCoords.lng, group.school);
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

    setLocating(true);
    setPaying(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission is required to choose delivery' });
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setBuyerCoords(coords);

      const tiers = Object.values(sellerGroups).map((group: any) =>
        getDistanceTier(coords.lat, coords.lng, group.school).tier
      );
      const isOnCampusOrder = deliveryMethod === 'on_campus';
      const isOnCampus = tiers.length > 0 && tiers.every((tier) => tier === 'on_campus');
      const hasOnCampusSeller = tiers.some((tier) => tier === 'on_campus');

      if (isOnCampusOrder && !isOnCampus) {
        Toast.show({ type: 'error', text1: 'You are not on the seller campus', text2: 'Choose outside-campus delivery instead' });
        return;
      }
      if (!isOnCampusOrder && hasOnCampusSeller) {
        Toast.show({ type: 'error', text1: 'You are on campus', text2: 'Choose on-campus delivery instead' });
        return;
      }

      const res = await api.post('/orders', {
        items: items.map((i: any) => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_method: deliveryMethod,
        buyer_lat: coords.lat,
        buyer_lng: coords.lng,
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
    } finally {
      setLocating(false);
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
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 }}
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
        <Text style={{ fontSize: 28, fontWeight: '800', color: 'white', marginTop: 40 }}>Your Cart</Text>
        <Text style={{ fontSize: 16, color: colors.headerMuted, marginTop: 4 }}>
          {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? 's' : ''} ready for checkout` : 'Nothing here yet'}
        </Text>
      </Animated.View>

      {/* BACK BUTTON (fades on scroll) */}
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, opacity: backButtonOpacity }}
      >
        <ContinueBrowsingButton onPress={() => router.push('/browse')} colors={colors} />
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
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10 }}>
        {items.map((item: any, index: number) => (
          <View
            key={item.product_id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                        {item.image && <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} cachePolicy="disk" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{item.title}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.brand, marginTop: 2 }}>
                GHS {parseFloat(item.price).toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.cardAlt, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 }}>
              <Pressable onPress={() => updateQuantity(item.product_id, item.quantity - 1)} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={12} color={colors.textSecondary} />
              </Pressable>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 16, textAlign: 'center' }}>{item.quantity}</Text>
              <Pressable onPress={() => updateQuantity(item.product_id, item.quantity + 1)} style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={12} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable onPress={() => removeItem(item.product_id)} style={{ padding: 4 }}>
              <Trash2 size={16} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}
        </View>

        {/* SUMMARY */}
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 22 }}>{'Order\nsummary'}</Text>

          {/* Delivery method toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, gap: 4 }}>
            {(['on_campus', 'delivery'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setDeliveryMethod(m)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: deliveryMethod === m ? colors.card : 'transparent' }}
              >
                {m === 'on_campus' ? <MapPin size={13} color={deliveryMethod === m ? colors.brand : colors.textMuted} /> : <Truck size={13} color={deliveryMethod === m ? colors.brand : colors.textMuted} />}
                <Text style={{ fontSize: 14, fontWeight: '600', color: deliveryMethod === m ? colors.brand : colors.textMuted }}>
                  {m === 'on_campus' ? 'On campus' : 'Off campus'}
                </Text>
              </Pressable>
            ))}
          </View>
          </View>

          {deliveryMethod === 'delivery' && (
            <Text style={{ fontSize: 14, color: colors.textFaint, marginBottom: 8, textAlign: 'right' }}>Delivered within 1–3 working days.</Text>
          )}

          {/* Subtotal */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>Subtotal ({itemCount} item{itemCount > 1 ? 's' : ''})</Text>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>GHS {subtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, color: colors.textMuted }}>Delivery</Text>
                {deliveryDiscountRate > 0 && deliveryFee > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>
                    -{Math.round(deliveryDiscountRate * 100)}%
                  </Text>
                )}
              </View>
              {deliveryFee > 0 ? (
                deliveryDiscountRate > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' }}>
                      GHS {deliveryFee.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.textMuted }}>GHS {discountedDeliveryFee.toFixed(2)}</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 16, color: colors.textMuted }}>GHS {deliveryFee.toFixed(2)}</Text>
                )
              ) : (
                <Text style={{ fontSize: 16, color: colors.textMuted }}>Free</Text>
              )}
            </View>
          </View>

          {/* Total */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderMuted, marginTop: 16, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Total</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>GHS {grandTotal.toFixed(2)}</Text>
          </View>

          {deliveryMethod === 'delivery' && (
            <Text style={{ fontSize: 14, color: colors.textFaint, marginTop: 6 }}>
              Paystack charges a 2% payment processing fee at checkout.
            </Text>
          )}

          {/* Action button */}
          <Pressable
            onPress={handleAction}
            disabled={paying || locating}
            style={{ marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: paying || locating ? 0.6 : 1 }}
          >
            {locating && (
              <ActivityIndicator size="small" color={colors.textOnGold} />
            )}
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 16 }}>
              {paying
                ? 'Redirecting to payment…'
                : locating
                  ? 'Checking location…'
                  : `Pay · GHS ${grandTotal.toFixed(2)}`}
            </Text>
          </Pressable>

          {!user && (
            <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center', marginTop: 12 }}>
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

    </View>
  );
}

function CartHeader({ count, colors, onBack }: { count: number; colors: any; onBack: () => void }) {
  return (
    <View style={{ position: 'relative', overflow: 'hidden', height: 160 }}>
      <CartVideo uri={CART_VIDEO} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.headerOverlay }} />

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <ContinueBrowsingButton onPress={onBack} colors={colors} />
        <Text style={{ fontSize: 28, fontWeight: '800', color: 'white', marginTop: 36 }}>Your Cart</Text>
        <Text style={{ fontSize: 16, color: colors.headerMuted, marginTop: 4 }}>
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