import { useState, useEffect, useRef, Fragment } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import Toast from 'react-native-toast-message';

import {
  Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Truck, Link2,
} from 'lucide-react-native';
import { ShoppingBagIcon as ShoppingBagSolid } from 'react-native-heroicons/solid';
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
        <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Browse</Text>
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
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 60 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <ShoppingBagSolid size={28} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Your cart is empty</Text>
              <Text style={{ fontSize: 16, color: colors.textFaint, marginTop: 6, lineHeight: 22 }}>
                Browse listings from students on your campus and add something you like.
              </Text>
            </View>
          </View>
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

  const keyOf = (i: any) => i.seller_id || i.seller_name || 'unknown';
  const orderedItems: any[] = Object.values(sellerGroups).flatMap((g: any) => g.items);

  const u0: any = user;
  const w0: any = items.find((i: any) => i.buyer_lat != null && i.buyer_lng != null);
  const feeCoords = buyerCoords
    || (w0 ? { lat: Number(w0.buyer_lat), lng: Number(w0.buyer_lng) }
    : u0?.location_lat != null && u0?.location_lng != null ? { lat: Number(u0.location_lat), lng: Number(u0.location_lng) }
    : null);
  const groupMethod = (group: any): 'on_campus' | 'delivery' => {
    if (!feeCoords) return deliveryMethod;
    return getDistanceTier(feeCoords.lat, feeCoords.lng, group.school).tier === 'on_campus'
      ? 'on_campus'
      : 'delivery';
  };
  const hasMixed = new Set(Object.values(sellerGroups).map(groupMethod)).size > 1;

  let deliveryFee = 0;
  {
    Object.values(sellerGroups).forEach((group: any) => {
      const method = groupMethod(group);
      const sellerPrices = {
        delivery_fee_on_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_on_campus || 0)),
        delivery_fee_near_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_near_campus || 0)),
        delivery_fee_far_campus: Math.max(...group.items.map((i: any) => i.delivery_fee_far_campus || 0)),
      };

      if (method === 'on_campus') {
        group.fee = sellerPrices.delivery_fee_on_campus;
        deliveryFee += group.fee;
      } else if (feeCoords) {
        const { fee } = calcDeliveryFee(feeCoords.lat, feeCoords.lng, group.school, sellerPrices);
        group.fee = fee;
        deliveryFee += fee;
      } else {
        group.fee = sellerPrices.delivery_fee_far_campus || FALLBACK_DELIVERY_FEE;
        deliveryFee += group.fee;
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

    const u: any = user;
    const withLoc: any = items.find((i: any) => i.buyer_lat != null && i.buyer_lng != null);
    const coords = withLoc
      ? { lat: Number(withLoc.buyer_lat), lng: Number(withLoc.buyer_lng) }
      : u.location_lat != null && u.location_lng != null
        ? { lat: Number(u.location_lat), lng: Number(u.location_lng) }
        : null;
    if (!coords) {
      Toast.show({ type: 'error', text1: 'Set your delivery location on a product page first' });
      return;
    }
    setLocating(true);
    setPaying(true);
    try {
      setBuyerCoords(coords);

      const res = await api.post('/orders', {
        items: items.map((i: any) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          delivery_method: groupMethod(sellerGroups[i.seller_id || i.seller_name || 'unknown']),
        })),
        delivery_method: hasMixed ? 'mixed' : groupMethod(Object.values(sellerGroups)[0]),
        buyer_lat: coords.lat,
        buyer_lng: coords.lng,
        buyer_location: withLoc?.buyer_location ?? u.location ?? null,
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
        {orderedItems.map((item: any, index: number) => {
          const sKey = keyOf(item);
          const prev = orderedItems[index - 1];
          const sameAsPrev = !!prev && keyOf(prev) === sKey;
          const fee = sellerGroups[sKey]?.fee || 0;
          const posInGroup = orderedItems.slice(0, index).filter((i: any) => keyOf(i) === sKey).length;
          return (
          <Fragment key={item.product_id}>
          {index > 0 && !(sameAsPrev && posInGroup > 1) && (sameAsPrev ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Link2 size={12} color={colors.textFaint} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textFaint }}>Same seller</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 1 }}>
                  {fee > 0 ? `Delivery GHS ${fee.toFixed(2)}` : 'Free delivery'}
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
          ) : (
            <View style={{ height: 1, backgroundColor: colors.border }} />
          ))}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: sameAsPrev ? 6 : 10,
            }}
          >
            <Pressable
              onPress={() => router.push(`/product/${item.product_id}` as any)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}
            >
            <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                        {item.image && <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} cachePolicy="disk" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{item.title}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.brand, marginTop: 2 }}>
                GHS {parseFloat(item.price).toFixed(2)}
              </Text>
              {(() => {
                const grp = sellerGroups[item.seller_id || item.seller_name || 'unknown'];
                if (grp?.items.length > 1) return null;
                const fee = grp?.fee || 0;
                return (
                  <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                    {fee > 0 ? `Delivery GHS ${fee.toFixed(2)}` : 'Free delivery'}
                  </Text>
                );
              })()}
            </View>
            </Pressable>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {feeCoords && (() => {
                  const on = groupMethod(sellerGroups[item.seller_id || item.seller_name || 'unknown']) === 'on_campus';
                  return (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: on ? colors.success : colors.warning }}>
                      {on ? 'On campus' : 'Off campus'}
                    </Text>
                  );
                })()}
                <Pressable onPress={() => removeItem(item.product_id)} hitSlop={8}>
                  <Trash2 size={16} color={colors.textFaint} />
                </Pressable>
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
            </View>
          </View>
          </Fragment>
          );
        })}
        </View>

        {/* SUMMARY */}
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 22 }}>Order summary</Text>

          {/* Delivery method toggle */}
          <View style={{ display: feeCoords ? 'none' : 'flex', flexDirection: 'row', backgroundColor: colors.chipBg, padding: 4, borderRadius: 12, gap: 4 }}>
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

          <Text style={{ fontSize: 14, color: colors.textFaint, marginTop: 6 }}>
            Paystack charges a 2% payment processing fee at checkout.
          </Text>

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