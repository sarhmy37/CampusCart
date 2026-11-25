import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, Animated, ActivityIndicator, Modal, Alert,
  useWindowDimensions, Platform, ScrollView, Dimensions,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import {
  ArrowLeft, Sparkles, Star, Zap, Eye, TrendingUp, Store, Bookmark,
  Award, ChevronDown, ChevronRight, Gauge, MessageCircle, Percent,
  Layers, Rocket, X, Trash2, Check, Clock,
} from 'lucide-react-native';

import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { BENEFITS_IMAGE } from '@/data/media';
import { Fonts } from '@/constants/theme';
import PaystackCheckout from '@/components/PaystackCheckout';

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();
const PAYMENT_CALLBACK_URL = 'https://campuscart-tdfn.onrender.com/paystack/callback';
const SERIF = Fonts?.serif;
const GOLD = '#E6AB2B';

const LISTING_LIMITS: Record<string, number> = { free: 10, pro: 30, premium: Infinity };

const TIER_META: Record<string, { label: string; icon: any }> = {
  pro: { label: 'Pro', icon: Star },
  premium: { label: 'Premium', icon: Sparkles },
};

const PLAN_INFO: Record<string, { price: number; period: string; days: number }> = {
  pro: { price: 25, period: 'month', days: 30 },
  premium: { price: 240, period: 'year', days: 365 },
};

type Perk = { icon: any; title: string; desc: string; tiers: string[] };
type PerkGroup = { category: string; items: Perk[] };

const SELLER_BENEFITS: PerkGroup[] = [
  {
    category: 'Selling',
    items: [
      { icon: Percent, title: '0% platform fee', desc: 'Keep 100% of every sale. Free plan sellers pay 1.5% per sale, you pay nothing.', tiers: ['pro', 'premium'] },
      { icon: Layers, title: 'Higher listing limit', desc: "List up to 30 items at once instead of the Free plan's 10.", tiers: ['pro'] },
      { icon: Layers, title: 'Unlimited listings', desc: 'List as many items as you want, with no cap at all.', tiers: ['premium'] },
      { icon: TrendingUp, title: 'Priority placement', desc: 'Your listings show first in Browse and search, ahead of Free plan sellers.', tiers: ['pro', 'premium'] },
      { icon: Award, title: 'Seller badge', desc: 'A badge on your listings and store page that marks you as a trusted, active seller.', tiers: ['pro', 'premium'] },
      { icon: Eye, title: 'Views and sales stats', desc: 'See how many people viewed and bought each of your listings.', tiers: ['pro', 'premium'] },
    ],
  },
  {
    category: 'Your store',
    items: [
      { icon: Store, title: 'Upgraded store page', desc: 'A richer storefront with social sharing built in.', tiers: ['pro'] },
      { icon: Rocket, title: 'Top store placement', desc: 'Your store is shown at the very top when buyers browse sellers.', tiers: ['premium'] },
    ],
  },
  {
    category: 'Support & visibility',
    items: [
      { icon: MessageCircle, title: 'Support within 2 days', desc: 'Skip the queue. Check your email within 2 days for our reply.', tiers: ['pro'] },
      { icon: Zap, title: 'Support within a few hours', desc: 'Check your email within a few hours for our reply.', tiers: ['premium'] },
      { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified when a matching listing appears.', tiers: ['pro', 'premium'] },
      { icon: Gauge, title: 'New listings first', desc: 'Listings that match your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
    ],
  },
];

const BUYER_BENEFITS: PerkGroup[] = [
  {
    category: 'Buying',
    items: [
      { icon: Percent, title: '10% off delivery', desc: 'Applied automatically to delivery at checkout.', tiers: ['pro'] },
      { icon: Percent, title: '18% off delivery', desc: 'A bigger discount on every delivery, applied automatically at checkout.', tiers: ['premium'] },
      { icon: Gauge, title: 'New listings first', desc: 'Listings that match your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
      { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified when a matching listing appears.', tiers: ['pro', 'premium'] },
    ],
  },
  {
    category: 'Support',
    items: [
      { icon: MessageCircle, title: 'Support within 2 days', desc: 'Skip the queue. Check your email within 2 days for our reply.', tiers: ['pro'] },
      { icon: Zap, title: 'Support within a few hours', desc: 'Check your email within a few hours for our reply.', tiers: ['premium'] },
    ],
  },
];

const FAQ_ITEMS: { q: string; a: string; sellerOnly?: boolean }[] = [
  { q: 'What happens when my plan expires?', a: "Your account goes back to the Free plan. Nothing is charged unless you renew. Listings above the Free limit stay live, but you can't add new ones until you're under the cap or you renew." },
  { q: 'Can I switch between Pro and Premium?', a: 'Yes. Upgrading to Premium applies immediately. Switching to Pro keeps your Premium benefits until the current period ends, then moves you to Pro.' },
  { q: 'What if I cancel?', a: 'You keep full access until your current period ends, then your account goes back to Free. Time already paid is not refunded, but nothing is cut off early.' },
  { q: 'Is the 0% fee automatic?', a: 'Yes. While your plan is active, every new sale uses a 0% platform fee instead of the standard 1.5%.', sellerOnly: true },
  { q: 'What counts toward "fees saved"?', a: "It's 1.5% of your confirmed sales while your plan has been active, which is what you would have paid on the Free plan.", sellerOnly: true },
];

const fmtMoney = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const fmtDate = (d: string | number | Date, year = true) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

const formatCountdown = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

export default function Benefits() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user, updateProfile } = useAuth();

  const heroHeight = Math.max(340, height * 0.42);
  const sheetOffset = heroHeight - 44;

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTextOpacity = scrollY.interpolate({ inputRange: [0, 100], outputRange: [1, 0], extrapolate: 'clamp' });
  const backButtonOpacity = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: 'clamp' });
  const heroScale = scrollY.interpolate({ inputRange: [-120, 0], outputRange: [1.15, 1], extrapolate: 'clamp' });

  const [loading, setLoading] = useState(true);
  const [listingCount, setListingCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [grossSales, setGrossSales] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [deletingSearchId, setDeletingSearchId] = useState<number | null>(null);

  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ url: string; reference: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const isSeller = user?.account_type === 'seller';
  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
  const planTier: string | null = isPlanActive ? String(user.plan).toLowerCase() : null;
  const meta = planTier ? TIER_META[planTier] : null;
  const info = planTier ? PLAN_INFO[planTier] : undefined;

  const daysLeft = user?.plan_expires_at
    ? Math.max(0, Math.ceil((new Date(user.plan_expires_at).getTime() - Date.now()) / 86400000))
    : 0;

  const pendingPlan = String(user?.pending_plan ?? '').toLowerCase();
  const isPendingCancel = pendingPlan === 'free';
  const isPendingDowngrade = !!pendingPlan && pendingPlan !== 'free' && pendingPlan !== planTier;
  const pendingLabel = pendingPlan ? pendingPlan.charAt(0).toUpperCase() + pendingPlan.slice(1) : '';

  const expiryLabel = user?.plan_expires_at ? fmtDate(user.plan_expires_at) : '';
  const expiryShort = user?.plan_expires_at ? fmtDate(user.plan_expires_at, false) : '';
  const statusText = `${isPendingDowngrade ? `${pendingLabel} starts` : isPendingCancel ? 'Ends' : 'Renews'} ${expiryLabel}`;

  const discountExpiry = user?.plan_discount_expires_at ? new Date(user.plan_discount_expires_at).getTime() : 0;
  const discountActive = discountExpiry > now;
  const discountMsLeft = Math.max(0, discountExpiry - now);
  const priceFor = (plan: string) => (discountActive ? PLAN_INFO[plan].price * 0.75 : PLAN_INFO[plan].price);

  useEffect(() => {
    if (!discountActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [discountActive]);

  useEffect(() => {
    if (!isSeller || !planTier) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get('/products/mine').catch(() => ({ data: [] })),
      api.get('/sellers/overview', { params: { period: 'all' } }).catch(() => ({ data: {} })),
    ]).then(([productsRes, overviewRes]) => {
      const products = productsRes.data || [];
      setListingCount(products.length);
      setTotalViews(products.reduce((sum: number, p: any) => sum + (p.views_count || 0), 0));
      setGrossSales(parseFloat(overviewRes.data?.gross_sales) || 0);
    }).finally(() => setLoading(false));
  }, [isSeller, planTier]);

  const refreshUser = async () => { try { await updateProfile({}); } catch {} };

  const loadSavedSearches = () => {
    setSavedLoading(true);
    api.get('/saved-searches/mine')
      .then((res) => setSavedSearches(res.data || []))
      .catch(() => setSavedSearches([]))
      .finally(() => setSavedLoading(false));
  };

  const handleToggleSaved = () => {
    const next = !savedExpanded;
    setSavedExpanded(next);
    if (next && savedSearches.length === 0) loadSavedSearches();
  };

  const handleDeleteSearch = async (id: number) => {
    setDeletingSearchId(id);
    try {
      await api.delete(`/saved-searches/${id}`);
      Toast.show({ type: 'success', text1: 'Saved search removed' });
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to remove this search' });
    } finally {
      setDeletingSearchId(null);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await api.post('/subscriptions/cancel');
      Toast.show({ type: 'success', text1: 'Subscription cancelled. You keep access until it expires.' });
      setShowCancelModal(false);
      await refreshUser();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not cancel subscription' });
    } finally {
      setCancelling(false);
    }
  };

  const handleUndoCancel = async () => {
    try {
      await api.post('/subscriptions/undo-cancel');
      Toast.show({ type: 'success', text1: 'Cancellation undone' });
      await refreshUser();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not undo cancellation' });
    }
  };

  const startCheckout = async (plan: 'pro' | 'premium') => {
    try {
      setBusyPlan(plan);
      const res = await api.post('/subscriptions/initiate', { plan });
      setCheckout({ url: res.data.authorization_url, reference: res.data.reference });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not start payment.' });
    } finally {
      setBusyPlan(null);
    }
  };

  const verifySubscription = async (reference: string) => {
    try {
      const res = await api.post(`/subscriptions/verify/${encodeURIComponent(reference)}`);
      if (res.data.status === 'active') {
        await refreshUser();
        Toast.show({ type: 'success', text1: `${res.data.plan} plan is now active` });
      } else {
        Toast.show({ type: 'error', text1: 'Payment is still being confirmed. Please check again shortly.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not verify payment.' });
    } finally {
      setCheckout(null);
    }
  };

  const confirmDowngrade = () => {
    Alert.alert(
      'Switch to Pro?',
      `You keep Premium until ${expiryLabel}, then move to Pro. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, switch',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyPlan('pro');
              await api.post('/subscriptions/schedule-downgrade', { plan: 'pro' });
              Toast.show({ type: 'success', text1: `You'll move to Pro on ${expiryLabel}.` });
              await refreshUser();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not schedule the change.' });
            } finally {
              setBusyPlan(null);
            }
          },
        },
      ],
    );
  };

  const feeSaved = grossSales * 0.015;
  const listingLimit = planTier ? (LISTING_LIMITS[planTier] ?? LISTING_LIMITS.free) : LISTING_LIMITS.free;

  const headerPhoto = user?.avatar_url || null;

  // ─── FREE PLAN TEASER ───
  if (!planTier) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <View style={{ width: '100%', height: '100%', backgroundColor: '#0d0c0a' }}>
            <Image
              source={headerPhoto ? { uri: headerPhoto } : BENEFITS_IMAGE}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              contentFit="cover"
              cachePolicy="disk"
            />
            <LinearGradient
              colors={['rgba(13,12,10,0.55)', 'rgba(13,12,10,0.75)', 'rgba(13,12,10,0.95)']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          </View>
          <View style={{ padding: 16 }}>
            <GlassPill onPress={() => router.back()}>
              <ArrowLeft size={12} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Back</Text>
            </GlassPill>
          </View>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(230,171,43,0.18)', borderWidth: 2, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={32} color={GOLD} />
            </View>
            <Text style={{ fontFamily: SERIF, color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 20, letterSpacing: -0.5 }}>
              You're on the Free plan
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 21, maxWidth: 320 }}>
              Pro and Premium remove the 1.5% sale fee, put your listings first, raise your listing limit, and shorten support wait times.
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              style={({ pressed }) => ({
                marginTop: 24, backgroundColor: GOLD, paddingHorizontal: 26, paddingVertical: 13,
                borderRadius: 12, opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: '#0d0c0a', fontWeight: '800', fontSize: 15 }}>See plans</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const Icon = meta!.icon;
  const groups = isSeller ? SELLER_BENEFITS : BUYER_BENEFITS;
  const premiumExtras = groups.flatMap((g) => g.items).filter((i) => i.tiers.length === 1 && i.tiers[0] === 'premium');
  const faqs = FAQ_ITEMS.filter((f) => isSeller || !f.sellerOnly);

  const unit = planTier === 'premium' ? 7 : 1;
  const unitName = planTier === 'premium' ? 'weeks' : 'days';
  const rulerTotal = Math.round((info?.days ?? 30) / unit);
  const rulerLeft = Math.min(rulerTotal, Math.ceil(daysLeft / unit));
  const rulerUsed = rulerTotal - rulerLeft;

  const showUpgrade = planTier === 'pro' && !pendingPlan;
  const showSwitchDown = planTier === 'premium' && !pendingPlan;
  const showRenew = !pendingPlan && daysLeft <= 7;

  // Shared row style — flattened to guarantee horizontal layout
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── HERO ─── */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight,
          overflow: 'hidden', backgroundColor: '#0d0c0a',
          transform: [{ scale: heroScale }],
        }}
      >
        <Image
          source={headerPhoto ? { uri: headerPhoto } : BENEFITS_IMAGE}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          cachePolicy="disk"
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,12,10,0.58)' }} />
        <LinearGradient
          colors={['rgba(230,171,43,0.10)', 'rgba(230,171,43,0)', 'rgba(0,0,0,0.35)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(13,12,10,0.55)', 'rgba(13,12,10,0.92)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: heroHeight * 0.55 }}
        />
        <CornerBrackets />
      </Animated.View>

      {/* Hero content — fades on scroll */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight,
          paddingHorizontal: 20, paddingTop: insets.top + 18, opacity: headerTextOpacity,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 11, paddingVertical: 5, borderRadius: 3,
            backgroundColor: 'rgba(230,171,43,0.18)',
            borderWidth: 1, borderColor: 'rgba(230,171,43,0.55)',
          }}>
            <Icon size={11} color={GOLD} />
            <Text style={{ color: GOLD, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 }}>
              {meta!.label.toUpperCase()} MEMBER
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 2.5 }}>MEMBER</Text>
          <Text style={{ fontFamily: SERIF, color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 3, letterSpacing: -0.3 }} numberOfLines={1}>
            {user?.name}
          </Text>
          {!!user?.school && (
            <Text style={{ color: 'rgba(255,255,255,0.48)', fontSize: 13, marginTop: 2 }}>{user.school}</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 22 }}>
          <Text style={{ fontFamily: SERIF, color: '#fff', fontSize: 72, fontWeight: '800', lineHeight: 72, letterSpacing: -2 }}>
            {daysLeft}
          </Text>
          <View style={{ paddingBottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', letterSpacing: 2 }}>REMAINING</Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 2 }}>
              {daysLeft === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <PeriodRuler total={rulerTotal} used={rulerUsed} total_={rulerTotal} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11, letterSpacing: 0.4 }}>
              {rulerUsed} OF {rulerTotal} {unitName.toUpperCase()} USED
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11 }}>{statusText}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Back pill */}
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 20, opacity: backButtonOpacity }}
      >
        <GlassPill onPress={() => router.back()}>
          <ArrowLeft size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Back</Text>
        </GlassPill>
      </Animated.View>

      {/* ─── BODY ─── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: sheetOffset }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: insets.bottom + 32,
            minHeight: height,
          }}
        >
          {/* handle */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* ── Discount banner ── */}
          {discountActive && (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
                backgroundColor: colors.brandSoft,
                borderWidth: 1, borderColor: colors.brand,
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand, letterSpacing: 0.8 }}>
                  REFERRAL REWARD
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                  25% off Pro and Premium
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Clock size={14} color={colors.brand} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brand, fontVariant: ['tabular-nums'] }}>
                  {formatCountdown(discountMsLeft)}
                </Text>
              </View>
            </View>
          )}

          {/* ── Section: Since joining (seller only) ── */}
          {isSeller && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <TrendingUp size={22} color={colors.brand} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Since joining
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
                    Numbers on your {meta!.label} plan
                  </Text>
                </View>
              </View>

              {[
                { label: 'Gross sales', value: loading ? '—' : `GHS ${grossSales.toFixed(2)}`, accent: false },
                { label: 'Platform fee saved', value: loading ? '—' : `GHS ${feeSaved.toFixed(2)}`, accent: true },
                { label: 'Listing views', value: loading ? '—' : totalViews.toLocaleString(), accent: false },
              ].map((row) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{row.label}</Text>
                  <Text
                    style={{
                      fontSize: 16, fontWeight: '800',
                      color: row.accent ? colors.brand : colors.text,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}

              {listingLimit !== Infinity && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Listings in use</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>
                      {listingCount}<Text style={{ fontSize: 13, fontWeight: '500', color: colors.textMuted }}> / {listingLimit}</Text>
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, marginTop: 8 }}>
                    {Array.from({ length: listingLimit }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          flex: 1, height: 8, borderRadius: 2,
                          backgroundColor: i < listingCount
                            ? (i === listingCount - 1 ? colors.brand : colors.text)
                            : colors.chipBg,
                        }}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Section: Your plan ── */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Icon size={22} color={colors.brand} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Your plan
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
                  {statusText}
                </Text>
              </View>
            </View>

            {/* plan row */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={colors.brand} strokeWidth={2.4} />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{meta!.label} plan</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                    GHS {info?.price ?? ''} / {info?.period ?? ''}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setShowCancelModal(true)} hitSlop={8}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand }}>Manage</Text>
              </Pressable>
            </View>

            {/* premium extras */}
            {showUpgrade && (
              <View style={{ marginTop: 18 }}>
                <Text style={{
                  fontSize: 11, fontWeight: '800', color: colors.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Premium adds
                </Text>
                {premiumExtras.map((p) => (
                  <View key={p.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color={colors.brand} strokeWidth={3.5} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>{p.title}</Text>
                  </View>
                ))}

                <Pressable
                  onPress={() => startCheckout('premium')}
                  disabled={busyPlan === 'premium'}
                  style={{
                    marginTop: 16,
                    borderRadius: 14,
                    backgroundColor: colors.brand,
                    paddingHorizontal: 16, paddingVertical: 15,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    opacity: busyPlan === 'premium' ? 0.7 : 1,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>Upgrade to Premium</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                      {discountActive && (
                        <Text style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', textDecorationLine: 'line-through' }}>
                          GHS {PLAN_INFO.premium.price}
                        </Text>
                      )}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.7)' }}>
                        GHS {fmtMoney(priceFor('premium'))} <Text style={{ fontWeight: '500' }}>/ year</Text>
                      </Text>
                    </View>
                  </View>
                  {busyPlan === 'premium' ? (
                    <ActivityIndicator color={colors.textOnGold} size="small" />
                  ) : (
                    <ChevronRight size={20} color={colors.textOnGold} strokeWidth={2.4} />
                  )}
                </Pressable>
              </View>
            )}

            {/* downgrade to pro */}
            {showSwitchDown && (
              <Pressable
                onPress={confirmDowngrade}
                disabled={!!busyPlan}
                style={{
                  marginTop: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
                  backgroundColor: colors.chipBg,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Switch to Pro</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                    Starts when Premium ends on {expiryLabel}
                  </Text>
                </View>
                {busyPlan === 'pro' ? (
                  <ActivityIndicator color={colors.brand} size="small" />
                ) : (
                  <ChevronRight size={18} color={colors.textMuted} />
                )}
              </Pressable>
            )}

            {/* renew */}
            {showRenew && (
              <Pressable
                onPress={() => startCheckout(planTier as 'pro' | 'premium')}
                disabled={busyPlan === planTier}
                style={{
                  marginTop: 16,
                  borderRadius: 14,
                  backgroundColor: colors.brand,
                  paddingHorizontal: 16, paddingVertical: 15,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  opacity: busyPlan === planTier ? 0.7 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>Renew {meta!.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                    {discountActive && (
                      <Text style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', textDecorationLine: 'line-through' }}>
                        GHS {info?.price}
                      </Text>
                    )}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.7)' }}>
                      GHS {fmtMoney(priceFor(planTier))} <Text style={{ fontWeight: '500' }}>/ {info?.period}</Text>
                    </Text>
                  </View>
                </View>
                {busyPlan === planTier ? (
                  <ActivityIndicator color={colors.textOnGold} size="small" />
                ) : (
                  <ChevronRight size={20} color={colors.textOnGold} strokeWidth={2.4} />
                )}
              </Pressable>
            )}

            {isPendingDowngrade && (
              <View style={{
                marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                backgroundColor: colors.brandSoft, borderLeftWidth: 3, borderLeftColor: colors.brand,
              }}>
                <Text style={{ fontSize: 12, color: colors.text, lineHeight: 18 }}>
                  {pendingLabel} starts on {expiryLabel}. You keep {meta!.label} until then.
                </Text>
              </View>
            )}
            {isPendingCancel && (
              <View style={{
                marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                backgroundColor: colors.brandSoft, borderLeftWidth: 3, borderLeftColor: colors.brand,
              }}>
                <Text style={{ fontSize: 12, color: colors.text, lineHeight: 18 }}>
                  Plan ends on {expiryLabel}. Undo the cancellation below to keep it.
                </Text>
              </View>
            )}
          </View>

          {/* ── Section: Manage ── */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Gauge size={22} color={colors.brand} strokeWidth={2.2} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Manage
              </Text>
            </View>

            {isSeller && (
              <Pressable
                onPress={() => router.push(`/store/${user.id}` as any)}
                style={rowStyle}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={17} color={colors.brand} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>View my store</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>See your public storefront</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            )}

            {/* saved searches */}
            <Pressable
              onPress={handleToggleSaved}
              style={{
                ...rowStyle,
                borderBottomWidth: savedExpanded ? 0 : 1,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Bookmark size={17} color={colors.brand} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>Saved searches</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>
                  {savedSearches.length > 0 ? `${savedSearches.length} saved` : 'Get notified when new listings match'}
                </Text>
              </View>
              <ChevronDown
                size={18}
                color={colors.textMuted}
                style={{ transform: [{ rotate: savedExpanded ? '180deg' : '0deg' }] }}
              />
            </Pressable>

            {savedExpanded && (
              <View style={{ paddingLeft: 52, paddingBottom: 12 }}>
                {savedLoading ? (
                  <ActivityIndicator color={colors.brand} style={{ marginVertical: 12 }} />
                ) : savedSearches.length === 0 ? (
                  <View style={{ paddingVertical: 8 }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 8 }}>
                      Nothing saved yet. Save a search from Browse and we'll notify you when a matching listing appears.
                    </Text>
                    <Pressable onPress={() => router.push('/(browse)/all' as any)}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand }}>Go to Browse →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    {savedSearches.map((s) => {
                      const hasPrice = s.price_min != null || s.price_max != null;
                      const priceLabel = hasPrice
                        ? `GHS ${s.price_min != null ? Number(s.price_min).toFixed(0) : '0'}${s.price_max != null ? ` to ${Number(s.price_max).toFixed(0)}` : '+'}`
                        : null;
                      const chips: { label: string; accent?: boolean }[] = [];
                      if (s.keyword) chips.push({ label: `"${s.keyword}"` });
                      if (s.category) chips.push({ label: s.category });
                      if (s.service_type) chips.push({ label: s.service_type });
                      if (s.school) chips.push({ label: s.school });
                      if (priceLabel) chips.push({ label: priceLabel });
                      if (s.verified_only) chips.push({ label: 'Verified only', accent: true });
                      return (
                        <View
                          key={s.id}
                          style={{
                            flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                            backgroundColor: colors.chipBg, borderRadius: 10,
                            paddingHorizontal: 10, paddingVertical: 8,
                          }}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                            {chips.map((chip, idx) => (
                              <View
                                key={idx}
                                style={{
                                  paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
                                  backgroundColor: chip.accent ? colors.successSoft : colors.card,
                                  borderWidth: 1,
                                  borderColor: chip.accent ? colors.success : colors.border,
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: chip.accent ? colors.success : colors.textSecondary }}>
                                  {chip.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                          <Pressable onPress={() => handleDeleteSearch(s.id)} disabled={deletingSearchId === s.id} hitSlop={8}>
                            <Trash2 size={14} color={colors.textMuted} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* priority support */}
            <Pressable
              onPress={() => router.push('/contact' as any)}
              style={rowStyle}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={17} color={colors.brand} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>Priority support</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>
                  {planTier === 'premium' ? 'Replies within a few hours' : 'Replies within 2 days'}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>

            {/* account settings */}
            <Pressable
              onPress={() => router.push('/settings' as any)}
              style={rowStyle}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Gauge size={17} color={colors.brand} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>Account settings</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>Billing details and profile</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>

            {/* cancel / undo */}
            {isPendingDowngrade ? null : isPendingCancel ? (
              <Pressable
                onPress={handleUndoCancel}
                style={rowStyle}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={17} color={colors.brand} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>Undo cancellation</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>
                    Ends {expiryShort}. Keep your plan instead
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShowCancelModal(true)}
                style={rowStyle}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={17} color={colors.error} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.error }} numberOfLines={1}>Cancel subscription</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>
                    You keep access until the period ends
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* ── Section: What you get ── */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Award size={22} color={colors.brand} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  What you get
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
                  {groups.reduce((n, g) => n + g.items.filter(i => i.tiers.includes(planTier)).length, 0)} perks active on your plan
                </Text>
              </View>
            </View>

            {groups.map((group) => {
              const items = group.items.filter((item) => item.tiers.includes(planTier));
              if (items.length === 0) return null;
              const isOpen = !collapsedCategories[group.category];
              return (
                <View key={group.category} style={{ marginTop: 10 }}>
                  <Pressable
                    onPress={() => setCollapsedCategories((prev) => ({ ...prev, [group.category]: !isOpen }))}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      {group.category}
                    </Text>
                    <ChevronDown
                      size={16}
                      color={isOpen ? colors.brand : colors.textMuted}
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </Pressable>

                  {isOpen && items.map((item) => {
                    const PerkIcon = item.icon;
                    const tag = planTier === 'premium' && item.tiers.length === 1 ? 'Premium' : undefined;
                    return (
                      <View
                        key={item.title}
                        style={{
                          flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                          paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted,
                        }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <PerkIcon size={17} color={colors.brand} strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.title}</Text>
                            {!!tag && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.brandSoft }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brand, letterSpacing: 0.5 }}>{tag}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 18 }}>{item.desc}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>

          {/* ── FAQ ── */}
          <View style={{ marginTop: 24 }}>
            <Pressable
              onPress={() => setShowFaq((v) => !v)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 12,
                borderTopWidth: 1, borderBottomWidth: showFaq ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={17} color={colors.brand} strokeWidth={2.2} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Questions</Text>
              </View>
              <ChevronDown
                size={18}
                color={showFaq ? colors.brand : colors.textMuted}
                style={{ transform: [{ rotate: showFaq ? '180deg' : '0deg' }] }}
              />
            </Pressable>

            {showFaq && faqs.map((faq, i) => (
              <View key={faq.q} style={{ borderBottomWidth: 1, borderBottomColor: colors.borderMuted }}>
                <Pressable
                  onPress={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 }}
                >
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: openFaq === i ? '800' : '600', color: colors.text }}>
                    {faq.q}
                  </Text>
                  <ChevronDown
                    size={16}
                    color={openFaq === i ? colors.brand : colors.textMuted}
                    style={{ transform: [{ rotate: openFaq === i ? '180deg' : '0deg' }] }}
                  />
                </Pressable>
                {openFaq === i && (
                  <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19, paddingBottom: 14, paddingRight: 24 }}>
                    {faq.a}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={{ alignItems: 'center', marginTop: 32 }}>
            <Text style={{ fontSize: 11, color: colors.textFaint, letterSpacing: 1.4, fontWeight: '700' }}>
              CAMPUSCART · MEMBERSHIP
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ─── Cancel sheet ─── */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setShowCancelModal(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 12,
            paddingBottom: insets.bottom + 20,
          }}>
            <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 }}>
              <X size={22} color={colors.error} strokeWidth={2.4} />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' }}>
              Cancel your subscription?
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 20, textAlign: 'center' }}>
              You keep {meta!.label} until {expiryShort}, then your account moves to Free. Time already paid is not refunded.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
              <Pressable
                onPress={() => setShowCancelModal(false)}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border, alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Keep plan</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmCancel}
                disabled={cancelling}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12,
                  backgroundColor: colors.error, alignItems: 'center',
                  opacity: cancelling ? 0.6 : 1,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                {cancelling && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                  {cancelling ? 'Cancelling…' : 'Cancel plan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PaystackCheckout
        visible={!!checkout}
        authorizationUrl={checkout?.url || null}
        callbackUrl={PAYMENT_CALLBACK_URL}
        onSuccess={verifySubscription}
        onClose={() => setCheckout(null)}
      />
    </View>
  );
}

// ─── Small hero pieces (unchanged) ───

function CornerBrackets() {
  const L = 14, T = 1;
  const c = 'rgba(230,171,43,0.55)';
  return (
    <>
      <View style={{ position: 'absolute', top: 20, left: 20, width: L, height: T, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 20, left: 20, width: T, height: L, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 20, right: 20, width: L, height: T, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 20, right: 20, width: T, height: L, backgroundColor: c }} />
      <View style={{ position: 'absolute', bottom: 60, left: 20, width: L, height: T, backgroundColor: c }} />
      <View style={{ position: 'absolute', bottom: 60, left: 20, width: T, height: L, backgroundColor: c }} />
      <View style={{ position: 'absolute', bottom: 60, right: 20, width: L, height: T, backgroundColor: c }} />
      <View style={{ position: 'absolute', bottom: 60, right: 20, width: T, height: L, backgroundColor: c }} />
    </>
  );
}

function PeriodRuler({ total, used, total_ }: { total: number; used: number; total_: number }) {
  const showLabels = total_ <= 31;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 26, gap: 2 }}>
        {Array.from({ length: total }).map((_, i) => {
          const isToday = i === used;
          const done = i < used;
          const isWeekMark = showLabels && i % 7 === 0;
          const h = isToday ? 26 : isWeekMark ? 16 : 10;
          return (
            <View
              key={i}
              style={{
                flex: 1, height: h, borderRadius: 1,
                backgroundColor: isToday ? '#fff' : done ? 'rgba(255,255,255,0.2)' : isWeekMark ? GOLD : 'rgba(230,171,43,0.55)',
              }}
            />
          );
        })}
      </View>
      {showLabels && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: 1 }}>01</Text>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: 1 }}>{String(total_).padStart(2, '0')}</Text>
        </View>
      )}
    </View>
  );
}

function GlassPill({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const Wrapper: any = GLASS ? GlassView : View;
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ alignSelf: 'flex-start' }}>
      <Wrapper
        {...(GLASS ? { glassEffectStyle: 'regular', isInteractive: true } : {})}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
          ...(GLASS ? {} : { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }),
        }}
      >
        {children}
      </Wrapper>
    </Pressable>
  );
}