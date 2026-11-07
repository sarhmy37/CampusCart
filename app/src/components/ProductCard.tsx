import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { Tag, Star, Heart, AlertTriangle, Sparkles, Rocket, BadgeCheck } from 'lucide-react-native';
import Svg, { Path, Defs, Mask, Rect } from 'react-native-svg';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useColors } from '@/hooks/useColors';

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();
const LINK_PAD = GLASS ? { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 } : {};

export default function ProductCard({
  product,
  boostMode = false,
  boostSelected = false,
  onBoostSelect,
}: {
  product: any;
  boostMode?: boolean;
  boostSelected?: boolean;
  onBoostSelect?: (p: any) => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { isWishlisted, toggleItem } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const { addItem } = useCart();

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start();
  const openCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/product/${product.id}`);
  };

  const rating = product.rating || 0;
  const reviewCount = product.review_count || 0;
  const stock = product.stock !== undefined ? product.stock : null;

  const oldPrice = product.old_price ? parseFloat(product.old_price) : null;
  const currentPrice = parseFloat(product.price);
  let discountPercent: number | null = null;
  if (oldPrice && oldPrice > currentPrice && oldPrice > 0 && currentPrice > 0) {
    discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  }

  const sellerPlanActive =
    product.seller_plan &&
    product.seller_plan !== 'free' &&
    product.seller_plan_expires_at &&
    new Date(product.seller_plan_expires_at) > new Date();
  const sellerPlan = sellerPlanActive ? product.seller_plan.toLowerCase() : null;

  const isBoosted = product.boosted_until && new Date(product.boosted_until) > new Date();

  const [boostCountdown, setBoostCountdown] = useState('');
  useEffect(() => {
    if (!isBoosted) return;
    const update = () => {
      const diffMs = new Date(product.boosted_until).getTime() - Date.now();
      if (diffMs <= 0) { setBoostCountdown(''); return; }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setBoostCountdown(hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [isBoosted, product.boosted_until]);

  let stockLabel: string | null = null;
  let stockColor: string = colors.textFaint;
  if (stock !== null && stock <= 0) {
    stockLabel = 'Out of stock';
    stockColor = colors.error;
  }

  const Wrapper: any = GLASS ? GlassView : View;
  const CardInner = (
    <Wrapper
      {...(GLASS ? { glassEffectStyle: 'regular', isInteractive: true } : {})}
      style={{
        ...(GLASS ? {} : { backgroundColor: colors.card }),
        borderRadius: 12,
        borderColor: boostSelected || isBoosted ? colors.brand : colors.border,
        borderWidth: boostSelected ? 2 : GLASS ? (isBoosted ? 1 : 0) : 1,
        overflow: 'hidden',
      }}
    >
      <View style={{ aspectRatio: 1.15, backgroundColor: colors.cardAlt, position: 'relative' }}>
        {product.primary_image ? (
          <Image
            source={{ uri: product.primary_image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Tag size={28} color={colors.textFaint} />
          </View>
        )}

        {/* Condition badge */}
        <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#334155', textTransform: 'capitalize' }}>
            {product.condition}
          </Text>
        </View>

        {/* Boosted badge */}
        {isBoosted && (
          <View style={{ position: 'absolute', top: 6, right: 50, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#38bdf8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
            <Rocket size={10} color="#fff" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>Product</Text>
          </View>
        )}

        {/* Sold out */}
        {stock !== null && stock <= 0 && (
          <View style={{ position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -30 }, { translateY: -12 }], backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>Sold out</Text>
          </View>
        )}

        {/* Low stock */}
        {stock !== null && stock > 0 && stock <= 5 && (
          <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#d97706' }}>{stock} left</Text>
          </View>
        )}

        {/* Discount badge */}
        {discountPercent !== null && !isBoosted && (
          <View style={{ position: 'absolute', top: 6, right: 50, backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>-{discountPercent}%</Text>
          </View>
        )}

          {/* Boost selection check */}
        {boostMode && (
          <View
            style={{
              position: 'absolute', top: 6, left: 6,
              width: 20, height: 20, borderRadius: 10,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: boostSelected ? colors.brand : 'rgba(255,255,255,0.85)',
              borderWidth: 1.5, borderColor: boostSelected ? colors.brand : colors.border,
            }}
          >
            {boostSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
          </View>
        )}

        {/* Add to cart */}
        {!boostMode && !(stock !== null && stock <= 0) && (
          <>
            <Svg width={52} height={52} viewBox="0 0 52 52" style={{ position: 'absolute', top: 0, right: 0 }} pointerEvents="none">
              <Defs>
                <Mask id="plusCut" x="0" y="0" width="52" height="52">
                  <Rect x="0" y="0" width="52" height="52" fill="#fff" />
                  <Path d="M23 20H41M32 11V29" stroke="#000" strokeWidth={3.5} strokeLinecap="round" />
                </Mask>
              </Defs>
              <Path
                d="M0 0 H52 V52 A12 12 0 0 0 40 40 H28 A16 16 0 0 1 12 24 V12 A12 12 0 0 0 0 0 Z"
                fill={colors.brand}
                mask="url(#plusCut)"
              />
            </Svg>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                if (addItem(product)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }}
              style={{ position: 'absolute', top: 0, right: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
              hitSlop={4}
            >
            </Pressable>
          </>
        )}

        {/* Wishlist */}
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); toggleItem(product); }}
          style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={4}
        >
          <Heart
            size={14}
            color={wishlisted ? '#ef4444' : colors.textFaint}
            fill={wishlisted ? '#ef4444' : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={{ padding: 8 }}>
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 15 }}>
          {product.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Star size={11} color="#f59e0b" fill="#f59e0b" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
            {rating ? Number(rating).toFixed(1) : 'New'}
          </Text>
          {reviewCount > 0 && (
            <Text style={{ fontSize: 12, color: colors.textFaint }}>({reviewCount})</Text>
          )}
        </View>

        <View style={{ marginTop: 6 }}>
          {discountPercent !== null && oldPrice ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.textFaint, textDecorationLine: 'line-through' }}>
                  GHS {oldPrice.toFixed(2)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444' }}>
                  -{discountPercent}%
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand }}>
                GHS {currentPrice.toFixed(2)}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand }}>
              GHS {currentPrice.toFixed(2)}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
          {product.seller_verified && <BadgeCheck size={10} color="#10b981" />}
          {sellerPlan === 'premium' && <Sparkles size={10} color="#a855f7" />}
          {sellerPlan === 'pro' && <Star size={10} color="#3b82f6" fill="#3b82f6" />}
          {isBoosted && <Rocket size={10} color={colors.brand} />}
        </View>

        {isBoosted && boostCountdown && (
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.brand, marginTop: 2 }}>
            🚀 {boostCountdown}
          </Text>
        )}

        {stockLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {stock !== null && stock <= 5 && stock > 0 && <AlertTriangle size={11} color="#f59e0b" />}
            <Text style={{ fontSize: 12, fontWeight: '500', color: stockColor }}>{stockLabel}</Text>
          </View>
        )}
      </View>
    </Wrapper>
  );

  if (boostMode) {
    return (
      <Animated.View style={{ width: '100%', transform: [{ scale }] }}>
        <Pressable
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBoostSelect?.(product); }}
        >
          {CardInner}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ width: '100%', transform: [{ scale }] }}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={openCard}>
        {CardInner}
      </Pressable>
    </Animated.View>
  );
}