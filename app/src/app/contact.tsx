import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import {
  ArrowLeft, Mail, Clock, Send, CheckCircle2, Inbox, CheckCheck, MessageCircle, LayoutDashboard,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

function WhatsAppIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </Svg>
  );
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
  {
    icon: MessageCircle,
    color: null,
    label: 'In-app support',
    value: 'Message us here',
    href: null,
    note: 'Send a message and track replies in the Sent and Attended tabs',
  },
];

const TABS = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'sent', label: 'Sent', Icon: Send },
  { key: 'attended', label: 'Attended', Icon: CheckCheck },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function Contact() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        }}
      >
        <Pressable onPress={() => router.replace('/profile')} style={{ padding: 6 }}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
          Contact Us
        </Text>
      </View>

      {/* Tabs — same look as the Feed tabs */}
      <View
        style={{
          paddingTop: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', height: 32 }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={{
                  flex: 1, alignItems: 'center', justifyContent: 'center',
                  gap: 2, paddingBottom: active ? 10 : 0,
                }}
              >
                <Icon
                  size={active ? 18 : 12}
                  color={active ? colors.brand : colors.textFaint}
                  strokeWidth={active ? 2.4 : 2}
                />
                <Text
                  style={{
                    fontSize: active ? 13 : 10.5,
                    fontWeight: active ? '800' : '500',
                    color: active ? colors.brand : colors.textFaint,
                  }}
                >
                  {label}
                </Text>
                {active && (
                  <View
                    style={{
                      position: 'absolute', bottom: -1, alignSelf: 'center',
                      height: 3, width: 30, borderRadius: 999, backgroundColor: colors.brand,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <Pressable onPress={Keyboard.dismiss} style={{ minHeight: 400 }}>
        {tab === 'overview' && (
          <>
            {CONTACT_METHODS.map((m) => {
              const Icon = m.icon;
              return (
                <Pressable
                  key={m.label}
                  onPress={() => (m.href ? Linking.openURL(m.href) : setShowSupport((v) => !v))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingHorizontal: 16, 
                    paddingVertical: 14,
                    backgroundColor: colors.card,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                > 
                  <View
                    style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: colors.chipBg,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} color={m.color || colors.brand} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: 16 }}>
                      {m.label}
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.brand, fontWeight: '600', marginTop: 2 }}>
                      {m.value}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                      {m.note}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {showSupport && (
            <View
              style={{
                backgroundColor: colors.card,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 10 }}>
                Send us a message
              </Text>

              {sent ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                  <CheckCircle2 size={18} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 15, fontWeight: '600' }}>
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
                      fontSize: 16,
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
                    <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 16 }}>
                      {sending ? 'Sending…' : 'Send message'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Clock size={16} color={colors.textFaint} />
              <Text style={{ flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 18 }}>
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
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RequestList({ loading, items, emptyIcon: Icon, emptyText, attended, colors }: any) {
  if (loading) {
    return (
      <View>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ height: 76, backgroundColor: colors.chipBg, borderBottomWidth: 1, borderBottomColor: colors.border }}
          />
        ))}
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 60 }}>
        <Icon size={28} color={colors.textFaint} />
        <Text style={{ marginTop: 12, color: colors.textFaint, fontSize: 15, textAlign: 'center', paddingHorizontal: 20 }}>
          {emptyText}
        </Text>
      </View>
    );
  }
  return (
    <View>
      {items.map((r: any) => (
        <View
          key={r.id}
          style={{
            backgroundColor: colors.card,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 19 }} numberOfLines={3}>
            {r.message}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: colors.textFaint, fontSize: 13 }}>
              {new Date(r.created_at).toLocaleDateString()}
            </Text>
            {attended ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 13, fontWeight: '700' }}>Attended to</Text>
              </View>
            ) : (
              <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '700' }}>Pending</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}