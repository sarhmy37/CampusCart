import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Tag, Star, Heart, AlertTriangle, MapPin, Sparkles, Rocket, BadgeCheck } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useColors } from '@/hooks/useColors';

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
  let stockColor = colors.textFaint;
  if (stock !== null && stock <= 0) {
    stockLabel = 'Out of stock';
    stockColor = colors.error;
  }

  const CardInner = (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: boostSelected ? colors.brand : isBoosted ? colors.brand : colors.border,
        borderWidth: boostSelected ? 2 : 1,
        overflow: 'hidden',
      }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: colors.cardAlt, position: 'relative' }}>
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
          <Text style={{ fontSize: 9, fontWeight: '600', color: '#334155', textTransform: 'capitalize' }}>
            {product.condition}
          </Text>
        </View>

        {/* Boosted badge */}
        {isBoosted && (
          <View style={{ position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brand, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
            <Rocket size={10} color={colors.textOnGold} />
            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textOnGold }}>Boosted</Text>
          </View>
        )}

        {/* Sold out */}
        {stock !== null && stock <= 0 && (
          <View style={{ position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -30 }, { translateY: -12 }], backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>Sold out</Text>
          </View>
        )}

        {/* Low stock */}
        {stock !== null && stock > 0 && stock <= 5 && (
          <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#d97706' }}>{stock} left</Text>
          </View>
        )}

        {/* Discount badge */}
        {discountPercent !== null && !isBoosted && (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: 'white' }}>-{discountPercent}%</Text>
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
            {boostSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text>}
          </View>
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

      <View style={{ padding: 10 }}>
        <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '600', color: colors.text, lineHeight: 15 }}>
          {product.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Star size={11} color="#f59e0b" fill="#f59e0b" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>
            {rating ? Number(rating).toFixed(1) : 'New'}
          </Text>
          {reviewCount > 0 && (
            <Text style={{ fontSize: 11, color: colors.textFaint }}>({reviewCount})</Text>
          )}
        </View>

        <View style={{ marginTop: 6 }}>
          {discountPercent !== null && oldPrice ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 10, color: colors.textFaint, textDecorationLine: 'line-through' }}>
                  GHS {oldPrice.toFixed(2)}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#ef4444' }}>
                  -{discountPercent}%
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>
                GHS {currentPrice.toFixed(2)}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brand }}>
              GHS {currentPrice.toFixed(2)}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <MapPin size={10} color={colors.textFaint} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: colors.textFaint }}>
            {product.seller_location || product.seller_meeting_place || 'Location not set'}
          </Text>
          {product.seller_verified && <BadgeCheck size={10} color="#10b981" />}
          {sellerPlan === 'premium' && <Sparkles size={10} color="#a855f7" />}
          {sellerPlan === 'pro' && <Star size={10} color="#3b82f6" fill="#3b82f6" />}
          {isBoosted && <Rocket size={10} color={colors.brand} />}
        </View>

        {isBoosted && boostCountdown && (
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.brand, marginTop: 2 }}>
            🚀 {boostCountdown}
          </Text>
        )}

        {stockLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {stock !== null && stock <= 5 && stock > 0 && <AlertTriangle size={11} color="#f59e0b" />}
            <Text style={{ fontSize: 11, fontWeight: '500', color: stockColor }}>{stockLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (boostMode) {
    return (
      <Pressable onPress={() => onBoostSelect?.(product)} style={{ width: '100%' }}>
        {CardInner}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => router.push(`/product/${product.id}`)} style={{ width: '100%' }}>
      {CardInner}
    </Pressable>
  );
}