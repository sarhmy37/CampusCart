import {
  View, Text, Pressable, Image, Animated, Easing, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  AlertTriangle, ChevronRight, Store, Truck, Calendar, Package, Wallet, Landmark,
  Clock, Tag, Rocket, Flag, Bookmark, TrendingUp, Briefcase, ArrowUpRight, ArrowDownRight, Sparkles,
} from 'lucide-react-native';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState } from './shared';
import { useColors } from '@/hooks/useColors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '6months', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const money = (n: number | string) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const safe = (p: Promise<any>, fallback: any) => p.then((r) => r.data ?? fallback).catch(() => fallback);

const RADIUS = { sm: 12, md: 16, lg: 20, xl: 26 };

export default function Overview({
  period, onGoToTab,
}: { period: string; onGoToTab?: (tab: string) => void }) {
  const colors = useColors();
  const router = useRouter();
  const go = (t: string) => onGoToTab?.(t);

  const { status, data, retry } = usePageReady({
    load: async () => {
      const [overview, deliveries, bookings, dataOrders, sales, products, withdrawals, accounts, payStatus, reports, saved] =
        await Promise.all([
          api.get('/sellers/overview', { params: { period } }).then((r) => r.data),
          safe(api.get('/orders/deliveries'), []),
          safe(api.get('/bookings/seller'), []),
          safe(api.get('/data-orders/pending'), []),
          safe(api.get('/orders/sales'), []),
          safe(api.get('/products/mine'), []),
          safe(api.get('/payouts/withdrawals'), []),
          safe(api.get('/payouts/accounts'), []),
          safe(api.get('/sellers/payment-status'), {}),
          safe(api.get('/reports/mine'), []),
          safe(api.get('/saved-searches/mine'), []),
        ]);
      return { overview, deliveries, bookings, dataOrders, sales, products, withdrawals, accounts, payStatus, reports, saved };
    },
    deps: [period],
  });

  useEffect(() => {
    if (status === 'ready') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [status, period]);

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error' || !data?.overview) {
    return <ErrorState icon={Store} text="Couldn't load your overview right now." onRetry={retry} />;
  }

  const { overview, deliveries, bookings, dataOrders, sales, products, withdrawals, accounts, payStatus, reports, saved } = data;

  const gross = parseFloat(overview.gross_sales) || 0;
  const net = parseFloat(overview.net_earnings) || 0;
  const salesCount = overview.successful_sales || 0;
  const avgOrderValue = salesCount > 0 ? gross / salesCount : 0;
  const rawChange = overview.net_change_percentage;
  const changePct = rawChange !== undefined && rawChange !== null ? parseFloat(rawChange) : null;
  const isPositive = (changePct ?? 0) >= 0;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label || 'This period';

  const toDeliver = deliveries.filter((d: any) => !d.delivered_at);
  const overdue = toDeliver.filter(
    (d: any) => d.delivery_method === 'delivery' && new Date(d.created_at).getTime() + 3 * 86400000 < Date.now()
  );
  const activeBookings = bookings.filter((b: any) => b.status === 'confirmed');

  const feesOwed = Math.round(
    (payStatus?.history || [])
      .filter((p: any) => p.status !== 'paid')
      .reduce((s: number, p: any) => s + (parseFloat(p.amount_due) - parseFloat(p.amount_paid)), 0) * 100
  ) / 100;
  const feesOverdue = !!payStatus?.restricted;
  const pendingWithdrawals = withdrawals.filter((w: any) => w.status !== 'completed').length;
  const notReceived = withdrawals.filter((w: any) => w.status === 'completed' && w.reported_at).length;
  const defaultAccount = accounts.find((a: any) => a.is_default) || accounts[0];

  const services = products.filter((p: any) => p.category === 'Services');
  const regular = products.filter((p: any) => p.category !== 'Services');
  const boosted = products.filter((p: any) => p.boosted_until && new Date(p.boosted_until) > new Date());
  const unavailable = products.filter((p: any) => p.status !== 'available').length;
  const total = products.length;

  const recentSales = useMemo(() => [...sales]
    .filter((s: any) => s.status !== 'cancelled')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3), [sales]);

  const openReports = reports.filter((r: any) => r.status === 'pending').length;

  return (
    <View style={{ gap: 26 }}>
      {/* Restricted banner */}
      {overview.restricted && (
        <Pressable
          onPress={() => go('payouts')}
          style={{
            flexDirection: 'row', gap: 10, alignItems: 'center',
            backgroundColor: colors.errorSoft,
            borderRadius: RADIUS.md,
            padding: 14,
            borderWidth: 1,
            borderColor: `${colors.error}30`,
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.error}22` }}>
            <AlertTriangle size={18} color={colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.error }}>
              Listings hidden
            </Text>
            <Text style={{ fontSize: 12, color: colors.error, opacity: 0.85, marginTop: 2 }}>
              GHS {parseFloat(overview.pending_payment_due).toFixed(2)} overdue · Tap to pay
            </Text>
          </View>
          <ChevronRight size={16} color={colors.error} />
        </Pressable>
      )}

      {/* HERO */}
      <Pressable
        onPress={() => go('sales')}
        style={{
          borderRadius: RADIUS.xl,
          overflow: 'hidden',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: `${colors.brand}30`,
          ...softShadow(colors),
        }}
      >
        {/* Decorative glows */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.brand, opacity: 0.16 }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -100, left: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.brand, opacity: 0.09 }} />

        <View style={{ padding: 22 }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sparkles size={13} color={colors.brand} />
              <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted }}>
                Net earnings
              </Text>
            </View>
            <View style={{ backgroundColor: colors.chipBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>{periodLabel}</Text>
            </View>
          </View>

          {/* Big number */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textMuted, marginRight: 8 }}>GHS</Text>
            <AnimatedMoney value={net} color={colors.text} />
          </View>

          {/* Delta pill */}
          {changePct !== null && changePct !== 0 && (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: isPositive ? `${colors.success}22` : `${colors.error}22`,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              {isPositive
                ? <ArrowUpRight size={13} color={colors.success} />
                : <ArrowDownRight size={13} color={colors.error} />}
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: isPositive ? colors.success : colors.error }}>
                {Math.abs(changePct).toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: isPositive ? colors.success : colors.error, opacity: 0.8 }}>
                vs previous
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 18, opacity: 0.7 }} />

          {/* Stats row */}
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <HeroStat label="Gross" value={`GHS ${money(gross)}`} colors={colors} />
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />
            <HeroStat label="Sales" value={String(salesCount)} colors={colors} />
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />
            <HeroStat label="Avg order" value={`GHS ${money(avgOrderValue)}`} colors={colors} />
          </View>
        </View>
      </Pressable>

      {/* TODO */}
      <View>
        <SectionLabel title="To do" action="Open tasks" onPress={() => go('tasks')} colors={colors} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile Icon={Truck} value={toDeliver.length} label="To deliver" tone="brand" colors={colors} onPress={() => go('tasks')} />
          <StatTile Icon={AlertTriangle} value={overdue.length} label="Overdue" tone={overdue.length ? 'error' : 'none'} pulse={overdue.length > 0} colors={colors} onPress={() => go('tasks')} />
          <StatTile Icon={Calendar} value={activeBookings.length} label="Bookings" tone="info" colors={colors} onPress={() => go('tasks')} />
          <StatTile Icon={Package} value={dataOrders.length} label="Data" tone="info" colors={colors} onPress={() => go('tasks')} />
        </View>
      </View>

      {/* MONEY */}
      <View>
        <SectionLabel title="Money" action="Open payouts" onPress={() => go('payouts')} colors={colors} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <WideTile
            Icon={Wallet}
            label="Fees owed"
            value={`GHS ${money(feesOwed)}`}
            hint={feesOverdue ? 'Overdue' : feesOwed > 0 ? 'Due' : 'All clear'}
            tone={feesOverdue ? 'error' : feesOwed > 0 ? 'warning' : 'success'}
            colors={colors}
            onPress={() => go('payouts')}
          />
          <WideTile
            Icon={Clock}
            label="Withdrawals"
            value={`${pendingWithdrawals} pending`}
            hint={notReceived > 0 ? `${notReceived} not received` : 'On track'}
            tone={notReceived > 0 ? 'error' : 'success'}
            colors={colors}
            onPress={() => go('payouts')}
          />
        </View>
        <Pressable
          onPress={() => go('payouts')}
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.card,
            borderRadius: RADIUS.md,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <IconDot Icon={Landmark} color={defaultAccount ? colors.brand : colors.warning} colors={colors} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {defaultAccount ? defaultAccount.account_name : 'No payout account yet'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
              {defaultAccount
                ? `${defaultAccount.bank_name || defaultAccount.method} · •••• ${String(defaultAccount.account_number).slice(-4)}`
                : 'Add one to withdraw'}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textFaint} />
        </Pressable>
      </View>

      {/* RECENT SALES */}
      <View>
        <SectionLabel title="Recent sales" action="All sales" onPress={() => go('sales')} colors={colors} />
        {recentSales.length === 0 ? (
          <EmptyRow text="No sales yet." colors={colors} />
        ) : (
          <View style={{ gap: 10 }}>
            {recentSales.map((s: any) => (
              <Pressable
                key={s.id}
                onPress={() => go('sales')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: colors.card,
                  padding: 12,
                  borderRadius: RADIUS.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {(() => {
                  const img = products.find((p: any) => p.title === s.title)?.primary_image;
                  return (
                    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.cardAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                      {img ? (
                        <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <TrendingUp size={18} color={colors.textFaint} />
                      )}
                    </View>
                  );
                })()}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{s.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                    {s.buyer_name} · {new Date(s.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: colors.success }}>
                    +{parseFloat(s.seller_earnings).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textFaint }}>GHS</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* LISTINGS */}
      <View>
        <SectionLabel title="Listings" action="Manage" onPress={() => go('listings')} colors={colors} />
        {total === 0 ? (
          <EmptyRow text="You haven't listed anything yet." colors={colors} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.chipBg }}>
              {regular.length > 0 && (
                <View style={{ flex: regular.length, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}>
                  {regular.length / total > 0.18 && (
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>{regular.length}</Text>
                  )}
                </View>
              )}
              {services.length > 0 && (
                <View style={{ flex: services.length, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' }}>
                  {services.length / total > 0.18 && (
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>{services.length}</Text>
                  )}
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              <Legend Icon={Tag} color={colors.brand} text={`${regular.length} products`} colors={colors} />
              <Legend Icon={Briefcase} color={colors.success} text={`${services.length} services`} colors={colors} />
              <Legend Icon={Rocket} color={colors.warning} text={`${boosted.length} boosted`} colors={colors} />
              {unavailable > 0 && <Legend Icon={AlertTriangle} color={colors.textFaint} text={`${unavailable} unavailable`} colors={colors} />}
            </View>
          </>
        )}
      </View>

      {/* REPORTS + SAVED */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile Icon={Flag} value={openReports} label="Open reports" tone={openReports ? 'warning' : 'none'} pulse={openReports > 0} colors={colors} onPress={() => go('reports')} />
        <StatTile Icon={Bookmark} value={saved.length} label="Saved searches" tone="none" colors={colors} onPress={() => router.push('/browse' as any)} />
      </View>
    </View>
  );
}

/* ---------- helpers ---------- */

function softShadow(colors: any) {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 3 },
    default: {},
  }) as any;
}

function toneColors(tone: string, colors: any) {
  switch (tone) {
    case 'brand': return { fg: colors.brand, bg: colors.brandSoft };
    case 'error': return { fg: colors.error, bg: colors.errorSoft };
    case 'warning': return { fg: colors.warning, bg: colors.warningSoft };
    case 'success': return { fg: colors.success, bg: colors.successSoft };
    case 'info': return { fg: colors.info, bg: colors.infoSoft };
    default: return { fg: colors.textMuted, bg: colors.chipBg };
  }
}

function AnimatedMoney({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, anim]);
  const [display, setDisplay] = useStateCompat('0.00');
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(money(value * v)));
    return () => anim.removeListener(id);
  }, [value, anim]);
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: 46, fontWeight: '900', color, letterSpacing: -1.8 }}>
      {display}
    </Text>
  );
}

// tiny local hook shim so we don't need extra imports
import { useState as useStateCompat } from 'react';

function IconDot({ Icon, color, colors }: { Icon: any; color: string; colors: any }) {
  return (
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} color={color} />
    </View>
  );
}

function StatTile({
  Icon, value, label, tone, colors, onPress, pulse = false,
}: { Icon: any; value: number; label: string; tone: string; colors: any; onPress: () => void; pulse?: boolean }) {
  const t = toneColors(tone, colors);
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 30 }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={{
          backgroundColor: t.bg,
          borderRadius: RADIUS.lg,
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: `${t.fg}22`,
          minHeight: 96,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: `${t.fg}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={t.fg} />
          </View>
          {pulse && value > 0 && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} />
          )}
        </View>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 10, letterSpacing: -0.8 }}>{value}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: t.fg, marginTop: 2 }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function WideTile({
  Icon, label, value, hint, tone, colors, onPress,
}: { Icon: any; label: string; value: string; hint: string; tone: string; colors: any; onPress: () => void }) {
  const t = toneColors(tone, colors);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: t.bg,
        borderRadius: RADIUS.lg,
        padding: 14,
        borderWidth: 1,
        borderColor: `${t.fg}22`,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: `${t.fg}22`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={t.fg} />
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: t.fg, letterSpacing: 0.2 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 19, fontWeight: '900', color: colors.text, marginTop: 10, letterSpacing: -0.4 }}>{value}</Text>
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: t.fg, marginTop: 3, opacity: 0.9 }}>{hint}</Text>
    </Pressable>
  );
}

function SectionLabel({ title, action, onPress, colors }: { title: string; action: string; onPress: () => void; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '900', color: colors.brand, letterSpacing: 1.2, textTransform: 'uppercase' }}>{title}</Text>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          backgroundColor: colors.chipBg,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>{action}</Text>
        <ChevronRight size={12} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function HeroStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.7 }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function Legend({ Icon, color, text, colors }: { Icon: any; color: string; text: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Icon size={12} color={color} />
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textMuted }}>{text}</Text>
    </View>
  );
}

function EmptyRow({ text, colors }: { text: string; colors: any }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: RADIUS.md, padding: 18, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}>
      <Text style={{ fontSize: 13.5, color: colors.textFaint, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}