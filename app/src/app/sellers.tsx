import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star, TrendingUp } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import api from '@/api/client';

type Seller = {
  user_id: string;
  name: string;
  avatar: string | null;
  shop_name?: string;
  sales: number;
  rating: number;
  trend_pct: number;
};

const STEP_1 = 25;
const STEP_2 = 75;

export default function SellersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(STEP_1);
  const heroHeight = 170;
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTextOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    api.get('/sellers/leaderboard')
      .then((res) => {
        const live = res.data || [];
        const sorted = [...live].sort((a, b) => (b.sales - a.sales) || (b.rating - a.rating));
        setSellers(sorted.slice(0, 100));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visibleSellers = useMemo(() => sellers.slice(0, visibleCount), [sellers, visibleCount]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* FIXED VIOLET HEADER */}
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, backgroundColor: '#6d28d9',
        }}
      >
        <LinearGradient
          colors={['rgba(109,40,217,0)', colors.background]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
        />
      </View>

      {/* HEADER TEXT (fades on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, paddingHorizontal: 16,
          paddingTop: insets.top + 60,
          opacity: headerTextOpacity,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff' }}>Top Sellers</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
          Ranked by sales and rating
        </Text>
      </Animated.View>

      {/* BACK BUTTON (stays visible) */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={{ position: 'absolute', top: insets.top + 12, left: 12, zIndex: 20, padding: 6 }}
      >
        <ChevronLeft size={24} color="#fff" />
      </Pressable>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: heroHeight - 20, paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {visibleSellers.map((seller, index) => (
          <SellerRow
            key={seller.user_id}
            seller={seller}
            rank={index + 1}
            colors={colors}
            onPress={() => router.push(`/seller/${seller.user_id}`)}
          />
        ))}

        {visibleCount < sellers.length && (
          <Pressable
            onPress={() => setVisibleCount(visibleCount < STEP_2 ? STEP_2 : sellers.length)}
            style={{ alignItems: 'center', paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand }}>
              {visibleCount < STEP_2 ? 'View more' : 'View all'}
            </Text>
          </Pressable>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function rankAccent(rank: number) {
  if (rank === 1) return '#f59e0b';
  if (rank === 2) return '#9ca3af';
  if (rank === 3) return '#c2410c';
  return null;
}

function SellerRow({
  seller, rank, colors, onPress,
}: { seller: Seller; rank: number; colors: any; onPress: () => void }) {
  const accent = rankAccent(rank);
  const isTop = accent !== null;
  const trendUp = seller.trend_pct >= 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: isTop ? accent! : colors.textFaint }}>
          {rank}
        </Text>
      </View>

      <View style={{ width: 48, height: 48 }}>
        <View
          style={{
            width: 48, height: 48, borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: colors.chipBg,
            borderWidth: isTop ? 2 : 1,
            borderColor: isTop ? accent! : colors.border,
          }}
        >
          {seller.avatar ? (
            <Image source={{ uri: seller.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.brand }}>
                {seller.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
            {seller.name}
          </Text>
          {rank === 1 && (
            <View style={{ backgroundColor: colors.brandSoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: colors.brand, letterSpacing: 0.4 }}>#1</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted }}>
            {seller.shop_name || `${seller.sales} sales`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Star size={11} color={colors.brand} fill={colors.brand} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>
              {seller.rating.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: colors.text }}>{seller.sales}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
          <TrendingUp
            size={11}
            color={trendUp ? '#16a34a' : '#dc2626'}
            style={{ transform: [{ scaleY: trendUp ? 1 : -1 }] }}
          />
          <Text style={{ fontSize: 11, fontWeight: '700', color: trendUp ? '#16a34a' : '#dc2626' }}>
            {Math.abs(seller.trend_pct)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}