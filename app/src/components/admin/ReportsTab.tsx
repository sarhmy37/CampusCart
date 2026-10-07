import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { Flag, ShieldAlert, XCircle, Ban, LogOut } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { Tag, IconButton, SkeletonList, EmptyState, confirmAsync, cardStyle } from './shared';

const STATUS_FILTERS = ['pending', 'reviewed', 'dismissed', 'actioned'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const REASON_LABELS: Record<string, string> = {
  scam: 'Scam or fraud',
  fake_listing: 'Fake or misleading listing',
  inappropriate: 'Inappropriate content',
  harassment: 'Harassment or unsafe behavior',
  account_security: 'Suspicious account access',
  ban_review: 'Ban review request',
  other: 'Something else',
};

export default function ReportsTab() {
  const colors = useColors();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/reports', { params: { status: statusFilter } })
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/reports/${id}`, { status });
      Toast.show({ type: 'success', text1: 'Report updated' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to update' });
    }
  };

  const forceLogout = async (report: any) => {
    setActingId(report.id);
    try {
      await api.post(`/admin/users/${report.reported_user_id}/force-logout`);
      Toast.show({ type: 'success', text1: 'User signed out of all sessions' });
      await updateStatus(report.id, 'reviewed');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed' });
    } finally {
      setActingId(null);
    }
  };

  const banUser = async (report: any) => {
    const ok = await confirmAsync(
      'Ban this account?',
      'They will be unable to log in until unbanned.',
      'Ban'
    );
    if (!ok) return;
    setActingId(report.id);
    try {
      await api.patch(`/admin/users/${report.reported_user_id}`, { banned: true });
      Toast.show({ type: 'success', text1: 'Account banned' });
      await updateStatus(report.id, 'actioned');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed' });
    } finally {
      setActingId(null);
    }
  };

  return (
    <View>
      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, marginBottom: 12 }}
      >
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(s)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
                backgroundColor: active ? colors.brandSoft : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '700' : '500',
                  color: active ? colors.brand : colors.textMuted,
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <SkeletonList />
      ) : reports.length === 0 ? (
        <EmptyState icon={Flag} text={`No ${statusFilter} reports.`} />
      ) : (
        <View style={{ gap: 8 }}>
          {reports.map((r) => (
            <View key={r.id} style={cardStyle(colors)}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tag color="red">{REASON_LABELS[r.reason] || r.reason}</Tag>
                <Text style={{ fontSize: 11, color: colors.textFaint }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Text>
                {r.status !== 'pending' && (
                  <Tag color={r.status === 'actioned' ? 'red' : 'slate'}>{r.status}</Tag>
                )}
              </View>

              {r.product_title && (
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8 }}>
                  Listing: {r.product_title}
                </Text>
              )}
              {r.reported_user_name && (
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  Reported user: {r.reported_user_name}
                </Text>
              )}
              <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 4 }}>
                Reported by {r.reporter_name} ({r.reporter_email})
              </Text>

              {r.details && (
                <View style={{ backgroundColor: colors.chipBg, borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                    {r.details}
                  </Text>
                </View>
              )}

              {r.status === 'pending' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {r.reason === 'account_security' && r.reported_user_id && (
                    <>
                      <Pressable
                        onPress={() => forceLogout(r)}
                        disabled={actingId === r.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: colors.warningSoft,
                        }}
                      >
                        <LogOut size={13} color={colors.warning} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.warning }}>
                          Force logout
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => banUser(r)}
                        disabled={actingId === r.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: colors.errorSoft,
                        }}
                      >
                        <Ban size={13} color={colors.error} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.error }}>
                          Ban
                        </Text>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    onPress={() => updateStatus(r.id, 'dismissed')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <XCircle size={13} color={colors.textMuted} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
                      Dismiss
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => updateStatus(r.id, 'actioned')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: colors.error,
                    }}
                  >
                    <ShieldAlert size={13} color="#fff" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                      Actioned
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}