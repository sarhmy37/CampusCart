import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import Toast from 'react-native-toast-message';
import {
  ShoppingCart, MessageCircle, Star, Flag, ChevronLeft, ChevronRight,
  Minus, Plus, ShieldCheck, MapPin, Clock, Truck, Tag, Sparkles,
  Map as MapIcon,
} from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useChat } from '@/context/ChatContext';
import ProductCard from '@/components/ProductCard';
import ReviewsSection from '@/components/ReviewsSection';
import ReportModal from '@/components/ReportModal';
import LocationPickerModal from '@/components/LocationPickerModal';
import { useColors } from '@/hooks/useColors';

function formatWhatsAppNumber(n: string) {
  return (n || '').replace(/\D/g, '');
}

function formatLastActive(lastActive: string | null | undefined) {
  if (!lastActive) return 'Activity unknown';
  const diffMs = Date.now() - new Date(lastActive).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 15) return 'Active now';
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;
  return `Active ${new Date(lastActive).toLocaleDateString()}`;
}

export default function ProductDetail() {
  const colors = useColors();
  const { theme } = useTheme();
  const reportColor = theme === 'dark' ? '#f87171' : '#dc2626';
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { addItem } = useCart();
  const { openChat } = useChat();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/browse');
  };

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [similar, setSimilar] = useState<any[]>([]);
  const [showReport, setShowReport] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const locationY = useRef(0);
  const [loc, setLoc] = useState<{ lat: number; lng: number; text: string } | null>(null);
  const [locSource, setLocSource] = useState<'profile' | 'map' | 'gps' | null>(null);
  const [locMissing, setLocMissing] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);

  // Use the profile location automatically if it exists
  useEffect(() => {
    const u: any = user;
    if (u?.location && u.location_lat != null && u.location_lng != null) {
      setLoc({ lat: Number(u.location_lat), lng: Number(u.location_lng), text: u.location });
      setLocSource('profile');
      setLocMissing(false);
    }
  }, [(user as any)?.location, (user as any)?.location_lat, (user as any)?.location_lng]);

  const applyLocation = async (c: { lat: number; lng: number }, source: 'map' | 'gps') => {
    let text = 'Pinned location';
    try {
      const [p] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      text = [p?.name, p?.street, p?.district, p?.city].filter(Boolean).join(', ') || text;
    } catch {}
    setLoc({ ...c, text });
    setLocSource(source);
    setLocMissing(false);
    // Save to the profile so they only set it once (ignore failures, e.g. edit cooldown)
    updateProfile({ location: text, location_lat: c.lat, location_lng: c.lng } as any).catch(() => {});
  };

  const useCurrentLocation = async () => {
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission needed' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await applyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps');
    } catch {
      Toast.show({ type: 'error', text1: 'Could not get your location. Try the map instead.' });
    } finally {
      setLocBusy(false);
    }
  };

  const promptForLocation = () => {
    setLocMissing(true);
    scrollRef.current?.scrollTo({ y: Math.max(0, locationY.current - 16), animated: true });
    Toast.show({ type: 'info', text1: 'Set your delivery location first' });
  };

  useEffect(() => {
    setProduct(null); setActiveImg(0); setQty(1);
    api.get(`/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch(() => {
        Toast.show({ type: 'error', text1: 'This listing has been removed by the seller.' });
        router.replace('/browse');
      });
  }, [id]);

  useEffect(() => {
    if (product?.id) {
      api.get(`/reviews/product/${product.id}`).then((res) => setReviews(res.data)).catch(() => {});
    }
  }, [product]);

  useEffect(() => {
    if (!product?.category) return;
    api.get('/products', { params: { category: product.category } })
      .then((res) => setSimilar(res.data.filter((p: any) => p.id !== product.id).slice(0, 6)))
      .catch(() => {});
  }, [product]);

  if (!product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundAlt }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const stock = product.stock ?? 1;
  const isOutOfStock = stock <= 0;
  const isOwner = user && user.id === product.seller_id;

  const sellerPlanActive = product.seller_plan && product.seller_plan !== 'free' &&
    product.seller_plan_expires_at && new Date(product.seller_plan_expires_at) > new Date();
  const sellerPlan = sellerPlanActive ? product.seller_plan.toLowerCase() : null;

  const oldPrice = product.old_price ? parseFloat(product.old_price) : null;
  const currentPrice = parseFloat(product.price);
  let discountPercent: number | null = null;
  if (oldPrice && oldPrice > currentPrice && oldPrice > 0 && currentPrice > 0) {
    discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  }

  const slides = [
    ...(product.images?.length ? product.images : [{ image_url: product.primary_image }]),
    ...(product.video_url ? [{ video_url: product.video_url }] : []),
  ];

  const sellerName = product.seller_name || 'Seller';
  const sellerInitial = sellerName.charAt(0).toUpperCase();

  const addToCart = (): boolean => {
    if (isOutOfStock) { Toast.show({ type: 'error', text1: 'Sorry, this item is out of stock.' }); return false; }
    if (isOwner) { Toast.show({ type: 'error', text1: 'You cannot add your own listing to cart.' }); return false; }
    if (qty > stock) { Toast.show({ type: 'error', text1: `Only ${stock} available in stock.` }); return false; }
    if (!loc) { promptForLocation(); return false; }

    return addItem({
        id: product.id,
        title: product.title,
        price: product.price,
        primary_image: product.images?.[0]?.image_url || product.primary_image,
        seller_id: product.seller_id,
        seller_name: product.seller_name,
        seller_whatsapp: product.seller_whatsapp || product.whatsapp,
        seller_school: product.seller_school,
        stock: product.stock,
        delivery_fee_on_campus: product.delivery_fee_on_campus,
        delivery_fee_near_campus: product.delivery_fee_near_campus,
        delivery_fee_far_campus: product.delivery_fee_far_campus,
        buyer_location: loc.text,
        buyer_lat: loc.lat,
        buyer_lng: loc.lng,
    } as any, qty);
  };

  const handleAddToCart = () => { addToCart(); };
  const handleBuyNow = () => { if (addToCart()) router.push('/cart'); };

  const handleMessage = () => {
    if (isOwner) return Toast.show({ type: 'info', text1: 'You are the seller.' });
    openChat({ sellerId: product.seller_id, sellerName, productId: product.id });
  };

  const handleWhatsApp = () => {
    if (isOwner) return;
    const num = formatWhatsAppNumber(product.seller_whatsapp || product.whatsapp);
    if (num) Linking.openURL(`https://wa.me/${num}`);
  };

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.backgroundAlt }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable
        onPress={goBack}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}
      >
        <ChevronLeft size={16} color={colors.textMuted} />
        <Text style={{ fontSize: 16, color: colors.textMuted }}>Back</Text>
      </Pressable>

      {/* Media */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ aspectRatio: 1, backgroundColor: colors.cardAlt, borderRadius: 16, overflow: 'hidden' }}>
          {slides.length === 0 || (!slides[0]?.image_url && !slides[0]?.video_url) ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={48} color={colors.textFaint} />
            </View>
          ) : (
            slides.map((slide: any, i: number) =>
              slide.video_url ? (
                <VideoSlide key={i} uri={slide.video_url} active={i === activeImg} />
              ) : slide.image_url ? (
                <Image key={i} source={{ uri: slide.image_url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: i === activeImg ? 1 : 0 }} resizeMode="cover" />
              ) : null
            )
          )}

          {slides.length > 1 && (
            <>
              <Pressable
                onPress={() => setActiveImg((i) => (i === 0 ? slides.length - 1 : i - 1))}
                style={{ position: 'absolute', left: 10, top: '45%', width: 32, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={20} color="white" />
              </Pressable>
              <Pressable
                onPress={() => setActiveImg((i) => (i === slides.length - 1 ? 0 : i + 1))}
                style={{ position: 'absolute', right: 10, top: '45%', width: 32, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={20} color="white" />
              </Pressable>
            </>
          )}
        </View>

        {slides.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
            {slides.map((slide: any, i: number) => (
              <Pressable
                key={i}
                onPress={() => setActiveImg(i)}
                style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: activeImg === i ? colors.brand : 'transparent' }}
              >
                {slide.video_url ? (
                  <View style={{ flex: 1, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 12 }}>▶</Text>
                  </View>
                ) : (
                  <Image source={{ uri: slide.image_url }} style={{ width: '100%', height: '100%' }} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Action Card */}
      <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 }}>{product.title}</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.brandSoft }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.brand, textTransform: 'capitalize' }}>{product.condition}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 16, color: colors.textSecondary, lineHeight: 20, marginTop: 6 }}>
            {product.description || 'No description provided.'}
          </Text>

          <View style={{ marginTop: 10 }}>
            {discountPercent !== null && oldPrice ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, color: colors.textFaint, textDecorationLine: 'line-through' }}>GHS {oldPrice.toFixed(2)}</Text>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.errorSoft }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.error }}>-{discountPercent}%</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 30, fontWeight: '800', color: colors.brand }}>GHS {currentPrice.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={{ fontSize: 30, fontWeight: '800', color: colors.brand }}>GHS {currentPrice.toFixed(2)}</Text>
            )}
          </View>

          {isOwner && (
            <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning }}>
              <Text style={{ fontSize: 14, color: colors.warning }}>⚠️ You are the seller of this item. You cannot purchase your own listing.</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>Qty</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || isOwner}>
                <Minus size={14} color={qty <= 1 ? colors.textFaint : colors.textSecondary} />
              </Pressable>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 16, textAlign: 'center' }}>{qty}</Text>
              <Pressable onPress={() => setQty((q) => Math.min(stock, q + 1))} disabled={isOutOfStock || qty >= stock || isOwner}>
                <Plus size={14} color={qty >= stock ? colors.textFaint : colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: colors.textFaint }}>{isOutOfStock ? 'Out of stock' : `${stock} available`}</Text>
          </View>

          <View style={{ gap: 10, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Combined Buy now + Add to cart */}
              <View style={{ flex: 1, height: 50 }}>
                {/* Add to cart sits behind, on the right */}
                <Pressable
                  onPress={handleAddToCart}
                  disabled={isOutOfStock || isOwner}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, right: 0, width: '40%',
                    paddingLeft: 18,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: colors.cardAlt,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <ShoppingCart size={20} color={isOutOfStock || isOwner ? colors.textFaint : colors.textSecondary} />
                </Pressable>

                {/* Buy now sits on top, with a small shadow on its right side */}
                <Pressable
                  onPress={handleBuyNow}
                  disabled={isOutOfStock || isOwner}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0, width: '68%',
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: isOutOfStock || isOwner ? colors.chipBg : colors.brand,
                    zIndex: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 3, height: 0 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: isOutOfStock || isOwner ? colors.textFaint : colors.textOnGold }}>
                    {isOutOfStock ? 'Out of Stock' : isOwner ? 'Your Listing' : 'Buy now'}
                  </Text>
                </Pressable>
              </View>

              {/* Chat replaces the old Add to cart button */}
              <Pressable
                onPress={handleMessage}
                disabled={isOwner}
                style={{
                  flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderRadius: 14, borderWidth: 1, borderColor: colors.border,
                }}
              >
                <MessageCircle size={18} color={isOwner ? colors.textFaint : colors.textSecondary} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: isOwner ? colors.textFaint : colors.textSecondary }}>Chat</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Delivery location */}
      {!isOwner && (
        <View
          onLayout={(e) => { locationY.current = e.nativeEvent.layout.y; }}
          style={{ marginTop: 16, paddingHorizontal: 16 }}
        >
        <View
          style={{
            paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1,
            borderColor: locMissing ? colors.error : colors.border,
            backgroundColor: locMissing ? colors.errorSoft : 'transparent',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.brand, textTransform: 'uppercase', letterSpacing: 1, textDecorationLine: 'underline' }}>
              Delivery location
            </Text>
            <Pressable onPress={() => router.push({ pathname: '/profile', params: { editLocation: '1' } })} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.brand }}>Edit</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <MapPin size={15} color={colors.textFaint} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 16, color: loc ? colors.text : colors.textFaint }}>
              {loc ? loc.text : 'No location set'}
            </Text>
          </View>

          {locSource === 'profile' && (
            <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>
              Using your profile address. You can change it from your Profile page.
            </Text>
          )}
          {locMissing && !loc && (
            <Text style={{ fontSize: 14, color: colors.error, marginTop: 6 }}>
              Please set where this order should be delivered.
            </Text>
          )}

          {locSource !== 'profile' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {([
                { key: 'map', label: 'Set on map', onPress: () => setShowLocPicker(true), busy: false },
                { key: 'gps', label: locBusy ? 'Getting…' : 'Use current location', onPress: useCurrentLocation, busy: locBusy },
              ] as const).map((b) => {
                const active = locSource === b.key;
                const c = active ? '#059669' : colors.textSecondary;
                return (
                  <Pressable
                    key={b.key}
                    onPress={b.onPress}
                    disabled={b.busy}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      paddingVertical: 12, borderRadius: 12, borderWidth: 1, opacity: b.busy ? 0.6 : 1,
                      borderColor: active ? '#6ee7b7' : colors.border,
                      backgroundColor: active ? 'rgba(16,185,129,0.1)' : 'transparent',
                    }}
                  >
                    {b.busy ? <ActivityIndicator size="small" color={colors.brand} /> : b.key === 'map' ? <MapIcon size={15} color={c} /> : <MapPin size={15} color={c} />}
                    <Text style={{ fontSize: 15, fontWeight: '600', color: c }}>{b.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        </View>
      )}

      {/* Seller Card */}
      <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
        <View style={{ paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.brand, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, textDecorationLine: 'underline' }}>Sold by</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {product.seller_avatar ? (
              <Image source={{ uri: product.seller_avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 16 }}>{sellerInitial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{sellerName}</Text>
                {product.seller_verified && <ShieldCheck size={14} color={colors.brand} />}
              </View>
              {sellerPlan && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: sellerPlan === 'premium' ? '#f5f3ff' : '#eff6ff' }}>
                  {sellerPlan === 'premium' ? <Sparkles size={11} color="#7c3aed" /> : <Star size={11} color="#2563eb" />}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: sellerPlan === 'premium' ? '#7c3aed' : '#2563eb' }}>
                    {sellerPlan === 'premium' ? 'Premium Seller' : 'Pro Seller'}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                {sellerPlan && (
                  <Text style={{ fontSize: 13, color: colors.textFaint }}>
                    {`${product.seller_sales_count ?? 0} ${product.seller_sales_count === 1 ? 'sale' : 'sales'} · `}
                  </Text>
                )}
                {formatLastActive(product.seller_last_active) === 'Active now' && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 5 }} />
                )}
                <Text style={{ fontSize: 13, color: colors.textFaint }}>
                  {formatLastActive(product.seller_last_active)}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end', gap: 6, maxWidth: 130 }}>
              {product.seller_school && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} color={colors.textFaint} />
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary }}>{product.seller_school}</Text>
                </View>
              )}
              {(product.seller_location || product.seller_meeting_place) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Tag size={12} color={colors.textFaint} />
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary }}>{product.seller_location || product.seller_meeting_place}</Text>
                </View>
              )}
              {(product.seller_whatsapp || product.whatsapp) && (
                <Pressable onPress={handleWhatsApp} disabled={isOwner} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <MessageCircle size={12} color={isOwner ? colors.textFaint : colors.success} />
                  <Text numberOfLines={1} style={{ fontSize: 13, color: isOwner ? colors.textFaint : colors.success }}>{product.seller_whatsapp || product.whatsapp}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>


      {/* Details */}
      <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.brand, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textDecorationLine: 'underline' }}>Details</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {product.category && (
            <View style={{ width: '33.33%', paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, color: colors.textFaint }}>Category</Text>
              <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>{product.category}</Text>
            </View>
          )}
          {product.delivery_fee_on_campus != null && (
            <View style={{ width: '33.33%', paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, color: colors.textFaint }}>On-campus delivery</Text>
              <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>
                {parseFloat(product.delivery_fee_on_campus) === 0 ? 'Free' : `GHS ${parseFloat(product.delivery_fee_on_campus).toFixed(2)}`}
              </Text>
            </View>
          )}
          {product.created_at && (
            <View style={{ width: '33.33%', paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, color: colors.textFaint }}>Posted</Text>
              <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>{new Date(product.created_at).toLocaleDateString()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Reviews */}
      <View style={{ paddingHorizontal: 16 }}>
        <ReviewsSection reviewsData={reviews} productId={product.id} />
      </View>

      {/* Report */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <Pressable onPress={() => setShowReport(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}>
          <Flag size={13} color={reportColor} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: reportColor }}>Report this listing</Text>
        </Pressable>
      </View>

      {/* Similar listings */}
      {similar.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12, paddingHorizontal: 16 }}>Similar listings</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {similar.map((p) => (
              <View key={p.id} style={{ width: 160 }}>
                <ProductCard product={p} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {showLocPicker && (
        <LocationPickerModal
          colors={colors}
          initial={loc ? { lat: loc.lat, lng: loc.lng } : null}
          onCancel={() => setShowLocPicker(false)}
          onConfirm={(pos: { lat: number; lng: number }) => {
            setShowLocPicker(false);
            applyLocation(pos, 'map');
          }}
        />
      )}

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        productId={product.id}
        reportedUserId={product.seller_id}
      />
    </ScrollView>
  );
}

function VideoSlide({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => {
    if (active) player.play(); else player.pause();
  }, [active]);
  return (
    <VideoView
      player={player}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: active ? 1 : 0 }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}