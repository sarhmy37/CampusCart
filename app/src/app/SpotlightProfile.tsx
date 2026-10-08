// app/SpotlightProfile.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, Dimensions, Modal, Share,
  TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Eye, Heart, MessageCircle, Repeat, Send, Play, MoreHorizontal,
  Camera, Image as ImageIcon, User as UserIcon, Share2, X, MapPin,
} from 'lucide-react-native';
import {
  Squares2X2Icon as GridOutline,
  ArrowPathRoundedSquareIcon as RepostOutline,
  ChartBarSquareIcon as InsightsOutline,
} from 'react-native-heroicons/outline';
import {
  Squares2X2Icon as GridSolid,
  ArrowPathRoundedSquareIcon as RepostSolid,
  ChartBarSquareIcon as InsightsSolid,
} from 'react-native-heroicons/solid';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { StoryViewerLocal } from './stories';
import { useChat } from '@/context/ChatContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW } = Dimensions.get('window');
const GUTTER = 20;
const TILE_GAP = 10;
const TILE_W = (SW - GUTTER * 2 - TILE_GAP * 2) / 3;
const PHOTO_MS = 6000;
const MAX_VIDEO_MS = 60000;
const COVER_H = 200;
const AVATAR = 84;
const NAME_COL_OFFSET = AVATAR + 12;

const CONTENT_LABEL: Record<string, string> = {
  entertainment: 'Entertainment',
  educational: 'Educational',
  news: 'News & Commentary',
  commercial: 'Commercial',
  lifestyle: 'Lifestyle',
  creative: 'Creative & Craft',
  inspirational: 'Inspirational',
};

type Post = {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  created_at: string;
  kind?: string;
  content_type?: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  repost_count: number;
  export_count: number;
};

type Repost = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  reposted_at: string;
  owner_name: string;
  owner_avatar?: string | null;
  owner_plan?: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
};

type TabKey = 'posts' | 'reposts' | 'insights';

function formatCount(n?: number) {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
}

function relativeTime(dateStr?: string | null) {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function SpotlightProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; guest?: string }>();

  const targetUserId = params.userId ? String(params.userId) : (user?.id ? String(user.id) : '');
  const guestMode = !!params.userId && String(params.userId) !== String(user?.id);

  const [posts, setPosts] = useState<Post[]>([]);
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('posts');
  const { openChat, sendQuickMessage } = useChat();
  const [viewer, setViewer] = useState<{ groups: any[]; gi: number; si: number } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [reelStyle, setReelStyle] = useState<'horizontal' | 'vertical'>('vertical');
  const durationsRef = useRef<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);

  // Guest profile data (name/avatar/followers of the visited user)
  const [guestData, setGuestData] = useState<{ name: string; avatar: string | null; followers: number; plan?: string | null } | null>(null);
  const [followStats, setFollowStats] = useState<{ followers: number; following: number; i_follow: boolean } | null>(null);

  // Profile info (bio) edit
  const [profileInfo, setProfileInfo] = useState<string>((user as any)?.spotlight_bio || (user as any)?.bio || '');
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [infoDraft, setInfoDraft] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    if (guestMode) return;
    const serverValue = (user as any)?.spotlight_bio || (user as any)?.bio || '';
    if (serverValue) {
      setProfileInfo(serverValue);
    } else if (user?.id) {
      AsyncStorage.getItem(`spotlight_bio_${user.id}`)
        .then((v) => { if (v) setProfileInfo(v); })
        .catch(() => {});
    }
  }, [(user as any)?.spotlight_bio, (user as any)?.bio, user?.id, guestMode]);

  useEffect(() => {
    AsyncStorage.getItem('reel_style_v1')
      .then((v) => { if (v === 'horizontal' || v === 'vertical') setReelStyle(v); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      api.get(`/follows/stats/${targetUserId}`)
        .then((r) => setFollowStats(r.data))
        .catch(() => {});
      if (guestMode) {
        // Guest view: pull this user's spotlight posts from the public feed
        const res = await api.get('/stories/feed');
        const group = (res.data || []).find((g: any) => String(g.user_id) === String(targetUserId));
        if (group) {
          const spotlights: Post[] = (group.stories || [])
            .filter((s: any) => (s.kind ?? 'story') === 'spotlight')
            .map((s: any) => ({
              ...s,
              view_count: Number(s.view_count) || 0,
              like_count: Number(s.like_count) || 0,
              comment_count: Number(s.comment_count) || 0,
              repost_count: Number(s.repost_count) || 0,
              export_count: Number(s.export_count) || 0,
            }))
            .sort((a: Post, b: Post) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setPosts(spotlights);
          setGuestData({
            name: group.user_name,
            avatar: group.user_avatar ?? null,
            followers: Number(group.activity_count) || 0,
            plan: group.user_plan ?? null,
          });
        }
        setReposts([]);
      } else {
        const [mine, rep] = await Promise.all([
          api.get('/stories/mine'),
          api.get('/stories/reposts/mine'),
        ]);
        const spotlights: Post[] = (mine.data || [])
          .filter((s: any) => s.kind === 'spotlight')
          .map((s: any) => ({
            ...s,
            view_count: Number(s.view_count) || 0,
            like_count: Number(s.like_count) || 0,
            comment_count: Number(s.comment_count) || 0,
            repost_count: Number(s.repost_count) || 0,
            export_count: Number(s.export_count) || 0,
          }))
          .sort((a: Post, b: Post) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setPosts(spotlights);
        setReposts(rep.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guestMode, targetUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollowProfile = async () => {
    if (!followStats) return;
    const next = !followStats.i_follow;
    const prev = followStats;
    setFollowStats({
      ...prev,
      i_follow: next,
      followers: Math.max(0, prev.followers + (next ? 1 : -1)),
    });
    try {
      if (next) await api.post(`/follows/${targetUserId}`);
      else await api.delete(`/follows/${targetUserId}`);
      Toast.show({
        type: 'success',
        text1: next ? `Following ${(displayName || '').split(' ')[0]}` : 'Unfollowed',
        text2: next ? "You'll be notified when they post" : undefined,
      });
    } catch {
      setFollowStats(prev);
      Toast.show({ type: 'error', text1: "Couldn't update follow" });
    }
  };

  const openEditInfo = () => {
    setMenuOpen(false);
    setInfoDraft(profileInfo);
    setEditInfoOpen(true);
  };

  const saveProfileInfo = async () => {
    const text = infoDraft.trim();
    setSavingInfo(true);
    setProfileInfo(text);
    try {
      const res = await api.patch('/spotlight/profile', { spotlight_bio: text });
      if (res?.data) setUser(res.data);
      setEditInfoOpen(false);
      Toast.show({ type: 'success', text1: 'Profile info saved' });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try { await AsyncStorage.setItem(`spotlight_bio_${user?.id}`, text); } catch {}
        setEditInfoOpen(false);
        Toast.show({ type: 'success', text1: 'Profile info saved' });
      } else {
        Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Could not save profile info' });
      }
    } finally {
      setSavingInfo(false);
    }
  };

  const patchStory = (id: string, patch: any) =>
    setViewer((v) => v && ({
      ...v,
      groups: v.groups.map((g) => ({
        ...g,
        stories: g.stories.map((st: any) => (st.id === id ? { ...st, ...patch } : st)),
      })),
    }));

  const openAt = (groups: any[], gi: number, si: number) => {
    const st = groups[gi]?.stories[si];
    if (!st) return;
    if (st.media_type !== 'video') durationsRef.current[st.id] = PHOTO_MS;
    setViewer({ groups, gi, si });
    setMediaReady(false);
  };

  const goTo = (gi: number, si: number) => {
    if (!viewer) return;
    const st = viewer.groups[gi]?.stories[si];
    if (!st) return;
    if (st.media_type !== 'video') durationsRef.current[st.id] = PHOTO_MS;
    setViewer({ ...viewer, gi, si });
    setMediaReady(false);
  };

  const advance = () => {
    if (!viewer) return;
    const g = viewer.groups[viewer.gi];
    if (viewer.si < g.stories.length - 1) goTo(viewer.gi, viewer.si + 1);
    else if (reelStyle === 'vertical') {
      if (g.stories.length === 1) {
        setMediaReady(g.stories[0].media_type !== 'video');
        setReplayKey((k) => k + 1);
      } else goTo(viewer.gi, 0);
    } else goTo((viewer.gi + 1) % viewer.groups.length, 0);
  };

  const goBack = () => {
    if (!viewer) return;
    if (viewer.si > 0) goTo(viewer.gi, viewer.si - 1);
    else {
      const pg = (viewer.gi - 1 + viewer.groups.length) % viewer.groups.length;
      goTo(pg, viewer.groups[pg].stories.length - 1);
    }
  };

  const swipeGroup = (dir: 1 | -1) => {
    if (!viewer) return;
    goTo((viewer.gi + dir + viewer.groups.length) % viewer.groups.length, 0);
  };

  const closeViewer = () => { setViewer(null); load(); };

  const onViewerReady = (durationMs?: number) => {
    if (!viewer) return;
    const st = viewer.groups[viewer.gi].stories[viewer.si];
    if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
      durationsRef.current[st.id] = Math.min(durationMs, MAX_VIDEO_MS);
    } else if (!durationsRef.current[st.id]) {
      durationsRef.current[st.id] = PHOTO_MS;
    }
    if (String(st.user_id) !== String(user?.id)) api.post(`/stories/${st.id}/view`).catch(() => {});
    setMediaReady(true);
  };

  const repostStory = async (st: any) => {
    const next = !st.reposted;
    patchStory(st.id, { reposted: next, repost_count: Math.max(0, (st.repost_count ?? 0) + (next ? 1 : -1)) });
    try {
      const res = next ? await api.post(`/stories/${st.id}/repost`) : await api.delete(`/stories/${st.id}/repost`);
      patchStory(st.id, {
        repost_count: res.data.repost_count,
        reposted_by: res.data.reposted_by,
        last_repost_at: res.data.last_repost_at,
      });
    } catch {
      patchStory(st.id, { reposted: !next, repost_count: st.repost_count });
    }
  };

  const expiresAt = user?.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const hasPaid = !!user?.plan && user.plan !== 'free';
  const planActive = hasPaid && !!expiresAt && expiresAt > new Date();

  const totals = useMemo(() => posts.reduce(
    (a, p) => ({
      views: a.views + p.view_count,
      likes: a.likes + p.like_count,
      comments: a.comments + p.comment_count,
      reposts: a.reposts + p.repost_count,
      exports: a.exports + p.export_count,
    }),
    { views: 0, likes: 0, comments: 0, reposts: 0, exports: 0 },
  ), [posts]);

  const topPost = useMemo(
    () => [...posts].sort((a, b) => b.view_count - a.view_count || b.like_count - a.like_count)[0] ?? null,
    [posts],
  );

  const topType = useMemo(() => {
    const count: Record<string, number> = {};
    posts.forEach((p) => { if (p.content_type) count[p.content_type] = (count[p.content_type] || 0) + 1; });
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return best ? CONTENT_LABEL[best[0]] ?? best[0] : null;
  }, [posts]);

  const avgViews = posts.length ? Math.round(totals.views / posts.length) : 0;
  const engagement = totals.views > 0
    ? Math.round(((totals.likes + totals.comments + totals.reposts) / totals.views) * 100)
    : 0;

  // Whose info to show
  const displayName = guestMode ? (guestData?.name || '…') : user?.name;
  const displayAvatar = guestMode ? (guestData?.avatar ?? null) : user?.avatar_url;
  const displayPlan = guestMode ? (guestData?.plan ?? undefined) : (planActive ? user?.plan : undefined);

  const myGroup = useMemo(() => ({
    user_id: guestMode ? targetUserId : user?.id,
    user_name: displayName,
    user_avatar: displayAvatar ?? null,
    user_plan: displayPlan,
    allViewed: true,
    stories: posts.map((p) => ({
      ...p, user_id: guestMode ? targetUserId : user?.id, user_name: displayName,
      user_avatar: displayAvatar ?? null, viewed: true,
    })),
  }), [posts, user, guestMode, targetUserId, displayName, displayAvatar, displayPlan]);

  const repostGroups = useMemo(() => {
    const map = new Map<string, any>();
    reposts.forEach((r: any) => {
      const key = String(r.user_id);
      if (!map.has(key)) {
        map.set(key, {
          user_id: r.user_id, user_name: r.owner_name, user_avatar: r.owner_avatar ?? null,
          user_plan: r.owner_plan ?? undefined, allViewed: true, stories: [],
        });
      }
      map.get(key).stories.push({
        ...r, user_name: r.owner_name, user_avatar: r.owner_avatar ?? null,
        viewed: true, kind: 'spotlight', reposted: true,
      });
    });
    return Array.from(map.values());
  }, [reposts]);

  const openRepost = (r: Repost) => {
    const gi = repostGroups.findIndex((g) => String(g.user_id) === String(r.user_id));
    if (gi === -1) return;
    const si = repostGroups[gi].stories.findIndex((x: any) => x.id === r.id);
    openAt(repostGroups, gi, Math.max(0, si));
  };

  const coverUri = guestMode ? (guestData?.avatar ?? null) : (user?.cover_url || user?.avatar_url || null);
  const location: string = ((guestMode ? null : (user as any)?.location) || '') as string;

  const shareProfile = async () => {
    setMenuOpen(false);
    try {
      await Share.share({
        message: `Check out ${displayName} on Tre-X`,
      });
    } catch {}
  };

  const vg = viewer ? viewer.groups[viewer.gi] : null;
  const vs = viewer && vg ? vg.stories[viewer.si] : null;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const allTabs: { key: TabKey; label: string; count?: number; outline: any; solid: any }[] = [
    { key: 'posts', label: 'Posts', count: posts.length, outline: GridOutline, solid: GridSolid },
    { key: 'reposts', label: 'Reposts', count: reposts.length, outline: RepostOutline, solid: RepostSolid },
    { key: 'insights', label: 'Insights', outline: InsightsOutline, solid: InsightsSolid },
  ];
  const tabs = guestMode ? allTabs.filter((t) => t.key === 'posts') : allTabs;

  const onBackPress = () => {
    if (guestMode) router.back();
    else router.replace('/profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brand}
          />
        }
      >
        {/* Cover */}
        <View style={{ height: COVER_H, position: 'relative', overflow: 'hidden' }}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.card }} />
          )}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />

          <LinearGradient
            pointerEvents="none"
            colors={['transparent', colors.background]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 }}
          />

          <Pressable
            onPress={onBackPress}
            hitSlop={12}
            style={{
              position: 'absolute', top: 10, left: 12,
              padding: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>

          {!guestMode && (
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={12}
              style={{
                position: 'absolute', top: 10, right: 12,
                padding: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.4)',
              }}
            >
              <MoreHorizontal size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        {/* Avatar + name */}
        <View
          style={{
            paddingHorizontal: GUTTER,
            marginTop: -(AVATAR / 2) - 6,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
              overflow: 'hidden', backgroundColor: colors.chipBg,
              borderWidth: 4, borderColor: colors.background,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 26, fontWeight: '800', color: colors.brand }}>
                {displayName?.[0]?.toUpperCase() || '?'}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, marginLeft: 12, marginBottom: 16 }}>
            <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>
              {displayName}
            </Text>
          </View>
        </View>

        {/* @username (only for own profile) */}
        {!guestMode && !!user?.username && (
          <View style={{ paddingHorizontal: GUTTER, marginTop: -32, paddingLeft: GUTTER + NAME_COL_OFFSET }}>
            <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted }}>
              @{user.username}
            </Text>
          </View>
        )}

        {/* Profile info (bio) */}
        {!guestMode && !!profileInfo && (
          <View style={{ paddingHorizontal: GUTTER, marginTop: 8, paddingLeft: GUTTER + NAME_COL_OFFSET }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 }}>
              {profileInfo}
            </Text>
          </View>
        )}

        {/* Stats row: guest = followers · mine = views across */}
        {guestMode ? (
          <View style={{ paddingHorizontal: GUTTER, marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, letterSpacing: -1.5, lineHeight: 46 }}>
                <Text style={{ fontSize: 40, fontWeight: '900' }}>
                  {formatCount(followStats?.followers ?? 0)}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted, letterSpacing: 0 }}>
                  {' '}{(followStats?.followers ?? 0) === 1 ? 'follower' : 'followers'}
                </Text>
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                {posts.length} {posts.length === 1 ? 'spotlight post' : 'spotlight posts'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', marginLeft: 12 }}>
              <Pressable
                onPress={toggleFollowProfile}
                disabled={!followStats}
                style={{
                  backgroundColor: followStats?.i_follow ? colors.card : colors.brand,
                  borderWidth: 1,
                  borderColor: followStats?.i_follow ? colors.border : colors.brand,
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
                  borderTopRightRadius: 0, borderBottomRightRadius: 0,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: followStats?.i_follow ? colors.text : colors.textOnGold }}>
                  {followStats?.i_follow ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => openChat({ sellerId: targetUserId, sellerName: displayName || '', draftMessage: '' })}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1, borderLeftWidth: 0, borderColor: colors.border,
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                  borderTopRightRadius: 10, borderBottomRightRadius: 10,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Chat</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: GUTTER, marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, letterSpacing: -1.5, lineHeight: 46 }}>
                <Text style={{ fontSize: 40, fontWeight: '900' }}>
                  {formatCount(totals.views)}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted, letterSpacing: 0 }}>
                  {' '}views
                </Text>
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                across {posts.length} {posts.length === 1 ? 'spotlight post' : 'spotlight posts'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 6 }}>
                <Text style={{ fontWeight: '800', color: colors.text }}>{formatCount(followStats?.followers ?? 0)}</Text>
                {' '}{(followStats?.followers ?? 0) === 1 ? 'follower' : 'followers'}
                {'  ·  '}
                <Text style={{ fontWeight: '800', color: colors.text }}>{formatCount(followStats?.following ?? 0)}</Text>
                {' '}following
              </Text>
            </View>

            {!!location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 12, maxWidth: '40%' }}>
                <MapPin size={13} color={colors.textMuted} />
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted }}>
                  {location}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={{
          flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
          paddingHorizontal: GUTTER, marginTop: 20,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            const Icon = on ? t.solid : t.outline;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  alignItems: 'center', justifyContent: 'flex-end', gap: 3,
                  paddingHorizontal: 22, paddingBottom: 10,
                }}
              >
                <Icon size={16} color={on ? colors.brand : colors.textFaint} />
                <Text style={{ fontSize: 11.5, fontWeight: on ? '800' : '500', color: on ? colors.brand : colors.textFaint }}>
                  {t.label}{t.count ? ` ${t.count}` : ''}
                </Text>
                {on && (
                  <View
                    style={{
                      position: 'absolute', bottom: -1, alignSelf: 'center',
                      height: 3, width: 28, borderRadius: 999, backgroundColor: colors.brand,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Posts */}
        {tab === 'posts' && (
          <View style={{ paddingHorizontal: GUTTER }}>
            {posts.length === 0 ? (
              <Empty
                colors={colors}
                text={guestMode ? 'No spotlight posts yet.' : "You haven't posted a spotlight yet."}
                action={guestMode ? undefined : 'Post a spotlight'}
                onAction={guestMode ? undefined : () => router.push('/stories/new')}
              />
            ) : posts.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => openAt([myGroup], 0, i)}
                style={{
                  flexDirection: 'row', gap: 14, paddingVertical: 14,
                  borderBottomWidth: i === posts.length - 1 ? 0 : 1, borderBottomColor: colors.border,
                }}
              >
                <View style={{ width: 66, height: 88, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                  <Thumb uri={p.media_url} type={p.media_type} />
                  {p.media_type === 'video' && <PlayBadge />}
                </View>
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20 }}>
                    {p.caption || 'No caption'}
                  </Text>
                  <View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
                      <Stat icon={<Eye size={14} color={colors.textMuted} />} value={p.view_count} colors={colors} />
                      <Stat icon={<Heart size={14} color={colors.textMuted} />} value={p.like_count} colors={colors} />
                      <Stat icon={<MessageCircle size={14} color={colors.textMuted} />} value={p.comment_count} colors={colors} />
                      <Stat icon={<Repeat size={14} color={colors.textMuted} />} value={p.repost_count} colors={colors} />
                      <Stat icon={<Send size={13} color={colors.textMuted} />} value={p.export_count} colors={colors} />
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>{relativeTime(p.created_at)}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Reposts — only for own profile */}
        {!guestMode && tab === 'reposts' && (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 18 }}>
            {reposts.length === 0 ? (
              <Empty colors={colors} text="Spotlights you repost will show up here." />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, rowGap: 20 }}>
                {reposts.map((r) => (
                  <Pressable key={`${r.id}-${r.reposted_at}`} onPress={() => openRepost(r)} style={{ width: TILE_W }}>
                    <View style={{ width: TILE_W, height: TILE_W, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                      <Thumb uri={r.media_url} type={r.media_type} />
                      {r.media_type === 'video' && <PlayBadge />}
                    </View>
                    <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '700', color: colors.text, lineHeight: 15, marginTop: 6 }}>
                      {r.caption || 'No caption'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <View style={{ width: 16, height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                        {r.owner_avatar ? (
                          <Image source={{ uri: r.owner_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <Text style={{ fontSize: 8, fontWeight: '800', color: colors.brand }}>{r.owner_name?.[0]?.toUpperCase()}</Text>
                        )}
                      </View>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: colors.textMuted }}>{r.owner_name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                      <Stat icon={<Heart size={12} color={colors.textMuted} />} value={r.like_count} colors={colors} small />
                      <Stat icon={<MessageCircle size={12} color={colors.textMuted} />} value={r.comment_count} colors={colors} small />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: colors.brand, marginTop: 5 }}>
                      Reposted {relativeTime(r.reposted_at)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Insights — only for own profile */}
        {!guestMode && tab === 'insights' && (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 6 }}>
            {posts.length === 0 ? (
              <Empty colors={colors} text="Post a spotlight to start seeing how it does." />
            ) : (
              <>
                {topPost && (
                  <Pressable
                    onPress={() => openAt([myGroup], 0, Math.max(0, posts.findIndex((x) => x.id === topPost.id)))}
                    style={{ flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <View style={{ width: 66, height: 88, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                      <Thumb uri={topPost.media_url} type={topPost.media_type} />
                      {topPost.media_type === 'video' && <PlayBadge />}
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>Your most viewed spotlight</Text>
                      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -1, marginTop: 2 }}>
                        {formatCount(topPost.view_count)} views
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                        {topPost.caption || 'No caption'}
                      </Text>
                    </View>
                  </Pressable>
                )}
                <Row label="Likes" value={formatCount(totals.likes)} colors={colors} />
                <Row label="Comments" value={formatCount(totals.comments)} colors={colors} />
                <Row label="Reposts of your spotlights" value={formatCount(totals.reposts)} colors={colors} />
                <Row label="Exports" value={formatCount(totals.exports)} colors={colors} />
                <Row label="Average views per spotlight" value={formatCount(avgViews)} colors={colors} />
                <Row label="Viewers who liked, commented or reposted" value={`${engagement}%`} colors={colors} />
                {!!topType && <Row label="Type you post most" value={topType} colors={colors} last />}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Cover / profile options sheet — own profile only */}
      {!guestMode && (
        <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            />
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingTop: 12, paddingBottom: insets.bottom + 16,
              }}
            >
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Spotlight profile</Text>
                <Pressable onPress={() => setMenuOpen(false)} hitSlop={10}>
                  <X size={18} color={colors.textMuted} />
                </Pressable>
              </View>

              <MenuRow
                icon={<Camera size={18} color={colors.text} />}
                label="Change cover photo"
                colors={colors}
                onPress={() => { setMenuOpen(false); Toast.show({ type: 'info', text1: 'Coming soon' }); }}
              />
              <MenuRow
                icon={<ImageIcon size={18} color={colors.text} />}
                label="Change profile picture"
                colors={colors}
                onPress={() => { setMenuOpen(false); Toast.show({ type: 'info', text1: 'Coming soon' }); }}
              />
              <MenuRow
                icon={<UserIcon size={18} color={colors.text} />}
                label="Edit profile info"
                colors={colors}
                onPress={openEditInfo}
              />
              <MenuRow
                icon={<Share2 size={18} color={colors.text} />}
                label="Share profile"
                colors={colors}
                last
                onPress={shareProfile}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Edit profile info sheet */}
      <Modal visible={editInfoOpen} transparent animationType="slide" onRequestClose={() => setEditInfoOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={() => { Keyboard.dismiss(); setEditInfoOpen(false); }}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingHorizontal: GUTTER, paddingTop: 12,
              paddingBottom: insets.bottom + 20,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Profile info</Text>
              <Pressable onPress={() => { Keyboard.dismiss(); setEditInfoOpen(false); }} hitSlop={10}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              A short line about you or what you post. Shows on your spotlight profile.
            </Text>

            <TextInput
              value={infoDraft}
              onChangeText={setInfoDraft}
              placeholder="e.g. Sneaker plug · KNUST · DM for orders"
              placeholderTextColor={colors.textFaint}
              style={{
                minHeight: 90,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg ?? 'transparent',
                color: colors.text,
                fontSize: 14,
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 12,
                textAlignVertical: 'top',
              }}
              multiline
              maxLength={140}
            />
            <Text style={{ fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 6 }}>
              {infoDraft.length}/140
            </Text>

            <Pressable
              onPress={saveProfileInfo}
              disabled={savingInfo}
              style={{
                marginTop: 14,
                paddingVertical: 13,
                borderRadius: 12,
                backgroundColor: colors.brand,
                alignItems: 'center',
                opacity: savingInfo ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.textOnGold, fontWeight: '800', fontSize: 14 }}>
                {savingInfo ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={closeViewer}>
        {viewer && vg && vs && (
          <StoryViewerLocal
            group={vg}
            story={vs}
            durationMs={durationsRef.current[vs.id] ?? PHOTO_MS}
            mediaReady={mediaReady}
            replayKey={replayKey}
            reelStyle={reelStyle}
            onPatch={patchStory}
            onRepost={repostStory}
            onMediaReady={onViewerReady}
            isOwnStory={String(vg.user_id) === String(user?.id)}
            onClose={closeViewer}
            onBack={goBack}
            onNext={advance}
            onSwipeNextGroup={() => swipeGroup(1)}
            onSwipePrevGroup={() => swipeGroup(-1)}
            prevGroup={viewer.groups.length > 1 ? viewer.groups[(viewer.gi - 1 + viewer.groups.length) % viewer.groups.length] : undefined}
            nextGroup={viewer.groups.length > 1 ? viewer.groups[(viewer.gi + 1) % viewer.groups.length] : undefined}
            onQuickReact={async (emoji: string) => sendQuickMessage(vg.user_id, emoji, vs.id)}
            onReply={(text: string) => {
              setViewer(null);
              openChat({
                sellerId: vg.user_id,
                sellerName: vg.user_name,
                draftMessage: text,
                storyId: vs.id,
                storyMediaUrl: vs.media_url,
                storyMediaType: vs.media_type,
                storyCaption: vs.caption,
              });
            }}
          />
        )}
      </Modal>
    </View>
  );
}

/* ───────────── Pieces ───────────── */
function MenuRow({
  icon, label, onPress, colors, last,
}: { icon: React.ReactNode; label: string; onPress: () => void; colors: any; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: GUTTER, paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderMuted,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

function Stat({ icon, value, colors, small }: { icon: React.ReactNode; value: number; colors: any; small?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {icon}
      <Text style={{ fontSize: small ? 12 : 13, fontWeight: '600', color: colors.textMuted }}>{formatCount(value)}</Text>
    </View>
  );
}

function Row({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        paddingVertical: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
      }}
    >
      <Text style={{ flex: 1, fontSize: 14, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{value}</Text>
    </View>
  );
}

function Empty({ colors, text, action, onAction }: { colors: any; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ paddingVertical: 40 }}>
      <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>{text}</Text>
      {!!action && (
        <Pressable onPress={onAction} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brand }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function PlayBadge() {
  return (
    <View
      style={{
        position: 'absolute', right: 6, bottom: 6, width: 20, height: 20, borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Play size={10} color="#fff" fill="#fff" />
    </View>
  );
}

function Thumb({ uri, type }: { uri: string; type: 'image' | 'video' }) {
  if (type === 'video') return <VideoThumb uri={uri} />;
  return <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />;
}

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false;
    p.muted = true;
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}