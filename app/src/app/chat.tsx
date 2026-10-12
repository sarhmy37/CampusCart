import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import StoryViewer from '@/components/StoryViewer';
import StoryRing from '@/components/StoryRing';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { parseWallpaper } from '@/data/wallpapers';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, ArrowLeft, X, BellOff, Star, Sparkles } from 'lucide-react-native';
import {
  InboxIcon as InboxOutline,
  EnvelopeIcon as EnvelopeOutline,
  ShoppingBagIcon as BagOutline,
  TagIcon as TagOutline,
  BellSlashIcon as BellSlashOutline,
  FlagIcon as FlagOutline,
} from 'react-native-heroicons/outline';
import {
  InboxIcon as InboxSolid,
  EnvelopeIcon as EnvelopeSolid,
  ShoppingBagIcon as BagSolid,
  TagIcon as TagSolid,
  BellSlashIcon as BellSlashSolid,
  FlagIcon as FlagSolid,
} from 'react-native-heroicons/solid';
import api from '@/api/client';
import { useChat } from '@/context/ChatContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { SCREEN_PADDING_X } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const GREETINGS: { start: number; end: number; options: string[] }[] = [
  { start: 5, end: 12, options: ['Good morning', 'Rise and shine', 'Morning, champ', 'Fresh day, fresh chats'] },
  { start: 12, end: 17, options: ['Good afternoon', 'Hey there', 'Afternoon vibes', 'Hope your day is smooth'] },
  { start: 17, end: 22, options: ['Good evening', 'Evening vibes', 'Winding down?', 'Hope your day went well'] },
  { start: 22, end: 24, options: ['Late night chats', 'Night owl', 'Still up? Same here'] },
  { start: 0, end: 5, options: ['Night owl', 'Up late, huh?', 'The quiet hours'] },
];

const SUBTITLES = [
  'Your conversations with buyers and sellers.',
  "Catch up on what's happening.",
  'Every great deal starts with a hello.',
  'Reply fast, close faster.',
  "Let's see who's been talking to you.",
  'Good deals are just a message away.',
  'Keep the conversation going.',
];

function getSubtitle() {
  return SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)];
}

function getGreeting() {
  const hour = new Date().getHours();
  const bucket = GREETINGS.find((g) => hour >= g.start && hour < g.end);
  const options = bucket?.options || ['Hey'];
  return options[Math.floor(Math.random() * options.length)];
}

// Compact chat-style timestamps: 12:45 / Yesterday / Mon / 3 Sep
function formatChatTime(dateString?: string | null) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);

  if (dayDiff <= 0) {
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function formatPresence(lastActiveAt?: string | null) {
  if (!lastActiveAt) return '';
  const diffMin = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 60000);
  if (diffMin < 2) return 'Active now';
  if (diffMin < 60) return `Last active ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Last active ${diffHr}h ago`;
  return `Last active ${Math.floor(diffHr / 24)}d ago`;
}

function BubbleTail({ isMine, color }: { isMine: boolean; color: string }) {
  return (
    <Svg
      width={8}
      height={10}
      viewBox="0 0 8 10"
      style={{
        position: 'absolute',
        bottom: 0,
        ...(isMine ? { right: -6 } : { left: -6, transform: [{ scaleX: -1 }] }),
      }}
    >
      <Path d="M0 0 L0 10 L8 10 C4 9 1 6 0 0 Z" fill={color} />
    </Svg>
  );
}

type Filter = 'all' | 'unread' | 'buying' | 'selling' | 'muted' | 'reports';

const REPORT_REASONS: Record<string, string> = {
  scam: 'Scam or fraud',
  fake_listing: 'Fake or misleading listing',
  inappropriate: 'Inappropriate content',
  harassment: 'Harassment or unsafe behavior',
  other: 'Something else',
};

function PlanBadge({ plan, expiresAt }: { plan?: string | null; expiresAt?: string | null; colors?: any }) {
  const active = plan && plan !== 'free' && expiresAt && new Date(expiresAt) > new Date();
  if (!active) return null;
  const tier = plan.toLowerCase();
  if (tier === 'premium') return <Sparkles size={15} color="#a855f7" fill="#a855f7" />;
  if (tier === 'pro') return <Star size={15} color="#3b82f6" fill="#3b82f6" />;
  return null;
}

function Avatar({ convo, size, colors, storyGroup, onPressStory }: any) {
  const flags: boolean[] | null = storyGroup ? storyGroup.stories.map((s: any) => !!s.viewed) : null;
  const inner = flags ? size - (flags.every(Boolean) ? 8 : 9) : size;
  const face = convo.other_user_avatar ? (
    <Image
      source={{ uri: convo.other_user_avatar }}
      style={{ width: inner, height: inner, borderRadius: inner / 2 }}
      contentFit="cover"
    />
  ) : (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: inner * 0.4, fontWeight: '700', color: colors.brand }}>
        {convo.other_user_name?.[0]?.toUpperCase() || '?'}
      </Text>
    </View>
  );
  if (!flags) return face;
  return (
    <Pressable onPress={onPressStory} hitSlop={4}>
      <StoryRing size={size} flags={flags} dimColor={colors.border}>{face}</StoryRing>
    </Pressable>
  );
}

export default function Messages() {
  const router = useRouter();
const { conversations, openConversation, unreadCount, isMuted, openChat, sendQuickMessage } = useChat() as any;
  const colors = useColors();

  const { theme } = useTheme();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [previewConvo, setPreviewConvo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const headerBg = theme === 'dark' ? colors.card : colors.background;
  const bodyBg = theme === 'dark' ? colors.background : colors.card;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const all = useMemo(() => conversations || [], [conversations]);

  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
const [storyMap, setStoryMap] = useState<Record<string, any>>({});

useFocusEffect(
  useCallback(() => {
    api.get('/stories/feed')
      .then((res) => {
        const map: Record<string, any> = {};
        (res.data || []).forEach((g: any) => { map[String(g.user_id)] = g; });
        setStoryMap(map);
      })
      .catch(() => {});
  }, [])
);

const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
const [activeStoryIndex, setActiveStoryIndex] = useState(0);
const [mediaReady, setMediaReady] = useState(false);
const durationsRef = useRef<Record<string, number>>({});
const loadedRef = useRef<Set<string>>(new Set());
const storyGroups = useMemo(() => Object.values(storyMap), [storyMap]);

const goToStory = (gi: number, si: number) => {
  const s = storyGroups[gi]?.stories[si];
  if (s && s.media_type !== 'video') durationsRef.current[s.id] = 6000;
  setActiveGroupIndex(gi);
  setActiveStoryIndex(si);
  setMediaReady(!!s && s.media_type !== 'video' && loadedRef.current.has(s.id));
};

const advanceStory = () => {
  if (activeGroupIndex === null) return;
  const g = storyGroups[activeGroupIndex];
  if (activeStoryIndex < g.stories.length - 1) goToStory(activeGroupIndex, activeStoryIndex + 1);
  else if (activeGroupIndex < storyGroups.length - 1) goToStory(activeGroupIndex + 1, 0);
  else { setActiveGroupIndex(null); setActiveStoryIndex(0); }
};

const goBack = () => {
  if (activeGroupIndex === null) return;
  if (activeStoryIndex > 0) goToStory(activeGroupIndex, activeStoryIndex - 1);
  else if (activeGroupIndex > 0) {
    const pg = storyGroups[activeGroupIndex - 1];
    goToStory(activeGroupIndex - 1, pg.stories.length - 1);
  }
};

const markViewed = (s: any) => {
  if (s.viewed || String(s.user_id) === String(user?.id)) return;
  api.post(`/stories/${s.id}/view`).catch(() => {});
  setStoryMap((prev) => {
    const g = prev[String(s.user_id)];
    if (!g) return prev;
    const stories = g.stories.map((x: any) => (x.id === s.id ? { ...x, viewed: true } : x));
    return { ...prev, [String(s.user_id)]: { ...g, stories, allViewed: stories.every((x: any) => x.viewed) } };
  });
};

  useEffect(() => {
    if (filter !== 'reports') return;
    setReportsLoading(true);
    api.get('/reports/mine')
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setReportsLoading(false));
  }, [filter]);

  const chatReports = useMemo(() => {
    let list = reports.filter(
      (r: any) => r.reported_user_id && !r.product_id && String(r.reported_user_id) !== String(r.reporter_id)
    );
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r: any) => (r.reported_user_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [reports, search]);

  const counts = useMemo(
    () => ({
      unread: all.filter((c: any) => c.unread_count > 0 && !isMuted(c.id)).length,
      muted: all.filter((c: any) => isMuted(c.id)).length,
    }),
    [all, isMuted]
  );

  const filtered = useMemo(() => {
    let list = all;
    if (filter === 'unread') list = list.filter((c: any) => c.unread_count > 0 && !isMuted(c.id));
    if (filter === 'buying') list = list.filter((c: any) => c.my_role === 'buying');
    if (filter === 'selling') list = list.filter((c: any) => c.my_role === 'selling');
    if (filter === 'muted') list = list.filter((c: any) => isMuted(c.id));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((cv: any) => (cv.other_user_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [all, filter, search, isMuted]);

  const handleOpenChat = (convo: any) => {
    openConversation(convo);
  };

  const [previewMessages, setPreviewMessages] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLastActive, setPreviewLastActive] = useState<string | null>(null);
  const [previewWallpaper, setPreviewWallpaper] = useState<any>(null);
  const pvParsed = parseWallpaper(previewWallpaper);
  const pvBg =
    pvParsed.kind === 'none'
      ? { backgroundColor: '#EFEAFB' }
      : pvParsed.kind === 'color'
      ? { backgroundColor: pvParsed.color }
      : { backgroundColor: colors.background };

  const openPreview = async (convo: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPreviewConvo(convo);
    setPreviewMessages([]);
    setPreviewLastActive(null);
    setPreviewWallpaper(null);
    setPreviewLoading(true);
    api.get(`/chat/presence/${convo.other_user_id}`)
      .then((r) => setPreviewLastActive(r.data.last_active_at))
      .catch(() => {});
    api.get(`/chat/${convo.id}/wallpaper`)
      .then((r) => setPreviewWallpaper(r.data || { type: 'none', value: null }))
      .catch(() => setPreviewWallpaper({ type: 'none', value: null }));
    try {
      const res = await api.get(`/chat/${convo.id}/messages`);
      setPreviewMessages((res.data || []).slice(-6));
    } catch {
      setPreviewMessages([]);
    } finally {
      setPreviewLoading(false);
    }
  };

const openStory = (g: any) => {
  const gi = storyGroups.findIndex((x: any) => String(x.user_id) === String(g.user_id));
  if (gi === -1) return;
  const si = Math.max(0, g.stories.findIndex((x: any) => !x.viewed));
  goToStory(gi, si);
};

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const chips: { key: Filter; label: string; outline: any; solid: any; count?: number }[] = [
    { key: 'all', label: 'All', outline: InboxOutline, solid: InboxSolid },
    { key: 'unread', label: 'Unread', outline: EnvelopeOutline, solid: EnvelopeSolid, count: counts.unread },
    { key: 'buying', label: 'Buying', outline: BagOutline, solid: BagSolid },
    { key: 'selling', label: 'Selling', outline: TagOutline, solid: TagSolid },
    { key: 'muted', label: 'Muted', outline: BellSlashOutline, solid: BellSlashSolid },
    { key: 'reports', label: 'Reports', outline: FlagOutline, solid: FlagSolid },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bodyBg }} edges={[]}>
      {/* Header */}
      <View style={{ paddingHorizontal: SCREEN_PADDING_X, paddingTop: 10, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -4, padding: 4 }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 24, fontWeight: '700', color: colors.text }}>
            Messages
          </Text>
          {unreadCount > 0 && (
            <Text style={{ fontSize: 15, color: colors.brand, fontWeight: '600' }}>
              {unreadCount} unread
            </Text>
          )}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: headerBg,
          }}
        >
          <Search size={16} color={colors.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, paddingVertical: 11, color: colors.text, fontSize: 16 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginTop: 6,
          paddingHorizontal: 6,
        }}
      >
        {chips.map((chip) => {
          const active = filter === chip.key;
          const Icon = active ? chip.solid : chip.outline;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingTop: 12,
                paddingBottom: 11,
                borderBottomWidth: 3,
                borderBottomColor: active ? colors.brand : 'transparent',
                marginBottom: -1,
              }}
            >
              <View>
                <Icon size={16} color={active ? colors.brand : colors.textFaint} />
                {!!chip.count && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -8,
                      minWidth: 14,
                      height: 14,
                      paddingHorizontal: 3,
                      borderRadius: 7,
                      backgroundColor: colors.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1a1a1a' }}>
                      {chip.count > 9 ? '9+' : chip.count}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: active ? '800' : '500',
                  color: active ? colors.text : colors.textMuted,
                }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={filter === 'reports' ? chatReports : filtered}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 120, paddingTop: 4 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: 'center' }}>
              {search
                ? `No results for "${search}"`
                : filter === 'unread'
                ? 'No unread messages'
                : filter === 'buying'
                ? 'No buying chats'
                : filter === 'selling'
                ? 'No selling chats'
                : filter === 'reports'
                ? reportsLoading
                  ? 'Loading…'
                  : "You haven't reported anyone"
                : filter === 'muted'
                ? 'No muted chats'
                : 'No messages yet'}
            </Text>
          </View>
        }
        renderItem={({ item: convo }: any) => {
          if (filter === 'reports') {
            const pending = (convo.status || 'pending') === 'pending';
            return (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
                    {convo.reported_user_name || 'Unknown user'}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: pending ? colors.warning : colors.success }}>
                      {pending ? 'Pending' : 'Completed'}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>
                      {new Date(convo.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 3 }}>
                  {REPORT_REASONS[convo.reason] || convo.reason}
                </Text>
                {!!convo.details && (
                  <Text numberOfLines={2} style={{ fontSize: 14, color: colors.textFaint, marginTop: 3 }}>
                    {convo.details}
                  </Text>
                )}
              </View>
            );
          }
          const muted = isMuted(convo.id);
          const unread = convo.unread_count > 0 && !muted;
          return (
            <Pressable
              onPress={() => handleOpenChat(convo)}
              onLongPress={() => openPreview(convo)}
              delayLongPress={200}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingHorizontal: 12,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: unread ? headerBg : 'transparent',
              }}
            >
              {/* Unread accent bar */}
              {unread && (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 18,
                    bottom: 18,
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: colors.brand,
                  }}
                />
              )}

<Avatar
  convo={convo}
  size={52}
  colors={colors}
  storyGroup={storyMap[String(convo.other_user_id)]}
  onPressStory={() => openStory(storyMap[String(convo.other_user_id)])}
/>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontSize: 17,
                        fontWeight: unread ? '800' : '600',
                        color: colors.text,
                      }}
                    >
                      {convo.other_user_name}
                    </Text>
                    <PlanBadge
                      plan={convo.other_user_plan}
                      expiresAt={convo.other_user_plan_expires_at}
                      colors={colors}
                    />
                  </View>
                  {!!convo.last_message_at && (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: unread ? '700' : '500',
                        color: unread ? colors.brand : colors.textFaint,
                      }}
                    >
                      {formatChatTime(convo.last_message_at)}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginTop: 3,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: unread ? '600' : '400',
                      color: unread ? colors.text : colors.textMuted,
                    }}
                  >
                    {convo.last_message
                      ? (convo.last_message_sender_id === user?.id ? 'You: ' : '') + convo.last_message
                      : 'Say hello 👋'}
                  </Text>

                  {muted ? (
                    <BellOff size={14} color={colors.textFaint} />
                  ) : unread ? (
                    <View
                      style={{
                        backgroundColor: colors.brand,
                        minWidth: 20,
                        height: 20,
                        paddingHorizontal: 6,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#1a1a1a', fontSize: 13, fontWeight: '700' }}>
                        {convo.unread_count > 9 ? '9+' : convo.unread_count}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      <Modal
        visible={!!previewConvo}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewConvo(null)}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => setPreviewConvo(null)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
          />
          {previewConvo && (
            <Pressable
              onPress={() => {
                const c = previewConvo;
                setPreviewConvo(null);
                handleOpenChat(c);
              }}
              style={{
                width: '100%',
                maxWidth: 380,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: colors.card,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderMuted,
                }}
              >
                {previewConvo.other_user_avatar ? (
                  <Image
                    source={{ uri: previewConvo.other_user_avatar }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '700', color: colors.brand, fontSize: 16 }}>
                      {previewConvo.other_user_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontWeight: '700', color: colors.text, fontSize: 16 }}>
                      {previewConvo.other_user_name}
                    </Text>
                    <PlanBadge
                      plan={previewConvo.other_user_plan}
                      expiresAt={previewConvo.other_user_plan_expires_at}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                    {formatPresence(previewLastActive) === 'Active now' && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
                    )}
                    <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>
                      {formatPresence(previewLastActive)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Latest 6 messages */}
              <View style={[{ padding: 14, minHeight: 120 }, pvBg]}>
                {pvParsed.kind === 'gradient' && (
                  <LinearGradient
                    colors={pvParsed.colors as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                )}
                {pvParsed.kind === 'image' && (
                  <Image
                    source={{ uri: pvParsed.uri }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    contentFit="cover"
                  />
                )}
                {previewLoading ? (
                  <ActivityIndicator color={colors.brand} style={{ marginVertical: 30 }} />
                ) : previewMessages.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: colors.textFaint, fontSize: 15, marginVertical: 30 }}>
                    No messages yet
                  </Text>
                ) : (
                  previewMessages.map((m: any) => {
                    const isMine = m.sender_id === user?.id;
                    const label = m.deleted_for_everyone
                      ? 'This message was deleted'
                      : m.content
                      ? m.content
                      : m.media_type === 'image'
                      ? '📷 Photo'
                      : m.media_type === 'video'
                      ? '🎥 Video'
                      : m.media_type === 'audio'
                      ? '🎤 Voice note'
                      : m.media_type === 'file'
                      ? '📎 File'
                      : '';
                    return (
                      <View key={m.id} style={{ alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 6, paddingHorizontal: 6 }}>
                        <View
                          style={{
                            maxWidth: '80%',
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 14,
                            borderBottomRightRadius: isMine ? 4 : 14,
                            borderBottomLeftRadius: isMine ? 14 : 4,
                            backgroundColor: isMine ? colors.brand : colors.chipBg,
                          }}
                        >
                          <BubbleTail isMine={isMine} color={isMine ? colors.brand : colors.chipBg} />
                          <Text
                            numberOfLines={3}
                            style={{
                              fontSize: 15,
                              fontStyle: m.deleted_for_everyone ? 'italic' : 'normal',
                              color: isMine ? colors.textOnGold : colors.text,
                            }}
                          >
                            {label}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </Pressable>
          )}
        </View>
      </Modal>

      <Modal
        visible={activeGroupIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveGroupIndex(null)}
      >
        {activeGroupIndex !== null && storyGroups[activeGroupIndex] && (
          <StoryViewer
            group={storyGroups[activeGroupIndex]}
            story={storyGroups[activeGroupIndex].stories[activeStoryIndex]}
            durationMs={durationsRef.current[storyGroups[activeGroupIndex].stories[activeStoryIndex].id] ?? 6000}
            mediaReady={mediaReady}
            onMediaReady={(durationMs?: number) => {
              const s = storyGroups[activeGroupIndex]?.stories[activeStoryIndex];
              if (s) {
                markViewed(s);
                loadedRef.current.add(s.id);
                if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
                  durationsRef.current[s.id] = Math.min(durationMs, 60000);
                } else if (!durationsRef.current[s.id]) {
                  durationsRef.current[s.id] = 6000;
                }
              }
              setMediaReady(true);
            }}
            isOwnStory={String(storyGroups[activeGroupIndex].user_id) === String(user?.id)}
            onClose={() => setActiveGroupIndex(null)}
            onBack={goBack}
            onNext={advanceStory}
            notice={null}
            onSwipeNextGroup={() => {
              if (activeGroupIndex < storyGroups.length - 1) goToStory(activeGroupIndex + 1, 0);
            }}
            onSwipePrevGroup={() => {
              if (activeGroupIndex > 0) goToStory(activeGroupIndex - 1, 0);
            }}
            prevGroup={activeGroupIndex > 0 ? storyGroups[activeGroupIndex - 1] : undefined}
            nextGroup={activeGroupIndex < storyGroups.length - 1 ? storyGroups[activeGroupIndex + 1] : undefined}
            onQuickReact={async (emoji: string) => {
              const g = storyGroups[activeGroupIndex];
              return await sendQuickMessage(g.user_id, emoji, g.stories[activeStoryIndex].id);
            }}
            onReply={(text: string) => {
              const g = storyGroups[activeGroupIndex];
              const s = g.stories[activeStoryIndex];
              setActiveGroupIndex(null);
              setActiveStoryIndex(0);
              openChat({
                sellerId: g.user_id,
                sellerName: g.user_name,
                draftMessage: text,
                storyId: s.id,
                storyMediaUrl: s.media_url,
                storyMediaType: s.media_type,
                storyCaption: s.caption,
              });
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}