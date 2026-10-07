import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Trash2, X } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { SkeletonList, EmptyState, cardStyle } from './shared';

export default function DeletedChatsTab() {
  const colors = useColors();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/deleted-chats')
      .then((res) => setChats(res.data))
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList />;

  if (chats.length === 0) {
    return <EmptyState icon={Trash2} text="No chats have been deleted for everyone yet." />;
  }

  return (
    <View>
      <Text style={{ fontSize: 13, color: colors.textFaint, marginBottom: 10 }}>
        {chats.length} conversation{chats.length === 1 ? '' : 's'} deleted for everyone
      </Text>

      <View style={{ gap: 8 }}>
        {chats.map((c) => (
          <Pressable
            key={c.conversation_id}
            onPress={() => setSelectedChat(c)}
            style={{ ...cardStyle(colors) }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {c.buyer_name} ↔ {c.seller_name}
                </Text>
                {c.product_title && (
                  <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }} numberOfLines={1}>
                    Re: {c.product_title}
                  </Text>
                )}
                <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 4 }} numberOfLines={2}>
                  Deleted by <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{c.deleted_by_name}</Text> ({c.deleted_by_email})
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textFaint, flexShrink: 0 }}>
                {new Date(c.deleted_for_everyone_at).toLocaleString()}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {selectedChat && (
        <DeletedChatDetailModal
          chat={selectedChat}
          onClose={() => setSelectedChat(null)}
        />
      )}
    </View>
  );
}

// ─── DETAIL MODAL ────────────────────────────────────────────────────
function DeletedChatDetailModal({
  chat, onClose,
}: { chat: any; onClose: () => void }) {
  const colors = useColors();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/deleted-chats/${chat.conversation_id}/messages`)
      .then((res) => setMessages(res.data))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [chat.conversation_id]);

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
        onPress={onClose}
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
          maxHeight: 620,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>
              Deleted conversation
            </Text>
            <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }} numberOfLines={2}>
              {chat.buyer_name} ({chat.buyer_email})
            </Text>
            <Text style={{ fontSize: 12, color: colors.textFaint }} numberOfLines={2}>
              ↔ {chat.seller_name} ({chat.seller_email})
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <X size={18} color={colors.textFaint} />
          </Pressable>
        </View>

        <View style={{ backgroundColor: colors.chipBg, borderRadius: 12, padding: 10, marginTop: 10 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            Deleted by{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{chat.deleted_by_name}</Text>
            {' '}on {new Date(chat.deleted_for_everyone_at).toLocaleString()}
          </Text>
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>
          Full message history ({messages.length})
        </Text>

        {loading ? (
          <SkeletonList count={3} />
        ) : messages.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textFaint }}>No messages found.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {messages.map((m) => {
              const isBuyer = m.sender_id === chat.buyer_id;
              return (
                <View
                  key={m.id}
                  style={{
                    backgroundColor: colors.chipBg,
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                      {isBuyer ? chat.buyer_name : chat.seller_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint }}>
                      {new Date(m.created_at).toLocaleString()}
                    </Text>
                  </View>

                  {m.content && (
                    <Text style={{ fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 18 }}>
                      {m.content}
                    </Text>
                  )}

                  {m.media_type === 'image' && m.media_url && (
                    <Image
                      source={{ uri: m.media_url }}
                      style={{ width: 180, height: 180, borderRadius: 10, marginTop: 6 }}
                      contentFit="cover"
                    />
                  )}

                  {m.media_type === 'audio' && m.media_url && (
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 6, fontStyle: 'italic' }}>
                      🎤 Voice note (open in web to play)
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}