import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Modal, Pressable, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Trash2 } from 'lucide-react-native';
import { useNotifications } from '@/context/NotificationContext';
import { useColors } from '@/hooks/useColors';

const NOTIF_META: Record<string, { emoji: string }> = {
  price_drop: { emoji: '💰' },
  low_stock: { emoji: '⚡' },
  new_listing: { emoji: '🛍️' },
  out_of_stock: { emoji: '📦' },
  delivery_reminder: { emoji: '🚚' },
  payment_received_seller: { emoji: '📦' },
  order_delivered_buyer: { emoji: '✅' },
  new_order: { emoji: '📦' },
  delivery_marked: { emoji: '✅' },
  story_like: { emoji: '❤️' },
  story_comment: { emoji: '💬' },
  default: { emoji: '🔔' },
};

// These disappear from the panel 30 minutes after the user has seen them.
const EXPIRE_AFTER_SEEN_MS = 30 * 60 * 1000;
const SEEN_KEY = 'notif_seen_at_v1';
// module-level cache, also saved to storage so it survives app restarts
const seenAtById: Record<string, number> = {};
let loadedSeen = false;

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotificationsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { notifications, clearAllNotifications, removeNotification } = useNotifications();

  const [ready, setReady] = useState(loadedSeen);

  // load the saved record once
  useEffect(() => {
    if (loadedSeen) return;
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => { if (raw) Object.assign(seenAtById, JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => { loadedSeen = true; setReady(true); });
  }, []);

  // the 30 minute clock starts the moment these are on screen
  useEffect(() => {
    if (!visible || !ready) return;
    const stamp = Date.now();
    let changed = false;
    notifications.forEach((n: any) => {
      const key = String(n.id);
      if (!seenAtById[key]) {
        seenAtById[key] = stamp;
        changed = true;
      }
    });
    // forget records for notifications that no longer exist (deleted / cleared)
    if (notifications.length > 0) {
      const present = new Set(notifications.map((n: any) => String(n.id)));
      Object.keys(seenAtById).forEach((k) => {
        if (!present.has(k)) {
          delete seenAtById[k];
          changed = true;
        }
      });
    }
    if (changed) AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seenAtById)).catch(() => {});
  }, [visible, ready, notifications]);

  const now = Date.now();
  const shown = notifications.filter((n: any) => {
    if (!ready) return false; // wait for the saved record so expired ones don't flash
    const seenAt = seenAtById[String(n.id)];
    return !seenAt || now - seenAt < EXPIRE_AFTER_SEEN_MS;
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight }} onPress={onClose}>
        <View
          style={{
            position: 'absolute',
            top: 90,
            left: 12,
            right: 12,
            maxHeight: 420,
            backgroundColor: colors.card,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderMuted }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Notifications</Text>
          </View>

          {shown.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, paddingVertical: 32, textAlign: 'center', fontSize: 14, color: colors.textFaint }}>
              Nothing yet. We check every minute.
            </Text>
          ) : (
            <FlatList
              data={shown}
              keyExtractor={(n) => String(n.id)}
              renderItem={({ item: n }) => {
                const meta = NOTIF_META[n.type] || NOTIF_META.default;
                return (
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(n.link || `/product/${n.productId || n.id}`);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderMuted,
                      backgroundColor: n.read ? colors.card : colors.brandSoft,
                    }}
                  >
                    {n.primary_image ? (
                      <Image source={{ uri: n.primary_image }} style={{ width: 40, height: 40, borderRadius: 12 }} />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{n.title}</Text>
                      {n.message ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{n.message}</Text>
                      ) : null}
                      {n.created_at ? (
                        <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>{formatRelativeTime(n.created_at)}</Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => removeNotification(n.id)} style={{ padding: 4 }}>
                      <Trash2 size={16} color={colors.textFaint} />
                    </Pressable>
                  </Pressable>
                );
              }}
            />
          )}

          {shown.length > 0 && (
            <Pressable
              onPress={clearAllNotifications}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderMuted }}
            >
              <Text style={{ fontSize: 12, color: colors.textFaint, fontWeight: '600', textAlign: 'center' }}>Clear all</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}