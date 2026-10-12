import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, Image, SectionList, FlatList, Dimensions,
  Animated, PanResponder, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, Trash2 } from 'lucide-react-native';
import { Squares2X2Icon as GridOutline, BellIcon as BellOutline } from 'react-native-heroicons/outline';
import { Squares2X2Icon as GridSolid, BellIcon as BellSolid, BellSlashIcon as BellSlashSolid } from 'react-native-heroicons/solid';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '@/context/NotificationContext';
import { useChat } from '@/context/ChatContext';
import { useColors } from '@/hooks/useColors';
import { LOGO_LIGHT } from '@/data/media';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const NOTIF_META: Record<string, { emoji: string; tint: string; title?: string }> = {
  // wishlist / listings (generated in the app)
  price_drop: { emoji: '💰', tint: '#10b981' },
  low_stock: { emoji: '⚡', tint: '#f59e0b' },
  new_listing: { emoji: '🛍️', tint: '#8b5cf6' },
  out_of_stock: { emoji: '📦', tint: '#f43f5e' },
  // orders
  new_order: { emoji: '📦', tint: '#3b82f6', title: 'New order' },
  payment_received_seller: { emoji: '📦', tint: '#10b981', title: 'New order' },
  payment_success_buyer: { emoji: '�', tint: '#10b981', title: 'Payment successful' },
  payment_flagged: { emoji: '🚩', tint: '#f43f5e', title: 'Payment flagged' },
  delivery_marked: { emoji: '✅', tint: '#0ea5e9' },
  order_delivered_buyer: { emoji: '✅', tint: '#10b981', title: 'Order marked as delivered' },
  order_completed_buyer: { emoji: '🎉', tint: '#10b981', title: 'Order completed' },
  order_completed_seller: { emoji: '🎉', tint: '#10b981', title: 'Order completed' },
  order_cancelled_buyer: { emoji: '❌', tint: '#f43f5e', title: 'Order cancelled' },
  order_cancelled_seller: { emoji: '❌', tint: '#f43f5e', title: 'Order cancelled' },
  order_overdue: { emoji: '⏰', tint: '#f59e0b', title: 'Order overdue' },
  order_overdue_seller: { emoji: '⏰', tint: '#f59e0b', title: 'Order overdue' },
  order_reported_buyer: { emoji: '📝', tint: '#f59e0b', title: 'Report received' },
  order_reported_seller: { emoji: '⚠️', tint: '#f43f5e', title: 'Order reported' },
  delivery_reminder: { emoji: '🚚', tint: '#0ea5e9', title: 'Delivery reminder' },
  delivery_reminder_buyer: { emoji: '🚚', tint: '#0ea5e9', title: 'Delivery reminder' },
  // data orders
  new_data_order: { emoji: '�', tint: '#3b82f6', title: 'New data order' },
  data_order_delivered: { emoji: '📶', tint: '#10b981', title: 'Data order delivered' },
  // money
  funds_available: { emoji: '💵', tint: '#10b981', title: 'Funds available' },
  withdrawal_completed: { emoji: '🏦', tint: '#10b981', title: 'Withdrawal completed' },
  withdrawal_failed: { emoji: '🏦', tint: '#f43f5e', title: 'Withdrawal failed' },
  withdrawal_reversed: { emoji: '↩️', tint: '#f59e0b', title: 'Withdrawal reversed' },
  // plans / boosts
  boost_confirmed: { emoji: '🚀', tint: '#f59e0b', title: 'Boost confirmed' },
  boost_ending: { emoji: '⏳', tint: '#f59e0b', title: 'Boost ending soon' },
  subscription_activated: { emoji: '✨', tint: '#a855f7', title: 'Plan activated' },
  // social
  story_like: { emoji: '❤️', tint: '#ec4899', title: 'New like' },
  story_comment: { emoji: '💬', tint: '#8b5cf6', title: 'New comment' },
  follow_post: { emoji: '🔥', tint: '#f59e0b', title: 'New post' },
  follow_listing: { emoji: '🛍️', tint: '#f59e0b', title: 'New listing' },
  saved_search_match: { emoji: '🔎', tint: '#8b5cf6', title: 'Saved search match' },
  story_repost: { emoji: '🔁', tint: '#22c55e', title: 'New repost' },
  comment_like: { emoji: '❤️', tint: '#ec4899', title: 'Comment liked' },
  new_message: { emoji: '💬', tint: '#3b82f6', title: 'New message' },
  donation_received: { emoji: '', tint: '#E6AB2B', title: 'Thank you for your support' },
  default: { emoji: '🔔', tint: '#64748b' },
};

function getNotifRoute(n: any) {
  switch (n.type) {
    case 'order_reported_seller':
    case 'payment_received_seller':
      return {
        pathname: '/dashboard',
        params: { tab: 'deliveries', ...(n.related_id ? { highlightOrder: String(n.related_id) } : {}) },
      };
    case 'order_cancelled_seller':
    case 'payment_flagged':
      return null;
    case 'withdrawal_reversed':
    case 'withdrawal_failed':
    case 'withdrawal_completed':
    case 'funds_available':
      return { pathname: '/dashboard', params: { tab: 'payouts' } };
    case 'order_completed_seller':
      return { pathname: '/dashboard', params: { tab: 'sales' } };
    case 'order_completed_buyer':
      return {
        pathname: '/dashboard',
        params: { tab: 'completed', ...(n.related_id ? { highlightOrder: String(n.related_id) } : {}) },
      };
    case 'delivery_reminder_buyer':
    case 'order_cancelled_buyer':
    case 'order_delivered_buyer':
    case 'payment_success_buyer':
      return {
        pathname: '/dashboard',
        params: { tab: 'orders', ...(n.related_id ? { highlightOrder: String(n.related_id) } : {}) },
      };
    case 'data_order_delivered':
      return { pathname: '/dashboard', params: { tab: 'completed' } };
    case 'new_data_order':
      return { pathname: '/dashboard', params: { tab: 'deliveries' } };
    case 'subscription_activated':
      return '/benefits';
    default:
      return n.link || `/product/${n.productId || n.id}`;
  }
}

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, clearAllNotifications, removeNotification, muted, toggleMute } = useNotifications();
  const { conversations, openConversation } = useChat();
  const swing = useRef(new Animated.Value(0)).current;
  const onToggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (muted) {
      const t = (to: number, d: number) =>
        Animated.timing(swing, { toValue: to, duration: d, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
      swing.setValue(0);
      Animated.sequence([
        t(1, 90), t(-1, 130), t(0.7, 120), t(-0.7, 120), t(0.4, 110), t(-0.4, 110), t(0, 100),
      ]).start();
    }
    toggleMute();
  };
  const swingRotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  // ── Drag-to-dismiss ──────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const DISMISS_THRESHOLD = 120;   // px pulled down before it dismisses
  const DISMISS_VELOCITY = 0.9;    // fast flick also dismisses

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        // only allow downward drag; upward drag is capped with resistance
        const dy = g.dy < 0 ? g.dy * 0.25 : g.dy;
        translateY.setValue(dy);
      },
      onPanResponderRelease: (_e, g) => {
        const shouldDismiss =
          g.dy > DISMISS_THRESHOLD || g.vy > DISMISS_VELOCITY;
        if (shouldDismiss) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onCloseRef.current();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  // reset to "All" every time the panel opens
  useEffect(() => {
    if (visible) {
      setTab('all');
      translateY.setValue(0);
    }
  }, [visible]);

  const visibleNotifs = notifications;

  const unreadCount = visibleNotifs.filter((n: any) => !n.read).length;
  const displayed = tab === 'unread'
    ? visibleNotifs.filter((n: any) => !n.read)
    : visibleNotifs;

  // Split into "New" (unread) and "Earlier" (read) sections
  const sections = useMemo(() => {
    const fresh: any[] = [];
    const earlier: any[] = [];
    displayed.forEach((n) => (n.read ? earlier : fresh).push(n));
    const out: { title: string; data: any[] }[] = [];
    if (fresh.length) out.push({ title: 'New', data: fresh });
    if (earlier.length) out.push({ title: 'Earlier', data: earlier });
    return out;
  }, [displayed]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.overlayLight, justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Animated.View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 6,
            paddingBottom: insets.bottom + 8,
            maxHeight: SCREEN_HEIGHT * 0.82,
            overflow: 'hidden',
            transform: [{ translateY }],
          }}
        >
          {/* drag handle — grab me */}
          <View
            {...pan.panHandlers}
            style={{
              alignSelf: 'stretch',
              alignItems: 'center',
              paddingTop: 10,
              paddingBottom: 16,
            }}
          >
            <View
              style={{
                width: 44, height: 4, borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Notifications
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </Text>
            </View>
            <Pressable onPress={onToggleMute} hitSlop={10}>
              {muted
                ? <BellSlashSolid size={19} color={colors.brand} />
                : (
                  <Animated.View style={{ transform: [{ translateY: -8 }, { rotate: swingRotate }, { translateY: 8 }] }}>
                    <BellOutline size={19} color={colors.textMuted} />
                  </Animated.View>
                )}
            </Pressable>
          </View>

          {/* tabs — same style as stories FeedTabs */}
          <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1, flexDirection: 'row', height: 32 }}>
              {([
                { key: 'all', label: 'All', outline: GridOutline, solid: GridSolid },
                { key: 'unread', label: 'Unread', outline: BellOutline, solid: BellSolid },
              ] as const).map((t) => {
                const active = tab === t.key;
                const Icon = active ? t.solid : t.outline;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingBottom: active ? 10 : 0 }}
                  >
                    <Icon size={active ? 18 : 12} color={active ? colors.brand : colors.textFaint} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontSize: active ? 13 : 10.5, fontWeight: active ? '800' : '500', color: active ? colors.brand : colors.textFaint }}>
                        {t.label}
                      </Text>
                      {t.key === 'unread' && unreadCount > 0 && (
                        <View
                          style={{
                            minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
                            backgroundColor: colors.brand,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textOnGold }}>
                            {unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
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

          {/* actions — top right of body, both tabs */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 20, marginTop: 12 }}>
            {visibleNotifs.length > 0 && (
              <Pressable onPress={clearAllNotifications} hitSlop={10}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Clear all</Text>
              </Pressable>
            )}
          </View>

          {/* body */}
          {displayed.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 }}>
              <View
                style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: colors.chipBg,
                  alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}
              >
                <Bell size={28} color={colors.textFaint} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                {tab === 'unread' ? 'Nothing unread' : 'Nothing yet'}
              </Text>
              <Text
                style={{
                  fontSize: 14, color: colors.textMuted,
                  textAlign: 'center', marginTop: 4, lineHeight: 18,
                }}
              >
                {tab === 'unread' ? "You've seen it all." : 'We check every minute.'}
              </Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(n) => String(n.id)}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
              renderSectionHeader={({ section }) => (
                <View
                  style={{
                    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11, fontWeight: '900',
                      color: colors.textFaint,
                      letterSpacing: 1.2, textTransform: 'uppercase',
                    }}
                  >
                    {section.title}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.borderMuted }} />
                </View>
              )}
              renderItem={({ item: n }) => {
                const meta = NOTIF_META[n.type] || NOTIF_META.default;
                const unread = !n.read;
                return (
                  <Pressable
                    onPress={() => {
                      if (n.type === 'new_message') {
                        const convo = (conversations || []).find((c: any) => String(c.id) === String(n.related_id));
                        removeNotification(n.id);
                        onClose();
                        if (convo) openConversation(convo);
                        else router.push('/chat' as any);
                        return;
                      }
                      const target = getNotifRoute(n);
                      if (!target) return;
                      removeNotification(n.id);
                      onClose();
                      router.push(target as any);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginHorizontal: 16,
                      marginBottom: 8,
                      paddingLeft: 12,
                      paddingRight: 12,
                      paddingVertical: 12,
                      borderRadius: 16,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.borderMuted,
                      overflow: 'hidden',
                    }}
                  >

                    {/* icon tile */}
                    <View
                      style={{
                        width: 44, height: 44, borderRadius: 14,
                        backgroundColor: meta.tint + '26',
                        alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      {n.type === 'donation_received' ? (
                        <Image
                          source={LOGO_LIGHT}
                          style={{ width: '100%', height: '100%', borderRadius: 14 }}
                          contentFit="contain"
                        />
                      ) : (n.type === 'new_message' || n.type === 'story_like' || n.type === 'story_comment' || n.type === 'follow_post' || n.type === 'story_repost' || n.type === 'comment_like' || n.type === 'follow_listing') && n.sender_avatar ? (
                        <Image
                          source={{ uri: n.sender_avatar }}
                          style={{ width: '100%', height: '100%', borderRadius: 14 }}
                        />
                      ) : n.primary_image ? (
                        <Image
                          source={{ uri: n.primary_image }}
                          style={{ width: '100%', height: '100%', borderRadius: 14 }}
                        />
                      ) : (
                        <Text style={{ fontSize: 21 }}>{meta.emoji}</Text>
                      )}
                      {unread && (
                        <View
                          style={{
                            position: 'absolute', top: -2, right: -2,
                            width: 10, height: 10, borderRadius: 5,
                            backgroundColor: colors.brand,
                            borderWidth: 2, borderColor: colors.card,
                          }}
                        />
                      )}
                    </View>

                    {/* text: starts at the very top, level with the tile */}
                    <View style={{ flex: 1, minWidth: 0, marginTop:-4 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 15,
                          lineHeight: 16,
                          includeFontPadding: false,
                          fontWeight: unread ? '800' : '700',
                          color: colors.text,
                        }}
                      >
                        {n.title || meta.title || 'Tre-X'}
                      </Text>
                      {n.message ? (
                        <Text
                          numberOfLines={2}
                          style={{
                            fontSize: 13, color: colors.textMuted,
                            marginTop: 2, lineHeight: 16, includeFontPadding: false,
                          }}
                        >
                          {n.message}
                        </Text>
                      ) : null}
                      {n.created_at ? (
                        <Text
                          style={{
                            fontSize: 11, color: colors.textFaint,
                            marginTop: 4, fontWeight: '600', letterSpacing: 0.2,
                          }}
                        >
                          {formatRelativeTime(n.created_at)}
                        </Text>
                      ) : null}
                    </View>

                    {/* dismiss */}
                    <Pressable
                      onPress={() => removeNotification(n.id)}
                      hitSlop={10}
                      style={{ alignSelf: 'center' }}
                    >
                      <Trash2 size={18} color={colors.textFaint} />
                    </Pressable>
                  </Pressable>
                );
              }}
            />
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}