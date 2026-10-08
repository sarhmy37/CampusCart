import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Search, Send, Users, ShoppingBag, User as UserIcon, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';

type Group = 'all' | 'sellers' | 'buyers';

export default function MessagesTab() {
  const colors = useColors();

  const [mode, setMode] = useState<'group' | 'individual'>('group');
  const [group, setGroup] = useState<Group>('all');
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [allowReplies, setAllowReplies] = useState(false);

  const fetchAccounts = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get('/admin/message/accounts', { params: q ? { q } : {} });
      setAccounts(res.data || []);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load accounts' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchAccounts(search.trim()), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, fetchAccounts]);

  const sendIndividual = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await api.post('/admin/message/individual', {
        userId: selected.id,
        content: draft.trim(),
        allowReplies,
      });
      Toast.show({ type: 'success', text1: `Sent to ${selected.name}` });
      setDraft('');
      setSelected(null);
      setAllowReplies(false);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err.response?.data?.error || 'Failed to send',
      });
    } finally {
      setSending(false);
    }
  };

  const sendGroup = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/admin/message/group', {
        group,
        content: draft.trim(),
      });
      Toast.show({
        type: 'success',
        text1: `Sent to ${res.data.sent} of ${res.data.total}`,
      });
      setDraft('');
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err.response?.data?.error || 'Failed to send',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {/* Tre-X header preview */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Image
          source={{
            uri: 'https://cdn.sanity.io/images/aypd5e7o/production/d7ca1ef11350ce1f20f723c6890094ae3514861f-1254x1254.png',
          }}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
            Send as Tre-X
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            Messages appear from the official Tre-X account
          </Text>
        </View>
      </View>

      {/* Mode toggle: individual vs group */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => { setMode('group'); setSelected(null); }}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: mode === 'group' ? colors.brandSoft : colors.card,
            borderWidth: 1,
            borderColor: mode === 'group' ? colors.brand : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: mode === 'group' ? colors.brand : colors.textMuted,
            }}
          >
            Group broadcast
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('individual')}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: mode === 'individual' ? colors.brandSoft : colors.card,
            borderWidth: 1,
            borderColor: mode === 'individual' ? colors.brand : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: mode === 'individual' ? colors.brand : colors.textMuted,
            }}
          >
            Individual {selected ? `· ${selected.name}` : ''}
          </Text>
        </Pressable>
      </View>

      {/* GROUP MODE */}
      {mode === 'group' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                { key: 'all', label: 'Everyone', icon: Users },
                { key: 'sellers', label: 'Sellers', icon: ShoppingBag },
                { key: 'buyers', label: 'Buyers', icon: UserIcon },
              ] as const
            ).map((g) => {
              const active = group === g.key;
              const Icon = g.icon;
              return (
                <Pressable
                  key={g.key}
                  onPress={() => setGroup(g.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: active ? colors.brandSoft : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                  }}
                >
                  <Icon size={18} color={active ? colors.brand : colors.textMuted} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? colors.brand : colors.textMuted,
                    }}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Composer
            draft={draft}
            setDraft={setDraft}
            colors={colors}
            sending={sending}
            onSend={sendGroup}
            placeholder={`Message to ${group === 'all' ? 'everyone' : group}…`}
          />
        </>
      )}

      {/* INDIVIDUAL MODE */}
      {mode === 'individual' && selected ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.chipBg,
            }}
          >
            {selected.avatar_url ? (
              <Image
                source={{ uri: selected.avatar_url }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '700', color: colors.brand }}>
                  {selected.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {selected.name}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                {selected.account_type === 'seller' ? 'Seller' : 'Buyer'} · {selected.university_email}
              </Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={8}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => setAllowReplies((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: allowReplies ? colors.brand : colors.border,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: allowReplies ? colors.brand : colors.textMuted,
                backgroundColor: allowReplies ? colors.brand : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {allowReplies && (
                <Text style={{ color: colors.textOnGold, fontSize: 13, fontWeight: '900', lineHeight: 15 }}>
                  ✓
                </Text>
              )}
            </View>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>
              Allow this user to reply
            </Text>
          </Pressable>

          <Composer
            draft={draft}
            setDraft={setDraft}
            colors={colors}
            sending={sending}
            onSend={sendIndividual}
            placeholder={`Message ${selected.name}…`}
          />
        </>
      ) : null}

      {/* ACCOUNT PICKER (individual mode, no selection yet) */}
      {mode === 'individual' && !selected && (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.chipBg,
            }}
          >
            <Search size={16} color={colors.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Find a specific account…"
              placeholderTextColor={colors.textFaint}
              style={{ flex: 1, paddingVertical: 11, color: colors.text, fontSize: 14 }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 12 }} />
          ) : accounts.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
              {search ? `No results for "${search}"` : 'No accounts'}
            </Text>
          ) : (
            accounts.map((acct) => (
              <Pressable
                key={acct.id}
                onPress={() => setSelected(acct)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {acct.avatar_url ? (
                  <Image
                    source={{ uri: acct.avatar_url }}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.brandSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: colors.brand }}>
                      {acct.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {acct.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    {acct.account_type === 'seller' ? 'Seller' : 'Buyer'} · {acct.university_email}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </>
      )}
    </View>
  );
}

function Composer({
  draft, setDraft, colors, sending, onSend, placeholder,
}: {
  draft: string;
  setDraft: (v: string) => void;
  colors: any;
  sending: boolean;
  onSend: () => void;
  placeholder: string;
}) {
  const disabled = sending || !draft.trim();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline
        editable={!sending}
        style={{
          minHeight: 100,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.chipBg,
          color: colors.text,
          fontSize: 14,
          textAlignVertical: 'top',
        }}
      />
      <Pressable
        onPress={onSend}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: disabled ? colors.border : colors.brand,
        }}
      >
        {sending ? (
          <ActivityIndicator color={colors.textOnGold} size="small" />
        ) : (
          <>
            <Send size={16} color={colors.textOnGold} />
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
              Send
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}