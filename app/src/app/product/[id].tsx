import { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import Toast from 'react-native-toast-message';
import {
  ShoppingCart, MessageCircle, Star, Flag, ChevronLeft, ChevronRight,
  Minus, Plus, ShieldCheck, MapPin, Clock, Truck, Tag, Sparkles,
} from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useChat } from '@/context/ChatContext';
import ProductCard from '@/components/ProductCard';
import ReviewsSection from '@/components/ReviewsSection';
import ReportModal from '@/components/ReportModal';
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
  const { user } = useAuth();
  const { addItem } = useCart();
  const { openChat } = useChat();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [similar, setSimilar] = useState<any[]>([]);
  const [showReport, setShowReport] = useState(false);

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

  const handleAddToCart = () => {
    if (isOutOfStock) return Toast.show({ type: 'error', text1: 'Sorry, this item is out of stock.' });
    if (isOwner) return Toast.show({ type: 'error', text1: 'You cannot add your own listing to cart.' });
    if (qty > stock) return Toast.show({ type: 'error', text1: `Only ${stock} available in stock.` });
    for (let i = 0; i < qty; i++) {
      addItem({
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
      });
    }
    Toast.show({ type: 'success', text1: `Added ${qty} to cart` });
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return Toast.show({ type: 'error', text1: 'Sorry, this item is out of stock.' });
    if (isOwner) return Toast.show({ type: 'error', text1: 'You cannot buy your own listing.' });
    handleAddToCart();
    router.push('/cart');
  };

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
    <ScrollView style={{ flex: 1, backgroundColor: colors.backgroundAlt }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable
        onPress={() => router.replace('/browse')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}
      >
        <ChevronLeft size={16} color={colors.textMuted} />
        <Text style={{ fontSize: 14, color: colors.textMuted }}>Back to browse</Text>
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
                    <Text style={{ color: colors.text, fontSize: 10 }}>▶</Text>
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
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>{product.title}</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.brandSoft }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand, textTransform: 'capitalize' }}>{product.condition}</Text>
            </View>
          </View>

          {reviews?.avg_rating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{reviews.avg_rating}</Text>
              <Text style={{ fontSize: 14, color: colors.textFaint }}>({reviews.total} reviews)</Text>
            </View>
          )}

          <View style={{ marginTop: 10 }}>
            {discountPercent !== null && oldPrice ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' }}>GHS {oldPrice.toFixed(2)}</Text>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.errorSoft }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.error }}>-{discountPercent}%</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.brand }}>GHS {currentPrice.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.brand }}>GHS {currentPrice.toFixed(2)}</Text>
            )}
          </View>

          {isOwner && (
            <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning }}>
              <Text style={{ fontSize: 12, color: colors.warning }}>⚠️ You are the seller of this item. You cannot purchase your own listing.</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Qty</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || isOwner}>
                <Minus size={14} color={qty <= 1 ? colors.textFaint : colors.textSecondary} />
              </Pressable>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 16, textAlign: 'center' }}>{qty}</Text>
              <Pressable onPress={() => setQty((q) => Math.min(stock, q + 1))} disabled={isOutOfStock || qty >= stock || isOwner}>
                <Plus size={14} color={qty >= stock ? colors.textFaint : colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: colors.textFaint }}>{isOutOfStock ? 'Out of stock' : `${stock} available`}</Text>
          </View>

          <View style={{ gap: 10, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleBuyNow}
                disabled={isOutOfStock || isOwner}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: isOutOfStock || isOwner ? colors.chipBg : colors.brand, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: isOutOfStock || isOwner ? colors.textFaint : colors.textOnGold }}>
                  {isOutOfStock ? 'Out of Stock' : isOwner ? 'Your Own Listing' : 'Buy now'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleAddToCart}
                disabled={isOutOfStock || isOwner}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
              >
                <ShoppingCart size={18} color={isOutOfStock || isOwner ? colors.textFaint : colors.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: isOutOfStock || isOwner ? colors.textFaint : colors.textSecondary }}>
                  {isOwner ? 'Cannot buy' : 'Add to cart'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={handleMessage}
              disabled={isOwner}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
            >
              <MessageCircle size={18} color={isOwner ? colors.textFaint : colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: isOwner ? colors.textFaint : colors.textSecondary }}>
                {isOwner ? 'You are the seller' : 'Chat with the seller'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Seller Card */}
      <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: sellerPlan === 'premium' ? '#c4b5fd' : sellerPlan === 'pro' ? '#93c5fd' : colors.border }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Sold by</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {product.seller_avatar ? (
              <Image source={{ uri: product.seller_avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{sellerInitial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{sellerName}</Text>
                {product.seller_verified && <ShieldCheck size={14} color={colors.brand} />}
              </View>
              {sellerPlan && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: sellerPlan === 'premium' ? '#f5f3ff' : '#eff6ff' }}>
                  {sellerPlan === 'premium' ? <Sparkles size={11} color="#7c3aed" /> : <Star size={11} color="#2563eb" />}
                  <Text style={{ fontSize: 10, fontWeight: '600', color: sellerPlan === 'premium' ? '#7c3aed' : '#2563eb' }}>
                    {sellerPlan === 'premium' ? 'Premium Seller' : 'Pro Seller'}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                {sellerPlan && (
                  <Text style={{ fontSize: 11, color: colors.textFaint }}>
                    {`${product.seller_sales_count ?? 0} ${product.seller_sales_count === 1 ? 'sale' : 'sales'} · `}
                  </Text>
                )}
                {formatLastActive(product.seller_last_active) === 'Active now' && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 5 }} />
                )}
                <Text style={{ fontSize: 11, color: colors.textFaint }}>
                  {formatLastActive(product.seller_last_active)}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderMuted, gap: 10 }}>
            {product.seller_school && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={14} color={colors.textFaint} />
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{product.seller_school}</Text>
              </View>
            )}
            {(product.seller_location || product.seller_meeting_place) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Tag size={14} color={colors.textFaint} />
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Near: {product.seller_location || product.seller_meeting_place}</Text>
              </View>
            )}
            {(product.seller_whatsapp || product.whatsapp) && (
              <Pressable onPress={handleWhatsApp} disabled={isOwner} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={14} color={isOwner ? colors.textFaint : colors.success} />
                <Text style={{ fontSize: 14, color: isOwner ? colors.textFaint : colors.success }}>{product.seller_whatsapp || product.whatsapp}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Trust Strip */}
      <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={18} color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Email-verified student seller</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Truck size={18} color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Meet up on campus, or arrange delivery</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Clock size={18} color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Usually responds within a few hours</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Description</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
            {product.description || 'No description provided.'}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Details</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ width: '50%', paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, color: colors.textFaint }}>Condition</Text>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500', textTransform: 'capitalize' }}>{product.condition}</Text>
            </View>
            {product.category && (
              <View style={{ width: '50%', paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, color: colors.textFaint }}>Category</Text>
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>{product.category}</Text>
              </View>
            )}
            <View style={{ width: '50%', paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, color: colors.textFaint }}>Available</Text>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>{stock} in stock</Text>
            </View>
            {product.created_at && (
              <View style={{ width: '50%', paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, color: colors.textFaint }}>Posted</Text>
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>{new Date(product.created_at).toLocaleDateString()}</Text>
              </View>
            )}
          </View>
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
          <Text style={{ fontSize: 12, fontWeight: '600', color: reportColor }}>Report this listing</Text>
        </Pressable>
      </View>

      {/* Similar listings */}
      {similar.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, paddingHorizontal: 16 }}>Similar listings</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {similar.map((p) => (
              <View key={p.id} style={{ width: 160 }}>
                <ProductCard product={p} />
              </View>
            ))}
          </ScrollView>
        </View>
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