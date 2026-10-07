import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Linking, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Star, Tag, Sparkles, BadgeCheck, ShoppingBag } from 'lucide-react-native';
import ProductCard from '@/components/ProductCard';
import { useColors } from '@/hooks/useColors';
import api from '@/api/client';

const GRID_GAP = 10;
const COLUMNS = 3;

const SOCIAL_LINKS = [
  {
    key: 'social_tiktok', label: 'TikTok', bg: '#000000',
    href: (v: string) => `https://www.tiktok.com/@${v.replace('@', '')}`,
    path: 'M16.6 5.82c-1-.87-1.6-2.14-1.6-3.52h-3.15v13.4c0 1.62-1.3 2.93-2.92 2.93a2.92 2.92 0 0 1-2.92-2.93 2.92 2.92 0 0 1 2.92-2.92c.3 0 .58.04.85.13V9.75a6.13 6.13 0 0 0-.85-.06A6.1 6.1 0 0 0 3.02 15.8 6.1 6.1 0 0 0 9.13 21.9a6.1 6.1 0 0 0 6.1-6.1V8.57a9.14 9.14 0 0 0 5.31 1.7V7.1a5.97 5.97 0 0 1-3.94-1.28z',
  },
  {
    key: 'social_whatsapp', label: 'WhatsApp', bg: '#25D366',
    href: (v: string) => `https://wa.me/${v.replace(/\D/g, '')}`,
    path: 'M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2z',
  },
  {
    key: 'social_instagram', label: 'Instagram', bg: '#d62976',
    href: (v: string) => `https://instagram.com/${v.replace('@', '')}`,
    path: 'M12 2c-2.72 0-3.06.01-4.13.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2.01 8.94 2 9.28 2 12s.01 3.06.06 4.13c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.94 21.99 9.28 22 12 22s3.06-.01 4.13-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.07.06-1.41.06-4.13s-.01-3.06-.06-4.13c-.05-1.06-.22-1.79-.47-2.43a4.9 4.9 0 0 0-1.16-1.77 4.9 4.9 0 0 0-1.77-1.16c-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2Z',
  },
  {
    key: 'social_snapchat', label: 'Snapchat', bg: '#FFFC00', iconColor: '#000000',
    href: (v: string) => `https://snapchat.com/add/${v.replace('@', '')}`,
    path: 'M12.006 2.001C9.875 2.001 8.05 3.254 6.874 5.328c-.858 1.38-1.372 3.053-1.58 4.883-.211 1.86-.042 3.544.458 4.897-.36.082-.744.132-1.142.132-1.63 0-3.114-.709-3.114-2.188 0-.554.286-1.006.601-1.273.5-.5 1.5-.7 1.5-2.05 0-.6-.4-1.1-.9-1.2 0 0 .8-2.5 3-2.5 1.5 0 2.5 1 3.5 1s2-1 3.5-1c2.2 0 3 2.5 3 2.5-.5.1-.9.6-.9 1.2 0 1.35 1 1.55 1.5 2.05.315.267.601.719.601 1.273 0 1.479-1.484 2.188-3.114 2.188-.398 0-.782-.05-1.142-.132.5 1.353.669 3.037.458 4.897 5.077 4.487.709.306 1.262.489 1.694.625 4.548-.382-.789-.773-1.647-1.157-2.608z',
  },
  {
    key: 'social_facebook', label: 'Facebook', bg: '#1877F2',
    href: (v: string) => (v.startsWith('http') ? v : `https://facebook.com/${v}`),
    path: 'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z',
  },
];

function SocialIcon({ path, color = '#fff' }: { path: string; color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
      <Path d={path} />
    </Svg>
  );
}

function SocialHandlesRow({ seller }: { seller: any }) {
  const activeLinks = SOCIAL_LINKS.filter((link) => seller?.[link.key]);
  if (activeLinks.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
      {activeLinks.map((link) => (
        <Pressable
          key={link.key}
          onPress={() => Linking.openURL(link.href(seller[link.key]))}
          style={{
            width: 34, height: 34, borderRadius: 10,
            backgroundColor: link.bg,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SocialIcon path={link.path} color={(link as any).iconColor || '#fff'} />
        </Pressable>
      ))}
    </View>
  );
}

type Props = {
  id?: string;
  embedded?: boolean;
  // pick mode: tapping a product selects it instead of opening it (used by the story product tag)
  pickMode?: boolean;
  selectedId?: string | null;
  onSelect?: (p: any) => void;
};

export default function StorePage({
  id: idProp, embedded = false, pickMode = false, selectedId = null, onSelect,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = idProp || params.id;

  const heroHeight = embedded ? 240 : height * 0.38;

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const [seller, setSeller] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [rating, setRating] = useState<{ avg_rating: number | null; total: number } | null>(null);
  const [salesCount, setSalesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      api.get(`/products/seller/${id}`),
      api.get(`/reviews/seller/${id}`).catch(() => ({ data: { avg_rating: null, total: 0 } })),
    ])
      .then(([storeRes, reviewsRes]) => {
        setSeller(storeRes.data.seller);
        setListings(storeRes.data.listings);
        setRating(reviewsRes.data);
        setSalesCount(Number(storeRes.data.seller?.sales_count) || 0);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const sellerPlanActive = seller?.plan && seller.plan !== 'free'
    && seller?.plan_expires_at && new Date(seller.plan_expires_at) > new Date();
  const sellerPlan = sellerPlanActive ? seller.plan.toLowerCase() : null;

  if (notFound || !seller) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Store not found</Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
          This seller doesn't exist or their account is no longer active.
        </Text>
        <Pressable
          onPress={() => {
            router.back(); // close this modal first
            router.push('/browse'); // then navigate in the underlying stack
          }}
          style={{
            marginTop: 20, paddingHorizontal: 20, paddingVertical: 12,
            borderRadius: 999, backgroundColor: colors.brand,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textOnGold }}>
            Browse listings
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── FIXED GRADIENT BACKGROUND (never moves, never fades) ─── */}
      <View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: heroHeight,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#7c3aed']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* ─── FIXED HEADER CONTENT (fades on scroll, does NOT move) ─── */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          paddingTop: embedded ? 20 : insets.top + 12,
          paddingHorizontal: 16,
          opacity: headerOpacity,
          zIndex: 10,
        }}
      >
        {!embedded && (
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
            }}
          >
            <ArrowLeft size={14} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Back</Text>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: embedded ? 4 : 20 }}>
          <View
            style={{
              width: 76, height: 76, borderRadius: 38,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {seller.avatar_url ? (
              <Image source={{ uri: seller.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>
                {seller.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: '900', color: '#fff', flexShrink: 1 }}>
                {seller.name}
              </Text>
              {seller.verified && <BadgeCheck size={18} color="#34d399" />}
            </View>

            {sellerPlan && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: sellerPlan === 'premium' ? 'rgba(168,85,247,0.25)' : 'rgba(59,130,246,0.25)',
                  borderWidth: 1,
                  borderColor: sellerPlan === 'premium' ? 'rgba(216,180,254,0.4)' : 'rgba(147,197,253,0.4)',
                }}
              >
                {sellerPlan === 'premium' ? <Sparkles size={11} color="#e9d5ff" fill="#e9d5ff" /> : <Star size={11} color="#bfdbfe" fill="#bfdbfe" />}
                <Text style={{ fontSize: 10, fontWeight: '800', color: sellerPlan === 'premium' ? '#e9d5ff' : '#bfdbfe' }}>
                  {sellerPlan === 'premium' ? 'Premium Seller' : 'Pro Seller'}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
              {[seller.school, seller.location].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Tag size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{listings.length}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>listings</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShoppingBag size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{salesCount}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>sales</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Star size={14} color={rating?.avg_rating ? '#fbbf24' : 'rgba(255,255,255,0.4)'} fill={rating?.avg_rating ? '#fbbf24' : 'transparent'} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
              {rating?.avg_rating ? rating.avg_rating : '—'}
            </Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              {rating?.total ? `(${rating.total} review${rating.total === 1 ? '' : 's'})` : 'No reviews yet'}
            </Text>
          </View>
        </View>

        {sellerPlan && <SocialHandlesRow seller={seller} />}
      </Animated.View>

      {/* ─── SCROLLVIEW (body only, slides up over gradient) ─── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: embedded ? 200 : heroHeight * 0.76,
          paddingBottom: pickMode ? 120 : 40,
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 16,
            paddingTop: 32,
            minHeight: embedded ? undefined : height,
          }}
        >
          {listings.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                {seller.name} hasn't listed anything yet.
              </Text>
            </View>
          ) : (
            <View
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}
            >
              {listings.map((p) => (
                <View
                  key={p.id}
                  style={{
                    width: gridWidth > 0
                      ? (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS
                      : '31%',
                  }}
                >
                  <ProductCard
                    product={p}
                    boostMode={pickMode}
                    boostSelected={pickMode && String(selectedId) === String(p.id)}
                    onBoostSelect={onSelect}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}