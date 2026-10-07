import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Award, Store } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState } from './shared';
import { useColors } from '@/hooks/useColors';

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '6months', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

export default function Overview({ period }: { period: string }) {
  const colors = useColors();
  const router = useRouter();

  const { status, data, retry } = usePageReady({
    load: () =>
      Promise.all([
        api.get('/sellers/overview', { params: { period } }),
        api.get('/sellers/rewards'),
      ]).then(([o, r]) => ({ overview: o.data, rewards: r.data })),
    deps: [period],
  });

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error' || !data?.overview) {
    return <ErrorState icon={Store} text="Couldn't load your overview right now." onRetry={retry} />;
  }

  const overview = data.overview;
  const rewards = data.rewards;

  const gross = parseFloat(overview.gross_sales) || 0;
  const net = parseFloat(overview.net_earnings) || 0;
  const salesCount = overview.successful_sales || 0;
  const avgOrderValue = salesCount > 0 ? gross / salesCount : 0;

  const rawChange = overview.net_change_percentage;
  const changePct = rawChange !== undefined && rawChange !== null ? parseFloat(rawChange) : null;
  const isPositive = (changePct ?? 0) >= 0;

  const periodLabel = PERIODS.find((p) => p.value === period)?.label || 'This period';
  const progressCount = rewards?.progress || 0;
  const nextMilestone = rewards?.next_milestone || 0;
  const latestReward = rewards?.rewards?.[0];

  return (
    <View style={{ gap: 12 }}>
      {/* Restricted banner */}
      {overview.restricted && (
        <View style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.errorSoft, borderWidth: 1, borderColor: colors.error, borderRadius: 12, padding: 12 }}>
          <AlertTriangle size={16} color={colors.error} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.error }}>Your listings are hidden</Text>
            <Text style={{ fontSize: 12, color: colors.error, marginTop: 4, lineHeight: 17 }}>
              You have an overdue platform fee of GHS {parseFloat(overview.pending_payment_due).toFixed(2)}.{' '}
              <Text onPress={() => router.push('/settings')} style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
                Pay in Settings
              </Text>
            </Text>
          </View>
        </View>
      )}

      {/* Earnings statement card */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted }}>Earnings statement</Text>
          <Text style={{ fontSize: 12, color: colors.textFaint }}>{periodLabel}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 }}>
            GHS {net.toFixed(2)}
          </Text>
          {changePct !== null && changePct !== 0 && (
            <View style={{ backgroundColor: isPositive ? colors.successSoft : colors.errorSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isPositive ? colors.success : colors.error }}>
                {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 4 }}>
          Net earnings after fees · {salesCount} {salesCount === 1 ? 'sale' : 'sales'}
          {changePct !== null && changePct !== 0 && ` · ${isPositive ? 'up' : 'down'} vs previous period`}
        </Text>

        {/* Statement rows */}
        <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' }}>
          <StatementRow label="Gross sales" value={`GHS ${gross.toFixed(2)}`} colors={colors} />
          <StatementRow label="Average order" value={`GHS ${avgOrderValue.toFixed(2)}`} colors={colors} />
        </View>

        {/* Milestone progress */}
        {rewards && nextMilestone > 0 && (
          <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ position: 'relative', width: 72, height: 72 }}>
              <MilestoneRing progress={progressCount} total={nextMilestone} size={72} stroke={6} colors={colors} />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Award size={18} color={colors.brand} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Milestone progress</Text>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                {progressCount} of {nextMilestone} sales · 0.5% cashback at each milestone
              </Text>
              {latestReward && (
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success, marginTop: 6 }}>
                  Last reward: +GHS {parseFloat(latestReward.reward_amount).toFixed(2)} · Milestone {latestReward.milestone}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function StatementRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: colors.textMuted }}>{label}</Text>
      <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dotted', marginHorizontal: 8, transform: [{ translateY: -3 }] }} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

function MilestoneRing({ progress, total, size = 72, stroke = 6, colors }: { progress: number; total: number; size?: number; stroke?: number; colors: any }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(progress / total, 1) : 0;
  const offset = c * (1 - pct);
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={colors.cardAlt} />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        stroke={colors.brand}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
}