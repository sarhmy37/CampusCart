import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Star, Sparkles } from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import PaystackCheckout from '@/components/PaystackCheckout';

const PAYMENT_CALLBACK_URL = 'https://campuscart-tdfn.onrender.com/paystack/callback';
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    highlight: false,
    icon: null,
    buyerBenefits: [
      'Browse and message any seller',
      'Save items you like',
      'Leave and read reviews',
    ],
    sellerBenefits: [
      'Up to 10 active listings',
      '2% service commission on each booked service',
      'Buyers pay a 2% booking fee',
      'Basic store page',
    ],
  },
  {
    name: 'Pro',
    price: '25',
    period: '/month',
    highlight: true,
    icon: 'pro',
    buyerBenefits: [
      '10% off delivery fees',
      'Support replies within 2 days',
      'Saved searches with new-listing alerts',
      'See new listings first',
    ],
    sellerBenefits: [
      'No service commission on booked orders',
      'Buyers still pay the 2% booking fee',
      'Up to 30 active listings',
      'Listings shown first in search',
      'Pro Seller badge',
      'Upgraded store page with social sharing',
      'Views & sales statistics',
    ],
  },
  {
    name: 'Premium',
    price: '240',
    period: '/year',
    highlight: false,
    icon: 'premium',
    buyerBenefits: [
      'Everything in Pro',
      '18% off delivery fees',
      'Support replies within a few hours',
      'Saved searches with new-listing alerts',
      'Export videos with no watermark',
    ],
    sellerBenefits: [
      'No service commission on booked orders',
      'Buyers still pay the 2% booking fee',
      'Unlimited active listings',
      'Listings shown first in search',
      'Premium Seller badge',
      'Upgraded store page with social sharing',
      'Export videos with no watermark',
      'Views & sales statistics',
    ],
  },
];

export default function HomePlans() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const isSeller =
    String(user?.role ?? '').toLowerCase().includes('seller') ||
    String(user?.account_type ?? '').toLowerCase().includes('seller') ||
    String(user?.user_type ?? '').toLowerCase().includes('seller') ||
    user?.is_seller === true ||
    user?.is_seller === 1 ||
    user?.seller === true;
  const audience: 'buyer' | 'seller' | 'both' = !user ? 'both' : isSeller ? 'seller' : 'buyer';

  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ url: string; reference: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const discountExpiry = user?.plan_discount_expires_at
    ? new Date(user.plan_discount_expires_at).getTime()
    : 0;
  const discountActive = discountExpiry > now;
  const discountMsLeft = Math.max(0, discountExpiry - now);

  useEffect(() => {
    if (!discountActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [discountActive]);

  const formatCountdown = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const handleBrowseClick = () => {
    if (user) router.push('/browse');
    else router.push('/register');
  };

  const handlePlanClick = async (planName: string) => {
    const currentPlan = (user?.plan || 'free').toLowerCase();
    const targetPlan = planName.toLowerCase();
    const isCurrentPlanActive =
      user?.plan && user.plan !== 'free' && user?.plan_expires_at &&
      new Date(user.plan_expires_at) > new Date();

    const isPaidSwitch =
      isCurrentPlanActive &&
      ((currentPlan === 'pro' && targetPlan === 'premium') ||
        (currentPlan === 'premium' && targetPlan === 'pro'));

    if (isCurrentPlanActive && targetPlan !== currentPlan && !isPaidSwitch) {
      Toast.show({
        type: 'error',
        text1: `You're on the ${user.plan} plan until it expires — you can switch once it ends.`,
      });
      return;
    }

    if (targetPlan === 'free') {
      handleBrowseClick();
      return;
    }

    if (!user) {
      router.push('/register');
      return;
    }

    if (isPaidSwitch && currentPlan === 'premium' && targetPlan === 'pro') {
      const endDate = new Date(user.plan_expires_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      Alert.alert(
        'Downgrade to Pro?',
        `You'll keep Premium until ${endDate}, then switch to Pro and lose Premium benefits like unlimited listings and the 18% delivery discount. This can't be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, downgrade',
            style: 'destructive',
            onPress: async () => {
              try {
                setSubscribingPlan(planName);
                await api.post('/subscriptions/schedule-downgrade', { plan: targetPlan });
                Toast.show({
                  type: 'success',
                  text1: `You'll switch to Pro on ${endDate}. You keep Premium until then.`,
                });
              } catch (err: any) {
                Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not schedule the downgrade.' });
              } finally {
                setSubscribingPlan(null);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      setSubscribingPlan(planName);
      const res = await api.post('/subscriptions/initiate', { plan: targetPlan });
      setCheckout({ url: res.data.authorization_url, reference: res.data.reference });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not start payment.' });
    } finally {
      setSubscribingPlan(null);
    }
  };

  const verifySubscription = async (reference: string) => {
    try {
      const res = await api.post(`/subscriptions/verify/${encodeURIComponent(reference)}`);
      if (res.data.status === 'active') {
        await updateProfile({});
        Toast.show({ type: 'success', text1: `${res.data.plan} plan is now active` });
      } else {
        Toast.show({ type: 'error', text1: 'Payment is still being confirmed. Please check again shortly.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not verify payment.' });
    } finally {
      setCheckout(null);
    }
  };

  const renderButton = (plan: any) => {
    const currentPlan = (user?.plan || 'free').toLowerCase();
    const isCurrent = plan.name.toLowerCase() === currentPlan;
    const pendingPlan = user?.pending_plan?.toLowerCase();
    const pendingDate = user?.plan_expires_at
? new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
: '';

    if (pendingPlan && plan.name.toLowerCase() === pendingPlan) {
      return (
        <ButtonShell colors={colors} bg={colors.warningSoft}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warning, textAlign: 'center' }} numberOfLines={1}>
            Starts {pendingDate}
          </Text>
        </ButtonShell>
      );
    }
    if (isCurrent && pendingPlan) {
      return (
        <ButtonShell colors={colors} bg={colors.chipBg}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textFaint, textAlign: 'center' }} numberOfLines={1}>
            Active until {pendingDate}
          </Text>
        </ButtonShell>
      );
    }
    if (isCurrent) {
      return (
        <ButtonShell colors={colors} bg={colors.chipBg}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textFaint, textAlign: 'center' }} numberOfLines={1}>
            Current plan
          </Text>
        </ButtonShell>
      );
    }

    const label =
      plan.price === '0'
        ? 'Get started free'
        : currentPlan === 'pro' && plan.name === 'Premium'
        ? 'Upgrade to Premium'
        : currentPlan === 'premium' && plan.name === 'Pro'
        ? 'Downgrade to Pro'
        : `Choose ${plan.name}`;

    return (
      <ButtonShell
        colors={colors}
        bg={plan.highlight ? colors.brand : colors.chipBg}
        tint={plan.highlight ? colors.brand : undefined}
        onPress={() => handlePlanClick(plan.name)}
        disabled={subscribingPlan === plan.name}
      >
        {subscribingPlan === plan.name ? (
          <ActivityIndicator size="small" color={plan.highlight ? colors.textOnGold : colors.text} />
        ) : (
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: plan.highlight ? colors.textOnGold : colors.text,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </ButtonShell>
    );
  };

  return (
    <View style={{ backgroundColor: colors.backgroundAlt, paddingHorizontal: 16, paddingVertical: 40 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
        Plans
      </Text>
      <Text style={{ fontSize: 23, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 6 }}>
        Pick the plan that fits how you trade
      </Text>
      <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 }}>
         {audience === 'seller'
          ? 'Grow your store on campus — upgrade any time as your sales grow.'
          : audience === 'buyer'
          ? 'Save on delivery and get help faster — upgrade any time.'
          : 'Every plan works for both buyers and sellers — upgrade any time as your activity on campus grows.'}
      </Text>

      {discountActive && (
        <View style={{
          marginTop: 20,
          backgroundColor: colors.warningSoft,
          borderWidth: 1,
          borderColor: colors.warning,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          alignSelf: 'center',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.warning, textAlign: 'center' }}>
            🎉 Referral reward: 25% off Pro & Premium, ends in {formatCountdown(discountMsLeft)}
          </Text>
        </View>
      )}

      {/* Row 1: Free + Pro side by side */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        {PLANS.slice(0, 2).map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            colors={colors}
            discountActive={discountActive}
            renderButton={renderButton}
            audience={audience}
            width="flex"
          />
        ))}
      </View>

      {/* Row 2: Premium full width */}
      <View style={{ marginTop: 12 }}>
        <PlanCard
          plan={PLANS[2]}
          colors={colors}
          discountActive={discountActive}
          renderButton={renderButton}
          audience={audience}
          width="full"
        />
      </View>
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

function PlanCard({
  plan, colors, discountActive, renderButton, width, audience,
}: {
  plan: any;
  colors: any;
  discountActive: boolean;
  renderButton: (plan: any) => any;
  width: 'flex' | 'full';
  audience: 'buyer' | 'seller' | 'both';
}) {
  const discounted =
    discountActive && plan.price !== '0'
      ? (Number(plan.price) * 0.75).toFixed(2)
      : plan.price;

  return (
    <View
      style={{
        flex: width === 'flex' ? 1 : undefined,
        width: width === 'full' ? '100%' : undefined,
        backgroundColor: colors.card,
        borderRadius: 18,
        borderWidth: plan.highlight ? 2 : 1,
        borderColor: plan.highlight ? colors.brand : colors.border,
        padding: 14,
        position: 'relative',
      }}
    >
      {plan.highlight && (
        <View
          style={{
            position: 'absolute',
            top: -10,
            alignSelf: 'center',
            backgroundColor: colors.brand,
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            zIndex: 10,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textOnGold }}>
            Most popular
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {plan.icon === 'premium' && <Sparkles size={12} color="#a855f7" fill="#a855f7" />}
        {plan.icon === 'pro' && <Star size={12} color="#3b82f6" fill="#3b82f6" />}
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{plan.name}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginTop: 4, flexWrap: 'nowrap' }}>
        {discountActive && plan.price !== '0' && (
          <Text style={{ fontSize: 10, color: colors.textFaint, textDecorationLine: 'line-through' }}>
            GHS {plan.price}
          </Text>
        )}
        <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>
          GHS {discounted}
        </Text>
        <Text style={{ fontSize: 10, color: colors.textMuted }}>{plan.period}</Text>
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          gap: 8,
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.borderMuted,
        }}
      >
        {audience !== 'seller' && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>
              Buyers
            </Text>
            {plan.buyerBenefits.map((b: string) => (
              <View key={b} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
                <Text style={{ fontSize: 10, color: colors.brand }}>✓</Text>
                <Text style={{ flex: 1, fontSize: 10, color: colors.textSecondary, lineHeight: 12 }}>{b}</Text>
              </View>
            ))}
          </View>
        )}
        {audience !== 'buyer' && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>
              Sellers
            </Text>
            {plan.sellerBenefits.map((b: string) => (
              <View key={b} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
                <Text style={{ fontSize: 10, color: colors.brand }}>✓</Text>
                <Text style={{ flex: 1, fontSize: 10, color: colors.textSecondary, lineHeight: 12 }}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {renderButton(plan)}
    </View>
  );
}

function ButtonShell({ colors, bg, tint, onPress, disabled, children }: any) {
  const base = btnStyle(colors);
  const inner = GLASS ? (
    <GlassView
      glassEffectStyle="regular"
      isInteractive={!!onPress}
      tintColor={tint}
      style={{ ...base, borderRadius: 10 }}
    >
      {children}
    </GlassView>
  ) : (
    <View style={{ ...base, backgroundColor: bg }}>{children}</View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.6 : 1 }}>
      {inner}
    </Pressable>
  );
}

function btnStyle(colors: any) {
  return {
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 36,
  };
}