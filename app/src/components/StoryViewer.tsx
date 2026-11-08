import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, Dimensions, Modal, ActivityIndicator, Animated, Easing, PanResponder,
  TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  X, ChevronLeft, ChevronRight, ChevronDown, Heart, MessageCircle, Repeat, Reply, MoreHorizontal, Check, Pin, Play, Plus, Send,
  Download, Share2, Archive, Trash2, EyeOff, Ban, Flag, Pencil, Sparkles, Star, Music,
  Eye, Settings,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import PostSettingsSheet, { PostSettingsT } from '@/components/PostSettingsSheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_VIDEO_DURATION_MS = 60000; // videos never play past 60s in the viewer
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();
const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5,
} as const;
const REPORT_REASONS = ['Spam', 'Nudity or sexual content', 'Harassment or hate', 'Scam or fake', 'Something else'];
const NO_INTERNET_MSG = 'Check your internet connection';

type Story = {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  created_at: string;
  viewed?: boolean;
  content_type?: string | null;
  view_count?: number;
  like_count?: number;
  liked?: boolean;
  comment_count?: number;
  trim_start_ms?: number | null;
  trim_end_ms?: number | null;
  export_count?: number;
  comments_off?: boolean;
  kind?: 'story' | 'spotlight';
  reposted?: boolean;
  repost_count?: number;
  reposted_by?: { name: string; avatar?: string | null } | null;
  top_reposters?: { id: string; name: string; avatar?: string | null }[];
  last_repost_at?: string | null;
  crop?: { x: number; y: number; w: number; h: number; fa?: number | null } | null;
  text_overlay?: { text: string; y: number } | null;
  sound?: { id: number; url: string; start?: number | null; end?: number | null; owner: string } | null;
  music_url?: string | null;
  music_start_ms?: number | null;
  music_end_ms?: number | null;
  allow_chat?: boolean | null;
  show_likes?: boolean | null;
  allow_repost?: boolean | null;
  allow_export?: boolean | null;
  chat_allowed?: boolean;
  likes_visible?: boolean;
  repost_allowed?: boolean;
  export_allowed?: boolean;
  product_tag?: { product_id: string; title: string; price: number; image: string | null; x: number; y: number; rot: number } | null;
};

type StoryGroup = {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_plan?: 'pro' | 'premium';
  activity_count?: number;
  is_seller?: boolean;
  user_allow_chat?: boolean;
  is_following?: boolean;
  stories: Story[];
  allViewed: boolean;
};

type VideoCropT = { x: number; y: number; w: number; h: number; fa?: number | null };

// ─── EXPORT ──────────────────────────────────────────────────────────
type ExportUi = { busy: (text: string | null) => void; msg: (text: string, isError?: boolean) => void };

let exportRunning = false;
async function runExport(story: Story, kind: 'gallery' | 'share', ui: ExportUi, onCount?: (n: number) => void) {
  const countIt = () =>
    api.post(`/story-export/${story.id}/done`).then((r) => onCount?.(r.data.count)).catch(() => {});
  if (exportRunning) { ui.msg('Please wait, another video is still downloading', true); return; }
  exportRunning = true;
  const noun = story.media_type === 'video' ? 'video' : 'photo';
  let finished = false;
  ui.busy(`Preparing ${noun}...`);
  try {
    const { data } = await api.post(`/story-export/${story.id}`);
    const isImage = data.type === 'image';
    const dest = `${FileSystem.cacheDirectory}trex-${story.id}.${isImage ? 'jpg' : 'mp4'}`;
    let lastPct = -1;
    const dl = FileSystem.createDownloadResumable(data.url, dest, {}, (p) => {
      if (!p.totalBytesExpectedToWrite) return;
      const pct = Math.floor((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100);
      if (!finished && pct !== lastPct) { lastPct = pct; ui.busy(`Downloading ${noun} ${pct}%`); }
    });
    const res = await dl.downloadAsync();
    if (!res || res.status !== 200) {
      const body = res ? await FileSystem.readAsStringAsync(res.uri).catch(() => '') : '';
      throw new Error(`download ${res?.status ?? 'failed'} ${body.slice(0, 120)}`);
    }
    finished = true;
    ui.busy(null);
    if (kind === 'gallery') {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) { ui.msg('Allow gallery access to save', true); return; }
      await MediaLibrary.saveToLibraryAsync(res.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      ui.msg('Saved to gallery');
      countIt();
    } else {
      if (!(await Sharing.isAvailableAsync())) { ui.msg("Sharing isn't available", true); return; }
      await Sharing.shareAsync(res.uri, { mimeType: isImage ? 'image/jpeg' : 'video/mp4', dialogTitle: isImage ? 'Share image' : 'Share video' });
      countIt();
    }
  } catch (e: any) {
    finished = true;
    ui.busy(null);
    console.log('EXPORT ERROR', e?.response?.status, e?.response?.data, e?.message);
    ui.msg(`Export failed: ${e?.response?.status ?? ''} ${e?.response?.data?.error ?? e?.message ?? ''}`.trim(), true);
  } finally {
    exportRunning = false;
  }
}

function GlassOrView({ glass, tint, style, children }: any) {
  if (glass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive tintColor={tint} style={[style, { overflow: 'hidden' }]}>
        {children}
      </GlassView>
    );
  }
  return <View style={style}>{children}</View>;
}

// ─── STORY GROUP PREVIEW (shown only mid-swipe transition) ────────────
function StoryGroupPreview({ group }: { group?: StoryGroup }) {
  if (!group) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  const cover = group.stories[0]; // matches goToStory(idx, 0) landing on the first story
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {cover.media_type === 'video' ? (
        <View style={{ flex: 1, backgroundColor: '#000' }} />
      ) : (
        <Image source={{ uri: cover.media_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      )}
    </View>
  );
}

// ─── REEL ACTION (icon + count, right column in vertical mode) ───────
function ReelAction({
  icon, count, onPress, hidden,
}: { icon: React.ReactNode; count?: string; onPress?: () => void; hidden?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignItems: 'center', gap: 4, display: hidden ? 'none' : 'flex' }}>
      <View style={{ shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
        {icon}
      </View>
      {!!count && (
        <Text
          style={{
            fontSize: 14, fontWeight: '600', color: '#fff',
            textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
          }}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

function HeartBurst({ burst }: { burst: { id: number; x: number; y: number } | null }) {
  const hearts = useRef(
    Array.from({ length: 3 }, () => ({
      v: new Animated.Value(0),
      dx: (Math.random() - 0.5) * 160,
      jitter: (Math.random() - 0.5) * 60,
      size: 42 + Math.random() * 28,
    }))
  ).current;

  useEffect(() => {
    if (!burst) return;
    hearts.forEach((h) => h.v.setValue(0));
    Animated.stagger(
      70,
      hearts.map((h) => Animated.timing(h.v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [burst?.id]);

  if (!burst) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      {hearts.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: burst.x + h.jitter - h.size / 2,
            top: burst.y - h.size / 2,
            opacity: h.v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: h.v.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) },
              { translateX: h.v.interpolate({ inputRange: [0, 1], outputRange: [0, h.dx] }) },
              { scale: h.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 1] }) },
            ],
          }}
        >
          <Heart size={h.size} color="#ef4444" fill="#ef4444" />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── FULL-SCREEN VIEWER ──────────────────────────────────────────────
export default function StoryViewer({
  group, story, durationMs, mediaReady, isOwnStory, onMediaReady, onClose, onBack, onNext,
  onSwipeNextGroup, onSwipePrevGroup, prevGroup, nextGroup, onReply, onQuickReact, notice, reelStyle, feedTab,
  onFeedTabChange, onPatch, onRepost, replayKey, onRemoveStory, onRemoveUser, onFollow, onArchive,
}: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const isVertical = reelStyle === 'vertical';
  const { theme } = useTheme();
  const isStaticFeedImage = story.kind === 'spotlight' && story.media_type === 'image';
  const hasSound = story.media_type === 'video' || !!story.sound;
  const [exportOpen, setExportOpen] = useState(false);
  const [followDone, setFollowDone] = useState(false);
  const followTimerRef = useRef<any>(null);
  useEffect(() => () => clearTimeout(followTimerRef.current), []);
  const handleFollowTap = () => {
    if (group.is_following || followDone) return;
    onFollow?.(group);
    setFollowDone(true);
    clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => setFollowDone(false), 1000);
  };
  const showFollowBadge = !isOwnStory && (!group.is_following || followDone);
  const openProfile = () => {
    const uid = group.user_id;
    onClose();
    setTimeout(() => router.push({ pathname: '/SpotlightProfile', params: { userId: uid, guest: '1' } }), 300);
  };
  const openSound = () => {
    const sid = story.sound?.id ?? story.id;
    onClose();
    setTimeout(() => router.push({ pathname: '/sound/[id]', params: { id: String(sid) } } as any), 300);
  };
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [postSettingsOpen, setPostSettingsOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  useEffect(() => { setCaptionExpanded(false); }, [story.id]);
  const [captionDraft, setCaptionDraft] = useState(story.caption ?? '');
  const [savingCaption, setSavingCaption] = useState(false);
  const [reportStep, setReportStep] = useState<'menu' | 'reasons'>('menu');
  const sendReport = async (reason: string) => {
    setReportOpen(false);
    try {
      await api.post(`/stories/${story.id}/report`, { reason });
      showToast('Report sent');
    } catch {
      showToast("Couldn't send report");
    }
  };
  const hidePost = async () => {
    setReportOpen(false);
    try {
      await api.post(`/stories/${story.id}/hide`);
      showToast("Got it, you'll see less like this");
      setTimeout(() => onRemoveStory?.(story.id), 1000);
    } catch {
      showToast("Couldn't hide post");
    }
  };

  const blockUser = () => {
    setReportOpen(false);
    Alert.alert(
      `Block ${group.user_name.split(' ')[0]}?`,
      "You won't see their posts and they won't see yours.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/stories/block/${group.user_id}`);
              showToast('User blocked');
              setTimeout(() => onRemoveUser?.(group.user_id), 1000);
            } catch {
              showToast("Couldn't block user");
            }
          },
        },
      ],
    );
  };

  const deletePost = () => {
    setReportOpen(false);
    Alert.alert('Delete this post?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/stories/${story.id}`);
            showToast('Post deleted');
            setTimeout(() => onRemoveStory?.(story.id), 1000);
          } catch {
            showToast("Couldn't delete post");
          }
        },
      },
    ]);
  };

  const archivePost = () => {
    setReportOpen(false);
    Alert.alert('Archive this post?', 'It will be removed from your feed and saved in Spotlight Profile > Archived.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          try {
            await api.patch(`/stories/${story.id}/archive`, { archived: true });
            showToast('Post archived');
            setTimeout(() => onArchive?.(story.id), 1000);
          } catch {
            showToast("Couldn't archive post");
          }
        },
      },
    ]);
  };

  const editCaption = () => {
    setReportOpen(false);
    setCaptionDraft(story.caption ?? '');
    setEditOpen(true);
  };

  const saveCaption = async () => {
    if (captionDraft.length > 500) {
      showToast('Caption must be 500 characters or less');
      return;
    }
    setSavingCaption(true);
    try {
      const res = await api.patch(`/stories/${story.id}/caption`, { caption: captionDraft });
      onPatch?.(story.id, { caption: res.data?.caption ?? captionDraft });
      setEditOpen(false);
      showToast('Caption updated');
    } catch {
      showToast("Couldn't update caption");
    } finally {
      setSavingCaption(false);
    }
  };

  const updatePostSetting = async (key: keyof PostSettingsT, value: boolean | undefined) => {
    try {
      const res = await api.patch(`/stories/${story.id}/settings`, { [key]: value ?? null });
      onPatch?.(story.id, res.data);
    } catch {
      showToast("Couldn't update setting");
    }
  };

  const toggleComments = async () => {
    setReportOpen(false);
    const off = !story.comments_off;
    onPatch?.(story.id, { comments_off: off });
    try {
      await api.patch(`/stories/${story.id}/comments-off`, { off });
      showToast(off ? 'Comments turned off' : 'Comments turned on');
    } catch {
      onPatch?.(story.id, { comments_off: !off });
      showToast("Couldn't update comments");
    }
  };

  const [exporting, setExporting] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const openExport = () => setExportOpen(true);
  const handleExport = (kind: 'gallery' | 'share') => {
    setExportOpen(false);
    runExport(story, kind, {
      busy: (t) => { setExporting(!!t); setExportText(t); },
      msg: (t) => showToast(t),
    }, (c) => onPatch?.(story.id, { export_count: c }));
  };
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 1800);
  };
  useEffect(() => {
    if (notice) showToast(notice.text);
  }, [notice?.id]);

  const handleQuickReact = async (emoji: string) => {
    const ok = await onQuickReact(emoji);
    showToast(ok ? `Sent ${emoji}` : "Couldn't send");
  };
  const [barRowWidth, setBarRowWidth] = useState(0);
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  useEffect(() => { setImgAspect(null); }, [story.id]);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(!!story.liked);
  const [likeCount, setLikeCount] = useState<number>(story.like_count ?? 0);
  const [commentCount, setCommentCount] = useState<number>(story.comment_count ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const commentInputRef = useRef<TextInput>(null);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [repliesById, setRepliesById] = useState<Record<string, any[]>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  const sheetDrag = useSheetDrag(() => setCommentsOpen(false));
  const reportDrag = useSheetDrag(() => setReportOpen(false));
  const editDrag = useSheetDrag(() => setEditOpen(false));
  useEffect(() => {
    if (editOpen) editDrag.translateY.setValue(0);
  }, [editOpen]);
  useEffect(() => {
    if (reportOpen && reportStep === 'reasons') reportDrag.translateY.setValue(0);
  }, [reportOpen, reportStep]);
  useEffect(() => {
    if (commentsOpen) sheetDrag.translateY.setValue(0);
  }, [commentsOpen]);
  useEffect(() => {
    setLiked(!!story.liked);
    setLikeCount(story.like_count ?? 0);
    setCommentCount(story.comment_count ?? 0);
    setCommentsOpen(false);
    setComments([]);
    setCommentText('');
    setReplyTo(null);
    setOpenReplies({});
    setRepliesById({});
  }, [story.id]);

  const ownerId = group.user_id;
  const isOwner = isOwnStory;
  const togglePin = async (c: any) => {
    try {
      await api.patch(`/stories/${story.id}/comments/${c.id}/pin`, { pinned: !c.pinned });
      const res = await api.get(`/stories/${story.id}/comments`);
      setComments(res.data || []);
    } catch {
      showToast("Couldn't update pin");
    }
  };

  const toggleCommentLike = async (c: any, threadId?: string) => {
    const next = !c.liked;
    const count = c.like_count ?? 0;
    const apply = (fn: (x: any) => any) => {
      if (threadId) setRepliesById((p) => ({ ...p, [threadId]: (p[threadId] || []).map(fn) }));
      else setComments((prev) => prev.map(fn));
    };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    apply((x) => (x.id === c.id ? { ...x, liked: next, like_count: Math.max(0, count + (next ? 1 : -1)) } : x));
    try {
      if (next) await api.post(`/stories/${story.id}/comments/${c.id}/like`);
      else await api.delete(`/stories/${story.id}/comments/${c.id}/like`);
    } catch {
      apply((x) => (x.id === c.id ? { ...x, liked: !next, like_count: count } : x));
      showToast("Couldn't update like");
    }
  };

  const toggleLike = async () => {
    const next = !liked;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    onPatch?.(story.id, { liked: next, like_count: Math.max(0, likeCount + (next ? 1 : -1)) });
    try {
      if (next) await api.post(`/stories/${story.id}/like`);
      else await api.delete(`/stories/${story.id}/like`);
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      onPatch?.(story.id, { liked: !next, like_count: likeCount });
      showToast("Couldn't update like");
    }
  };

  const openComments = async () => {
    if (story.comments_off && !isOwnStory) { showToast('Comments are turned off'); return; }
    setCommentsOpen(true);
    setCommentsLoading(true);
    try {
      const res = await api.get(`/stories/${story.id}/comments`);
      setComments(res.data || []);
    } catch {
      showToast("Couldn't load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadReplies = async (commentId: string) => {
    setRepliesLoading((p) => ({ ...p, [commentId]: true }));
    try {
      const res = await api.get(`/stories/${story.id}/comments/${commentId}/replies`);
      setRepliesById((p) => ({ ...p, [commentId]: res.data || [] }));
      return true;
    } catch {
      return false;
    } finally {
      setRepliesLoading((p) => ({ ...p, [commentId]: false }));
    }
  };

  const toggleReplies = async (commentId: string) => {
    if (openReplies[commentId]) {
      setOpenReplies((p) => ({ ...p, [commentId]: false }));
      return;
    }
    setOpenReplies((p) => ({ ...p, [commentId]: true }));
    if (repliesById[commentId]) return;
    const ok = await loadReplies(commentId);
    if (!ok) {
      setOpenReplies((p) => ({ ...p, [commentId]: false }));
      showToast("Couldn't load replies");
    }
  };

  const sendComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    const target = replyTo;
    setCommentText('');
    setReplyTo(null);
    try {
      const res = await api.post(`/stories/${story.id}/comments`, {
        text,
        ...(target ? { parent_id: target.id } : {}),
      });
      if (target) {
        const threadId = res.data.parent_id; // the original comment this reply belongs to
        setComments((prev) => prev.map((c) => (
          c.id === threadId ? { ...c, reply_count: (c.reply_count || 0) + 1 } : c
        )));
        setOpenReplies((p) => ({ ...p, [threadId]: true }));
        if (repliesById[threadId]) {
          setRepliesById((p) => ({ ...p, [threadId]: [...(p[threadId] || []), res.data] }));
        } else {
          loadReplies(threadId);
        }
      } else {
        setComments((prev) => [
          ...prev.filter((x) => x.pinned),
          { ...res.data, reply_count: 0 },
          ...prev.filter((x) => !x.pinned),
        ]);
      }
      setCommentCount((c) => c + 1);
      onPatch?.(story.id, { comment_count: commentCount + 1 });
    } catch {
      setCommentText(text);
      if (target) setReplyTo(target);
      showToast("Couldn't send comment");
    }
  };
  const replyInputRef = useRef<TextInput>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);
  const currentIndex = group.stories.indexOf(story);

  // Next 2 stories in this group + first story of the next/previous group
  const upcoming = useMemo(() => {
    const list: Story[] = [];
    if (nextGroup?.stories[0]) list.push(nextGroup.stories[0]);
    if (prevGroup?.stories[0]) list.push(prevGroup.stories[0]);
    list.push(...group.stories.slice(currentIndex + 1, currentIndex + 4));
    const seen = new Set<string>([story.id]);
    return list.filter((s) => s && !seen.has(s.id) && seen.add(s.id));
  }, [story.id, nextGroup, prevGroup, group]);

  useEffect(() => {
    const imgs = upcoming.filter((s) => s.media_type !== 'video').map((s) => s.media_url);
    if (imgs.length) Image.prefetch(imgs);
  }, [upcoming]);

  const BAR_GAP = 4;
  const barWidth = barRowWidth > 0
    ? (barRowWidth - BAR_GAP * (group.stories.length - 1)) / group.stories.length
    : 0;

  // One persistent Animated.Value per story — every bar is driven off its
  // own value, so switching which index is "current" never inherits a
  // stale in-flight number from a different bar.
  const barAnims = useMemo(
    () => group.stories.map(() => new Animated.Value(0)),
    [group.user_id, group.stories.length]
  );
  const currentAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const advanceTimerRef = useRef<any>(null);
  // Guards against onNext firing more than once for the same story.
  const advancedRef = useRef(false);
  const advanceOnce = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onNext();
  };

  // Tell the server how much of each Spotlight post was watched
  const durForWatchRef = useRef(durationMs);
  durForWatchRef.current = durationMs;
  useLayoutEffect(() => {
    if (!isVertical || story.kind !== 'spotlight') return;
    const anim = barAnims[currentIndex];
    if (!anim) return;
    let frac = 0;
    const listenerId = anim.addListener(({ value }: { value: number }) => { frac = value; });
    const storyId = story.id;
    return () => {
      anim.removeListener(listenerId);
      if (frac < 0.02) return;
      const dur = durForWatchRef.current;
      api.post(`/stories/${storyId}/watch`, {
        watched_ms: Math.round(frac * dur),
        duration_ms: dur,
        completed: frac >= 0.95,
      }).catch(() => {});
    };
  }, [story.id]);

  // useLayoutEffect (not useEffect) so the reset happens before paint —
  // no one-frame flash of a stale fill amount.
  useLayoutEffect(() => {
    currentAnimRef.current?.stop();
    advancedRef.current = false;
    setReplyText('');

    barAnims.forEach((val: Animated.Value, i: number) => {
      if (i < currentIndex) val.setValue(1);
      else if (i > currentIndex) val.setValue(0);
    });

    const current = barAnims[currentIndex];
    if (!current) return;
    current.setValue(0);
    if (!mediaReady || isStaticFeedImage) return;

    currentAnimRef.current = Animated.timing(current, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    currentAnimRef.current.start();
    clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(advanceOnce, durationMs);

    return () => {
      currentAnimRef.current?.stop();
      clearTimeout(advanceTimerRef.current);
    };
  }, [currentIndex, mediaReady, group.user_id, replayKey, isStaticFeedImage]);

  // ── Swipe-down-to-dismiss / swipe left-right to switch story groups ──
  const DISMISS_THRESHOLD = 120;
  const HORIZONTAL_SWIPE_THRESHOLD = 60;
  const gestureAxisRef = useRef<'vertical' | 'horizontal' | 'up' | 'reel' | 'dismissX' | null>(null);
  const dragX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  useLayoutEffect(() => {
    slideY.setValue(0);
  }, [group.user_id, story.id]);
  const HORIZONTAL_TRANSITION_MS = 320;
  const CIRCLE_SIZE = SCREEN_WIDTH * 0.45;
  const shrink = Animated.add(translateY, dragX);
  const dragOpacity = shrink.interpolate({
    inputRange: [0, 300, SCREEN_HEIGHT],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });
  const maskWidth = shrink.interpolate({
    inputRange: [0, 300],
    outputRange: [SCREEN_WIDTH, CIRCLE_SIZE],
    extrapolate: 'clamp',
  });
  const maskHeight = shrink.interpolate({
    inputRange: [0, 300],
    outputRange: [SCREEN_HEIGHT, CIRCLE_SIZE],
    extrapolate: 'clamp',
  });
  const maskRadius = shrink.interpolate({
    inputRange: [0, 300],
    outputRange: [0, CIRCLE_SIZE / 2],
    extrapolate: 'clamp',
  });

  const HALF = SCREEN_WIDTH / 2;
  const SIDE_SCALE = 0.86;
  const SQ_R = 28;
  const FULL = SCREEN_WIDTH;
  // current story: drifts a little, shrinks, rounds, fades
  const curShiftX = translateX.interpolate({ inputRange: [-FULL, 0, FULL], outputRange: [-FULL * 0.35, 0, FULL * 0.35], extrapolate: 'clamp' });
  const curScale = translateX.interpolate({ inputRange: [-FULL, 0, FULL], outputRange: [SIDE_SCALE, 1, SIDE_SCALE], extrapolate: 'clamp' });
  const curR = translateX.interpolate({ inputRange: [-FULL, 0, FULL], outputRange: [SQ_R, 0, SQ_R], extrapolate: 'clamp' });
  const curOpacity = translateX.interpolate({ inputRange: [-FULL, -HALF, 0, HALF, FULL], outputRange: [0, 0.6, 1, 0.6, 0], extrapolate: 'clamp' });
  // incoming (next) story: slides in from the right while scaling up
  const nextShiftX = translateX.interpolate({ inputRange: [-FULL, 0], outputRange: [0, FULL], extrapolate: 'clamp' });
  const nextScale = translateX.interpolate({ inputRange: [-FULL, 0], outputRange: [1, SIDE_SCALE], extrapolate: 'clamp' });
  const nextR = translateX.interpolate({ inputRange: [-FULL, 0], outputRange: [0, SQ_R], extrapolate: 'clamp' });
  const nextOpacity = translateX.interpolate({ inputRange: [-FULL, -HALF, 0], outputRange: [1, 0.7, 0], extrapolate: 'clamp' });
  // incoming (previous) story: slides in from the left while scaling up
  const prevShiftX = translateX.interpolate({ inputRange: [0, FULL], outputRange: [-FULL, 0], extrapolate: 'clamp' });
  const prevScale = translateX.interpolate({ inputRange: [0, FULL], outputRange: [SIDE_SCALE, 1], extrapolate: 'clamp' });
  const prevR = translateX.interpolate({ inputRange: [0, FULL], outputRange: [SQ_R, 0], extrapolate: 'clamp' });
  const prevOpacity = translateX.interpolate({ inputRange: [0, HALF, FULL], outputRange: [0, 0.7, 1], extrapolate: 'clamp' });
  useLayoutEffect(() => {
    translateX.setValue(0);
  }, [group.user_id]);

  // Resumes the current bar's countdown for whatever time is left,
  // rather than restarting it from zero, after a cancelled swipe.
  const resumeCurrentBar = () => {
    const current = barAnims[currentIndex];
    if (!current || !mediaReady || barPausedRef.current) return;
    current.stopAnimation((value: number) => {
      const remaining = Math.max(0, (1 - value) * durationMs);
      if (remaining <= 0) {
        advanceOnce();
        return;
      }
      currentAnimRef.current = Animated.timing(current, {
        toValue: 1,
        duration: remaining,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      currentAnimRef.current.start();
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(advanceOnce, remaining);
    });
  };

  // Fresh closure every render (no useRef wrapper) so nextGroup/prevGroup/
  // currentIndex/mediaReady inside these handlers are never stale after
  // the first swipe.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, gesture) => {
      const absDx = Math.abs(gesture.dx);
      const absDy = Math.abs(gesture.dy);
      if (absDx < 10 && absDy < 10) return false;
      if (isVertical) {
        if (gesture.dx > 12 && absDx > absDy * 1.5) {
          gestureAxisRef.current = 'dismissX';
          return true;
        }
        if (absDy > 10 && absDy > absDx * 1.5) {
          gestureAxisRef.current = 'reel';
          return true;
        }
        return false;
      }
      if (gesture.dy > 8 && absDy > absDx * 1.5) {
        gestureAxisRef.current = 'vertical';
        return true;
      }
      if (gesture.dy < -8 && absDy > absDx * 1.5) {
        gestureAxisRef.current = 'up';
        return true;
      }
      if (absDx > 12 && absDx > absDy * 1.5) {
        gestureAxisRef.current = 'horizontal';
        return true;
      }
      return false;
    },
    onPanResponderGrant: () => {
      currentAnimRef.current?.stop();
      clearTimeout(advanceTimerRef.current);
      heldRef.current = true;
    },
    onPanResponderMove: (_e, gesture) => {
      if (gestureAxisRef.current === 'dismissX') {
        dragX.setValue(Math.max(0, gesture.dx));
      } else if (gestureAxisRef.current === 'reel') {
        const toNext = gesture.dy < 0;
        const blocked = (toNext && !nextGroup) || (!toNext && !prevGroup);
        slideY.setValue(blocked ? gesture.dy / 3 : gesture.dy);
      } else if (gestureAxisRef.current === 'vertical' && gesture.dy > 0) {
        translateY.setValue(gesture.dy);
      } else if (gestureAxisRef.current === 'horizontal') {
        const draggingToNext = gesture.dx < 0;
        const blocked = (draggingToNext && !nextGroup) || (!draggingToNext && !prevGroup);
        translateX.setValue(blocked ? gesture.dx / 3 : gesture.dx);
      }
    },
    onPanResponderRelease: (_e, gesture) => {
      if (gestureAxisRef.current === 'dismissX') {
        gestureAxisRef.current = null;
        if (gesture.dx > DISMISS_THRESHOLD || gesture.vx > 0.8) {
          Animated.timing(dragX, {
            toValue: SCREEN_HEIGHT,
            duration: 260,
            useNativeDriver: false,
          }).start(() => onClose());
        } else {
          Animated.spring(dragX, { toValue: 0, useNativeDriver: false, bounciness: 6 })
            .start(resumeCurrentBar);
        }
        return;
      }
      if (gestureAxisRef.current === 'reel') {
        gestureAxisRef.current = null;
        const goingNext = gesture.dy <= -SCREEN_HEIGHT * 0.2 || gesture.vy <= -0.6;
        const goingPrev = gesture.dy >= SCREEN_HEIGHT * 0.2 || gesture.vy >= 0.6;
        if ((goingNext && nextGroup) || (goingPrev && prevGroup)) {
          Animated.timing(slideY, {
            toValue: goingNext ? -SCREEN_HEIGHT : SCREEN_HEIGHT,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => (goingNext ? onSwipeNextGroup() : onSwipePrevGroup()));
        } else {
          if (goingNext || goingPrev) {
            goingNext ? onSwipeNextGroup() : onSwipePrevGroup(); // shows the "no more" toast
          }
          Animated.spring(slideY, { toValue: 0, useNativeDriver: false, bounciness: 6 })
            .start(resumeCurrentBar);
        }
        return;
      }
      if (gestureAxisRef.current === 'up') {
        gestureAxisRef.current = null;
        if (gesture.dy < -60 && replyInputRef.current) {
          replyInputRef.current.focus();
        } else {
          resumeCurrentBar();
        }
        return;
      }
      if (gestureAxisRef.current === 'horizontal') {
        const goingNext = gesture.dx <= -HORIZONTAL_SWIPE_THRESHOLD;
        const goingPrev = gesture.dx >= HORIZONTAL_SWIPE_THRESHOLD;

        if (goingNext && nextGroup) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: HORIZONTAL_TRANSITION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => onSwipeNextGroup());
        } else if (goingPrev && prevGroup) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: HORIZONTAL_TRANSITION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => onSwipePrevGroup());
        } else {
          if (goingNext || goingPrev) {
            // Threshold cleared but nothing that way — same "no more
            // stories" toast as before (handled in the parent), snap back.
            goingNext ? onSwipeNextGroup() : onSwipePrevGroup();
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 6,
          }).start(resumeCurrentBar);
        }
        gestureAxisRef.current = null;
        return;
      }

      if (gesture.dy > DISMISS_THRESHOLD) {
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          useNativeDriver: false,
        }).start(() => onClose());
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 6,
        }).start(resumeCurrentBar);
      }
      gestureAxisRef.current = null;
    },
    onPanResponderTerminate: () => {
      if (gestureAxisRef.current === 'dismissX') {
        gestureAxisRef.current = null;
        Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start(resumeCurrentBar);
        return;
      }
      if (gestureAxisRef.current === 'reel') {
        gestureAxisRef.current = null;
        Animated.spring(slideY, { toValue: 0, useNativeDriver: false }).start(resumeCurrentBar);
        return;
      }
      if (gestureAxisRef.current === 'up') {
        gestureAxisRef.current = null;
        resumeCurrentBar();
        return;
      }
      if (gestureAxisRef.current === 'horizontal') {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: false })
          .start(resumeCurrentBar);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false })
          .start(resumeCurrentBar);
      }
      gestureAxisRef.current = null;
    },
  });

  // ── Reply-to-story ──────────────────────────────────────────────────
  const handleReplyFocus = () => {
    setIsTyping(true);
    currentAnimRef.current?.stop();
    clearTimeout(advanceTimerRef.current);
  };

  const handleReplyBlur = () => {
    setIsTyping(false);
    resumeCurrentBar();
  };

  const handleSendReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setReplyText('');
    replyInputRef.current?.clear();
    Keyboard.dismiss();
    const ok = await onQuickReact(trimmed);
    if (!ok) setReplyText(trimmed);
    showToast(ok ? 'Sent' : "Couldn't send");
  };

  // ── Hold-to-pause ────────────────────────────────────────────────────
  // A quick tap navigates (back/next); holding past HOLD_THRESHOLD_MS just
  // pauses the timer without navigating, and releasing resumes it.
  // In vertical (reel) mode a quick tap toggles pause instead.
  const HOLD_THRESHOLD_MS = 200;
  const pressStartRef = useRef(0);
  const heldRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHolding, setIsHolding] = useState(false);

  const handlePressIn = () => {
    pressStartRef.current = Date.now();
    heldRef.current = false;
    currentAnimRef.current?.stop();
    clearTimeout(advanceTimerRef.current);
  };

  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<any>(null);
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => () => clearTimeout(tapTimerRef.current), []);
  const quickTap = (action: () => void, x: number, y: number) => {
    const now = Date.now();
    clearTimeout(tapTimerRef.current);
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      setBurst((b) => ({ id: (b?.id ?? 0) + 1, x, y }));
      if (!liked) toggleLike();
      resumeCurrentBar();
      return;
    }
    lastTapRef.current = now;
    tapTimerRef.current = setTimeout(() => { lastTapRef.current = 0; action(); }, 280);
  };

  const handlePressOutSide = (side: 'back' | 'next', px = SCREEN_WIDTH / 2, py = SCREEN_HEIGHT / 2) => {
    if (isTyping || keyboardHeight > 0) {
      setIsPaused(false);
      Keyboard.dismiss();
      return;
    }
    const heldMs = Date.now() - pressStartRef.current;
    if (isVertical) {
      setIsHolding(false);
      if (heldMs >= HOLD_THRESHOLD_MS) {
        setIsPaused(false);
      } else {
        quickTap(() => {
          const zone = px < SCREEN_WIDTH * 0.3 ? 'left' : px > SCREEN_WIDTH * 0.7 ? 'right' : 'middle';
          if (zone === 'left' && currentIndex > 0) { setIsPaused(false); onBack(); }
          else if (zone === 'right' && currentIndex < group.stories.length - 1) { setIsPaused(false); onNext(); }
          else if (zone === 'middle' && story.media_type === 'video') setIsPaused((p: boolean) => !p);
          else resumeCurrentBar();
        }, px, py);
      }
      return;
    }
    if (heldMs < HOLD_THRESHOLD_MS && !heldRef.current) {
      quickTap(() => {
        setIsPaused(false);
        side === 'back' ? onBack() : onNext();
      }, px, py);
    } else {
      setIsPaused(false);
      resumeCurrentBar();
    }
  };

  const holdTimerRef = useRef<any>(null);
  const startHoldWatch = () => {
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      heldRef.current = true;
      setIsHolding(true);
      setIsPaused(true);
    }, HOLD_THRESHOLD_MS);
  };

  // ── Scrub (video only) ──
  const [isScrubbing, setIsScrubbing] = useState(false);
  const seekRef = useRef<((f: number) => void) | null>(null);
  const scrubActiveRef = useRef(false);
  const scrubStartRef = useRef(0);
  const scrubTimerRef = useRef<any>(null);
  const scrubCtx = useRef<any>({});
  const nStories = group.stories.length;
  const vSegW = (SCREEN_WIDTH - 3 * (nStories - 1)) / nStories;
  const scrubSegW = isVertical ? vSegW : barWidth;
  const scrubLeft = isVertical
    ? currentIndex * (vSegW + 3)
    : 10 + currentIndex * (barWidth + BAR_GAP);
  scrubCtx.current = { segW: scrubSegW, left: scrubLeft, i: currentIndex, anims: barAnims };

  const scrubEnd = () => {
    clearTimeout(scrubTimerRef.current);
    if (!scrubActiveRef.current) return;
    scrubActiveRef.current = false;
    setIsScrubbing(false); // un-pausing resumes from the bar's current value
  };
  const scrubXRef = useRef(0);
  const applyScrub = (x: number) => {
    const { segW, left, i, anims } = scrubCtx.current;
    const f = Math.min(1, Math.max(0, (x - left) / segW));
    anims[i].setValue(f);
    seekRef.current?.(f);
  };
  const scrubPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (_e, g) => {
      scrubXRef.current = g.x0;
      scrubTimerRef.current = setTimeout(() => {
        const { anims, i } = scrubCtx.current;
        anims[i].stopAnimation();
        scrubActiveRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsScrubbing(true);
        applyScrub(scrubXRef.current);
      }, 250);
    },
    onPanResponderMove: (_e, g) => {
      scrubXRef.current = g.moveX;
      if (!scrubActiveRef.current) return;
      applyScrub(g.moveX);
    },
    onPanResponderRelease: scrubEnd,
    onPanResponderTerminate: scrubEnd,
  })).current;

  const barPaused = isPaused || isTyping || commentsOpen || exportOpen || reportOpen || isScrubbing || postSettingsOpen;
  const barPausedRef = useRef(false);
  barPausedRef.current = barPaused;
  const VIEWER_TABS = [
    { key: 'all', label: 'All' },
    { key: 'foryou', label: 'For You' },
    { key: 'following', label: 'Following' },
  ] as const;
  const [tabsOpen, setTabsOpen] = useState(false);
  const tabsAnim = useRef(new Animated.Value(0)).current;
  const tabsCloseTimerRef = useRef<any>(null);
  useEffect(() => () => clearTimeout(tabsCloseTimerRef.current), []);
  const setTabsMenu = (open: boolean) => {
    clearTimeout(tabsCloseTimerRef.current);
    setTabsOpen(open);
    Animated.timing(tabsAnim, {
      toValue: open ? 1 : 0,
      duration: open ? 220 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const pickViewerTab = (key: 'all' | 'foryou' | 'following') => {
    if (key === feedTab) { setTabsMenu(false); return; }
    const ok = onFeedTabChange?.(key);
    Haptics.notificationAsync(
      ok === false ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
    );
    clearTimeout(tabsCloseTimerRef.current);
    tabsCloseTimerRef.current = setTimeout(() => setTabsMenu(false), 250);
  };
  const firstPauseRun = useRef(true);
  useEffect(() => {
    if (firstPauseRun.current) {
      firstPauseRun.current = false;
      return;
    }
    if (barPaused) {
      currentAnimRef.current?.stop();
      clearTimeout(advanceTimerRef.current);
      barAnims[currentIndex]?.stopAnimation();
    } else {
      resumeCurrentBar();
    }
  }, [barPaused]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {upcoming
        .filter((s: any) => s.media_type === 'video')
        .slice(0, 3)
        .map((s: any) => (
          <VideoPreloader key={s.id} uri={s.media_url} />
        ))}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          width: maskWidth,
          height: maskHeight,
          borderRadius: maskRadius,
          overflow: 'hidden',
          backgroundColor: '#000',
          opacity: dragOpacity,
          transform: [{ translateY }],
        }}
      >
        <Animated.View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: [{ translateY: slideY }] }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View
              style={{
                position: 'absolute', width: SCREEN_WIDTH, height: SCREEN_HEIGHT, borderRadius: prevR,
                opacity: prevOpacity, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
                transform: [{ translateX: prevShiftX }, { scale: prevScale }],
              }}
            >
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                <StoryGroupPreview group={prevGroup} />
              </View>
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute', width: SCREEN_WIDTH, height: SCREEN_HEIGHT, borderRadius: nextR,
                opacity: nextOpacity, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
                transform: [{ translateX: nextShiftX }, { scale: nextScale }],
              }}
            >
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                <StoryGroupPreview group={nextGroup} />
              </View>
            </Animated.View>
          </View>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                width: SCREEN_WIDTH, height: SCREEN_HEIGHT, borderRadius: curR, opacity: curOpacity,
                overflow: 'hidden', transform: [{ translateX: curShiftX }, { scale: curScale }],
              }}
            >
              <View style={{ flex: 1, backgroundColor: '#000', paddingBottom: isVertical ? keyboardHeight : 0 }}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                  {story.media_type === 'video' ? (
                    <StoryVideoPlayer
                      key={`${story.id}-${replayKey}`}
                      uri={story.media_url}
                      onReady={onMediaReady}
                      onError={() => showToast(NO_INTERNET_MSG)}
                      paused={barPaused}
                      seekRef={seekRef} muted={!!story.sound}
                      trimStartMs={story.trim_start_ms}
                      trimEndMs={story.trim_end_ms}
                      crop={story.crop}
                    />
                  ) : (
                    <View key={`${story.id}-${replayKey}`} style={{ width: '100%', height: '100%' }}>
                      <GapFill
                        aspect={imgAspect}
                        render={() => (
                          <Image source={{ uri: story.media_url }} style={{ width: '100%', height: '100%' }} contentFit="fill" />
                        )}
                      />
                      <Image
                        source={{ uri: story.media_url }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="contain"
                        onLoad={(e: any) => {
                          if (e?.source?.width && e?.source?.height) setImgAspect(e.source.width / e.source.height);
                          onMediaReady();
                        }}
                        onError={() => showToast(NO_INTERNET_MSG)}
                      />
                    </View>
                  )}
                  {!!story.text_overlay && <ViewerTextOverlay overlay={story.text_overlay} />}
{!!story.sound && mediaReady && (
  <SoundTrack key={`sound-${story.id}-${replayKey}`} sound={story.sound} paused={barPaused} />
)}
                  {!!story.music_url && mediaReady && (
                    <MusicTrack
                      key={`music-${story.id}-${replayKey}`}
                      url={story.music_url}
                      startMs={story.music_start_ms}
                      endMs={story.music_end_ms}
                      paused={barPaused}
                    />
                  )}
                  {!mediaReady && <DelayedLoader delay={500} />}
                  {!isVertical && !isStaticFeedImage && (
                    <View
                      onLayout={(e) => setBarRowWidth(e.nativeEvent.layout.width)}
                      style={{
                        position: 'absolute',
                        top: insets.top + 10,
                        left: 10, right: 10,
                        flexDirection: 'row',
                        gap: BAR_GAP,
                        opacity: isPaused ? 0 : 1,
                      }}
                    >
                      {group.stories.map((_: any, i: number) => (
                        <View
                          key={i}
                          style={{
                            flex: 1, height: isScrubbing && i === currentIndex ? 8 : 3, borderRadius: 4,
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            overflow: 'hidden',
                          }}
                        >
                          {barWidth > 0 && (
                            <Animated.View
                              style={{
                                width: barWidth,
                                height: '100%',
                                backgroundColor: '#fff',
                                borderRadius: 2,
                                transform: [{
                                  translateX: barAnims[i].interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-barWidth, 0],
                                    extrapolate: 'clamp',
                                  }),
                                }],
                              }}
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  {!isVertical && !isStaticFeedImage && (
                    <View
                      style={{
                        position: 'absolute',
                        top: insets.top + 24,
                        left: 16, right: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        opacity: isPaused ? 0 : 1,
                      }}
                    >
                      <Pressable onPress={openProfile} hitSlop={6} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <LinearGradient
                        colors={['#f59e0b', '#ef4444', '#a855f7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 36, height: 36, borderRadius: 18, padding: 2 }}
                      >
                        <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                          {group.user_avatar && (
                            <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                          )}
                        </View>
                      </LinearGradient>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: '800', color: '#fff' }}>
                            {group.user_name}
                          </Text>
                          <PlanBadge plan={group.user_plan} size={13} />
                        </View>
                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                          {relativeTime(story.created_at)}
                        </Text>
                        <RepostedBy story={story} color={colors.brand} nameColor="rgba(255,255,255,0.75)" fontSize={11} />
                      </View>
                      </Pressable>
                      <Pressable onPress={onClose} style={{ padding: 6 }}>
                        <X size={22} color="#fff" />
                      </Pressable>
                    </View>
                  )}
                  {!isVertical && !isStaticFeedImage && !!story.caption && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: insets.top + 80,
                        bottom: isOwnStory ? insets.bottom + 20 : insets.bottom + 90,
                        left: 24, right: 24,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: getCaptionFontSize(story.caption),
                          fontWeight: '700',
                          color: '#fff',
                          textAlign: 'center',
                        }}
                      >
                        {story.caption}
                      </Text>
                    </View>
                  )}
                  <Pressable
                    onPressIn={() => { handlePressIn(); startHoldWatch(); }}
                    onPressOut={(e) => { clearTimeout(holdTimerRef.current); handlePressOutSide('back', e.nativeEvent.pageX, e.nativeEvent.pageY); }}
                    style={{ position: 'absolute', top: insets.top + 70, bottom: 0, left: 0, width: SCREEN_WIDTH * 0.5 }}
                  />
                  <Pressable
                    onPressIn={() => { handlePressIn(); startHoldWatch(); }}
                    onPressOut={(e) => { clearTimeout(holdTimerRef.current); handlePressOutSide('next', e.nativeEvent.pageX, e.nativeEvent.pageY); }}
                    style={{ position: 'absolute', top: insets.top + 70, bottom: 0, right: 0, width: SCREEN_WIDTH * 0.5 }}
                  />
                  <HeartBurst burst={burst} />
                  {story.media_type === 'video' && mediaReady && scrubSegW > 0 && (
                    <View
                      {...scrubPan.panHandlers}
                      style={{
                        position: 'absolute',
                        left: scrubLeft, width: scrubSegW,
                        ...(isVertical
                          ? { bottom: 0, height: 16 }
                          : { top: insets.top - 4, height: 28 }),
                      }}
                    />
                  )}
                  {!!story.product_tag && (
                    <ViewerProductTag
                      tag={story.product_tag}
                      onPress={() => {
                        const pid = story.product_tag.product_id;
                        onClose();
                        setTimeout(() => router.push(`/product/${pid}`), 300);
                      }}
                    />
                  )}
                  {!!toastMsg && (
                    <View
                      pointerEvents="none"
                      style={{ position: 'absolute', top: insets.top + 70, left: 0, right: 0, alignItems: 'center' }}
                    >
                      <View
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          borderWidth: 1, borderColor: colors.brand,
                          paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{toastMsg}</Text>
                      </View>
                    </View>
                  )}
                  {isVertical && (
                    <View
                      pointerEvents={isHolding ? 'none' : 'box-none'}
                      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: isHolding ? 0 : 1 }}
                    >
                      {isPaused && story.media_type === 'video' && (
                        <View
                          pointerEvents="none"
                          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={32} color="#fff" fill="#fff" />
                          </View>
                        </View>
                      )}
                      {keyboardHeight === 0 && (
                        <View style={{ position: 'absolute', right: 12, bottom: 16, alignItems: 'center', gap: 20 }}>
                          <Pressable onPress={openProfile} hitSlop={6} style={{ marginBottom: 16, width: 44, height: 44 }}>
                            <View
                              style={{
                                width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
                                borderWidth: 2, borderColor: '#fff', backgroundColor: colors.chipBg,
                                alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {group.user_avatar ? (
                                <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                              ) : (
                                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand }}>
                                  {group.user_name?.[0]?.toUpperCase() || '?'}
                                </Text>
                              )}
                            </View>
                            {showFollowBadge && (
                              <Pressable
                                onPress={handleFollowTap}
                                hitSlop={8}
                                style={{
                                  position: 'absolute', bottom: -9, alignSelf: 'center',
                                  width: 22, height: 22, borderRadius: 11,
                                  backgroundColor: followDone ? '#22c55e' : colors.brand,
                                  alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                {followDone
                                  ? <Check size={12} color="#fff" strokeWidth={3.5} />
                                  : <Plus size={12} color={colors.textOnGold} strokeWidth={3.5} />}
                              </Pressable>
                            )}
                          </Pressable>
                          <ReelAction
                            icon={<Heart size={28} color={liked ? '#ef4444' : '#fff'} fill={liked ? '#ef4444' : 'transparent'} />}
                            count={story.likes_visible === false && !isOwnStory ? 'Likes' : formatCount(likeCount)}
                            onPress={toggleLike}
                          />
                          {!story.comments_off && (
                            <ReelAction
                              icon={<MessageCircle size={27} color="#fff" />}
                              count={formatCount(commentCount)}
                              onPress={openComments}
                            />
                          )}
                          <ReelAction
                            icon={<Repeat size={27} color={story.reposted ? '#22c55e' : '#fff'} />}
                            count={formatCount(story.repost_count ?? 0)}
                          hidden={story.repost_allowed === false && !isOwnStory}
                            onPress={() => onRepost?.(story)}
                          />
                          <ReelAction icon={<Send size={26} color="#fff" />} count={formatCount(story.export_count ?? 0)} onPress={openExport} hidden={story.export_allowed === false && !isOwnStory} />
                          <ReelAction icon={<MoreHorizontal size={26} color="#fff" />} onPress={() => { setReportStep('menu'); setReportOpen(true); }} />
                          {(story.media_type === 'video' || !!story.sound) && (
                            <Pressable onPress={openSound} hitSlop={8}>
  <SoundSquare avatar={group.user_avatar} name={group.user_name} playing={!barPaused && mediaReady} />
</Pressable>
                          )}
                        </View>
                      )}
                      <View
                        pointerEvents="box-none"
                        style={{ position: 'absolute', left: 16, right: 76, bottom: 16, gap: 12 }}
                      >
                        <RepostBubbles story={story} onClose={onClose} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ flex: hasSound ? 1 : 0, flexShrink: 1, minWidth: 0, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Pressable onPress={openProfile} hitSlop={6} style={{ flexShrink: 1 }}>
                                <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: '800', color: '#fff', ...TEXT_SHADOW }}>
                                  {group.user_name}
                                </Text>
                              </Pressable>
                              <PlanBadge plan={group.user_plan} size={15} />
                            </View>
                            {hasSound && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ shadowColor: '#000', shadowOpacity: 0.85, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
                                  <Music size={14} color="#fff" />
                                </View>
                                <Marquee
                                  text={`Original sound · ${story.sound?.owner ?? group.user_name}`}
                                  style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', ...TEXT_SHADOW }}
                                />
                              </View>
                            )}
                          </View>
                          {!isOwnStory && story.chat_allowed !== false && (
                            <Pressable
                              hitSlop={8}
                              onPress={() => onReply('')}
                              style={{
                                borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
                                paddingHorizontal: 13, paddingVertical: 6, borderRadius: 10,
                              }}
                            >
                              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', ...TEXT_SHADOW }}>Chat</Text>
                            </Pressable>
                          )}
                          {hasSound && <View style={{ flex: 1 }} />}
                        </View>
{!!story.caption && (
  <Pressable onPress={() => setCaptionExpanded((e) => !e)} hitSlop={6}>
    <Text
      numberOfLines={captionExpanded ? undefined : 1}
      ellipsizeMode="tail"
      style={{
        fontSize: 16, lineHeight: 19, color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
      }}
    >
      {story.caption}
    </Text>
  </Pressable>
)}
                      </View>
                      <View
                        pointerEvents="none"
                        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 3, display: story.media_type === 'video' ? 'flex' : 'none' }}
                      >
                        {group.stories.map((_: any, i: number) => {
                          const segW = (SCREEN_WIDTH - 3 * (group.stories.length - 1)) / group.stories.length;
                          return (
                            <View
                              key={i}
                              style={{ width: segW, height: isScrubbing && i === currentIndex ? 8 : 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.3)' }}
                            >
                              <Animated.View
                                style={{
                                  width: segW, height: '100%', backgroundColor: '#fff',
                                  transform: [{
                                    translateX: barAnims[i].interpolate({
                                      inputRange: [0, 1], outputRange: [-segW, 0], extrapolate: 'clamp',
                                    }),
                                  }],
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
                {isVertical && (
                <View style={{ height: 12 + 44 + (keyboardHeight > 0 ? 16 : insets.bottom + 16) }} />
              )}
              {!isOwnStory && !isVertical && (
                  <View
                    style={{
                      ...(isVertical
                        ? {}
                        : { position: 'absolute', left: 0, right: 0, bottom: keyboardHeight }),
                      backgroundColor: isVertical ? '#0b0d10' : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 14,
                      paddingTop: isVertical ? 12 : GLASS ? 14 : 34,
                      paddingBottom: keyboardHeight > 0 ? 16 : insets.bottom + 16,
                    }}
                  >
                    {!isVertical && !GLASS && (
                      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                        <MaskedView
                          style={{ flex: 1 }}
                          maskElement={
                            <LinearGradient
                              colors={['transparent', '#000000', '#000000']}
                              locations={[0, 0.4, 1]}
                              style={{ flex: 1 }}
                            />
                          }
                        >
                          <BlurView intensity={40} tint="dark" style={{ flex: 1 }} />
                        </MaskedView>
                      </View>
                    )}
                    <GlassOrView
                      glass={GLASS && !isVertical}
                      style={{
                        flex: 1,
                        height: isVertical ? 44 : 46,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: isVertical ? 22 : 19,
                        borderWidth: GLASS && !isVertical ? 0 : 1.5,
                        borderColor: colors.brand,
                        backgroundColor: 'transparent',
                        paddingHorizontal: 18,
                      }}
                    >
                      {isVertical && (
                        <Pressable onPress={openComments} style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>
                            {story.comments_off && !isOwnStory ? 'Comments are turned off' : 'Add comment...'}
                          </Text>
                        </Pressable>
                      )}
                      <TextInput
                        ref={replyInputRef}
                        value={replyText}
                        onChangeText={setReplyText}
                        onFocus={handleReplyFocus}
                        onBlur={handleReplyBlur}
                        placeholder={`Send message to ${group.user_name.split(' ')[0]}...`}
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        style={isVertical ? { display: 'none' } : { flex: 1, color: '#fff', fontSize: 16 }}
                        returnKeyType="send"
                        onSubmitEditing={handleSendReply}
                        blurOnSubmit={false}
                      />
                      {!replyText.trim() && !isVertical && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                          {['❤️', '😂', '🔥', '👏'].map((emoji) => (
                            <EmojiReact key={emoji} emoji={emoji} onSend={handleQuickReact} />
                          ))}
                        </View>
                      )}
                    </GlassOrView>
                    {(!isVertical || !!replyText.trim()) && (
                      <Pressable onPress={handleSendReply} disabled={!replyText.trim()}>
                        <GlassOrView
                          glass={GLASS && !isVertical}
                          tint={replyText.trim() ? colors.brand : undefined}
                          style={{
                            width: 38, height: 38, borderRadius: 19,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: GLASS && !isVertical ? 'transparent' : (replyText.trim() ? colors.brand : 'rgba(255,255,255,0.14)'),
                          }}
                        >
                          <Send size={18} color={replyText.trim() ? colors.textOnGold : 'rgba(255,255,255,0.5)'} />
                        </GlassOrView>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
      {isVertical && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 96,
            opacity: dragOpacity,
          }}
        >
          <View pointerEvents="box-none" style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{ position: 'absolute', top: insets.top + 10, left: 12, padding: 6, zIndex: 2 }}
            >
              <ChevronLeft size={28} color="#fff" />
            </Pressable>
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute', top: insets.top + 10, left: 0, right: 0,
                height: 40, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTabsMenu(!tabsOpen); }}
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <View style={{ width: 24 }} />
                <Text style={{ fontSize: 23, fontWeight: '800', color: '#fff' }}>Feed</Text>
                <Animated.View
                  style={{
                    transform: [{
                      rotate: tabsAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
                    }],
                  }}
                >
                  <ChevronDown size={20} color="#fff" strokeWidth={2.8} />
                </Animated.View>
              </Pressable>
            </View>

            <Animated.View
              pointerEvents={tabsOpen ? 'auto' : 'none'}
              style={{
                position: 'absolute', top: insets.top + 46, left: 0, right: 0,
                alignItems: 'center',
                opacity: tabsAnim,
                transform: [
                  { translateY: tabsAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
                  { scale: tabsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                ],
              }}
            >
              <GlassOrView
                glass={GLASS}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 999,
                  overflow: 'hidden',
                  backgroundColor: GLASS ? 'transparent' : 'rgba(30,30,34,0.6)',
                  borderWidth: GLASS ? 0 : 1, borderColor: 'rgba(255,255,255,0.18)',
                }}
              >
                {!GLASS && (
                  <BlurView
                    intensity={40}
                    tint="dark"
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                )}
                {VIEWER_TABS.map((t) => {
                  const active = feedTab === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => pickViewerTab(t.key)}
                      hitSlop={4}
                      style={{
                        paddingHorizontal: 13, height: 30, borderRadius: 15,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 15,
                          fontWeight: active ? '800' : '600',
                          color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </GlassOrView>
            </Animated.View>
          </View>
        </Animated.View>
      )}
      {isVertical && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: keyboardHeight,
            backgroundColor: theme === 'dark' ? colors.background : '#18181b', opacity: dragOpacity,
            paddingHorizontal: 14, paddingTop: 12,
            paddingBottom: keyboardHeight > 0 ? 16 : insets.bottom + 16,
          }}
        >
          <Pressable
            onPress={openComments}
            style={{
              height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.brand,
              justifyContent: 'center', paddingHorizontal: 18,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>
              {story.comments_off && !isOwnStory ? 'Comments are turned off' : 'Add comment...'}
            </Text>
          </Pressable>
        </Animated.View>
      )}
      {!!exportText && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: insets.top + 70, left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: colors.brand,
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{exportText}</Text>
          </View>
        </View>
      )}
      {exportOpen && <ExportSheet isImage={story.media_type !== 'video'} onClose={() => setExportOpen(false)} onPick={handleExport} />}
      {reportOpen && reportStep === 'menu' && (
        <PostOptionsSheet
          isOwn={isOwnStory}
          commentsOff={!!story.comments_off}
          onClose={() => setReportOpen(false)}
          onReport={() => setReportStep('reasons')}
          onHide={hidePost}
          onBlock={blockUser}
          onDelete={deletePost}
          onArchive={archivePost}
          onEdit={editCaption}
          onToggleComments={toggleComments}
          onSettings={() => { setReportOpen(false); setPostSettingsOpen(true); }}
        />
      )}
      <PostSettingsSheet
        visible={postSettingsOpen}
        settings={{
          allow_chat: story.allow_chat ?? undefined,
          show_likes: story.show_likes ?? undefined,
          allow_repost: story.allow_repost ?? undefined,
          allow_export: story.allow_export ?? undefined,
        }}
        onChange={updatePostSetting}
        onClose={() => setPostSettingsOpen(false)}
        commentsOff={!!story.comments_off}
        onToggleComments={async () => {
          const off = !story.comments_off;
          onPatch?.(story.id, { comments_off: off });
          try {
            await api.patch(`/stories/${story.id}/comments-off`, { off });
          } catch {
            onPatch?.(story.id, { comments_off: !off });
            showToast("Couldn't update comments");
          }
        }}
        onEditCaption={editCaption}
      />
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={() => setEditOpen(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <Animated.View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, paddingBottom: insets.bottom + 20, transform: [{ translateY: editDrag.translateY }] }}>
            <View {...editDrag.panHandlers} style={{ paddingTop: 8, paddingBottom: 14 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>Edit caption</Text>
            <TextInput
              value={captionDraft}
              onChangeText={setCaptionDraft}
              multiline
              maxLength={500}
              autoFocus
              placeholder="Add a caption..."
              placeholderTextColor={colors.textMuted}
              style={{ minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16, textAlignVertical: 'top' }}
            />
            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'right', marginTop: 5 }}>{captionDraft.length}/500</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setEditOpen(false)} style={{ flex: 1 }}>
                <GlassOrView
                  glass={GLASS}
                  style={{
                    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                    borderWidth: GLASS ? 0 : 1, borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Cancel</Text>
                </GlassOrView>
              </Pressable>
              <Pressable onPress={saveCaption} disabled={savingCaption} style={{ flex: 1, opacity: savingCaption ? 0.6 : 1 }}>
                <GlassOrView
                  glass={GLASS}
                  tint={colors.brand}
                  style={{
                    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                    backgroundColor: GLASS ? 'transparent' : colors.brand,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textOnGold }}>{savingCaption ? 'Saving...' : 'Save'}</Text>
                </GlassOrView>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      {reportOpen && reportStep === 'reasons' && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setReportOpen(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <Animated.View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 20,
              transform: [{ translateY: reportDrag.translateY }],
            }}
          >
            <View {...reportDrag.panHandlers} style={{ paddingTop: 12, paddingBottom: 16, marginTop: -12 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Report this post</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                  Why are you reporting it?
                </Text>
              </View>
              <Pressable
                onPress={() => setReportStep('menu')}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.brand }}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>Back</Text>
              </Pressable>
            </View>
            {REPORT_REASONS.map((r, i) => (
              <Pressable
                key={r}
                onPress={() => sendReport(r)}
                style={{
                  paddingVertical: 15,
                  borderBottomWidth: i === REPORT_REASONS.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{r}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      )}
      {commentsOpen && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => { Keyboard.dismiss(); setCommentsOpen(false); }}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <Animated.View
            style={{
              height: SCREEN_HEIGHT * 0.6,
              backgroundColor: colors.card,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: keyboardHeight > 0 ? 10 : insets.bottom + 10,
              transform: [{ translateY: sheetDrag.translateY }],
            }}
          >
            <View {...sheetDrag.panHandlers} style={{ paddingTop: 12, paddingBottom: 8, marginTop: -12 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, paddingHorizontal: 16 }}>
                Comments{commentCount > 0 ? ` (${formatCount(commentCount)})` : ''}
              </Text>
            </View>

            <View style={{ flex: 1 }} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
              {commentsLoading ? (
                <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
              ) : comments.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 15, marginTop: 28 }}>
                  No comments yet. Be the first.
                </Text>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 8 + keyboardHeight }}
                >
                  {comments.map((c: any) => (
                    <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                        {c.user_avatar ? (
                          <Image source={{ uri: c.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brand }}>
                              {c.user_name?.[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                          {c.user_name}{String(c.user_id) === String(ownerId) ? <Text style={{ fontWeight: '800', color: colors.brand }}>{' (Creator)'}</Text> : null}
                          <Text style={{ fontWeight: '500', color: colors.textMuted }}>  {relativeTime(c.created_at)}</Text>
                        </Text>
                        <Text style={{ fontSize: 16, color: colors.text, marginTop: 2 }}>{c.text}</Text>
                        {!!c.pinned && (
                          <View style={{ position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Pin size={11} color={colors.brand} fill={colors.brand} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand }}>Pinned</Text>
                          </View>
                        )}
                        <Pressable
                          onPress={() => toggleCommentLike(c)}
                          hitSlop={8}
                          style={{ position: 'absolute', right: 0, top: c.pinned ? 18 : 0, alignItems: 'center', gap: 1 }}
                        >
                          <Heart size={15} color={c.liked ? '#ef4444' : colors.textMuted} fill={c.liked ? '#ef4444' : 'transparent'} />
                          {(c.like_count ?? 0) > 0 && (
                            <Text style={{ fontSize: 14, fontWeight: '700', color: c.liked ? '#ef4444' : colors.textMuted }}>{formatCount(c.like_count)}</Text>
                          )}
                        </Pressable>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <Pressable
                            onPress={() => { setReplyTo({ id: c.id, name: c.user_name }); commentInputRef.current?.focus(); }}
                            hitSlop={8}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          >
                            <Reply size={13} color={colors.textMuted} />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Reply</Text>
                          </Pressable>
                          {isOwner && (
                            <>
                              <Text style={{ fontSize: 14, color: colors.textMuted }}>·</Text>
                              <Pressable onPress={() => togglePin(c)} hitSlop={8}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>{c.pinned ? 'Unpin' : 'Pin'}</Text>
                              </Pressable>
                            </>
                          )}
                          {(c.reply_count ?? 0) > 0 && (
                            <>
                              <Text style={{ fontSize: 14, color: colors.textMuted }}>·</Text>
                              <Pressable onPress={() => toggleReplies(c.id)} hitSlop={8}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>
                                  {openReplies[c.id]
                                    ? 'Hide replies'
                                    : `View ${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}`}
                                </Text>
                              </Pressable>
                            </>
                          )}
                        </View>
                        {openReplies[c.id] && (
                          <View style={{ marginTop: 10, gap: 12 }}>
                            {repliesLoading[c.id] && !repliesById[c.id] && (
                              <ActivityIndicator color={colors.brand} />
                            )}
                            {(repliesById[c.id] || []).map((r: any) => (
                              <View key={r.id} style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                                  {r.user_avatar ? (
                                    <Image source={{ uri: r.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                  ) : (
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>
                                        {r.user_name?.[0]?.toUpperCase() || '?'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                                    {r.user_name}{String(r.user_id) === String(ownerId) ? <Text style={{ fontWeight: '800', color: colors.brand }}>{' (Creator)'}</Text> : null}
                                    <Text style={{ fontWeight: '500', color: colors.textMuted }}>  {relativeTime(r.created_at)}</Text>
                                  </Text>
                                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 2 }}>{r.text}</Text>
                                  <Pressable
                                    onPress={() => toggleCommentLike(r, c.id)}
                                    hitSlop={8}
                                    style={{ position: 'absolute', right: 0, top: 0, alignItems: 'center', gap: 1 }}
                                  >
                                    <Heart size={14} color={r.liked ? '#ef4444' : colors.textMuted} fill={r.liked ? '#ef4444' : 'transparent'} />
                                    {(r.like_count ?? 0) > 0 && (
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: r.liked ? '#ef4444' : colors.textMuted }}>{formatCount(r.like_count)}</Text>
                                    )}
                                  </Pressable>
                                  <Pressable
                                    onPress={() => { setReplyTo({ id: r.id, name: r.user_name }); commentInputRef.current?.focus(); }}
                                    hitSlop={8}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                                  >
                                    <Reply size={12} color={colors.textMuted} />
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Reply</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {replyTo && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, paddingVertical: 6, marginTop: 6, transform: [{ translateY: -keyboardHeight }],
                  backgroundColor: colors.chipBg,
                }}
              >
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: colors.textMuted }}>
                  Replying to <Text style={{ fontWeight: '800', color: colors.text }}>{replyTo.name}</Text>
                </Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.card, transform: [{ translateY: -keyboardHeight }] }}>
              <TextInput
                ref={commentInputRef}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
                placeholderTextColor={colors.textMuted}
                maxLength={300}
                returnKeyType="send"
                onSubmitEditing={sendComment}
                style={{
                  flex: 1, height: 42, borderRadius: 21, paddingHorizontal: 16,
                  borderWidth: 1.5, borderColor: colors.brand,
                  backgroundColor: 'transparent', color: colors.text, fontSize: 16,
                }}
              />
              <Pressable
                onPress={sendComment}
                disabled={!commentText.trim()}
                style={{
                  width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: commentText.trim() ? colors.brand : colors.chipBg,
                }}
              >
                <Send size={18} color={commentText.trim() ? colors.textOnGold : colors.textMuted} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// Fills the empty top/bottom bars with a blurred copy of the media's own top/bottom part
function GapFill({ aspect, render }: { aspect: number | null; render: () => React.ReactNode }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const mediaH = aspect && box.w ? box.w / aspect : 0;
  const gap = Math.max(0, (box.h - mediaH) / 2);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {gap > 1 && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: gap, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: 0, left: -(box.w * (gap / (0.3 * mediaH)) - box.w) / 2, width: box.w * (gap / (0.3 * mediaH)), height: gap / 0.3 }}>{render()}</View>
            <BlurView intensity={100} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </View>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: gap, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', bottom: 0, left: -(box.w * (gap / (0.3 * mediaH)) - box.w) / 2, width: box.w * (gap / (0.3 * mediaH)), height: gap / 0.3 }}>{render()}</View>
            <BlurView intensity={100} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </View>
        </>
      )}
    </View>
  );
}

// Spinner that only appears if loading takes longer than a moment
function DelayedLoader({ delay = 300 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <View
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );
}
// Scrolls its text sideways only when it's too long for the space it has
// Scrolls its text in a continuous loop only when it's too long for the space it has.
// When the start of the sentence comes back around, it pauses briefly, then continues.
// Scrolls its text in a continuous loop only when it's too long for the space it has.
// When the start of the sentence comes back around, it pauses briefly, then continues.
function Marquee({ text, style }: { text: string; style?: any }) {
  const GAP = 40;
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const overflow = boxW > 0 && textW > boxW + 1;

  useEffect(() => {
    x.setValue(0);
    if (!overflow) return;
    const dist = textW + GAP;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(x, { toValue: -dist, duration: dist * 30, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 1, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [overflow, textW, boxW, text]);

  return (
    <View
      style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
      onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
    >
      {/* invisible copy, only used to measure the real text width */}
      <Text
        style={[style, { position: 'absolute', left: 0, top: 0, width: 5000, opacity: 0 }]}
        onTextLayout={(e) => {
          const w = e.nativeEvent.lines?.[0]?.width ?? 0;
          if (w > 0) setTextW(w);
        }}
      >
        {text}
      </Text>
      <Animated.View style={{ flexDirection: 'row', width: 5000, transform: [{ translateX: x }] }}>
        <Text numberOfLines={1} style={style}>{text}</Text>
        {overflow && <Text numberOfLines={1} style={[style, { marginLeft: GAP }]}>{text}</Text>}
      </Animated.View>
    </View>
  );
}

// Plays the reused sound (the original post's audio) under a post that uses it.
function SoundTrack({ sound, paused }: { sound: { url: string; start?: number | null; end?: number | null }; paused: boolean }) {
  const player = useVideoPlayer({ uri: sound.url, useCaching: true }, (p) => { p.loop = false; });
  useEffect(() => { try { player.currentTime = (sound.start ?? 0) / 1000; } catch {} }, [player]);
  useEffect(() => {
    try { if (paused) player.pause(); else player.play(); } catch {}
  }, [paused, player]);
  useEffect(() => {
    const t = setInterval(() => {
      try { if (sound.end && player.currentTime * 1000 >= sound.end) player.pause(); } catch {}
    }, 200);
    return () => clearInterval(t);
  }, [player]);
  return null;
}

function MusicTrack({
  url, startMs, endMs, paused,
}: { url: string; startMs?: number | null; endMs?: number | null; paused: boolean }) {
  const player = useAudioPlayer(url);
  const start = Math.max(0, startMs ?? 0);
  const end = endMs != null ? Math.max(start + 1000, endMs) : null;

  useEffect(() => {
    try {
      player.loop = false;
      player.currentTime = start / 1000;
      if (!paused) player.play();
    } catch {}
    return () => { try { player.pause(); } catch {} };
  }, [player, start, paused]);

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        if (end != null && player.currentTime * 1000 >= end) {
          player.pause();
          player.currentTime = start / 1000;
        }
      } catch {}
    }, 100);
    return () => clearInterval(timer);
  }, [player, start, end]);

  return null;
}

// Invisible player that just buffers/caches an upcoming video.
function VideoPreloader({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
  });
  useEffect(() => () => { try { player.pause(); } catch {} }, [player]);
  return null;
}

function SoundSquare({ avatar, name, playing }: { avatar?: string | null; name?: string; playing: boolean }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!playing) { bars.forEach((b) => b.setValue(0.3)); return; }
    const loops = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.timing(b, { toValue: 1, duration: 280 + i * 110, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(b, { toValue: 0.25, duration: 260 + i * 90, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing]);

  return (
    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#333', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 3 }}>
    <View style={{ width: 32, height: 32, borderRadius: 9, overflow: 'hidden', borderWidth: 1.5, borderColor: '#fff', backgroundColor: '#333' }}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" blurRadius={3} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 16 }}>
          {bars.map((b, i) => (
            <Animated.View key={i} style={{ width: 2, height: 16, borderRadius: 1, backgroundColor: '#fff', transform: [{ scaleY: b }] }} />
          ))}
        </View>
      </View>
    </View>
    </View>
  );
}

function RepostBubbles({ story, onClose }: { story: Story; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);

  const list = useMemo(() => {
    const base = story.top_reposters?.length
      ? story.top_reposters
      : story.reposted_by
      ? [{ id: 'by', ...story.reposted_by }]
      : [];
    return base.slice(0, 4);
  }, [story.top_reposters, story.reposted_by]);

  const n = story.repost_count ?? 0;
  const enter = useRef(new Animated.Value(0)).current;
  const pops = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const floats = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    enter.setValue(0);
    pops.forEach((p) => p.setValue(0));
    Animated.parallel([
      Animated.spring(enter, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
      Animated.stagger(90, pops.map((p) =>
        Animated.spring(p, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true })
      )),
    ]).start();
    const loops = floats.map((f, i) => {
      f.setValue(0);
      return Animated.loop(
        Animated.timing(f, { toValue: 1, duration: 2400 + i * 450, easing: Easing.linear, useNativeDriver: true })
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [story.id]);

  useEffect(() => {
    if (!open) return;
    setPeople(null);
    setFailed(false);
    api.get(`/stories/${story.id}/reposters`)
      .then((r) => setPeople(r.data || []))
      .catch(() => setFailed(true));
  }, [open, story.id]);

  if (n < 1 || list.length === 0) return null;

  const first = list[0].name?.split(' ')[0] || 'Someone';
  const others = Math.max(0, n - list.length);
  const overflowLabel = others > 99 ? '99+' : `+${others}`;
  const AVATAR = 30;
  const OVERLAP = -11;
  const textShadow = {
    textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5,
  } as const;

  const goProfile = (uid: string) => {
    setOpen(false);
    onClose();
    setTimeout(() => router.push({ pathname: '/SpotlightProfile', params: { userId: uid, guest: '1' } }), 300);
  };

  const onAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
  };

  return (
    <>
      <Animated.View
        style={{
          alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
          opacity: enter,
          transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }],
        }}
      >
        {/* text */}
        <Pressable onPress={onAvatarPress} hitSlop={8} style={{ maxWidth: 150, justifyContent: 'center' }}>
          <Text style={[{ fontSize: 9, fontWeight: '900', letterSpacing: 1.6, color: colors.brand, marginBottom: 1 }, textShadow]}>
            REPOSTED BY
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '800', color: '#fff', flexShrink: 1 }, textShadow]}>
              {first}
            </Text>
            {others > 0 && (
              <Text style={[{ fontSize: 11, fontWeight: '800', color: colors.brand, marginLeft: 5 }, textShadow]}>
                {overflowLabel}
              </Text>
            )}
          </View>
        </Pressable>

        {/* divider */}
        <View
          style={{
            width: 1.5, height: 46, borderRadius: 1, marginLeft: 10,
            backgroundColor: colors.brand, opacity: 0.9,
          }}
        />

        {/* avatars (right of text, tappable) */}
        <Pressable onPress={onAvatarPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
          {list.map((p, i) => (
            <Animated.View
              key={p.id}
              style={{
                width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
                marginLeft: i === 0 ? 0 : OVERLAP, zIndex: list.length - i,
                alignItems: 'center', justifyContent: 'center',
                opacity: pops[i],
                transform: [
                  { scale: pops[i] },
                  { translateY: floats[i].interpolate({
                    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
                    outputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map(
                      (t) => 3 * Math.sin(2 * Math.PI * (t + [0, 0.5, 0.25, 0.75][i]))
                    ),
                  }) },
                ],
              }}
            >
              <View
                style={{
                  width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: 'hidden',
                  borderWidth: 2, borderColor: '#fff', backgroundColor: '#333',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {p.avatar ? (
                  <Image source={{ uri: p.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{p.name?.[0]?.toUpperCase() || '?'}</Text>
                )}
              </View>
              {i === list.length - 1 && others > 0 && (
                <View
                  style={{
                    position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9,
                    backgroundColor: colors.brand, borderWidth: 1.5, borderColor: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 9.5, fontWeight: '900', color: colors.textOnGold }}>{overflowLabel}</Text>
                </View>
              )}
            </Animated.View>
          ))}
        </Pressable>
      </Animated.View>

      {/* list of everyone who reposted */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <View
            style={{
              backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 16, maxHeight: SCREEN_HEIGHT * 0.6,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>
              Reposted by
            </Text>
            {failed ? (
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Couldn't load reposts</Text>
            ) : people === null ? (
              <ActivityIndicator color={colors.brand} />
            ) : people.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.textMuted }}>No reposts yet</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ gap: 14 }}>
                  {people.map((p) => (
                    <Pressable key={p.id} onPress={() => goProfile(String(p.id))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                        {p.avatar ? (
                          <Image source={{ uri: p.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand }}>{p.name?.[0]?.toUpperCase() || '?'}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>{p.name}</Text>
                          <PlanBadge plan={p.plan} size={12} />
                        </View>
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 1 }}>
                          {formatCount(p.followers ?? 0)} followers · {formatCount(p.following ?? 0)} following
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function EmojiReact({ emoji, onSend }: { emoji: string; onSend: (e: string) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.7, speed: 40, bounciness: 14, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 10, useNativeDriver: true }),
    ]).start();
    onSend(emoji);
  };
  return (
    <Pressable onPress={bounce} hitSlop={6}>
      <Animated.Text style={{ fontSize: 19, transform: [{ scale }] }}>{emoji}</Animated.Text>
    </Pressable>
  );
}

function PlanBadge({ plan, size = 12 }: { plan?: string | null; size?: number }) {
  if (plan === 'premium') return <Sparkles size={size} color="#a855f7" fill="#a855f7" />;
  if (plan === 'pro') return <Star size={size} color="#3b82f6" fill="#3b82f6" />;
  return null;
}

function RepostedBy({ story, color, nameColor, fontSize = 10 }: { story: Story; color: string; nameColor: string; fontSize?: number }) {
  const n = story.repost_count ?? 0;
  const by = story.reposted_by;
  if (n < 1 || !by?.name) return null;
  const others = n - 1;
  const first = by.name.split(' ')[0];
  const av = fontSize + 8;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: fontSize + 1, fontWeight: '800', color }}>Reposted : </Text>
      <View style={{ width: av, height: av, borderRadius: av / 2, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.35)', alignItems: 'center', justifyContent: 'center' }}>
        {by.avatar ? (
          <Image source={{ uri: by.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Text style={{ fontSize: fontSize - 2, fontWeight: '800', color }}>{first[0]?.toUpperCase()}</Text>
        )}
      </View>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize, color: nameColor }}>
        {first}{others > 0 ? ` and ${others > 9 ? '9+' : others} ${others === 1 ? 'other' : 'others'}` : ''}
      </Text>
    </View>
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function getCaptionFontSize(text: string) {
  const len = text.trim().length;
  if (len <= 40) return 20;
  if (len <= 80) return 18;
  if (len <= 140) return 16;
  if (len <= 220) return 15;
  return 14;
}

// ─── UTIL ────────────────────────────────────────────────────────────
function relativeTime(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function StoryVideoPlayer({
  uri, onReady, onError, paused, trimStartMs, trimEndMs, crop, seekRef, muted,
}: {
  seekRef?: React.MutableRefObject<((f: number) => void) | null>;
  uri: string; onReady: (durationMs?: number) => void; onError?: () => void; paused: boolean;
  trimStartMs?: number | null; trimEndMs?: number | null; muted?: boolean;
  crop?: VideoCropT | null;
}) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false; // duration is capped/advanced manually now
    if (!paused) p.play(); // start right away, don't wait for readyToPlay
  });
  const readyRef = useRef(false);
  const durRef = useRef(0);
  useEffect(() => { try { player.muted = !!muted; } catch {} }, [muted, player]);
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (f: number) => {
      const startS = (trimStartMs ?? 0) / 1000;
      const spanS = Math.min(durRef.current, MAX_VIDEO_DURATION_MS) / 1000;
      player.currentTime = startS + f * spanS;
    };
    return () => { seekRef.current = null; };
  }, [player, trimStartMs]);

  useEffect(() => {
    // video never became ready (slow or dead connection) -> tell the person
    const failTimer = setTimeout(() => { if (!readyRef.current) onError?.(); }, 20000);
    const sub = player.addListener('statusChange', ({ status }: { status: string }) => {
      if (status === 'error') { clearTimeout(failTimer); onError?.(); }
      if (status === 'readyToPlay' && !readyRef.current) {
        clearTimeout(failTimer);
        readyRef.current = true;
        const fullMs = player.duration ? player.duration * 1000 : undefined;
        const hasTrim = trimStartMs != null && trimEndMs != null && trimEndMs > trimStartMs;
        if (hasTrim) player.currentTime = trimStartMs! / 1000;
        if (!paused) player.play();
        const durationMs = hasTrim
          ? Math.min(trimEndMs!, fullMs ?? trimEndMs!) - trimStartMs!
          : fullMs;
        durRef.current = durationMs ?? 0;
        const sz: any = (player as any).videoTrack?.size;
        if (crop?.fa && crop.w > 0 && crop.h > 0) setAspect((crop.w * crop.fa) / crop.h);
        else if (sz?.width && sz?.height) setAspect(sz.width / sz.height);
        onReady(durationMs);
      }
    });
    return () => { clearTimeout(failTimer); sub.remove(); };
  }, [player]);

  // Drives actual playback from the hold state — separate from the
  // ready-detection effect above so toggling paused never re-triggers onReady.
  useEffect(() => {
    if (!readyRef.current) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  return (
    <View style={{ width: '100%', height: '100%' }}>
      <GapFill aspect={aspect} render={() => <CroppedVideoView player={player} crop={crop} />} />
      <CroppedVideoView player={player} crop={crop} contain />
    </View>
  );
}

// Shows only the cropped part of a video, filling the box
function CroppedVideoView({ player, crop, contain }: { player: any; crop?: VideoCropT | null; contain?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (!crop || !crop.fa || crop.w <= 0 || crop.h <= 0) {
    return (
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
    );
  }
  const fa = crop.fa;
  const s = box.w > 0
    ? (contain
        ? Math.min(box.w / (crop.w * fa), box.h / crop.h)
        : Math.max(box.w / (crop.w * fa), box.h / crop.h))
    : 0;
  const FW = fa * s;
  const FH = s;
  if (contain) {
    return (
      <View
        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {s > 0 && (
          <View style={{ width: crop.w * FW, height: crop.h * FH, overflow: 'hidden' }}>
            <VideoView
              player={player}
              style={{ position: 'absolute', width: FW, height: FH, left: -crop.x * FW, top: -crop.y * FH }}
              contentFit="fill"
              nativeControls={false}
            />
          </View>
        )}
      </View>
    );
  }
  return (
    <View
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {s > 0 && (
        <VideoView
          player={player}
          style={{
            position: 'absolute', width: FW, height: FH,
            left: -crop.x * FW + (box.w - crop.w * FW) / 2,
            top: -crop.y * FH + (box.h - crop.h * FH) / 2,
          }}
          contentFit="fill"
          nativeControls={false}
        />
      )}
    </View>
  );
}

function ViewerProductTag({ tag, onPress }: { tag: any; onPress: () => void }) {
  const TAG_W = 150;
  const TAG_H = 56;
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 && (
        <Pressable
          onPress={onPress}
          style={{
            position: 'absolute',
            left: tag.x * box.w - TAG_W / 2,
            top: tag.y * box.h - TAG_H / 2,
            width: TAG_W, height: TAG_H,
            transform: [{ rotate: `${tag.rot}deg` }],
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#fff', borderRadius: 12, padding: 6,
            elevation: 6,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e5e7eb' }}>
            {!!tag.image && <Image source={{ uri: tag.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>{tag.title}</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#b45309', marginTop: 2 }}>
              GHS {Number(tag.price).toFixed(2)}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function ViewerTextOverlay({ overlay }: { overlay: { text: string; y: number } }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [bandH, setBandH] = useState(60);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.h > 0 && (
        <View
          onLayout={(e) => setBandH(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute', left: 0, right: 0,
            top: overlay.y * Math.max(0, box.h - bandH),
            backgroundColor: 'rgba(0,0,0,0.55)',
            paddingVertical: 14, paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>
            {overlay.text}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── EXPORT SHEET ────────────────────────────────────────────────────
function ExportSheet({
  onClose, onPick, isImage,
}: { onClose: () => void; onPick: (kind: 'gallery' | 'share') => void; isImage?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const drag = useSheetDrag(onClose);
  const noWatermark = !!(user?.plan === 'premium' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date());

  const options = [
    { key: 'gallery' as const, label: 'Save to gallery', desc: 'Keep a copy on your phone', Icon: Download },
    { key: 'share' as const, label: 'Share to...', desc: 'WhatsApp, Instagram and other apps', Icon: Share2 },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end' }}>
      <Pressable
        onPress={onClose}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
      />
      <Animated.View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingHorizontal: 20, paddingTop: 12,
          paddingBottom: insets.bottom + 20,
          transform: [{ translateY: drag.translateY }],
        }}
      >
        <View {...drag.panHandlers} style={{ paddingTop: 12, paddingBottom: 16, marginTop: -12 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{isImage ? 'Export photo' : 'Export video'}</Text>
            <View style={{ marginTop: 4, marginBottom: 18 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                'Your export will not include a watermark.'
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            style={{ backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, alignSelf: 'flex-start' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>Cancel</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {options.map(({ key, label, desc, Icon }) => (
            <Pressable
              key={key}
              onPress={() => onPick(key)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14,
                borderWidth: 1, borderColor: colors.border,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{label}</Text>
                <Text numberOfLines={2} style={{ fontSize: 13, color: colors.textMuted, marginTop: 1 }}>{desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function useSheetDrag(onClose: () => void) {
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) Keyboard.dismiss();
      if (g.dy > 120 || g.vy > 0.8) {
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: false }).start(() => {
          Keyboard.dismiss();
          onCloseRef.current();
        });
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false }).start();
    },
  })).current;
  return { translateY, panHandlers: pan.panHandlers };
}

function PostOptionsSheet({
  isOwn, commentsOff, onClose, onReport, onHide, onBlock, onDelete, onArchive, onEdit, onToggleComments, onSettings,
}: {
  isOwn: boolean; commentsOff: boolean; onClose: () => void;
  onReport: () => void; onHide: () => void; onBlock: () => void;
  onDelete: () => void; onArchive: () => void; onEdit: () => void; onToggleComments: () => void; onSettings?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const drag = useSheetDrag(onClose);

  const rows: { key: string; label: string; Icon: any; danger?: boolean; onPress: () => void }[] = isOwn
    ? [
        { key: 'edit', label: 'Edit caption', Icon: Pencil, onPress: onEdit },
        { key: 'settings', label: 'Post settings', Icon: Settings, onPress: () => onSettings?.() },
        { key: 'archive', label: 'Archive post', Icon: Archive, onPress: onArchive },
        { key: 'delete', label: 'Delete post', Icon: Trash2, danger: true, onPress: onDelete },
      ]
    : [
        { key: 'hide', label: 'Not interested', Icon: EyeOff, onPress: onHide },
        { key: 'block', label: 'Block this person', Icon: Ban, danger: true, onPress: onBlock },
        { key: 'report', label: 'Report post', Icon: Flag, danger: true, onPress: onReport },
      ];

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end' }}>
      <Pressable
        onPress={onClose}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
      />
      <Animated.View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 20,
          transform: [{ translateY: drag.translateY }],
        }}
      >
        <View {...drag.panHandlers} style={{ paddingTop: 12, paddingBottom: 12, marginTop: -12 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        {rows.map(({ key, label, Icon, danger, onPress }, i) => (
          <Pressable
            key={key}
            onPress={onPress}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15,
              borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border,
            }}
          >
            <Icon size={20} color={danger ? '#ef4444' : colors.text} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: danger ? '#ef4444' : colors.text }}>{label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}