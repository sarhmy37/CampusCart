import { View, Text } from 'react-native';
import { Flag } from 'lucide-react-native';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';

const REASON_LABELS: Record<string, string> = {
  scam: 'Scam or fraud',
  fake_listing: 'Fake or misleading listing',
  inappropriate: 'Inappropriate content',
  harassment: 'Harassment or unsafe behavior',
  category_request: 'Category request',
  other: 'Something else',
};

const REPORT_STATUS_DESC: Record<string, string> = {
  pending: 'Waiting for review',
  reviewed: 'Reviewed by our team',
  dismissed: 'No action needed',
  actioned: 'Action was taken',
};

export default function Reports() {
  const colors = useColors();
  const { status, data: reports, retry } = usePageReady({
    load: () => api.get('/reports/mine').then((res) => res.data),
  });

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error') return <ErrorState icon={Flag} text="Couldn't load your reports right now." onRetry={retry} />;
  if (!reports || reports.length === 0) return <EmptyState icon={Flag} text="You haven't reported anything." />;

  const statusStyle = (s: string) => {
    switch (s) {
      case 'pending': return { bg: colors.warningSoft, text: colors.warning };
      case 'reviewed': return { bg: colors.infoSoft, text: colors.info };
      case 'actioned': return { bg: colors.successSoft, text: colors.success };
      default: return { bg: colors.chipBg, text: colors.textMuted };
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {reports.map((r: any) => {
        const sStyle = statusStyle(r.status);
        return (
          <View key={r.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {REASON_LABELS[r.reason] || r.reason}
                </Text>
                {r.product_title && (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    Listing: {r.product_title}
                  </Text>
                )}
                {r.reported_user_name && (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    User: {r.reported_user_name}
                  </Text>
                )}
                {r.details && (
                  <View style={{ backgroundColor: colors.cardAlt, borderRadius: 10, padding: 10, marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>{r.details}</Text>
                  </View>
                )}
                <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 8 }}>
                  Filed {new Date(r.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ backgroundColor: sStyle.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: sStyle.text, textTransform: 'capitalize' }}>
                    {r.status}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 4, textAlign: 'right', maxWidth: 110 }}>
                  {REPORT_STATUS_DESC[r.status]}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}