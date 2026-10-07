import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { MessageCircle, Send, X, Star, Sparkles } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { Tag, SkeletonList, EmptyState, cardStyle } from './shared';

const STATUS_FILTERS = ['pending', 'resolved'] as const;

export default function SupportTab() {
  const colors = useColors();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved'>('pending');
  const [replyTarget, setReplyTarget] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/support')
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = requests.filter((r) => r.status === statusFilter);

  const planBadge = (r: any) => {
    const active = r.plan && r.plan !== 'free' && r.plan_expires_at && new Date(r.plan_expires_at) > new Date();
    if (!active) return null;
    if (r.plan === 'premium') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(168,85,247,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Sparkles size={9} color="#a855f7" />
          <Text style={{ fontSize: 100, fontWeight: '700', color: '#a855f7' }}>PREMIUM</Text>
        </View>
      );
    }
    if (r.plan === 'pro') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Star size={9} color="#3b82f6" />
          <Text style={{ fontSize: 100, fontWeight: '700', color: '#3b82f6' }}>PRO</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View>
      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, justifyContent: 'center' }}>
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
      </View>

      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageCircle} text={`No ${statusFilter} support requests.`} />
      ) : (
        <View style={{ gap: 8 }}>
          {filtered.map((r) => (
            <View key={r.id} style={cardStyle(colors)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{r.user_name}</Text>
                {planBadge(r)}
              </View>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>{r.user_email}</Text>

              <View style={{ backgroundColor: colors.chipBg, borderRadius: 10, padding: 10, marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                  {r.message}
                </Text>
              </View>

              <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 6 }}>
                {new Date(r.created_at).toLocaleString()}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                {r.status === 'pending' ? (
                  <Pressable
                    onPress={() => setReplyTarget(r)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: colors.brand,
                    }}
                  >
                    <Send size={13} color={colors.textOnGold} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>
                      Reply
                    </Text>
                  </Pressable>
                ) : (
                  <Tag color="emerald">Resolved</Tag>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {replyTarget && (
        <ReplyModal
          request={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSuccess={() => { setReplyTarget(null); load(); }}
        />
      )}
    </View>
  );
}

// ─── REPLY MODAL ─────────────────────────────────────────────────────
function ReplyModal({
  request, onClose, onSuccess,
}: { request: any; onClose: () => void; onSuccess: () => void }) {
  const colors = useColors();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/admin/support/${request.id}/reply`, { reply: reply.trim() });
      Toast.show({ type: 'success', text1: 'Reply sent' });
      onSuccess();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to send reply' });
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        marginHorizontal: -16,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        onPress={() => !sending && onClose()}
        style={{
          position: 'fixed' as any,
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          zIndex: 99,
        }}
      />
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 100,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, flex: 1 }}>
            Reply to {request.user_name}
          </Text>
          <Pressable onPress={onClose} style={{ padding: 6 }} disabled={sending}>
            <X size={18} color={colors.textFaint} />
          </Pressable>
        </View>

        <View style={{ backgroundColor: colors.chipBg, borderRadius: 10, padding: 10, marginTop: 10 }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            {request.message}
          </Text>
        </View>

        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder="Type your reply…"
          placeholderTextColor={colors.textFaint}
          multiline
          editable={!sending}
          style={{
            marginTop: 14,
            minHeight: 100,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
            color: colors.text,
            fontSize: 15,
            textAlignVertical: 'top',
          }}
        />

        <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 6 }}>
          This will be emailed to the user and mark the request as resolved.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Pressable
            onPress={onClose}
            disabled={sending}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSend}
            disabled={sending || !reply.trim()}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.brand,
              alignItems: 'center',
              opacity: sending || !reply.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textOnGold }}>
              {sending ? 'Sending…' : 'Send reply'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}