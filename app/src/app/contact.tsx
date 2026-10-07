import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Mail, Clock, Send, CheckCircle2, Inbox, CheckCheck,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

function WhatsAppIcon({ size, color }: { size: number; color: string }) {
  return <Mail size={size} color={color} />;
}

const CONTACT_METHODS = [
  {
    icon: WhatsAppIcon,
    color: '#10b981',
    label: 'WhatsApp',
    value: '@Trex_Support1',
    href: 'https://wa.me/Trex_Support1',
    note: 'Fastest response, usually within a few hours',
  },
  {
    icon: Mail,
    color: null,
    label: 'Email',
    value: 'support@trex.app',
    href: 'mailto:support@trex.app',
    note: 'We reply within 1 business day',
  },
];

const TABS = ['overview', 'sent', 'attended'] as const;
const TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  sent: 'Sent',
  attended: 'Attended',
};

export default function Contact() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (tab === 'overview' || !user) return;
    setLoadingRequests(true);
    api.get('/support/mine')
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]))
      .finally(() => setLoadingRequests(false));
  }, [tab, user]);

  const sentRequests = requests.filter((r) => r.status === 'pending');
  const attendedRequests = requests.filter((r) => r.status !== 'pending');

  const handleSubmit = async () => {
    if (!message.trim()) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.account_type !== 'buyer' && !user.personal_email) {
      Toast.show({ type: 'error', text1: 'Add a personal email in your profile first' });
      return;
    }
    setSending(true);
    try {
      await api.post('/support', { message: message.trim() });
      setSent(true);
      setMessage('');
      Toast.show({ type: 'success', text1: "Message sent — we'll get back soon." });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.replace('/profile')} style={{ padding: 6 }}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          Contact Us
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.chipBg,
            padding: 4,
            borderRadius: 12,
            marginBottom: 16,
            alignSelf: 'center',
          }}
        >
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: tab === t ? colors.card : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: tab === t ? colors.brand : colors.textMuted,
                }}
              >
                {TAB_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' && (
          <>
            {CONTACT_METHODS.map((m) => {
              const Icon = m.icon;
              return (
                <Pressable
                  key={m.label}
                  onPress={() => Linking.openURL(m.href)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 16,
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: colors.chipBg,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} color={m.color || colors.brand} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>
                      {m.label}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.brand, fontWeight: '600', marginTop: 2 }}>
                      {m.value}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>
                      {m.note}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                marginTop: 4,
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 10 }}>
                Send us a message
              </Text>

              {sent ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                  <CheckCircle2 size={18} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 13, fontWeight: '600' }}>
                    Message sent — we'll get back soon.
                  </Text>
                </View>
              ) : (
                <>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Tell us what's going on..."
                    placeholderTextColor={colors.textFaint}
                    multiline
                    editable={!sending}
                    style={{
                      minHeight: 100,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      color: colors.text,
                      fontSize: 14,
                      textAlignVertical: 'top',
                    }}
                  />
                  <Pressable
                    onPress={handleSubmit}
                    disabled={sending || !message.trim()}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 12,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: colors.brand,
                      opacity: sending || !message.trim() ? 0.5 : 1,
                    }}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color={colors.textOnGold} />
                    ) : (
                      <Send size={16} color={colors.textOnGold} />
                    )}
                    <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                      {sending ? 'Sending…' : 'Send message'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                padding: 14,
                borderRadius: 14,
                backgroundColor: colors.chipBg,
                marginTop: 12,
              }}
            >
              <Clock size={16} color={colors.textFaint} />
              <Text style={{ flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                Premium members get a reply within 24 hours, Pro within 2 days, and free members within a few days.
              </Text>
            </View>
          </>
        )}

        {tab === 'sent' && (
          <RequestList
            loading={loadingRequests}
            items={sentRequests}
            emptyIcon={Inbox}
            emptyText="No pending requests. Anything you send shows up here until we reply."
            colors={colors}
          />
        )}

        {tab === 'attended' && (
          <RequestList
            loading={loadingRequests}
            items={attendedRequests}
            emptyIcon={CheckCheck}
            emptyText="Nothing attended to yet."
            attended
            colors={colors}
          />
        )}
      </ScrollView>
    </View>
  );
}

function RequestList({ loading, items, emptyIcon: Icon, emptyText, attended, colors }: any) {
  if (loading) {
    return (
      <View style={{ gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: 70, borderRadius: 16, backgroundColor: colors.chipBg }} />
        ))}
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 60 }}>
        <Icon size={28} color={colors.textFaint} />
        <Text style={{ marginTop: 12, color: colors.textFaint, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 }}>
          {emptyText}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {items.map((r: any) => (
        <View
          key={r.id}
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
            {r.message}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>
              {new Date(r.created_at).toLocaleDateString()}
            </Text>
            {attended ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>Attended to</Text>
              </View>
            ) : (
              <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>Pending</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}