import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Star, Sparkles } from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

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
      'Standard 1.5% fee per sale',
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
      '24-hour priority support',
      'See new listings first',
    ],
    sellerBenefits: [
      'Keep 100% of every sale — no platform fee',
      'Up to 30 active listings',
      'Listings shown first in search',
      'Pro Seller badge',
      'Upgraded store page with social sharing',
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
      'Same-day dedicated support line',
      'Export videos with no watermark',
    ],
    sellerBenefits: [
      'Keep 100% of every sale — no platform fee',
      'Unlimited active listings',
      'Listings shown first in search',
      'Premium Seller badge',
      'Store page shown at the very top of search',
      'Export videos with no watermark',
    ],
  },
];

export default function HomePlans() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isSeller =
    String(user?.role ?? '').toLowerCase().includes('seller') ||
    String(user?.account_type ?? '').toLowerCase().includes('seller') ||
    String(user?.user_type ?? '').toLowerCase().includes('seller') ||
    user?.is_seller === true ||
    user?.is_seller === 1 ||
    user?.seller === true;
  const audience: 'buyer' | 'seller' | 'both' = !user ? 'both' : isSeller ? 'seller' : 'buyer';

  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
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
      Linking.openURL(res.data.authorization_url);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not start payment.' });
    } finally {
      setSubscribingPlan(null);
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
        <View style={[btnStyle(colors), { backgroundColor: colors.warningSoft }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warning, textAlign: 'center' }} numberOfLines={1}>
            Starts {pendingDate}
          </Text>
        </View>
      );
    }
    if (isCurrent && pendingPlan) {
      return (
        <View style={[btnStyle(colors), { backgroundColor: colors.chipBg }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, textAlign: 'center' }} numberOfLines={1}>
            Active until {pendingDate}
          </Text>
        </View>
      );
    }
    if (isCurrent) {
      return (
        <View style={[btnStyle(colors), { backgroundColor: colors.chipBg }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, textAlign: 'center' }} numberOfLines={1}>
            Current plan
          </Text>
        </View>
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
      <Pressable
        onPress={() => handlePlanClick(plan.name)}
        disabled={subscribingPlan === plan.name}
        style={[
          btnStyle(colors),
          {
            backgroundColor: plan.highlight ? colors.brand : colors.chipBg,
            opacity: subscribingPlan === plan.name ? 0.6 : 1,
          },
        ]}
      >
        {subscribingPlan === plan.name ? (
          <ActivityIndicator size="small" color={plan.highlight ? colors.textOnGold : colors.text} />
        ) : (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: plan.highlight ? colors.textOnGold : colors.text,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: colors.backgroundAlt, paddingHorizontal: 16, paddingVertical: 40 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
        Plans
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 6 }}>
        Pick the plan that fits how you trade
      </Text>
      <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 }}>
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
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warning, textAlign: 'center' }}>
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
          <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textOnGold }}>
            Most popular
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {plan.icon === 'premium' && <Sparkles size={12} color="#a855f7" fill="#a855f7" />}
        {plan.icon === 'pro' && <Star size={12} color="#3b82f6" fill="#3b82f6" />}
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{plan.name}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginTop: 4, flexWrap: 'nowrap' }}>
        {discountActive && plan.price !== '0' && (
          <Text style={{ fontSize: 9, color: colors.textFaint, textDecorationLine: 'line-through' }}>
            GHS {plan.price}
          </Text>
        )}
        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text }}>
          GHS {discounted}
        </Text>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>{plan.period}</Text>
      </View>

      <View
        style={{
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
            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>
              Buyers
            </Text>
            {plan.buyerBenefits.map((b: string) => (
              <View key={b} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
                <Text style={{ fontSize: 9, color: colors.brand }}>✓</Text>
                <Text style={{ flex: 1, fontSize: 9, color: colors.textSecondary, lineHeight: 12 }}>{b}</Text>
              </View>
            ))}
          </View>
        )}
        {audience !== 'buyer' && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>
              Sellers
            </Text>
            {plan.sellerBenefits.map((b: string) => (
              <View key={b} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
                <Text style={{ fontSize: 9, color: colors.brand }}>✓</Text>
                <Text style={{ flex: 1, fontSize: 9, color: colors.textSecondary, lineHeight: 12 }}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {renderButton(plan)}
    </View>
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