import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, Animated, ActivityIndicator, Modal, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Sparkles, Star, Zap, Eye, TrendingUp, Store, Bookmark,
  Award, ChevronDown, ArrowRight, Gauge, MessageCircle, Percent,
  Layers, Rocket, X, Trash2,
} from 'lucide-react-native';

import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { BENEFITS_IMAGE } from '@/data/media';
import Reveal from '@/components/Reveal';

const LISTING_LIMITS: Record<string, number> = { free: 10, pro: 30, premium: Infinity };

const TIER_META: Record<string, { label: string; icon: any }> = {
  pro: { label: 'Pro', icon: Star },
  premium: { label: 'Premium', icon: Sparkles },
};

const SELLER_BENEFITS = [
  {
    category: 'Selling',
    items: [
      { icon: Percent, title: '0% platform fee', desc: "Keep 100% of every sale — Free plan sellers pay 1.5% per sale, you pay nothing.", tiers: ['pro', 'premium'] },
      { icon: Layers, title: 'Higher listing limit', desc: "List up to 30 items at once instead of the Free plan's 10.", tiers: ['pro'] },
      { icon: Layers, title: 'Unlimited listings', desc: 'List as many items as you want, with no cap at all.', tiers: ['premium'] },
      { icon: TrendingUp, title: 'Priority placement', desc: 'Your listings are shown first in Browse and search, ahead of Free plan sellers.', tiers: ['pro', 'premium'] },
      { icon: Award, title: 'Seller badge', desc: 'A visible badge on your listings and store page that signals a trusted, active seller.', tiers: ['pro', 'premium'] },
      { icon: Eye, title: 'Views & sales stats', desc: 'See exactly how many people viewed and bought each of your listings.', tiers: ['pro', 'premium'] },
    ],
  },
  {
    category: 'Your store',
    items: [
      { icon: Store, title: 'Upgraded store page', desc: 'A richer storefront with social sharing built in — share your store link anywhere.', tiers: ['pro'] },
      { icon: Rocket, title: 'Top store placement', desc: 'Your store page is shown at the very top when buyers browse sellers.', tiers: ['premium'] },
    ],
  },
  {
    category: 'Support & visibility',
    items: [
      { icon: MessageCircle, title: '24-hour priority support', desc: 'Jump the queue — your questions get answered within 24 hours.', tiers: ['pro'] },
      { icon: Zap, title: 'Same-day dedicated support', desc: 'A dedicated line that responds the same day, every day.', tiers: ['premium'] },
      { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified the moment a matching listing appears.', tiers: ['pro', 'premium'] },
      { icon: Gauge, title: 'See new listings first', desc: 'New listings matching your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
    ],
  },
];

const FAQ_ITEMS = [
  { q: 'What happens when my plan expires?', a: "Your account automatically reverts to the Free plan — no charge happens without you actively resubscribing. Listings beyond the Free plan's limit stay live, but you won't be able to add new ones until you're back under the cap or you renew." },
  { q: 'Can I switch between Pro and Premium?', a: "Yes, anytime. Upgrading to Premium applies immediately. Downgrading to Pro keeps your Premium benefits until your current period ends, then switches you to Pro at renewal — you never lose what you've already paid for." },
  { q: 'What if I cancel?', a: 'You keep full access until your current period ends, then your account reverts to Free. No refunds for time already paid, but nothing is cut off early.' },
  { q: 'Is the 0% fee automatic?', a: 'Yes — as soon as your plan is active, every new sale is calculated with a 0% platform fee instead of the standard 1.5%. No action needed on your end.' },
  { q: 'What counts toward "fees saved"?', a: "It's calculated as 1.5% of your total confirmed sales while your plan has been active — the amount you would have paid on the Free plan." },
];

function BenefitsVideo() {
  return (
    <Image
      source={BENEFITS_IMAGE}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="cover"
    />
  );
}

export default function Benefits() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useAuth();

  const heroHeight = height * 0.42;

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

  const isSeller = user?.account_type === 'seller';
  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
  const planTier = isPlanActive ? user!.plan.toLowerCase() : null;
  const meta = planTier ? TIER_META[planTier] : null;

  const daysLeft = user?.plan_expires_at
    ? Math.max(0, Math.ceil((new Date(user.plan_expires_at).getTime() - Date.now()) / 86400000))
    : 0;

  const pendingPlan = String((user as any)?.pending_plan ?? '').toLowerCase();
  const isPendingCancel = pendingPlan === 'free';
  const isPendingDowngrade = !!pendingPlan && pendingPlan !== 'free' && pendingPlan !== planTier;
  const pendingLabel = pendingPlan ? pendingPlan.charAt(0).toUpperCase() + pendingPlan.slice(1) : '';

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
      Toast.show({ type: 'success', text1: 'Subscription cancelled — you keep access until it expires.' });
      setShowCancelModal(false);
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
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not undo cancellation' });
    }
  };

  const feeSaved = grossSales * 0.015;
  const listingLimit = planTier ? LISTING_LIMITS[planTier] : LISTING_LIMITS.free;
  const listingUsagePct = listingLimit === Infinity ? 0 : Math.min(100, (listingCount / listingLimit) * 100);

  // ─── FREE PLAN TEASER ───
  if (!planTier) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <BenefitsVideo />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)' }} />
          <View style={{ padding: 20, paddingTop: insets.top + 16 }}>
            <Pressable
              onPress={() => router.back()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <ArrowLeft size={14} color="rgba(255,255,255,0.7)" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>Back</Text>
            </Pressable>
          </View>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Sparkles size={20} color="#fff" />
            </View>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
              You're on the Free plan
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 19, maxWidth: 320 }}>
              Upgrade to unlock 0% platform fees, priority placement, more listings, and dedicated support.
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginTop: 24, backgroundColor: '#fff',
                paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999,
              }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 13 }}>View plans</Text>
              <ArrowRight size={14} color="#0f172a" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const Icon = meta!.icon;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── FIXED VIDEO BACKGROUND ─── */}
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, overflow: 'hidden', backgroundColor: '#0f172a',
        }}
      >
        <BenefitsVideo />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)' }} />
      </View>

      {/* ─── HEADER TEXT (fades on scroll, sits over video) ─── */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: heroHeight,
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          opacity: headerTextOpacity,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Icon size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{meta!.label}</Text>
          </View>
        </View>

        <View style={{ marginTop: 30 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{user?.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{user?.school}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 20 }}>
          <Text style={{ color: '#fff', fontSize: 56, fontWeight: '900', lineHeight: 56 }}>{daysLeft}</Text>
          <View style={{ paddingBottom: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {daysLeft === 1 ? 'day' : 'days'} left
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
              {isPendingDowngrade ? `${pendingLabel} starts` : isPendingCancel ? 'Ends' : 'Renews'} {new Date(user!.plan_expires_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {isSeller && (
          <View style={{ flexDirection: 'row', marginTop: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <HeaderStat label="Listings" value={loading ? '···' : String(listingCount)} />
            <HeaderStat label="Total views" value={loading ? '···' : String(totalViews)} />
            <HeaderStat label="Fees saved" value={loading ? '···' : `GHS ${feeSaved.toFixed(0)}`} />
          </View>
        )}
      </Animated.View>

      {/* ─── BACK BUTTON (fades on scroll) ─── */}
      <Animated.View
        style={{
          position: 'absolute',
          top: insets.top + 12, left: 16, zIndex: 20,
          opacity: backButtonOpacity,
        }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          <ArrowLeft size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </Animated.View>

      {/* ─── SCROLLABLE BODY (scrolls over video) ─── */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: heroHeight * 0.62, paddingBottom: insets.bottom + 40 }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 28,
            minHeight: height,
          }}
        >
          {isSeller && listingLimit !== Infinity && (
            <Reveal>
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Listing usage</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{listingCount} / {listingLimit}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.chipBg, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${listingUsagePct}%`, backgroundColor: colors.brand, borderRadius: 999 }} />
                </View>
              </View>
            </Reveal>
          )}

          {isSeller && (
            <Reveal>
              <View style={{ paddingTop: 28 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
                  Since joining {meta!.label}
                </Text>
                <StatementLine label="Gross sales" value={loading ? '···' : `GHS ${grossSales.toFixed(2)}`} colors={colors} />
                <StatementLine label="Platform fee saved (1.5%)" value={loading ? '···' : `GHS ${feeSaved.toFixed(2)}`} highlight colors={colors} />
                <StatementLine label="Total views across listings" value={loading ? '···' : String(totalViews)} colors={colors} />
              </View>
            </Reveal>
          )}

          <Reveal delay={60}>
            <View style={{ paddingTop: 36 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>Manage</Text>

              {isSeller && (
                <ActionRow icon={Store} title="View my store" desc="See your public storefront" colors={colors} onPress={() => router.push(`/store/${user!.id}` as any)} />
              )}

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                <Pressable onPress={handleToggleSaved} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Bookmark size={15} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Saved searches</Text>
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                      {savedSearches.length > 0 ? `${savedSearches.length} saved` : 'Get notified when new listings match'}
                    </Text>
                  </View>
                  <ChevronDown size={15} color={savedExpanded ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: savedExpanded ? '180deg' : '0deg' }] }} />
                </Pressable>

                {savedExpanded && (
                  <View style={{ paddingLeft: 46, paddingBottom: 12 }}>
                    {savedLoading ? (
                      <ActivityIndicator color={colors.brand} />
                    ) : savedSearches.length === 0 ? (
                      <View>
                        <Text style={{ fontSize: 12, color: colors.textFaint, lineHeight: 18, marginBottom: 8 }}>
                          No saved searches yet. Save a search from the Browse page to get notified the moment a matching listing appears.
                        </Text>
                        <Pressable onPress={() => router.push('/(browse)/all' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>Browse listings</Text>
                          <ArrowRight size={12} color={colors.brand} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {savedSearches.map((s) => {
                          const hasPrice = s.price_min != null || s.price_max != null;
                          const priceLabel = hasPrice
                            ? `GHS ${s.price_min != null ? Number(s.price_min).toFixed(0) : '0'}${s.price_max != null ? ` – ${Number(s.price_max).toFixed(0)}` : '+'}`
                            : null;
                          return (
                            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.chipBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {s.keyword && <Chip label={`"${s.keyword}"`} colors={colors} />}
                                {s.category && <Chip label={s.category} colors={colors} />}
                                {s.service_type && <Chip label={s.service_type} colors={colors} />}
                                {s.school && <Chip label={`📍 ${s.school}`} colors={colors} />}
                                {priceLabel && <Chip label={priceLabel} colors={colors} />}
                                {s.verified_only && <Chip label="✓ Verified" colors={colors} accent />}
                              </View>
                              <Pressable onPress={() => handleDeleteSearch(s.id)} disabled={deletingSearchId === s.id} hitSlop={8}>
                                <Trash2 size={13} color={colors.textFaint} />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>

              <ActionRow icon={MessageCircle} title="Priority support" desc={planTier === 'premium' ? 'Same-day dedicated line' : '24-hour priority response'} colors={colors} onPress={() => router.push('/contact' as any)} />
              <ActionRow icon={Gauge} title="Manage subscription" desc="Renew, view billing, or change plan" colors={colors} onPress={() => router.push('/settings' as any)} />

              {isPendingDowngrade ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={15} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{pendingLabel} starts {new Date(user!.plan_expires_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>You keep {meta!.label} until then</Text>
                  </View>
                </View>
              ) : isPendingCancel ? (
                <ActionRow icon={X} title="Undo cancellation" desc={`Ends ${new Date(user!.plan_expires_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — keep your plan instead`} colors={colors} onPress={handleUndoCancel} />
              ) : (
                <ActionRow icon={X} title="Cancel subscription" desc="Keep access until your current period ends" colors={colors} onPress={() => setShowCancelModal(true)} danger />
              )}
            </View>
          </Reveal>

          <View style={{ paddingTop: 36 }}>
            <Reveal>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 }}>What's included</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Everything in your plan</Text>
            </Reveal>

            <View style={{ marginTop: 20, gap: 24 }}>
              {SELLER_BENEFITS.map((group, gi) => {
                const groupItems = group.items.filter((item) => item.tiers.includes(planTier));
                if (groupItems.length === 0) return null;
                const isOpen = !!collapsedCategories[group.category];
                return (
                  <Reveal key={group.category} delay={gi * 60}>
                    <View>
                      <Pressable
                        onPress={() => setCollapsedCategories((prev) => ({ ...prev, [group.category]: !isOpen }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>{group.category}</Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                        <ChevronDown size={15} color={isOpen ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
                      </Pressable>
                      {isOpen && (
                        <View>
                          {groupItems.map((item) => (
                            <BenefitRow key={item.title} item={item} colors={colors} />
                          ))}
                        </View>
                      )}
                    </View>
                  </Reveal>
                );
              })}
            </View>
          </View>

          {planTier === 'pro' && (
            <Reveal delay={100}>
              <View style={{ paddingTop: 36 }}>
                <View style={{ borderRadius: 16, padding: 18, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={15} color={colors.textOnGold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Go further with Premium</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                        Everything you have on Pro, plus no listing cap at all and your store shown first, every time.
                      </Text>
                      <Pressable onPress={() => router.push('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>Upgrade to Premium</Text>
                        <ArrowRight size={12} color={colors.brand} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </Reveal>
          )}

          <View style={{ paddingTop: 44, alignItems: 'center' }}>
            <Pressable onPress={() => setShowFaq((v) => !v)}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand, textDecorationLine: 'underline' }}>
                Frequently Asked Questions
              </Text>
            </Pressable>
            {showFaq && (
              <View style={{ marginTop: 20, width: '100%' }}>
                {FAQ_ITEMS.map((faq, i) => (
                  <FaqItem key={faq.q} faq={faq} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} colors={colors} />
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <Pressable
          onPress={() => setShowCancelModal(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, maxWidth: 340, width: '100%', borderWidth: 1, borderColor: colors.border }}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <X size={24} color="#ef4444" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' }}>Cancel subscription?</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                You'll keep {meta!.label} access until {new Date(user!.plan_expires_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, then your account moves to Free. No refund for time already paid.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
              <Pressable
                onPress={() => setShowCancelModal(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>Keep plan</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmCancel}
                disabled={cancelling}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center', opacity: cancelling ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                  {cancelling ? 'Cancelling…' : 'Cancel plan'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function StatementLine({ label, value, highlight, colors }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' }}>
      <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: highlight ? '#10b981' : colors.text }}>{value}</Text>
    </View>
  );
}

function BenefitRow({ item, colors }: any) {
  const Icon = item.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <Icon size={14} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 }}>{item.title}</Text>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>{item.desc}</Text>
      </View>
    </View>
  );
}

function ActionRow({ icon: Icon, title, desc, colors, onPress, danger }: any) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: danger ? '#fee2e2' : colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color={danger ? '#ef4444' : colors.textMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: danger ? '#ef4444' : colors.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>{desc}</Text>
      </View>
      <ArrowRight size={15} color={danger ? '#fca5a5' : colors.textFaint} />
    </Pressable>
  );
}

function FaqItem({ faq, open, onToggle, colors }: any) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: open ? '800' : '500', color: colors.text }}>{faq.q}</Text>
        <ChevronDown size={16} color={open ? colors.brand : colors.textFaint} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18, paddingBottom: 16, paddingRight: 24 }}>
          {faq.a}
        </Text>
      )}
    </View>
  );
}

function Chip({ label, colors, accent }: any) {
  return (
    <View style={{ backgroundColor: accent ? '#d1fae5' : colors.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: accent ? '#a7f3d0' : colors.border }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: accent ? '#047857' : colors.text }}>{label}</Text>
    </View>
  );
}