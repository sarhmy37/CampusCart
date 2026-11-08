import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, Animated, ActivityIndicator, Modal, Alert, useWindowDimensions, Platform,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  ArrowLeft, Sparkles, Star, Zap, Eye, TrendingUp, Store, Bookmark,
  Award, ChevronDown, ChevronRight, ArrowRight, Gauge, MessageCircle, Percent,
  Layers, Rocket, X, Trash2, Check,
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
const GOLD = '#E6AB2B'; // fixed gold for use on the dark hero

const LISTING_LIMITS: Record<string, number> = { free: 10, pro: 30, premium: Infinity };

const TIER_META: Record<string, { label: string; icon: any }> = {
  pro: { label: 'Pro', icon: Star },
  premium: { label: 'Premium', icon: Sparkles },
};

// price in GHS, `days` is the billing period length
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
      { icon: Store, title: 'Upgraded store page', desc: 'A richer storefront with social sharing built in. Share your store link anywhere.', tiers: ['pro'] },
      { icon: Rocket, title: 'Top store placement', desc: 'Your store is shown at the very top when buyers browse sellers.', tiers: ['premium'] },
    ],
  },
  {
    category: 'Support and visibility',
    items: [
      { icon: MessageCircle, title: 'Support replies within 2 days', desc: 'Skip the queue. Check your email within 2 days for our reply.', tiers: ['pro'] },
      { icon: Zap, title: 'Support replies within a few hours', desc: 'Check your email within a few hours for our reply.', tiers: ['premium'] },
      { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified when a matching listing appears.', tiers: ['pro', 'premium'] },
      { icon: Gauge, title: 'See new listings first', desc: 'New listings that match your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
    ],
  },
];

const BUYER_BENEFITS: PerkGroup[] = [
  {
    category: 'Buying',
    items: [
      { icon: Percent, title: '10% off delivery fees', desc: 'Applied automatically to delivery at checkout.', tiers: ['pro'] },
      { icon: Percent, title: '18% off delivery fees', desc: 'A bigger discount on every delivery, applied automatically at checkout.', tiers: ['premium'] },
      { icon: Gauge, title: 'See new listings first', desc: 'New listings that match your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
      { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified when a matching listing appears.', tiers: ['pro', 'premium'] },
    ],
  },
  {
    category: 'Support',
    items: [
      { icon: MessageCircle, title: 'Support replies within 2 days', desc: 'Skip the queue. Check your email within 2 days for our reply.', tiers: ['pro'] },
      { icon: Zap, title: 'Support replies within a few hours', desc: 'Check your email within a few hours for our reply.', tiers: ['premium'] },
    ],
  },
];

const FAQ_ITEMS: { q: string; a: string; sellerOnly?: boolean }[] = [
  { q: 'What happens when my plan expires?', a: "Your account goes back to the Free plan. Nothing is charged unless you renew. Listings above the Free limit stay live, but you can't add new ones until you're under the cap or you renew." },
  { q: 'Can I switch between Pro and Premium?', a: 'Yes. Upgrading to Premium applies immediately. Switching to Pro keeps your Premium benefits until the current period ends, then moves you to Pro. You never lose what you already paid for.' },
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
  const insets = { top: 0, bottom: 0 };
  const { height } = useWindowDimensions();
  const { user, updateProfile } = useAuth();

  const heroHeight = Math.max(340, height * 0.42);
  const sheetOffset = heroHeight - 44;

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTextOpacity = scrollY.interpolate({ inputRange: [0, 100], outputRange: [1, 0], extrapolate: 'clamp' });
  const backButtonOpacity = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: 'clamp' });

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

  const refreshUser = async () => {
    try { await updateProfile({}); } catch {}
  };

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

  // ── Plan changes (moved here from the home screen) ──
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
      `You keep Premium until ${expiryLabel}, then move to Pro and lose Premium benefits like unlimited listings and the 18% delivery discount. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, switch',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyPlan('pro');
              await api.post('/subscriptions/schedule-downgrade', { plan: 'pro' });
              Toast.show({ type: 'success', text1: `You'll move to Pro on ${expiryLabel}. Premium stays until then.` });
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

  // ─── FREE PLAN TEASER ───
  if (!planTier) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <BenefitsImage />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)' }} />
          <View style={{ padding: 16, paddingTop: insets.top + 16 }}>
            <GlassPill onPress={() => router.back()}>
              <ArrowLeft size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Back</Text>
            </GlassPill>
          </View>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text style={{ fontFamily: SERIF, color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' }}>
              You're on the Free plan
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 320 }}>
              Pro and Premium remove the 1.5% sale fee, put your listings first in search, raise your listing limit and shorten support wait times.
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              style={{ marginTop: 22, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 15 }}>See plans</Text>
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

  // Ruler: one tick per day on monthly plans, one per week on yearly plans
  const unit = planTier === 'premium' ? 7 : 1;
  const unitName = planTier === 'premium' ? 'weeks' : 'days';
  const rulerTotal = Math.round((info?.days ?? 30) / unit);
  const rulerLeft = Math.min(rulerTotal, Math.ceil(daysLeft / unit));
  const rulerUsed = rulerTotal - rulerLeft;

  const showUpgrade = planTier === 'pro' && !pendingPlan;
  const showSwitchDown = planTier === 'premium' && !pendingPlan;
  const showRenew = !pendingPlan && daysLeft <= 7;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fixed image behind everything */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight, overflow: 'hidden', backgroundColor: '#0f172a' }}>
        <BenefitsImage />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.68)' }} />
      </View>

      {/* Hero text (fades as you scroll) */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight,
          paddingHorizontal: 16, paddingTop: insets.top + 16, opacity: headerTextOpacity,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <Icon size={12} color={GOLD} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{meta!.label}</Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: SERIF, color: '#fff', fontSize: 24, fontWeight: '700' }} numberOfLines={1}>{user?.name}</Text>
          {!!user?.school && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 1 }}>{user.school}</Text>}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 }}>
          <Text style={{ fontFamily: SERIF, color: '#fff', fontSize: 60, fontWeight: '800', lineHeight: 62 }}>{daysLeft}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, paddingBottom: 9 }}>
            {daysLeft === 1 ? 'day' : 'days'} left
          </Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <PeriodRuler total={rulerTotal} used={rulerUsed} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{rulerUsed} of {rulerTotal} {unitName} used</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{statusText}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Back button (fades on scroll) */}
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 20, opacity: backButtonOpacity }}
      >
        <GlassPill onPress={() => router.back()}>
          <ArrowLeft size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Back</Text>
        </GlassPill>
      </Animated.View>

      {/* Body */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: sheetOffset }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 40,
            minHeight: height,
          }}
        >
          {/* Listing usage: one segment per listing slot */}
          {isSeller && listingLimit !== Infinity && (
            <View style={{ marginBottom: 22 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>Listings in use</Text>
                <Text style={{ fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: colors.text }}>
                  {listingCount}
                  <Text style={{ fontSize: 14, fontWeight: '400', color: colors.textFaint }}> of {listingLimit}</Text>
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {Array.from({ length: listingLimit }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1, height: 7, borderRadius: 1,
                      backgroundColor: i < listingCount ? colors.brand : colors.chipBg,
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Seller ledger */}
          {isSeller && (
            <View style={{ marginBottom: 24 }}>
              <SectionTitle title={`Since you joined ${meta!.label}`} colors={colors} />
              <Line label="Gross sales" value={loading ? '...' : `GHS ${grossSales.toFixed(2)}`} colors={colors} />
              <Line label="Platform fee saved (1.5%)" value={loading ? '...' : `GHS ${feeSaved.toFixed(2)}`} accent colors={colors} />
              <Line label="Views across your listings" value={loading ? '...' : String(totalViews)} colors={colors} />
            </View>
          )}

          {/* Plan */}
          <View style={{ marginBottom: 24 }}>
            <SectionTitle title="Your plan" note={statusText} colors={colors} />

            {discountActive && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4,
                  borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: colors.brandSoft,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brandText }}>Referral reward: 25% off Pro and Premium</Text>
                <Text style={{ fontFamily: SERIF, fontSize: 15, fontWeight: '800', color: colors.brandText, fontVariant: ['tabular-nums'] }}>
                  {formatCountdown(discountMsLeft)}
                </Text>
              </View>
            )}

            <Line label={`${meta!.label} plan`} value={`GHS ${info?.price ?? ''} / ${info?.period ?? ''}`} colors={colors} />

            {showUpgrade && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Premium adds</Text>
                {premiumExtras.map((p) => (
                  <View key={p.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
                    <Check size={14} color={colors.brand} strokeWidth={3} />
                    <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary }}>{p.title}</Text>
                  </View>
                ))}
                <PlanAction
                  title="Premium"
                  strike={discountActive ? `GHS ${PLAN_INFO.premium.price}` : undefined}
                  sub={`GHS ${fmtMoney(priceFor('premium'))} / year`}
                  buttonLabel="Upgrade"
                  filled
                  busy={busyPlan === 'premium'}
                  onPress={() => startCheckout('premium')}
                  colors={colors}
                />
              </View>
            )}

            {showSwitchDown && (
              <PlanAction
                title="Switch to Pro"
                sub={`Starts when Premium ends on ${expiryLabel}`}
                buttonLabel="Switch"
                busy={busyPlan === 'pro'}
                onPress={confirmDowngrade}
                colors={colors}
              />
            )}

            {showRenew && (
              <PlanAction
                title={`Renew ${meta!.label}`}
                strike={discountActive ? `GHS ${info?.price}` : undefined}
                sub={`GHS ${fmtMoney(priceFor(planTier))} / ${info?.period}`}
                buttonLabel="Renew"
                filled={!showUpgrade}
                busy={busyPlan === planTier}
                onPress={() => startCheckout(planTier as 'pro' | 'premium')}
                colors={colors}
              />
            )}

            {isPendingDowngrade && (
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 10, lineHeight: 18 }}>
                {pendingLabel} starts on {expiryLabel}. You keep {meta!.label} until then.
              </Text>
            )}
            {isPendingCancel && (
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 10, lineHeight: 18 }}>
                Your plan ends on {expiryLabel}. Undo the cancellation below to keep it.
              </Text>
            )}
          </View>

          {/* Manage */}
          <View style={{ marginBottom: 24 }}>
            <SectionTitle title="Manage" colors={colors} />

            {isSeller && (
              <ActionRow icon={Store} title="View my store" desc="See your public storefront" colors={colors} onPress={() => router.push(`/store/${user.id}` as any)} />
            )}

            <Pressable
              onPress={handleToggleSaved}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: savedExpanded ? 0 : 1, borderBottomColor: colors.border }}
            >
              <Bookmark size={18} color={colors.textMuted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Saved searches</Text>
                <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 1 }}>
                  {savedSearches.length > 0 ? `${savedSearches.length} saved` : 'Get notified when new listings match'}
                </Text>
              </View>
              <ChevronDown size={16} color={savedExpanded ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: savedExpanded ? '180deg' : '0deg' }] }} />
            </Pressable>

            {savedExpanded && (
              <View style={{ paddingLeft: 30, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {savedLoading ? (
                  <ActivityIndicator color={colors.brand} />
                ) : savedSearches.length === 0 ? (
                  <View>
                    <Text style={{ fontSize: 14, color: colors.textFaint, lineHeight: 19, marginBottom: 8 }}>
                      Nothing saved yet. Save a search from Browse and we'll notify you when a matching listing appears.
                    </Text>
                    <Pressable onPress={() => router.push('/(browse)/all' as any)}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand }}>Go to Browse</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    {savedSearches.map((s) => {
                      const hasPrice = s.price_min != null || s.price_max != null;
                      const priceLabel = hasPrice
                        ? `GHS ${s.price_min != null ? Number(s.price_min).toFixed(0) : '0'}${s.price_max != null ? ` to ${Number(s.price_max).toFixed(0)}` : '+'}`
                        : null;
                      return (
                        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.chipBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
                          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                            {s.keyword && <Chip label={`"${s.keyword}"`} colors={colors} />}
                            {s.category && <Chip label={s.category} colors={colors} />}
                            {s.service_type && <Chip label={s.service_type} colors={colors} />}
                            {s.school && <Chip label={s.school} colors={colors} />}
                            {priceLabel && <Chip label={priceLabel} colors={colors} />}
                            {s.verified_only && <Chip label="Verified only" colors={colors} accent />}
                          </View>
                          <Pressable onPress={() => handleDeleteSearch(s.id)} disabled={deletingSearchId === s.id} hitSlop={8}>
                            <Trash2 size={14} color={colors.textFaint} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <ActionRow
              icon={MessageCircle}
              title="Priority support"
              desc={planTier === 'premium' ? 'Replies within a few hours' : 'Replies within 2 days'}
              colors={colors}
              onPress={() => router.push('/contact' as any)}
            />
            <ActionRow icon={Gauge} title="Account settings" desc="Billing details and profile" colors={colors} onPress={() => router.push('/settings' as any)} />

            {isPendingDowngrade ? null : isPendingCancel ? (
              <ActionRow icon={X} title="Undo cancellation" desc={`Ends ${expiryShort}. Keep your plan instead`} colors={colors} onPress={handleUndoCancel} />
            ) : (
              <ActionRow icon={X} title="Cancel subscription" desc="You keep access until the period ends" colors={colors} onPress={() => setShowCancelModal(true)} danger />
            )}
          </View>

          {/* What's included */}
          <View>
            <SectionTitle title="What you get" colors={colors} />
            {groups.map((group) => {
              const items = group.items.filter((item) => item.tiers.includes(planTier));
              if (items.length === 0) return null;
              const isOpen = !collapsedCategories[group.category];
              return (
                <View key={group.category} style={{ marginTop: 6 }}>
                  <Pressable
                    onPress={() => setCollapsedCategories((prev) => ({ ...prev, [group.category]: !isOpen }))}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.brand }}>{group.category}</Text>
                    <ChevronDown size={16} color={isOpen ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
                  </Pressable>
                  {isOpen && items.map((item) => (
                    <PerkRow
                      key={item.title}
                      item={item}
                      tag={planTier === 'premium' && item.tiers.length === 1 ? 'Premium only' : undefined}
                      colors={colors}
                    />
                  ))}
                </View>
              );
            })}
          </View>

          {/* FAQ */}
          <View style={{ marginTop: 28 }}>
            <Pressable
              onPress={() => setShowFaq((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: showFaq ? 0 : 1, borderColor: colors.border }}
            >
              <Text style={{ fontFamily: SERIF, fontSize: 19, fontWeight: '700', color: colors.text }}>Questions</Text>
              <ChevronDown size={18} color={showFaq ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: showFaq ? '180deg' : '0deg' }] }} />
            </Pressable>
            {showFaq && faqs.map((faq, i) => (
              <FaqItem key={faq.q} faq={faq} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} colors={colors} />
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Cancel modal */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <Pressable
          onPress={() => setShowCancelModal(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: colors.card, borderRadius: 14, padding: 20, maxWidth: 340, width: '100%', borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ fontFamily: SERIF, fontSize: 21, fontWeight: '700', color: colors.text }}>Cancel your subscription?</Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 8, lineHeight: 21 }}>
              You keep {meta!.label} until {expiryShort}, then your account moves to Free. Time already paid is not refunded.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={() => setShowCancelModal(false)}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted }}>Keep plan</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmCancel}
                disabled={cancelling}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: colors.error, alignItems: 'center', opacity: cancelling ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{cancelling ? 'Cancelling...' : 'Cancel plan'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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

// ---- Pieces ----

function BenefitsImage() {
  return (
    <Image
      source={BENEFITS_IMAGE}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="cover"
    />
  );
}

// A ruler for the billing period: elapsed ticks fade, today is the tall white tick,
// the days still ahead are gold. Every 7th tick is taller on monthly plans.
function PeriodRuler({ total, used }: { total: number; used: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 24, gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => {
        const isToday = i === used;
        const done = i < used;
        const h = isToday ? 24 : total <= 31 && i % 7 === 0 ? 15 : 10;
        return (
          <View
            key={i}
            style={{
              flex: 1, height: h, borderRadius: 1,
              backgroundColor: isToday ? '#fff' : done ? 'rgba(255,255,255,0.22)' : GOLD,
            }}
          />
        );
      })}
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
          ...(GLASS ? {} : { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }),
        }}
      >
        {children}
      </Wrapper>
    </Pressable>
  );
}

function SectionTitle({ title, note, colors }: { title: string; note?: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontFamily: SERIF, fontSize: 19, fontWeight: '700', color: colors.text, flexShrink: 1 }}>{title}</Text>
      {!!note && <Text style={{ fontSize: 13, color: colors.textFaint }} numberOfLines={1}>{note}</Text>}
    </View>
  );
}

// Ledger line: label, dotted leader, value
function Line({ label, value, accent, colors }: { label: string; value: string; accent?: boolean; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8 }}>
      <Text style={{ fontSize: 14, color: colors.textMuted }}>{label}</Text>
      <View style={{ flex: 1, marginHorizontal: 6, marginBottom: 5, borderBottomWidth: 1, borderStyle: 'dotted', borderBottomColor: colors.textFaint }} />
      <Text style={{ fontFamily: SERIF, fontSize: 17, fontWeight: '700', color: accent ? colors.success : colors.text, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function SmallButton({ label, onPress, busy, filled, colors }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        minWidth: 88, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
        backgroundColor: filled ? colors.brand : 'transparent',
        borderWidth: 1, borderColor: filled ? colors.brand : colors.border,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={filled ? colors.textOnGold : colors.text} />
      ) : (
        <Text style={{ fontSize: 14, fontWeight: '800', color: filled ? colors.textOnGold : colors.text }}>{label}</Text>
      )}
    </Pressable>
  );
}

function PlanAction({ title, sub, strike, buttonLabel, onPress, busy, filled, colors }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 17, fontWeight: '700', color: colors.text }}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 1 }}>
          {!!strike && <Text style={{ fontSize: 13, color: colors.textFaint, textDecorationLine: 'line-through' }}>{strike}</Text>}
          <Text style={{ fontSize: 13, color: colors.textMuted, flexShrink: 1 }}>{sub}</Text>
        </View>
      </View>
      <SmallButton label={buttonLabel} onPress={onPress} busy={busy} filled={filled} colors={colors} />
    </View>
  );
}

function PerkRow({ item, tag, colors }: { item: Perk; tag?: string; colors: any }) {
  const PerkIcon = item.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <PerkIcon size={18} color={colors.brand} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{item.title}</Text>
          {!!tag && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, backgroundColor: colors.brandSoft }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandText }}>{tag}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2, lineHeight: 19 }}>{item.desc}</Text>
      </View>
    </View>
  );
}

function ActionRow({ icon: RowIcon, title, desc, colors, onPress, danger }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <RowIcon size={18} color={danger ? colors.error : colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: danger ? colors.error : colors.text }}>{title}</Text>
        <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 1 }}>{desc}</Text>
      </View>
      <ChevronRight size={16} color={colors.textFaint} />
    </Pressable>
  );
}

function FaqItem({ faq, open, onToggle, colors }: any) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: open ? '700' : '500', color: colors.text }}>{faq.q}</Text>
        <ChevronDown size={16} color={open ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 20, paddingBottom: 13, paddingRight: 20 }}>{faq.a}</Text>
      )}
    </View>
  );
}

function Chip({ label, colors, accent }: any) {
  return (
    <View style={{ backgroundColor: accent ? colors.successSoft : colors.card, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: accent ? colors.success : colors.border }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: accent ? colors.success : colors.text }}>{label}</Text>
    </View>
  );
}