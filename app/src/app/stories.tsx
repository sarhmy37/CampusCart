import { useEffect, useState, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, Dimensions, Modal, ActivityIndicator, Animated, Easing, PanResponder,
  TextInput, KeyboardAvoidingView, Platform, Keyboard, AppState, Alert
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import StoryViewer from '@/components/StoryViewer';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Pattern, Line, Rect, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Plus, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye, Sparkles, Star, Flame, Send, Play, Heart,
  MessageCircle, Repeat, Reply, MoreHorizontal, Maximize2, Download, Share2, Check, Pause, Archive,
  Trash2, EyeOff, Ban, Flag, Pin, Rocket, Pencil, Volume2, VolumeX,
} from 'lucide-react-native';
import ProductCard from '@/components/ProductCard';
import ServiceCard from '@/components/ServiceCard';
import InsetShadow from '@/components/InsetShadow';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import api from '@/api/client';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { LOGO_LIGHT, LOGO_DARK } from '@/data/media';
import { useTheme } from '@/context/ThemeContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { Squares2X2Icon as GridOutline, FireIcon as FireOutline, UsersIcon as UsersOutline, UserIcon, ChartBarIcon } from 'react-native-heroicons/outline';
import { Squares2X2Icon as GridSolid, FireIcon as FireSolid, UsersIcon as UsersSolid } from 'react-native-heroicons/solid';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const RING_SIZE = 76;
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const STATUS_CARD_WIDTH = (CARD_WIDTH / 2) * 0.85;
const STATUS_CARD_HEIGHT = STATUS_CARD_WIDTH * 1.5;
const BOOST_CARD_W = 156;  // center card width (all other sizes scale from this)
const BOOST_STEP = 162;    // distance between card centers (smaller = tighter overlap)
const PHOTO_DURATION_MS = 6000;      // photos show for a fixed 6s
const MAX_VIDEO_DURATION_MS = 60000; // videos never play past 60s in the viewer

const CONTENT_TYPES = [
  { key: 'all', emoji: '🌐', label: 'All', desc: 'Everything in this Feed' },
  { key: 'entertainment', emoji: '🎭', label: 'Entertainment', desc: 'Skits, memes, dance, challenges' },
  { key: 'educational', emoji: '📚', label: 'Educational', desc: 'Tutorials, explainers, study tips' },
  { key: 'news', emoji: '📰', label: 'News & Commentary', desc: 'Current events, opinions, sports' },
  { key: 'commercial', emoji: '🛍️', label: 'Commercial', desc: 'Ads, reviews, promos, products' },
  { key: 'lifestyle', emoji: '🌴', label: 'Lifestyle', desc: 'Vlogs, travel, food, fashion, fitness' },
  { key: 'creative', emoji: '🎨', label: 'Creative & Craft', desc: 'Art, DIY, music, photography' },
  { key: 'inspirational', emoji: '✨', label: 'Inspirational', desc: 'Motivation, faith, success stories' },
  { key: 'lowvalue', emoji: '⚠️', label: 'Low-value', desc: 'Reposts, AI filler, engagement bait' },
];

// ─── Collapse-on-scroll tuning ────────────────────────────────────────
const MAX_COLLAPSIBLE = 4;           // only the 4 most recent groups animate into the header
const MINI_RING_SIZE = 30;           // shrunk diameter once tucked into the header
const MINI_RING_STEP = 20;           // horizontal offset between tucked rings (creates the overlap)
const COLLAPSE_SCROLL_DISTANCE = 70; // px of scroll over which the collapse fully completes
const HEADER_PADDING_H = 16;         // matches contentContainerStyle paddingHorizontal on the ring row
const RING_ROW_TOP_PADDING = 16;     // matches the ring row wrapper's paddingTop
const RING_ROW_GAP = 14;             // matches contentContainerStyle gap on the ring row

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
  product_tag?: { product_id: string; title: string; price: number; image: string | null; x: number; y: number; rot: number } | null;
};

type StoryGroup = {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_plan?: 'pro' | 'premium';
  activity_count?: number;
  is_seller?: boolean;
  is_following?: boolean;
  stories: Story[];
  allViewed: boolean;
};

const DEMO_GROUPS: StoryGroup[] = [
  {
    user_id: 'demo-1',
    user_name: 'Kwame A.',
    user_avatar: 'https://i.pravatar.cc/150?img=12',
    allViewed: false,
    stories: [
      {
        id: 's1-1', user_id: 'demo-1', user_name: 'Kwame A.',
        user_avatar: 'https://i.pravatar.cc/150?img=12',
        media_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800',
        media_type: 'image',
        caption: 'Campus at golden hour 🌅',
        created_at: new Date(Date.now() - 12 * 60000).toISOString(),
        viewed: false,
      },
      {
        id: 's1-2', user_id: 'demo-1', user_name: 'Kwame A.',
        user_avatar: 'https://i.pravatar.cc/150?img=12',
        media_url: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800',
        media_type: 'image',
        caption: 'Library grind 📚',
        created_at: new Date(Date.now() - 8 * 60000).toISOString(),
        viewed: false,
      },
    ],
  },
  {
    user_id: 'demo-2',
    user_name: 'Ama K.',
    user_avatar: 'https://i.pravatar.cc/150?img=45',
    allViewed: false,
    stories: [{
      id: 's2-1', user_id: 'demo-2', user_name: 'Ama K.',
      user_avatar: 'https://i.pravatar.cc/150?img=45',
      media_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
      media_type: 'image',
      caption: 'Graduation vibes 🎓',
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      viewed: false,
    }],
  },
  {
    user_id: 'demo-3',
    user_name: 'Yaw B.',
    user_avatar: 'https://i.pravatar.cc/150?img=33',
    allViewed: true,
    stories: [{
      id: 's3-1', user_id: 'demo-3', user_name: 'Yaw B.',
      user_avatar: 'https://i.pravatar.cc/150?img=33',
      media_url: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800',
      media_type: 'image',
      caption: 'New kicks 👟 for sale — DM',
      created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      viewed: true,
    }],
  },
  {
    user_id: 'demo-4',
    user_name: 'Efua M.',
    user_avatar: 'https://i.pravatar.cc/150?img=20',
    allViewed: false,
    stories: [{
      id: 's4-1', user_id: 'demo-4', user_name: 'Efua M.',
      user_avatar: 'https://i.pravatar.cc/150?img=20',
      media_url: 'https://images.unsplash.com/photo-1519452575417-564c1401ecc0?w=800',
      media_type: 'image',
      caption: 'Hostel dinner 🍲',
      created_at: new Date(Date.now() - 4 * 60 * 60000).toISOString(),
      viewed: false,
    }],
  },
  {
    user_id: 'demo-5',
    user_name: 'Kofi T.',
    user_avatar: 'https://i.pravatar.cc/150?img=15',
    allViewed: false,
    stories: [{
      id: 's5-1', user_id: 'demo-5', user_name: 'Kofi T.',
      user_avatar: 'https://i.pravatar.cc/150?img=15',
      media_url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800',
      media_type: 'image',
      caption: 'Campus tour 📸',
      created_at: new Date(Date.now() - 6 * 60 * 60000).toISOString(),
      viewed: false,
    }],
  },
];

// ─── Explore demo cards (20 items = 10 rows × 2 columns) ───
const DEMO_EXPLORE = Array.from({ length: 20 }, (_, i) => ({
  id: `explore-${i + 1}`,
  title: [
    'iPhone 13 Pro — clean',
    'AirPods Pro 2',
    'Vintage denim jacket',
    'Campus hoodie',
    'Sneakers — barely worn',
    'Study lamp + desk set',
    'Textbook bundle',
    'Smart watch band',
    'Bluetooth speaker',
    'Desk organizer',
    'Blender (barely used)',
    'Skateboard deck',
    'Gaming mouse',
    'Wireless keyboard',
    'USB-C hub',
    'Backpack — waterproof',
    'Sunglasses classic',
    'Protein shaker set',
    'Water bottle — insulated',
    'Notebook + pen set',
  ][i % 20],
  price: [450, 320, 180, 120, 280, 95, 150, 60, 210, 45, 320, 240, 130, 175, 90, 200, 85, 40, 55, 30][i % 20],
  image: [
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400',
    'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400',
    'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400',
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400',
    'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400',
    'https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=400',
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400',
    'https://images.unsplash.com/photo-1625723044792-44de16ccb4e9?w=400',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400',
    'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400',
    'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400',
    'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400',
  ][i % 20],
  seller: ['Kwame A.', 'Ama K.', 'Yaw B.', 'Efua M.', 'Kofi T.'][i % 5],
  condition: i % 3 === 0 ? 'New' : 'Used',
}));

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

function FollowChatButtons({
  group, colors, onFollow, onChat,
}: { group: any; colors: any; onFollow: () => void; onChat: () => void }) {
  if (GLASS) {
    const following = !!group.is_following;
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <Pressable onPress={onFollow} hitSlop={{ top: 6, bottom: 6, left: 6 }}>
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={following ? undefined : colors.brand}
            style={{
              paddingHorizontal: 12, paddingVertical: 5,
              borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
              borderTopRightRadius: 0, borderBottomRightRadius: 0,
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: following ? colors.text : colors.textOnGold }}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </GlassView>
        </Pressable>
        <Pressable onPress={onChat} hitSlop={{ top: 6, bottom: 6, right: 6 }}>
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            style={{
              paddingHorizontal: 12, paddingVertical: 5,
              borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
              borderTopRightRadius: 10, borderBottomRightRadius: 10,
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Chat</Text>
          </GlassView>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={onFollow}
        hitSlop={{ top: 6, bottom: 6, left: 6 }}
        style={{
          backgroundColor: group.is_following ? colors.card : colors.brand,
          borderWidth: 1,
          borderColor: group.is_following ? colors.border : colors.brand,
          paddingHorizontal: 12, paddingVertical: 5,
          borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
          borderTopRightRadius: 0, borderBottomRightRadius: 0,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: group.is_following ? colors.text : colors.textOnGold }}>
          {group.is_following ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onChat}
        hitSlop={{ top: 6, bottom: 6, right: 6 }}
        style={{
          backgroundColor: colors.card,
          borderWidth: 1, borderLeftWidth: 0, borderColor: colors.border,
          paddingHorizontal: 12, paddingVertical: 5,
          borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
          borderTopRightRadius: 10, borderBottomRightRadius: 10,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Chat</Text>
      </Pressable>
    </View>
  );
}

const REPORT_REASONS = ['Spam', 'Nudity or sexual content', 'Harassment or hate', 'Scam or fake', 'Something else'];
const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);
let currentFeedStop: (() => void) | null = null;

type ExportUi = { busy: (text: string | null) => void; msg: (text: string, isError?: boolean) => void };

const toastUi: ExportUi = {
  busy: (t) => (t ? Toast.show({ text1: t, autoHide: false }) : Toast.hide()),
  msg: (t, isError) => Toast.show({ type: isError ? 'error' : 'success', text1: t }),
};

let exportRunning = false;
async function runExport(story: Story, kind: 'gallery' | 'share', ui: ExportUi, onCount?: (n: number) => void) {
  const countIt = () =>
    api.post(`/story-export/${story.id}/done`).then((r) => onCount?.(r.data.count)).catch(() => {});
  if (exportRunning) { ui.msg('Please wait, another video is still downloading', true); return; }
  exportRunning = true;
  ui.busy('Preparing video...');
  try {
    const { data } = await api.post(`/story-export/${story.id}`);
    const isImage = data.type === 'image';
    const dest = `${FileSystem.cacheDirectory}trex-${story.id}.${isImage ? 'jpg' : 'mp4'}`;
    let lastPct = -1;
    const dl = FileSystem.createDownloadResumable(data.url, dest, {}, (p) => {
      if (!p.totalBytesExpectedToWrite) return;
      const pct = Math.floor((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100);
      if (pct !== lastPct) { lastPct = pct; ui.busy(`Downloading video ${pct}%`); }
    });
    const res = await dl.downloadAsync();
    if (!res || res.status !== 200) {
      const body = res ? await FileSystem.readAsStringAsync(res.uri).catch(() => '') : '';
      throw new Error(`download ${res?.status ?? 'failed'} ${body.slice(0, 120)}`);
    }
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
    ui.busy(null);
    console.log('EXPORT ERROR', e?.response?.status, e?.response?.data, e?.message);
    ui.msg(`Export failed: ${e?.response?.status ?? ''} ${e?.response?.data?.error ?? e?.message ?? ''}`.trim(), true);
  } finally {
    exportRunning = false;
  }
}

function mergeGroups(prev: StoryGroup[], next: StoryGroup[]): StoryGroup[] {
  const map = new Map(prev.map((g) => [String(g.user_id), g]));
  for (const g of next) {
    const key = String(g.user_id);
    const old = map.get(key);
    if (!old) { map.set(key, g); continue; }
    const have = new Set(old.stories.map((s) => s.id));
    const stories = [...old.stories, ...g.stories.filter((s) => !have.has(s.id))]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    map.set(key, { ...old, ...g, stories, allViewed: stories.every((s) => s.viewed) });
  }
  return [...map.values()];
}

export default function Stories() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openStoryId } = useLocalSearchParams<{ openStoryId?: string }>();
  const { user } = useAuth();
  useEffect(() => { exportRunning = false; }, [user?.id]);
  const planActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
const { openChat, sendQuickMessage } = useChat();
  const { theme } = useTheme();

   const GREETING_MAX_CHARS = 20;

  const greeting = useMemo(() => {
    const first = user?.name?.split(' ')[0] || 'there';

    // Longest-first: each builder is tried in order, first one that fits wins.
    const builders = [
      (n: string) => `Heyyy, ${n} 👋`,
      (n: string) => `Welcome back, ${n} 👋`,
      (n: string) => `Hey there, ${n} ✨`,
      (n: string) => `What's good, ${n} 👋`,
      (n: string) => `Good to see you, ${n}`,
      (n: string) => `Sup ${n} 🔥`,
      (n: string) => `Yo ${n} 👋`,
      (n: string) => `Hi, ${n} 👋`,
      (n: string) => `Hi, ${n}`,
      (n: string) => `Hey, ${n}`,
      (n: string) => n,
    ];

    const fitting = builders
      .map((b) => b(first))
      .filter((s) => s.length <= GREETING_MAX_CHARS);

    if (fitting.length > 0) {
      return fitting[Math.floor(Math.random() * fitting.length)];
    }

    // Name alone is too long even bare — hard truncate as a last resort.
    return first.slice(0, GREETING_MAX_CHARS);
  }, [user?.name]);

  const subtitle = useMemo(() => {
    const lines = [
      "See what's happening around campus right now",
      "Fresh drops from students near you",
      "Find your next steal on campus",
      "Something new is always going on here",
      "Your campus marketplace, live",
      "Catch the latest before it's gone",
      "Deals, stories and more, all in one place",
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }, []);

  const [contentFilter, setContentFilter] = useState('all');
  const [viewerNotice, setViewerNotice] = useState<{ text: string; id: number } | null>(null);

  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const visibleCountRef = useRef(PAGE_SIZE);
  const totalExploreRef = useRef(0);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [contentFilter]);

  const FEED_PAGE = 12;
  const feedOffsetRef = useRef(0);
  const feedHasMoreRef = useRef(true);
  const feedFetchingRef = useRef(false);
  const statusOffsetRef = useRef(0);
  const statusHasMoreRef = useRef(true);
  const [statusOrder, setStatusOrder] = useState<Record<string, number>>({});

  const loadMoreFeed = () => {
    const isStatus = reelStyle !== 'vertical';
    const offsetRef = isStatus ? statusOffsetRef : feedOffsetRef;
    const hasMoreRef = isStatus ? statusHasMoreRef : feedHasMoreRef;
    if (feedFetchingRef.current || !hasMoreRef.current) return;
    feedFetchingRef.current = true;
    setLoadingMore(true);
    api.get('/stories/feed', { params: { limit: FEED_PAGE, offset: offsetRef.current, foryou: 'true', kind: isStatus ? 'story' : 'spotlight' } })
      .then((res) => {
        const next: StoryGroup[] = res.data || [];
        const start = offsetRef.current;
        offsetRef.current += next.length;
        hasMoreRef.current = next.length >= FEED_PAGE;
        if (isStatus) {
          setStatusOrder((o) => {
            const n = { ...o };
            next.forEach((g, i) => { if (n[String(g.user_id)] === undefined) n[String(g.user_id)] = start + i; });
            return n;
          });
        }
        setGroups((prev) => mergeGroups(prev, next));
        setVisibleCount((c) => c + FEED_PAGE);
      })
      .catch(() => {})
      .finally(() => { feedFetchingRef.current = false; setLoadingMore(false); });
  };

  const loadMoreExplore = () => {
    if (loadingMoreRef.current) return;
    if (visibleCountRef.current >= totalExploreRef.current) { loadMoreFeed(); return; }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((c) => c + PAGE_SIZE);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }, 400);
  };
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDrag = useSheetDrag(() => setFilterOpen(false));
  useEffect(() => {
    if (filterOpen) filterDrag.translateY.setValue(0);
  }, [filterOpen]);
  const [reelStyleOpen, setReelStyleOpen] = useState(false);
  const reelDrag = useSheetDrag(() => setReelStyleOpen(false));
  useEffect(() => {
    if (reelStyleOpen) reelDrag.translateY.setValue(0);
  }, [reelStyleOpen]);
  const [feedTab, setFeedTab] = useState<'all' | 'following' | 'foryou'>('foryou');
  const [tabsY, setTabsY] = useState(0);
  const tabsYRef = useRef(0);
  const tabsArmedRef = useRef(false);
  const [tabsPinned, setTabsPinned] = useState(false);
  const [commentsStoryId, setCommentsStoryId] = useState<string | null>(null);
  const [exportStory, setExportStory] = useState<Story | null>(null);
  const [reelStyle, setReelStyle] = useState<'horizontal' | 'vertical'>('horizontal');
  const [previewGroup, setPreviewGroup] = useState<any>(null);
  const [mainScrollLocked, setMainScrollLocked] = useState(false);

  // restore the saved reel style when the screen opens
  useEffect(() => {
    AsyncStorage.getItem('reel_style_v1')
      .then((v) => { if (v === 'horizontal' || v === 'vertical') setReelStyle(v); })
      .catch(() => {});
  }, []);
  // restore the saved content type when the screen opens
  useEffect(() => {
    AsyncStorage.getItem('content_filter_v1')
      .then((v) => { if (v && (v === 'all' || CONTENT_TYPES.some((t) => t.key === v))) setContentFilter(v); })
      .catch(() => {});
  }, []);
  // save it whenever it changes
  useEffect(() => {
    AsyncStorage.setItem('content_filter_v1', contentFilter).catch(() => {});
  }, [contentFilter]);
  const filterActive = reelStyle === 'vertical' && contentFilter !== 'all';

  const [allGroups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerSource, setViewerSource] = useState<'story' | 'spotlight'>('story');
  const [pinnedLatest, setPinnedLatest] = useState<Record<string, number>>({});
  const pinnedLatestRef = useRef<Record<string, number>>({});
  const pinScrollYRef = useRef(0);
  const releasePins = () => {
    if (Object.keys(pinnedLatestRef.current).length === 0) return;
    pinnedLatestRef.current = {};
    setPinnedLatest({});
  };

  const groupsOfKind = (kind: 'story' | 'spotlight', match?: (s: Story) => boolean) =>
    allGroups
      .map((g) => {
        const stories = g.stories.filter((s) => (s.kind ?? 'story') === kind && (!match || match(s)));
        return { ...g, stories, allViewed: stories.every((s) => s.viewed) };
      })
      .filter((g) => g.stories.length > 0);

  // Status: never filtered, no content type
  const statusList = useMemo(() => groupsOfKind('story'), [allGroups]);
  // Spotlight: keeps content type and the filter
  const spotlightAll = useMemo(() => groupsOfKind('spotlight'), [allGroups]);
  const spotlightList = useMemo(() => {
    if (contentFilter === 'all') return spotlightAll;
    return groupsOfKind('spotlight', (s) => {
      if (contentFilter === 'trending') return (s.view_count ?? 0) >= 5;
      if (contentFilter === 'new' || contentFilter === 'featured') return false;
      return s.content_type === contentFilter;
    });
  }, [allGroups, contentFilter]);

  // `groups` = whichever list the full-screen viewer is stepping through
  const groups = viewerSource === 'spotlight' ? spotlightList : statusList;
  const [fresh, setFresh] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const loadedStoryIds = useRef<Set<string>>(new Set());
  // Per-story duration cache, keyed by story id — replaces the old single
  // shared ref, which could leak a stale duration (e.g. a short one left
  // over from a different story) onto whichever story opened next.
  const storyDurationsRef = useRef<Record<string, number>>({});

  // ── Scroll-driven header collapse ──────────────────────────────────
  // scrollY tracks the main content ScrollView. collapseProgress goes
  // 0 (rings in their normal row) → 1 (rings tucked/overlapping in the
  // header), and reverses automatically as the user scrolls back up.
  const scrollY = useRef(new Animated.Value(0)).current;
  const ringScrollX = useRef(new Animated.Value(0)).current;
  const collapseStateRef = useRef<'expanded' | 'collapsed' | 'mid'>('expanded');
  const [textRowHeight, setTextRowHeight] = useState(61);
  const [ringRowHeight, setRingRowHeight] = useState(118);
  const [ringRowOffsetY, setRingRowOffsetY] = useState(61 + RING_ROW_TOP_PADDING);
  const headerRef = useRef<View>(null);
  const ringRowInnerRef = useRef<View>(null);

  const measureRingRowOffset = () => {
    requestAnimationFrame(() => {
      if (!headerRef.current || !ringRowInnerRef.current) return;
      ringRowInnerRef.current.measure((_x, _y, _w, _h, pageX, pageY) => {
        headerRef.current!.measure((_hx, _hy, _hw, _hh, hPageX, hPageY) => {
          setRingRowOffsetY(pageY - hPageY);
        });
      });
    });
  };

  const collapseProgress = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(0);
  const targetRef = useRef(0);
  const anchorRef = useRef({ p: 0, y: 0 });
  const settleAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const settlingRef = useRef(false);

  useEffect(() => {
    const id = collapseProgress.addListener(({ value }) => {
      progressRef.current = value;
      setCirclesExpanded(value <= 0.01);
      setRingOverlayInteractive(value >= 0.98);
    });
    return () => collapseProgress.removeListener(id);
  }, []);

  const animateCollapse = (to: number, duration = 180) => {
    settleAnimRef.current?.stop();
    settleAnimRef.current = Animated.timing(collapseProgress, {
      toValue: to,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    settlingRef.current = true;
    settleAnimRef.current.start(({ finished }) => {
      settlingRef.current = false;
      if (finished) anchorRef.current = { p: to, y: lastScrollYRef.current };
    });
  };

  // How much of the ring row's own horizontal scroll should still nudge the
  // overlay circles — full effect while expanded, fading to none as they
  // tuck into the header so the final tucked spot never depends on scroll.
  const ringScrollInfluence = collapseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const [ringOverlayInteractive, setRingOverlayInteractive] = useState(false);
  const [circlesExpanded, setCirclesExpanded] = useState(true);

  // ── Scroll-to-top button ──
  const TOP_BTN_THRESHOLD = 800; // px scrolled before the button is ever allowed to show
  const topBtnOpacity = useRef(new Animated.Value(0)).current;
  const topBtnTimerRef = useRef<any>(null);
  const topBtnVisibleRef = useRef(false);
  const [topBtnTouchable, setTopBtnTouchable] = useState(false);

  const hideTopBtn = () => {
    clearTimeout(topBtnTimerRef.current);
    if (!topBtnVisibleRef.current) return;
    topBtnVisibleRef.current = false;
    Animated.timing(topBtnOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !topBtnVisibleRef.current) setTopBtnTouchable(false);
    });
  };

  const showTopBtn = () => {
    clearTimeout(topBtnTimerRef.current);
    if (!topBtnVisibleRef.current) {
      topBtnVisibleRef.current = true;
      setTopBtnTouchable(true);
      Animated.timing(topBtnOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    // fades away 1s after scrolling stops
    topBtnTimerRef.current = setTimeout(hideTopBtn, 2500);
  };

  useEffect(() => () => clearTimeout(topBtnTimerRef.current), []);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        lastScrollYRef.current = y;
        if (settlingRef.current) {
          settleAnimRef.current?.stop();
          anchorRef.current = { p: progressRef.current, y };
        }
        const D = COLLAPSE_SCROLL_DISTANCE;
        if (y <= 0) anchorRef.current = { p: 0, y: 0 };
        else if (y >= D) anchorRef.current = { p: 1, y: D };
        const a = anchorRef.current;
        const p = a.p === 1
          ? (y >= a.y ? 1 : y / a.y)
          : (y <= a.y ? 0 : (y - a.y) / (D - a.y));
        collapseProgress.setValue(Math.min(1, Math.max(0, p)));
        const lockY = tabsYRef.current - 14;
        if (reelStyle === 'vertical' && tabsYRef.current > 0) {
          setTabsPinned(y >= lockY);
          if (y > lockY + 2) tabsArmedRef.current = true;
        }
        if (Object.keys(pinnedLatestRef.current).length > 0 && Math.abs(y - pinScrollYRef.current) > 600) releasePins();
        const { contentSize, layoutMeasurement } = e.nativeEvent;
        if (y + layoutMeasurement.height >= contentSize.height - 600) loadMoreExplore();
        if (y > TOP_BTN_THRESHOLD) showTopBtn();
        else hideTopBtn();

        if (y <= 0 && collapseStateRef.current !== 'expanded') {
          collapseStateRef.current = 'expanded';
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (y >= COLLAPSE_SCROLL_DISTANCE && collapseStateRef.current !== 'collapsed') {
          collapseStateRef.current = 'collapsed';
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (y > 0 && y < COLLAPSE_SCROLL_DISTANCE) {
          collapseStateRef.current = 'mid';
        }
      },
    },
  );

  const handleRingRowScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: ringScrollX } } }],
    { useNativeDriver: false },
  );

  const mainScrollRef = useRef<ScrollView>(null);
  const lastScrollYRef = useRef(0);
  const snapTimeoutRef = useRef<any>(null);

  const SNAP_COLLAPSE_AT = 0.6; // 40% away from fully collapsed
  const SNAP_EXPAND_AT = 0.4;   // 40% away from fully expanded

  const snapHeaderIfNeeded = () => {
    const p = progressRef.current;
    if (p <= 0.001 || p >= 0.999) return;
    animateCollapse(p >= 0.5 ? 1 : 0);
  };

  const scheduleSnapCheck = () => {
    clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(snapHeaderIfNeeded, 80);
  };

  // The 4 most recent groups participate in the collapse animation;
  // anything beyond that just fades away with the rest of the row.
  const myGroup = statusList.find((g) => String(g.user_id) === String(user?.id)) || null;
  const otherGroups = statusList.filter((g) => g !== myGroup);
const hasYouSlot = true;
  const collapsibleGroups = otherGroups.slice(0, MAX_COLLAPSIBLE);
  const restGroups = otherGroups.slice(MAX_COLLAPSIBLE);

  const rowContentOpacity = collapseProgress.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  const animatedRingRowHeight = collapseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [ringRowHeight, 0],
    extrapolate: 'clamp',
  });

  const miniRowCenterY = textRowHeight / 2 - MINI_RING_SIZE / 2;
  const scaleInset = (RING_SIZE - MINI_RING_SIZE) / 2;

  // Newest non-service listings for the "Just dropped" row
  const [allListings, setAllListings] = useState<any[]>([]);
  const isServiceItem = (p: any) => (p.category || p.category_name) === 'Services';
  const isBoosted = (p: any) => p.boosted_until && new Date(p.boosted_until) > new Date();
  const listings = useMemo(
    () => allListings.filter((p) => {
      switch (contentFilter) {
        case 'all': return true;
        case 'products': return !isServiceItem(p);
        case 'services': return isServiceItem(p);
        case 'new': return Date.now() - new Date(p.created_at).getTime() < 7 * 86400000;
        case 'featured': return !!isBoosted(p);
        default: return false;
      }
    }),
    [allListings, contentFilter]
  );
  const [boostedProducts, setBoostedProducts] = useState<any[]>([]);
  const [spotlightSeller, setSpotlightSeller] = useState<any>(null);
  const sellerDrag = useSheetDrag(() => setSpotlightSeller(null));
  useEffect(() => {
    if (spotlightSeller) sellerDrag.translateY.setValue(0);
  }, [!!spotlightSeller]);

  // Picks one of the old badge words as the section title.
  const spotlightWord = useMemo(() => {
    const words = ['Unique', 'Exclusive', 'Extraordinary'];
    return words[Math.floor(Math.random() * words.length)];
  }, []);

  // One entry per seller, holding all of that seller's boosted products.
  const boostedSellers = useMemo(() => {
    const map = new Map<string, any>();
    boostedProducts.forEach((p) => {
      const key = String(p.seller_id ?? p.seller_name);
      if (!map.has(key)) {
        map.set(key, {
          key,
          seller_id: p.seller_id,
          seller_name: p.seller_name,
          seller_avatar: p.seller_avatar,
          seller_plan: p.seller_plan,
          products: [],
        });
      }
      map.get(key).products.push(p);
    });
    return Array.from(map.values());
  }, [boostedProducts]);
  const exploreProducts = useMemo(() => listings.filter((p) => !isBoosted(p)), [listings]);

    useEffect(() => {
    api.get('/products/boosted').then((res) => setBoostedProducts(res.data || [])).catch(() => {});
  }, []);

  const activeGroupIndexRef = useRef(activeGroupIndex);
  activeGroupIndexRef.current = activeGroupIndex;

  // stop any playing feed video when leaving this screen / switching tabs
useFocusEffect(
  useCallback(() => {
    setScreenFocused(true);
    return () => { setScreenFocused(false); currentFeedStop?.(); releasePins(); };
  }, [])
);

  useEffect(() => {
    if (activeGroupIndex === null) setViewerSource('story');
  }, [activeGroupIndex]);

  useFocusEffect(
    useCallback(() => {
      if (activeGroupIndexRef.current !== null) return; // don't refetch under the open viewer
      let cancelled = false;
      if (!hasLoadedRef.current) setLoading(true);
      Promise.all([
        api.get('/stories/feed', { params: { limit: FEED_PAGE, offset: 0, foryou: 'true', kind: 'spotlight' } }),
        api.get('/stories/feed', { params: { limit: FEED_PAGE, offset: 0, foryou: 'true', kind: 'story' } }),
        api.get('/stories/feed', { params: { limit: 50, following: 'true', kind: 'story' } }),
      ])
        .then(([spotRes, statRes, folRes]) => {
          if (cancelled) return;
          const spot: StoryGroup[] = spotRes.data || [];
          const stat: StoryGroup[] = statRes.data || [];
          feedOffsetRef.current = spot.length;
          feedHasMoreRef.current = spot.length >= FEED_PAGE;
          statusOffsetRef.current = stat.length;
          statusHasMoreRef.current = stat.length >= FEED_PAGE;
          const orderMap: Record<string, number> = {};
          stat.forEach((g, i) => { orderMap[String(g.user_id)] = i; });
          setStatusOrder(orderMap);
          const nextGroups = mergeGroups(mergeGroups(spot, stat), folRes.data || []);

          // Drop any cached "already loaded" ids for stories that are no
          // longer in the feed (expired/removed), so they don't linger.
          const stillPresentIds = new Set(
            nextGroups.flatMap((g: StoryGroup) => g.stories.map((s) => s.id))
          );
          for (const id of loadedStoryIds.current) {
            if (!stillPresentIds.has(id)) loadedStoryIds.current.delete(id);
          }

          // Fully-viewed groups drop to the back only on a fresh focus of
          // this screen (leave + return) — never mid-session.
          const reordered = [
            ...nextGroups.filter((g: StoryGroup) => !g.allViewed),
            ...nextGroups.filter((g: StoryGroup) => g.allViewed),
          ];

          setGroups(reordered);

          Image.prefetch(
            reordered.flatMap((g: StoryGroup) =>
              g.stories.filter((s) => s.media_type !== 'video').map((s) => s.media_url)
            )
          );
        })
        .catch(() => {
          if (!cancelled) setGroups([]);
        })
        .finally(() => { if (!cancelled) { setLoading(false); hasLoadedRef.current = true; } });

      return () => { cancelled = true; };
    }, [])
  );

  // Moves to a (group, story) pair and computes mediaReady for it in the
  // SAME batch as the index change — otherwise there's a render where the
  // new story is showing but mediaReady still reflects the old one, which
  // caused the progress-bar flash.
  const markViewed = (s: Story) => {
    if (s.viewed) return;
    if (String(s.user_id) === String(user?.id) || String(s.user_id).startsWith('demo-')) return;
    api.post(`/stories/${s.id}/view`).catch(() => {});
    setGroups((prev) => prev.map((g) => {
      if (g.user_id !== s.user_id) return g;
      const stories = g.stories.map((x) => (x.id === s.id ? { ...x, viewed: true, view_count: (x.view_count ?? 0) + 1 } : x));
      return { ...g, stories, allViewed: stories.every((x) => x.viewed) };
    }));
  };

  const patchStory = (id: string, patch: Partial<Story>) => {
    setGroups((prev) => prev.map((g) => ({
      ...g,
      stories: g.stories.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })));
  };

  const removeStory = (id: string) => {
    setActiveGroupIndex(null);
    setActiveStoryIndex(0);
    setGroups((prev) => prev
      .map((g) => {
        const stories = g.stories.filter((s) => s.id !== id);
        return { ...g, stories, allViewed: stories.every((s) => s.viewed) };
      })
      .filter((g) => g.stories.length > 0));
  };

  const removeUser = (userId: string) => {
    setActiveGroupIndex(null);
    setActiveStoryIndex(0);
    setGroups((prev) => prev.filter((g) => String(g.user_id) !== String(userId)));
  };

  const toggleFeedLike = async (s: Story) => {
    const next = !s.liked;
    const count = s.like_count ?? 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    patchStory(s.id, { liked: next, like_count: Math.max(0, count + (next ? 1 : -1)) });
    try {
      if (next) await api.post(`/stories/${s.id}/like`);
      else await api.delete(`/stories/${s.id}/like`);
    } catch {
      patchStory(s.id, { liked: !next, like_count: count });
      Toast.show({ type: 'error', text1: "Couldn't update like" });
    }
  };

  const toggleFollow = async (g: StoryGroup) => {
    const next = !g.is_following;
    const setFollowing = (v: boolean) =>
      setGroups((prev) => prev.map((x) => (
        String(x.user_id) === String(g.user_id) ? { ...x, is_following: v } : x
      )));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowing(next);
    try {
      if (next) await api.post(`/follows/${g.user_id}`);
      else await api.delete(`/follows/${g.user_id}`);
      Toast.show({
        type: 'success',
        text1: next ? `Following ${g.user_name.split(' ')[0]}` : 'Unfollowed',
        text2: next ? "You'll be notified when they post" : undefined,
      });
    } catch {
      setFollowing(!next);
      Toast.show({ type: 'error', text1: "Couldn't update follow" });
    }
  };

    const toggleFeedRepost = async (s: Story) => {

    const next = !s.reposted;
    const pinKey = String(s.user_id);
    if (pinnedLatestRef.current[pinKey] === undefined) {
      const fi = feedItems.find((i) => String(i.group.user_id) === pinKey);
      if (fi) {
        pinnedLatestRef.current = { ...pinnedLatestRef.current, [pinKey]: fi.latest };
        setPinnedLatest(pinnedLatestRef.current);
        pinScrollYRef.current = lastScrollYRef.current;
      }
    }
    const prev = {
      reposted: s.reposted, repost_count: s.repost_count,
      reposted_by: s.reposted_by, last_repost_at: s.last_repost_at,
    };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    patchStory(s.id, {
      reposted: next,
      repost_count: Math.max(0, (s.repost_count ?? 0) + (next ? 1 : -1)),
      ...(next ? { last_repost_at: new Date().toISOString() } : {}),
    });
    try {
      const res = next
        ? await api.post(`/stories/${s.id}/repost`)
        : await api.delete(`/stories/${s.id}/repost`);
      patchStory(s.id, {
        repost_count: res.data.repost_count,
        reposted_by: res.data.reposted_by,
        top_reposters: res.data.top_reposters,
        last_repost_at: res.data.last_repost_at,
      });
      Toast.show({ type: 'success', text1: next ? 'Reposted' : 'Repost removed' });
    } catch {
      patchStory(s.id, prev);
      Toast.show({ type: 'error', text1: "Couldn't update repost" });
    }
  };

  const goToStory = (groupIdx: number, storyIdx: number, source: 'story' | 'spotlight' = viewerSource) => {
    setViewerSource(source);
    const list = source === 'spotlight' ? spotlightList : statusList;
    const nextStory = list[groupIdx]?.stories[storyIdx];
    if (nextStory && pinnedLatestRef.current[String(nextStory.user_id)] === undefined) releasePins();
    if (nextStory && nextStory.media_type !== 'video') {
      storyDurationsRef.current[nextStory.id] = PHOTO_DURATION_MS;
    }
    setActiveGroupIndex(groupIdx);
    setActiveStoryIndex(storyIdx);
    // Only trust the "already loaded" cache for images — a video should
    // always report back its own real duration via its player, never
    // reuse a leftover/default one.
    const cachedReady = nextStory
      ? nextStory.media_type !== 'video' && loadedStoryIds.current.has(nextStory.id)
      : false;
    setMediaReady(cachedReady);
  };

  const advanceStory = () => {
    if (activeGroupIndex === null) return;
    const group = groups[activeGroupIndex];
    if (activeStoryIndex < group.stories.length - 1) {
      goToStory(activeGroupIndex, activeStoryIndex + 1);
    } else if (reelStyle === 'vertical') {
      if (group.stories.length === 1) {
        setMediaReady(group.stories[0].media_type !== 'video');
        setReplayKey((k) => k + 1);
      } else {
        goToStory(activeGroupIndex, 0);
      }
    } else {
      goToStory((activeGroupIndex + 1) % groups.length, 0);
    }
  };

  const goBack = () => {
    if (activeGroupIndex === null) return;
    if (activeStoryIndex > 0) {
      goToStory(activeGroupIndex, activeStoryIndex - 1);
    } else {
      const prevGroupIdx = (activeGroupIndex - 1 + groups.length) % groups.length;
      const prevGroup = groups[prevGroupIdx];
      goToStory(prevGroupIdx, prevGroup.stories.length - 1);
    }
  };

  const openGroup = (index: number) => {
    goToStory(index, 0);
  };

  // Horizontal swipe — jumps straight to a different person's stories
  // (always starting at their first story), separate from the tap
  // zones which step through stories within the same group.
  const goToAdjacentGroup = (direction: 1 | -1) => {
    if (activeGroupIndex === null) return;
    const nextIdx = (activeGroupIndex + direction + groups.length) % groups.length;
    goToStory(nextIdx, 0);
  };

  // Deep-link: opened from a chat reply-to-story tap. If the story is
  // still in the live feed, jump straight to it there; otherwise fetch
  // it standalone (it may have expired) and open it as its own group.
  useEffect(() => {
    if (!openStoryId || loading) return;

    for (let gi = 0; gi < groups.length; gi++) {
      const si = groups[gi].stories.findIndex((s) => String(s.id) === String(openStoryId));
      if (si !== -1) {
        goToStory(gi, si);
        router.setParams({ openStoryId: undefined });
        return;
      }
    }

    api.get(`/stories/${openStoryId}`)
      .then((res) => {
        const s = res.data;
        const standaloneGroup: StoryGroup = {
          user_id: s.user_id,
          user_name: s.user_name,
          user_avatar: s.user_avatar,
          user_plan: s.user_plan,
          allViewed: true,
          stories: [{
            id: s.id,
            user_id: s.user_id,
            user_name: s.user_name,
            user_avatar: s.user_avatar,
            media_url: s.media_url,
            media_type: s.media_type,
            caption: s.caption,
            created_at: s.created_at,
            viewed: true,
            trim_start_ms: s.trim_start_ms,
            trim_end_ms: s.trim_end_ms,
            crop: s.crop,
            product_tag: s.product_tag,
            text_overlay: s.text_overlay,
            comments_off: s.comments_off,
          }],
        };
        setGroups((prev) => [standaloneGroup, ...prev]);
        setActiveGroupIndex(0);
        setActiveStoryIndex(0);
        setMediaReady(false);
      })
      .catch(() => {
        Toast.show({ type: 'error', text1: 'Story is no longer available' });
      })
      .finally(() => {
        router.setParams({ openStoryId: undefined });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStoryId, loading]);

  const exploreItems = useMemo(() => (
    exploreProducts
      .map((p: any) => ({
        type: 'product' as const,
        id: `product-${p.id}`,
        product: p,
        sortDate: p.created_at,
      }))
      .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
  ), [exploreProducts]);

  totalExploreRef.current = exploreItems.length;
  visibleCountRef.current = visibleCount;

  // One card per person, not per story— use their most recent story as
  // the cover/caption, same idea as the Spotlight/header ring treats a group.
  const statusItems = useMemo(() => (
    statusList
      .map((group, groupIndex) => {
        const latestStory = [...group.stories].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const latestIndex = group.stories.indexOf(latestStory);
        return {
          id: `story-group-${group.user_id}`,
          story: latestStory,
          group,
          groupIndex,
        };
      })
  ), [statusList]);

 const PLAN_RANK: Record<string, number> = { premium: 0, pro: 1 };
  const sortedStatusItems = useMemo(() => [...statusItems].sort((a: any, b: any) => {
    const pa = PLAN_RANK[a.group.user_plan ?? ''] ?? 2;
    const pb = PLAN_RANK[b.group.user_plan ?? ''] ?? 2;
    if (pa !== pb) return pa - pb;
    return (b.group.activity_count ?? 0) - (a.group.activity_count ?? 0);
  }), [statusItems]);

  // random order, kept stable per person so cards don't jump when a story is viewed
  const shuffleRef = useRef<Record<string, number>>({});
  const exploreStatusItems = useMemo(() => {
    sortedStatusItems.forEach((i: any) => {
      if (shuffleRef.current[i.id] === undefined) shuffleRef.current[i.id] = Math.random();
    });
    return [...sortedStatusItems].filter((i: any) => String(i.group.user_id) !== String(user?.id)).sort((a: any, b: any) =>
      (statusOrder[String(a.group.user_id)] ?? 9999) - (statusOrder[String(b.group.user_id)] ?? 9999));
  }, [sortedStatusItems, statusOrder]);
  // one post per person, newest activity first
  const feedItems = useMemo(() => (
    spotlightList
      .map((group, groupIndex) => ({
        id: `feed-${group.user_id}`,
        group,
        groupIndex,
        latest: pinnedLatest[String(group.user_id)] ?? Math.max(...group.stories.map((s) => Math.max(
          new Date(s.created_at).getTime(),
          s.last_repost_at ? new Date(s.last_repost_at).getTime() : 0,
        ))),
      }))
      .filter((i) => feedTab !== 'following' || !!i.group.is_following)
      .sort((a, b) => (feedTab === 'foryou' ? a.groupIndex - b.groupIndex : b.latest - a.latest))
  ), [spotlightList, pinnedLatest, feedTab]);
  totalExploreRef.current = reelStyle === 'vertical' ? feedItems.length : exploreStatusItems.length;
  const tabsLockY = tabsY - 14;

  const [screenFocused, setScreenFocused] = useState(true);

  if (loading) {
    return <StoriesSkeleton colors={colors} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
         <View ref={headerRef} style={{ backgroundColor: colors.card, paddingBottom: 34, position: 'relative' }}>
        <View
          onLayout={(e) => {
            const measured = e.nativeEvent.layout.height;
            setTextRowHeight((prev) => Math.max(prev, measured));
            measureRingRowOffset();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
              {greeting}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
        </View>

        {/* Your story row — height collapses to 0 on scroll, no gap left behind */}
        <Animated.View style={{ height: animatedRingRowHeight, overflow: 'hidden' }}>
          <View
            ref={ringRowInnerRef}
            onLayout={(e) => {
              // Guard against a stray early/short measurement (common with
              // horizontal ScrollViews on some platforms) permanently
              // shrinking the row — a real reading can only grow it.
              const measured = e.nativeEvent.layout.height;
              setRingRowHeight((prev) => Math.max(prev, measured));
              measureRingRowOffset();
            }}
            style={{ paddingTop: RING_ROW_TOP_PADDING }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: HEADER_PADDING_H, gap: RING_ROW_GAP }}
              onScroll={handleRingRowScroll}
              scrollEventThrottle={16}
            >
              {hasYouSlot && (
                <Animated.View style={{ opacity: rowContentOpacity }}>
                  <Pressable
                    onPress={() => router.push('/stories/new')}
                    style={{ alignItems: 'center', width: RING_SIZE }}
                  >
                    {myGroup ? (
                      <GradientRing viewed={false} dashed colors={colors} segments={myGroup.stories.length} group={myGroup}>
                        {myGroup.user_avatar ? (
                          <Image
                            source={{ uri: myGroup.user_avatar }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={{ flex: 1, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>
                              {myGroup.user_name?.[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </GradientRing>
                    ) : (
                      <View
                        style={{
                          width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
                          borderWidth: 2, borderStyle: 'dashed',
                          borderColor: colors.brand,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: colors.brandSoft,
                        }}
                      >
                        <Plus size={22} color={colors.brand} strokeWidth={2.5} />
                      </View>
                    )}
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 }}
                    >
                      {myGroup ? 'My Story' : 'You'}
                    </Text>
                  </Pressable>
                </Animated.View>
              )}

              {/* Invisible placeholders — reserve exact layout space for the 4
                  circles that are actually rendered in the header overlay below,
                  so nothing jumps and the real circles are the only instances. */}
              {collapsibleGroups.map((group, index) => (
                <Animated.View key={`${group.user_id}-${index}`} style={{ opacity: rowContentOpacity }}>
                  <Pressable
                    onPress={() => openGroup(groups.indexOf(group))}
                    style={{ alignItems: 'center', width: RING_SIZE }}
                  >
                    <GradientRing viewed={group.allViewed} storiesViewed={group.stories.map((s) => Boolean(s.viewed))} colors={colors} segments={group.stories.length} group={group}>
                      {group.user_avatar ? (
                        <Image
                          source={{ uri: group.user_avatar }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: colors.chipBg,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>
                            {group.user_name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </GradientRing>
                    <RingName group={group} colors={colors} />
                  </Pressable>
                </Animated.View>
              ))}

              {restGroups.map((group, i) => {
                const index = i + MAX_COLLAPSIBLE;
                return (
                  <Animated.View key={group.user_id} style={{ opacity: rowContentOpacity }}>
                    <Pressable
                      onPress={() => openGroup(groups.indexOf(group))}
                      style={{ alignItems: 'center', width: RING_SIZE }}
                    >
                      <GradientRing viewed={group.allViewed} storiesViewed={group.stories.map((s) => Boolean(s.viewed))} colors={colors} segments={group.stories.length} group={group}>
                        {group.user_avatar ? (
                          <Image
                            source={{ uri: group.user_avatar }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={{
                              flex: 1,
                              backgroundColor: colors.chipBg,
                              alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>
                              {group.user_name?.[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </GradientRing>
                      <RingName group={group} colors={colors} />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </ScrollView>
          </View>
        </Animated.View>

        {/* Overlay: the actual 4 collapsible circles — same elements throughout,
            they translate/scale from their row position into the tucked,
            overlapping spot beside the title/subtitle. Never faded in/out. */}
        <View
          pointerEvents={ringOverlayInteractive ? 'box-none' : 'none'}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        >
          {collapsibleGroups.map((group, i) => {
            const startX = HEADER_PADDING_H + (hasYouSlot ? RING_SIZE + RING_ROW_GAP : 0) + i * (RING_SIZE + RING_ROW_GAP);
            const startY = ringRowOffsetY;
            const endX = SCREEN_WIDTH - HEADER_PADDING_H - MINI_RING_SIZE - i * MINI_RING_STEP;
            const endY = miniRowCenterY;

            const baseTranslateX = collapseProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [startX, endX - scaleInset],
              extrapolate: 'clamp',
            });
            const translateX = Animated.add(
              baseTranslateX,
              Animated.multiply(Animated.multiply(ringScrollX, -1), ringScrollInfluence),
            );
            const translateY = collapseProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [startY, endY - scaleInset],
              extrapolate: 'clamp',
            });
            const scale = collapseProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, MINI_RING_SIZE / RING_SIZE],
              extrapolate: 'clamp',
            });
            const labelOpacity = collapseProgress.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [1, 0, 0],
              extrapolate: 'clamp',
            });
            const overlayOpacity = collapseProgress.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 1, 1],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={group.user_id}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: RING_SIZE,
                  alignItems: 'center',
                  zIndex: collapsibleGroups.length - i,
                  opacity: overlayOpacity,
                  transform: [{ translateX }, { translateY }],
                }}
              >
                <Animated.View style={{ transform: [{ scale }] }}>
                  <Pressable onPress={() => openGroup(groups.indexOf(group))}>
                    <GradientRing viewed={group.allViewed} storiesViewed={group.stories.map((s) => Boolean(s.viewed))} colors={colors} segments={group.stories.length} group={group}>
                      {group.user_avatar ? (
                        <Image
                          source={{ uri: group.user_avatar }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: colors.chipBg,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>
                            {group.user_name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </GradientRing>
                  </Pressable>
                </Animated.View>
<Animated.View style={{ opacity: labelOpacity }}>
  <RingName group={group} colors={colors} />
</Animated.View>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {reelStyle === 'vertical' && statusList.length === 0 && spotlightAll.length === 0 ? (
        <EmptyState colors={colors} onAdd={() => router.push('/stories/new')} />
      ) : (
        <View style={{ flex: 1, marginTop: -14 }}>
        <Animated.ScrollView
          ref={mainScrollRef}
          scrollEnabled={!mainScrollLocked}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          nestedScrollEnabled
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollEndDrag={scheduleSnapCheck}
          onMomentumScrollEnd={() => { clearTimeout(snapTimeoutRef.current); snapHeaderIfNeeded(); }}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
          onScrollBeginDrag={() => { tabsArmedRef.current = false; }}
        >
          {/* Status — half the size of Spotlight cards, own horizontal-scrolling
              row so it's completely separate from products in Explore */}
          {(reelStyle !== 'vertical' || sortedStatusItems.length > 0 || spotlightAll.length > 0 || filterActive) && (
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  {reelStyle === 'vertical' && (
                    <Flame size={22} color={colors.brand} strokeWidth={2.2} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {reelStyle === 'vertical' ? 'Feed' : (sortedStatusItems.some((i: any) => i.group.is_following) ? 'Following' : 'For You')}
                    </Text>
                    {reelStyle === 'vertical' && (
                      <Text numberOfLines={1} style={{ fontSize: 14, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
                        Fresh posts from your campus
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                  <Pressable
                    onPress={() => setReelStyleOpen(true)}
                    hitSlop={8}
                  >
                    <DevicePhoneMobileIcon size={18} color={theme === 'dark' ? '#f5b301' : '#b45309'} />
                  </Pressable>
                  {reelStyle === 'vertical' && (
                    <>
                      <Text style={{ marginHorizontal: 8, fontSize: 16, color: theme === 'dark' ? '#f5b301' : '#b45309' }}>|</Text>
                      <Pressable
                        onPress={() => setFilterOpen(true)}
                        hitSlop={8}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                      >
                        <Text
                          style={{
                            fontSize: 13, fontWeight: '800', letterSpacing: 0.6,
                            color: theme === 'dark' ? '#f5b301' : '#b45309',
                          }}
                        >
                          {(CONTENT_TYPES.find((t) => t.key === contentFilter)?.label ?? 'CONTENT TYPE').toUpperCase()}
                        </Text>
                        <ChevronRight size={14} color={theme === 'dark' ? '#f5b301' : '#b45309'} strokeWidth={2.6} />
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              >
                {(reelStyle === 'vertical' ? ([] as typeof sortedStatusItems) : sortedStatusItems.filter((i: any) => i.group.is_following)).map((item) => (
                  <StatusCard
                    key={item.id}
                    item={item}
                    colors={colors}
                    onPress={() => goToStory(item.groupIndex, 0)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {filterActive && sortedStatusItems.length === 0 && boostedProducts.length === 0 && (
            <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 15, marginTop: 40 }}>
              Nothing here for this content type yet
            </Text>
          )}

          {/* Boosted — browse-style band with shadows + launch animation, feed (vertical) mode only */}
          {reelStyle === 'vertical' && boostedProducts.length > 0 && (
            <View style={{ marginTop: 20, backgroundColor: theme === 'dark' ? '#0a0a0a' : '#ffffff' }}>
              <InsetShadow direction="down" />
              <View style={{ paddingBottom: 0 }}>
                <View style={{ paddingHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <RocketLaunch color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      Boosted
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
                      Promoted by sellers. Priority placement, just for a while.
                    </Text>
                  </View>
                </View>
                <BoostedCarousel items={boostedProducts} onLock={setMainScrollLocked} hapticsOn={circlesExpanded} />
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
                <InsetShadow direction="up" />
              </View>
            </View>
          )}

          {/* Reel feed (vertical mode) */}
          {reelStyle === 'vertical' && (
            <View
              style={{ marginTop: 20 }}
              onLayout={(e) => { tabsYRef.current = e.nativeEvent.layout.y; setTabsY(e.nativeEvent.layout.y); }}
            >
<View style={{ flexDirection: 'row', marginBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
  <FeedTabs
  feedTab={feedTab}
  colors={colors}
  onChange={(key) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFeedTab(key); setVisibleCount(PAGE_SIZE); }}
/>
              </View>
              {feedTab === 'following' && feedItems.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 15, marginTop: 40, paddingHorizontal: 30 }}>
                  Follow people to see their posts here
                </Text>
              )}
              {feedItems.slice(0, visibleCount).map((item) => (
                <FeedPost
                  key={item.id}
                  item={item}
                  colors={colors}
                  isOwn={String(item.group.user_id) === String(user?.id)}
                  scrollY={scrollY}
                  onOpen={(storyIndex) => goToStory(item.groupIndex, storyIndex, 'spotlight')}
                  onLike={(story) => toggleFeedLike(story)}
                  onRepost={(story) => toggleFeedRepost(story)}
                  viewerOpen={activeGroupIndex !== null || !screenFocused}
                  onView={(story) => markViewed(story)}
                  onComments={(story) => story.comments_off && String(story.user_id) !== String(user?.id)
                    ? Toast.show({ type: 'error', text1: 'Comments are turned off' })
                    : setCommentsStoryId(story.id)}
                  onExport={(story) => setExportStory(story)}
                  onOpenProfile={(group) => setPreviewGroup(group)}
                  onFollow={(group) => toggleFollow(group)}
                  onChat={(story) => openChat({
                    sellerId: item.group.user_id,
                    sellerName: item.group.user_name,
                    draftMessage: '',
                    storyId: story.id,
                    storyMediaUrl: story.media_url,
                    storyMediaType: story.media_type,
                    storyCaption: story.caption,
                  })}
                />
              ))}
            </View>
          )}

          {/* Explore — 2-column grid, 10 rows */}
          <View style={{ marginTop: 28, paddingHorizontal: 8, display: reelStyle === 'vertical' ? 'none' : 'flex' }}>
            {sortedStatusItems.some((i: any) => i.group.is_following) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    For You
                  </Text>
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {exploreStatusItems.slice(0, visibleCount).map((item: any) => (
                <View key={item.id} style={{ width: (SCREEN_WIDTH - 8 * 2 - 8) / 2 }}>
                  <ExploreStoryCard item={item} onPress={() => goToStory(item.groupIndex, 0)} />
                </View>
              ))}
            </View>
          </View>
          {loadingMore && (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />
          )}
        </Animated.ScrollView>

        {reelStyle === 'vertical' && (
          <Animated.View
            pointerEvents={tabsPinned ? 'auto' : 'none'}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
              paddingTop: 14,
              backgroundColor: colors.background,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              opacity: scrollY.interpolate({
                inputRange: [tabsLockY - 1, tabsLockY],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            }}
          >
<View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <FeedTabs
                feedTab={feedTab}
                colors={colors}
                onChange={(key) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFeedTab(key); setVisibleCount(PAGE_SIZE); }}
              />
            </View>
          </Animated.View>
        )}
        </View>
      )}

      <Modal
        visible={!!exportStory}
        transparent
        animationType="slide"
        onRequestClose={() => setExportStory(null)}
      >
        <ExportSheet
          isImage={exportStory?.media_type !== 'video'}
          onClose={() => setExportStory(null)}
          onPick={(kind) => {
            const s = exportStory;
            setExportStory(null);
            if (s) setTimeout(() => runExport(s, kind, toastUi, (c) => patchStory(s.id, { export_count: c })), 350);
          }}
        />
        <Toast />
      </Modal>

      {/* Scroll-to-top button */}
      <Animated.View
        pointerEvents={topBtnTouchable ? 'box-none' : 'none'}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center',
          opacity: topBtnOpacity,
          transform: [{ translateY: topBtnOpacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <Pressable
          onPress={() => {
            mainScrollRef.current?.scrollTo({ y: 0, animated: true });
            hideTopBtn();
          }}
          hitSlop={8}
          style={{
            width: 34, height: 34, borderRadius: 17,
            borderWidth: 3, borderColor: colors.brand,
            overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <BlurView intensity={30} tint={theme === 'dark' ? 'dark' : 'light'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <ChevronUp size={18} color={colors.brand} strokeWidth={2.8} />
        </Pressable>
      </Animated.View>

      {/* Comments sheet (feed message icon) */}
      <CommentsSheet
        story={
          commentsStoryId
            ? allGroups.flatMap((g) => g.stories).find((s) => s.id === commentsStoryId) ?? null
            : null
        }
        colors={colors}
        onClose={() => setCommentsStoryId(null)}
        onCountChange={(id, count) => patchStory(id, { comment_count: count })}
      />

      {/* Reel style picker */}
      <Modal
        visible={reelStyleOpen}
        transparent
        animationType="none"
        onRequestClose={() => setReelStyleOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setReelStyleOpen(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <Animated.View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 12,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: reelDrag.translateY }],
            }}
          >
            <View {...reelDrag.panHandlers} style={{ paddingBottom: 14 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>View mode</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
                    Choose how you move through stories.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setReelStyleOpen(false)}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.brand }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>Done</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, justifyContent: 'center' }}>
              {([
                { key: 'horizontal', label: 'Following Statuses', desc: 'View statuses from people you follow' },
                { key: 'vertical', label: 'Spotlight Feed', desc: 'Explore posts from everyone on campus' },
              ] as const).map((s) => {
                const active = reelStyle === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setReelStyle(s.key);
                      AsyncStorage.setItem('reel_style_v1', s.key).catch(() => {});
                    }}
                    style={{
                      width: '46%', padding: 10, borderRadius: 14,
                      backgroundColor: active ? colors.brandSoft : 'transparent',
                      borderWidth: 1.5, borderColor: active ? colors.brand : colors.border,
                    }}
                  >
                    <ReelStyleSkeleton direction={s.key} colors={colors} />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 9 }}>{s.label}</Text>
                    <Text style={{ fontSize: 13, lineHeight: 15, color: colors.textMuted, marginTop: 3 }}>{s.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Content type filter */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="none"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setFilterOpen(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <Animated.View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 12,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: filterDrag.translateY }],
            }}
          >
            <View {...filterDrag.panHandlers} style={{ paddingBottom: 4 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Content type</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 14 }}>
                    Choose what you see in Spotlight.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setFilterOpen(false)}
                  style={{ backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, alignSelf: 'flex-start' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>Done</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.6, marginBottom: 18 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CONTENT_TYPES.map((t) => {
                  const active = contentFilter === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setContentFilter(t.key === 'all' || active ? 'all' : t.key);
                      }}
                      style={{
                        width: (SCREEN_WIDTH - 40 - 20) / 3,
                        padding: 10, borderRadius: 16, minHeight: 96,
                        backgroundColor: active ? colors.brandSoft : colors.chipBg,
                        borderWidth: 1.5, borderColor: active ? colors.brand : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 26 }}>{t.emoji}</Text>
                        {active && <Check size={16} color={colors.brand} strokeWidth={3} />}
                      </View>
                      <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 6 }}>{t.label}</Text>
                      <Text numberOfLines={2} style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 12 }}>{t.desc}</Text>
                    </Pressable>
                                     );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Seller's boosted products */}
      <Modal
        visible={!!spotlightSeller}
        transparent
        animationType="slide"
        onRequestClose={() => setSpotlightSeller(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setSpotlightSeller(null)}
        >
          <Animated.View style={{ transform: [{ translateY: sellerDrag.translateY }] }}>
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingTop: 12, paddingBottom: insets.bottom + 16,
            }}
          >
            <View {...sellerDrag.panHandlers} style={{ paddingTop: 12, paddingBottom: 14, marginTop: -12 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                {spotlightSeller?.seller_avatar ? (
                  <Image source={{ uri: spotlightSeller.seller_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand }}>
                      {spotlightSeller?.seller_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, fontWeight: '800', color: colors.text }}>
                    {spotlightSeller?.seller_name}
                  </Text>
                  <PlanBadge plan={spotlightSeller?.seller_plan} size={13} />
                </View>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  {spotlightSeller?.products?.length || 0} boosted {(spotlightSeller?.products?.length || 0) === 1 ? 'listing' : 'listings'}
                </Text>
              </View>
              <Pressable onPress={() => setSpotlightSeller(null)} hitSlop={8}>
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: SCREEN_HEIGHT * 0.6 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {(spotlightSeller?.products || []).map((p: any) => (
                <View key={p.id} style={{ width: (SCREEN_WIDTH - 16 * 2 - 12) / 2 }}>
                  <ExploreCard
                    item={{ product: p }}
                    colors={colors}
                    onPress={() => {
                      setSpotlightSeller(null);
                      // Let the sheet close before navigating, otherwise iOS can glitch.
                      setTimeout(() => router.push(`/product/${p.id}`), 250);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Spotlight profile preview (from feed avatar/name tap) */}
      {!!previewGroup && (
        <SpotlightPreviewModal
          group={previewGroup}
          colors={colors}
          onClose={() => setPreviewGroup(null)}
          onOpenProfile={(g) => {
            setPreviewGroup(null);
            setTimeout(() => {
              router.push({ pathname: '/SpotlightProfile', params: { userId: g.user_id, guest: '1' } });
            }, 200);
          }}
        />
      )}

      {/* Full-screen viewer */}
      <Modal
        visible={activeGroupIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveGroupIndex(null)}
      >
        {activeGroupIndex !== null && (
          <StoryViewerLocal
            group={groups[activeGroupIndex]}
            story={groups[activeGroupIndex].stories[activeStoryIndex]}
            durationMs={
              storyDurationsRef.current[groups[activeGroupIndex].stories[activeStoryIndex].id]
              ?? PHOTO_DURATION_MS
            }
            mediaReady={mediaReady}
            replayKey={replayKey}
            reelStyle={reelStyle}
            onPatch={patchStory}
            onRemoveStory={removeStory}
            onArchive={removeStory}
            onRemoveUser={removeUser}
            onRepost={toggleFeedRepost}
            onFollow={toggleFollow}
            onMediaReady={(durationMs?: number) => {
              const currentStory = groups[activeGroupIndex]?.stories[activeStoryIndex];
              if (currentStory) {
                markViewed(currentStory);
                loadedStoryIds.current.add(currentStory.id);
                if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
                  storyDurationsRef.current[currentStory.id] = Math.min(durationMs, MAX_VIDEO_DURATION_MS);
                } else if (!storyDurationsRef.current[currentStory.id]) {
                  storyDurationsRef.current[currentStory.id] = PHOTO_DURATION_MS;
                }
              }
              setMediaReady(true);
            }}
            isOwnStory={String(groups[activeGroupIndex].user_id) === String(user?.id)}
            onClose={() => setActiveGroupIndex(null)}
            onBack={goBack}
            onNext={advanceStory}
            notice={viewerNotice}
            onSwipeNextGroup={() => goToAdjacentGroup(1)}
            onSwipePrevGroup={() => goToAdjacentGroup(-1)}
            prevGroup={groups.length > 1 ? groups[(activeGroupIndex - 1 + groups.length) % groups.length] : undefined}
            nextGroup={groups.length > 1 ? groups[(activeGroupIndex + 1) % groups.length] : undefined}
            onQuickReact={async (emoji: string) => {
              const g = groups[activeGroupIndex];
              const s = g.stories[activeStoryIndex];
              return await sendQuickMessage(g.user_id, emoji, s.id);
            }}
            onReply={(text: string) => {
              const activeGroup = groups[activeGroupIndex];
              const activeStory = activeGroup.stories[activeStoryIndex];
              setActiveGroupIndex(null);
              setActiveStoryIndex(0);
              openChat({
                sellerId: activeGroup.user_id,
                sellerName: activeGroup.user_name,
                draftMessage: text,
                storyId: activeStory.id,
                storyMediaUrl: activeStory.media_url,
                storyMediaType: activeStory.media_type,
                storyCaption: activeStory.caption,
              });
            }}
          />
        )}
        <Toast />
      </Modal>
    </View>
  );
}

// ─── GRADIENT RING ───────────────────────────────────────────────────
// ─── SEGMENTED RING (SVG) ─────────────────────────────────────────────
// Draws the ring as N equal dashed arcs — a dash pattern of [segmentLen,
// gapLen] sized so it repeats exactly N times around the circumference,
// giving N visible cuts: 2 stories → 2 arcs, 3 → 120° each, 4 → a "plus".
const RING_SEGMENT_GAP_DEG = 10;

function SegmentedRingSvg({
  size, strokeWidth, segmentsViewed, dimColor, activeColor, gradientId,
}: {
  size: number; strokeWidth: number; segmentsViewed: boolean[]; dimColor: string; activeColor: string; gradientId?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const n = Math.max(1, segmentsViewed.length);
  const gapLen = n > 1 ? (RING_SEGMENT_GAP_DEG / 360) * circumference : 0;
  const segLen = n > 1 ? (circumference - n * gapLen) / n : circumference;
  const unitLen = segLen + gapLen;

  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      {gradientId && (
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#f59e0b" />
            <Stop offset="25%" stopColor="#ef4444" />
            <Stop offset="50%" stopColor="#a855f7" />
            <Stop offset="75%" stopColor="#3b82f6" />
            <Stop offset="100%" stopColor="#f59e0b" />
          </SvgLinearGradient>
        </Defs>
      )}
      {segmentsViewed.map((wasViewed, i) => (
        <Circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={wasViewed ? dimColor : (gradientId ? `url(#${gradientId})` : activeColor)}
          strokeWidth={strokeWidth}
          strokeDasharray={`${segLen}, ${circumference - segLen}`}
          strokeDashoffset={-i * unitLen}
          strokeLinecap={n > 1 ? 'round' : 'butt'}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      ))}
    </Svg>
  );
}

// ─── GRADIENT RING ───────────────────────────────────────────────────
function GradientRing({
  viewed, storiesViewed, plan, colors, children, size = RING_SIZE, segments = 1, group, dashed,
}: {
  viewed: boolean; storiesViewed?: boolean[]; plan?: 'pro' | 'premium'; colors: any; children?: React.ReactNode;
  size?: number; segments?: number; group?: StoryGroup; dashed?: boolean;
}) {
  const gradientIdRef = useRef(`ring-grad-${Math.random().toString(36).slice(2)}`);

  const segArray = storiesViewed && storiesViewed.length > 0
    ? storiesViewed
    : Array.from({ length: Math.max(1, segments) }, () => viewed);

  const hasUnviewedSegment = segArray.some((v) => !v);
  const strokeWidth = viewed ? 2 : 2.5;
  const activeColor = plan === 'pro' ? '#f5b301' : '#f59e0b';
  const avatarSize = viewed ? size - 8 : size - 9;
  const avatarOffset = (size - avatarSize) / 2;

  if (dashed) {
    const innerSize = size;
    return (
      <View
        style={{
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: innerSize, height: innerSize, borderRadius: innerSize / 2,
            overflow: 'hidden', backgroundColor: colors.chipBg,
          }}
        >
          {group ? <StoryCircleThumb group={group} colors={colors} /> : children}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={24} color="#fff" strokeWidth={2.5} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <SegmentedRingSvg
        size={size}
        strokeWidth={strokeWidth}
        segmentsViewed={segArray}
        dimColor={colors.border}
        activeColor={activeColor}
        gradientId={hasUnviewedSegment && plan !== 'pro' ? gradientIdRef.current : undefined}
      />
      <View
        style={{
          position: 'absolute',
          left: avatarOffset, top: avatarOffset,
          width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
          overflow: 'hidden',
          borderWidth: viewed ? 0 : 2,
          borderColor: colors.card,
          backgroundColor: colors.chipBg,
        }}
      >
        {group ? <StoryCircleThumb group={group} colors={colors} /> : children}
      </View>
    </View>
  );
}
// ─── EXPLORE STORY VIDEO THUMBNAIL ───────────────────────────────────
// Shows the video's own first frame (paused) instead of a static image,
// since a video URL can't be dropped straight into an <Image>.
function ExploreStoryVideoThumb({ uri, crop }: { uri: string; crop?: VideoCropT | null }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false;
    p.muted = true;
  });

  return (
    <View style={{ width: '100%', height: '100%' }}>
      <CroppedVideoView player={player} crop={crop} />
    </View>
  );
}

// ─── EXPLORE CARD ────────────────────────────────────────────────────
function ExploreCard({ item, colors, onPress }: { item: any; colors: any; onPress: () => void }) {
  const { product } = item;
  const price = parseFloat(product.price) || 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.chipBg }}>
        <Image
          source={{ uri: product.primary_image }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: product.condition === 'new' ? '#10b981' : 'rgba(0,0,0,0.55)',
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.4 }}>
            {(product.condition || '').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ padding: 10 }}>
        <Text
          numberOfLines={2}
          style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 17 }}
        >
          {product.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>{product.seller_name}</Text>
          <PlanBadge plan={product.seller_plan} size={10} />   
        </View>
        {!!product.description && (
          <Text
            numberOfLines={2}
            style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 }}
          >
            {product.description}
          </Text>
        )}
        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.brand, marginTop: 6 }}>
          GHS {price.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
}

// Muted, looping, autoplaying video for a spotlight slide (no controls, no play icon)
function SpotlightVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
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

// ─── STATUS CARD (story preview, half the Spotlight card size) ──────
function StatusCard({
  item, colors, onPress,
}: { item: any; colors: any; onPress: () => void }) {
  const { story, group } = item;

  return (
    <Pressable onPress={onPress} style={{ width: STATUS_CARD_WIDTH }}>
      <View
        style={{
          width: STATUS_CARD_WIDTH,
          height: STATUS_CARD_HEIGHT,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: colors.chipBg,
        }}
      >
        {story.media_type === 'video' ? (
          <ExploreStoryVideoThumb uri={story.media_url} crop={story.crop} />
        ) : (
          <Image
            source={{ uri: story.media_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
        />

        <View
          style={{
            position: 'absolute', top: 8, left: 8,
            backgroundColor: 'rgba(0,0,0,0.55)',
            paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.4 }}>
            STORY
          </Text>
        </View>

        <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <View
              style={{
                width: 18, height: 18, borderRadius: 9, overflow: 'hidden',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
              }}
            >
              {group.user_avatar ? (
                <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand }}>
                    {group.user_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#fff' }}>
                {group.user_name.split(' ')[0]}
              </Text>
              <PlanBadge plan={group.user_plan} size={10} />
            </View>
          </View>
          {story.caption && (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 14 }}
            >
              {story.caption}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ExploreStoryCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { story } = item;
  return (
    <Pressable
      onPress={onPress}
      style={{ width: '100%', aspectRatio: 0.62, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1f1f23' }}
    >
      {story.media_type === 'video' ? (
        <ExploreStoryVideoThumb uri={story.media_url} crop={story.crop} />
      ) : (
        <Image source={{ uri: story.media_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      )}
      {!!story.caption && (
        <Text
          numberOfLines={2}
          style={{
            position: 'absolute', left: 10, right: 10, bottom: 10,
            fontSize: 16, fontWeight: '800', color: '#fff',
            textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
          }}
        >
          {story.caption}
        </Text>
      )}
    </Pressable>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────
function EmptyState({ colors, onAdd }: { colors: any; onAdd: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
        No stories yet
      </Text>
      <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
        Be the first to share a moment from your campus.
      </Text>
      <Pressable
        onPress={onAdd}
        style={{
          marginTop: 20,
          paddingHorizontal: 22,
          paddingVertical: 11,
          borderRadius: 999,
          backgroundColor: colors.brand,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textOnGold }}>
          Share a story
        </Text>
      </Pressable>
    </View>
  );
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

// ─── FEED POST (one post per person, swipe sideways through their stories) ───
// ─── FEED POST (one post per person, swipe sideways through their stories) ───
function FeedPost({
  item, colors, onOpen, onLike, onChat, isOwn, scrollY, onComments, onExport, onRepost, viewerOpen, onOpenProfile, onFollow, onView,
}: {
  viewerOpen: boolean;
  onView: (story: Story) => void;
  item: any; colors: any; scrollY: Animated.Value;
  onOpen: (storyIndex: number) => void;
  onLike: (story: Story) => void;
  onChat: (story: Story) => void;
  onComments: (story: Story) => void;
  onExport: (story: Story) => void;
  onRepost: (story: Story) => void;
  onOpenProfile: (group: any) => void;
  onFollow: (group: any) => void;
  isOwn: boolean;
}) {
  const { group } = item;
  const router = useRouter();
  const stories: Story[] = group.stories;
  const [index, setIndex] = useState(0);
  const activeIdx = Math.min(index, stories.length - 1);
  const story: Story = stories[activeIdx];
  const stat = {
    fontSize: 15, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  } as const;
  const mediaW = SCREEN_WIDTH;
  const ACTION_H = 44;
  const CORNER_R = 18;
  const [iconsW, setIconsW] = useState(0);
  const STORE_W = iconsW > 0 ? SCREEN_WIDTH - 16 - iconsW - CORNER_R + 8 : 110;
  const fullH = SCREEN_WIDTH - 84 + ACTION_H;
  const [expanded, setExpanded] = useState(false);
    const [repostersOpen, setRepostersOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(0);
  const toggleReposters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (repostersOpen) { setRepostersOpen(false); return; }
    // open the panel right under this post
    postRef.current?.measureInWindow((_x, y, _w, h) => {
      setPanelTop(Math.min(y + h, SCREEN_HEIGHT - 340));
      setRepostersOpen(true);
    });
  };
  const [inFocus, setInFocus] = useState(false);
  const [scrolledAway, setScrolledAway] = useState(false);
  const [muted, setMuted] = useState(true);
  const postRef = useRef<View>(null);
  const awayCheckRef = useRef(0);
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const doubleLike = (x: number, y: number) => {
    setBurst((b) => ({ id: (b?.id ?? 0) + 1, x, y }));
    if (!story.liked) onLike(story);
  };

  // while expanded, collapse again once the post has scrolled out of view
  useEffect(() => {
    if (!expanded) return;
    const id = scrollY.addListener(() => {
      postRef.current?.measureInWindow((_x, y, _w, h) => {
        if (y + h < 100 || y > SCREEN_HEIGHT) setExpanded(false);
      });
    });
    return () => scrollY.removeListener(id);
  }, [expanded]);

  // a post is "in focus" when its centre sits in the middle band of the screen,
  // so only one post can ever qualify at a time
  useEffect(() => {
    let trailing: any;
    const measure = () => {
      postRef.current?.measureInWindow((_x, y, _w, h) => {
        if (!h) return;
        const center = y + h / 2;
        setInFocus(center > SCREEN_HEIGHT * 0.3 && center < SCREEN_HEIGHT * 0.7);
        setScrolledAway(y + h < -50 || y > SCREEN_HEIGHT + 50);
      });
    };
    const id = scrollY.addListener(() => {
      const now = Date.now();
      if (now - awayCheckRef.current >= 100) { awayCheckRef.current = now; measure(); }
      clearTimeout(trailing);
      trailing = setTimeout(measure, 150); // catches the final resting position
    });
    const init = setTimeout(measure, 300);   // initial check, no scroll needed
    return () => { scrollY.removeListener(id); clearTimeout(trailing); clearTimeout(init); };
  }, []);

  // each time a video scrolls away, it starts muted again next time
  useEffect(() => { if (scrolledAway) setMuted(true); }, [scrolledAway]);

  return (
    <View ref={postRef} collapsable={false} style={{ paddingTop: 20 }}>
      <View
        style={{
          flexDirection: 'row', gap: 12, paddingHorizontal: 16,
          alignItems: story.caption ? 'flex-start' : 'center',
        }}
      >
        <Pressable onPress={() => onOpenProfile(group)} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.chipBg }}>
          {group.user_avatar ? (
            <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.brand }}>
                {group.user_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable onPress={() => onOpenProfile(group)} hitSlop={4} style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                {group.user_name}
              </Text>
            </Pressable>
            <PlanBadge plan={group.user_plan} size={14} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>·</Text>
              <Play size={14} color={colors.textMuted} />
              <Text style={{ fontSize: 16, color: colors.textMuted }}>{formatCount(story.view_count ?? 0)}</Text>
            </View>
          </View>

          {!!story.caption && (
            <Pressable onPress={() => setExpanded((e) => !e)}>
              <Text
                numberOfLines={expanded ? undefined : 1}
                ellipsizeMode="tail"
                style={{ fontSize: 16, lineHeight: 20, color: colors.textMuted, marginTop: 2 }}
              >
                {story.caption}
              </Text>
            </Pressable>
          )}
        </View>
        {!isOwn && (
          <View style={{ alignSelf: 'center' }}>
            <FollowChatButtons
              group={group}
              colors={colors}
              onFollow={() => onFollow(group)}
              onChat={() => onChat(story)}
            />
          </View>
        )}
      </View>

      {/* edge-to-edge media: swipe sideways through this person's stories */}
      <View style={{ marginTop: 10, width: SCREEN_WIDTH, height: fullH, overflow: 'hidden', backgroundColor: colors.chipBg }}>
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / mediaW))}
        >
          {stories.map((s, i) =>
            s.media_type === 'video' ? (
              <View key={s.id} style={{ width: mediaW, height: fullH }}>
                <FeedVideo
                  uri={s.media_url}
                  crop={s.crop}
                  active={i === activeIdx}
                  shouldPlay={inFocus && !viewerOpen}
                  muted={muted}
                  scrolledAway={i === activeIdx && scrolledAway}
                  onTap={() => onOpen(i)}
                  onDoubleTap={doubleLike}
                  onPlay={() => onView(s)}
                />
              </View>
            ) : (
              <View key={s.id} style={{ width: mediaW, height: fullH }}>
                <FeedImage uri={s.media_url} onOpen={() => onOpen(i)} onDoubleTap={doubleLike} />
              </View>
            )
          )}
        </ScrollView>

        <HeartBurst burst={burst} />

        {story.media_type === 'video' && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMuted((m) => !m); }}
            hitSlop={8}
            style={{
              position: 'absolute', top: 10, left: 10,
              backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999,
              paddingHorizontal: 11, paddingVertical: 7,
            }}
          >
            {muted
              ? <VolumeX size={14} color="#fff" strokeWidth={2.4} />
              : <Volume2 size={14} color="#fff" strokeWidth={2.4} />}
          </Pressable>
        )}

        <View
          style={{
            position: 'absolute', top: 10, right: 10,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, overflow: 'hidden',
          }}
        >
          {stories.length > 1 && (
            <>
              <View pointerEvents="none" style={{ paddingLeft: 12, paddingRight: 10, paddingVertical: 7 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>
                  {activeIdx + 1}/{stories.length}
                </Text>
              </View>
              <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.28)' }} />
            </>
          )}
          <Pressable
            onPress={() => onOpen(activeIdx)}
            hitSlop={8}
            style={{ paddingHorizontal: 11, paddingVertical: 7 }}
          >
            <Maximize2 size={14} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>

        {stories.length > 1 && (
          <>
            <View
              pointerEvents="none"
              style={{ position: 'absolute', bottom: ACTION_H + 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}
            >
              {stories.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === activeIdx ? 16 : 5, height: 5, borderRadius: 3,
                    backgroundColor: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </View>
          </>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginTop: -ACTION_H, height: ACTION_H, paddingRight: 16,
        }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        {(
          <View style={{ width: STORE_W + CORNER_R, height: ACTION_H }}>
            <Svg width={STORE_W + CORNER_R} height={ACTION_H} style={{ position: 'absolute', left: 0, top: 0 }}>
              <Path
                fill={colors.background}
                d={`M0 0 L${STORE_W - CORNER_R} 0 A${CORNER_R} ${CORNER_R} 0 0 1 ${STORE_W} ${CORNER_R} L${STORE_W} ${ACTION_H - CORNER_R} A${CORNER_R} ${CORNER_R} 0 0 0 ${STORE_W + CORNER_R} ${ACTION_H} L0 ${ACTION_H} Z`}
              />
            </Svg>
            <View
              style={{
                width: STORE_W, height: ACTION_H, flexDirection: 'row',
                alignItems: 'center', paddingLeft: 16, gap: 14,
              }}
            >
              <View style={{ flexShrink: 1 }}>
                {group.is_seller && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Pressable
                      onPress={() => router.push({ pathname: `/seller/${group.user_id}`, params: { fromStory: '1', sellerName: group.user_name } } as any)}
                      hitSlop={8}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    >
                      <UserIcon size={15} color={colors.brand} strokeWidth={2.2} />
                      {(story.top_reposters?.length ?? 0) === 0 && (
                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand }}>View Store</Text>
                      )}
                    </Pressable>
                    {(story.top_reposters?.length ?? 0) > 0 && (
                      <>
                        <View style={{ width: 1.5, height: 12, borderRadius: 1, backgroundColor: colors.brand }} />
                        <RepostStack story={story} colors={colors} onPress={toggleReposters} />
                      </>
                    )}
                  </View>
                )}
                {!group.is_seller && (
                  <RepostStack story={story} colors={colors} onPress={toggleReposters} />
                )}
              </View>
            </View>
          </View>
        )}
        <View
          onLayout={(e) => setIconsW(e.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <Pressable onPress={() => onLike(story)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Heart
              size={18}
              color={story.liked ? '#ef4444' : '#fff'}
              fill={story.liked ? '#ef4444' : 'transparent'}
            />
            <Text style={[stat, story.liked && { color: '#ef4444' }]}>{formatCount(story.like_count ?? 0)}</Text>
          </Pressable>
          {!story.comments_off && (
            <Pressable onPress={() => onComments(story)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MessageCircle size={18} color="#fff" />
              <Text style={stat}>{formatCount(story.comment_count ?? 0)}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onRepost(story)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Repeat size={18} color={story.reposted ? '#22c55e' : '#fff'} />
            <Text style={[stat, story.reposted && { color: '#22c55e' }]}>{formatCount(story.repost_count ?? 0)}</Text>
          </Pressable>
          <Pressable onPress={() => onExport(story)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Send size={17} color="#fff" />
            <Text style={stat}>{formatCount(story.export_count ?? 0)}</Text>
          </Pressable>
        </View>
      </View>
      <Modal visible={repostersOpen} transparent animationType="fade" onRequestClose={() => setRepostersOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => setRepostersOpen(false)}
            onTouchStart={(e) => { (postRef as any).touchY = e.nativeEvent.pageY; }}
            onTouchMove={(e) => {
              if (Math.abs(e.nativeEvent.pageY - ((postRef as any).touchY ?? 0)) > 24) setRepostersOpen(false);
            }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <BlurView intensity={40} tint={colors.background === '#000000' ? 'dark' : 'default'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} />
          </Pressable>
          <View style={{ position: 'absolute', top: panelTop, left: 0, right: 0 }}>
            <RepostersPanel storyId={story.id} colors={colors} />
          </View>
        </View>
      </Modal>
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16, marginTop: 20 }} />
    </View>
  );
}

// Overlapping top-4 reposter avatars (feed only)
function RepostStack({ story, colors, onPress }: { story: Story; colors: any; onPress: () => void }) {
  const list = (story.top_reposters || []).slice(0, 4);
  if (list.length === 0) return null;
  const SIZE = 22;
  const OVERLAP = 8;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand, marginRight: 6 }}>Reposted by:</Text>
      {list.map((p, i) => (
        <View
          key={p.id}
          style={{
            width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden',
            marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: list.length - i,
            borderWidth: 2, borderColor: colors.background, backgroundColor: colors.chipBg,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {p.avatar ? (
            <Image source={{ uri: p.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand }}>{p.name?.[0]?.toUpperCase() || '?'}</Text>
          )}
        </View>
      ))}
    </Pressable>
  );
}

// Everyone who reposted, shown right under the post
function RepostersPanel({ storyId, colors }: { storyId: string; colors: any }) {
  const [list, setList] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api.get(`/stories/${storyId}/reposters`)
      .then((r) => setList(r.data || []))
      .catch(() => setFailed(true));
  }, [storyId]);

  return (
    <View
      style={{
        marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 16,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Reposted by</Text>
      {failed ? (
        <Text style={{ fontSize: 14, color: colors.textMuted }}>Couldn't load reposts</Text>
      ) : list === null ? (
        <ActivityIndicator color={colors.brand} />
      ) : list.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.textMuted }}>No reposts yet</Text>
      ) : (
        <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={{ gap: 12 }}>
            {list.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                  {p.avatar ? (
                    <Image source={{ uri: p.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand }}>{p.name?.[0]?.toUpperCase() || '?'}</Text>
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
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function useDoubleTap(onSingle: () => void, onDouble: (x: number, y: number) => void, delay = 260) {
  const lastRef = useRef(0);
  const timerRef = useRef<any>(null);
  const singleRef = useRef(onSingle);
  const doubleRef = useRef(onDouble);
  singleRef.current = onSingle;
  doubleRef.current = onDouble;
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return (e?: any) => {
    const now = Date.now();
    clearTimeout(timerRef.current);
    if (now - lastRef.current < delay) {
      lastRef.current = 0;
      doubleRef.current(e?.nativeEvent?.locationX ?? SCREEN_WIDTH / 2, e?.nativeEvent?.locationY ?? 200);
    } else {
      lastRef.current = now;
      timerRef.current = setTimeout(() => { lastRef.current = 0; singleRef.current(); }, delay);
    }
  };
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

function FeedImage({ uri, onOpen, onDoubleTap }: { uri: string; onOpen: () => void; onDoubleTap: (x: number, y: number) => void }) {
  const tap = useDoubleTap(onOpen, onDoubleTap);
  return (
    <Pressable onPress={tap} style={{ width: SCREEN_WIDTH, height: '100%' }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    </Pressable>
  );
}

function FeedVideo({
  uri, crop, active, shouldPlay, muted, scrolledAway, onTap, onDoubleTap, onPlay,
}: {
  uri: string; crop?: VideoCropT | null;
  active: boolean;          // this is the story currently showing in the post
  shouldPlay: boolean;      // the post is in the focus zone of the screen
  muted: boolean;
  scrolledAway?: boolean;
  onTap?: () => void;
  onDoubleTap?: (x: number, y: number) => void;
  onPlay?: () => void;
}) {
  // The player is created as soon as the post mounts, so the video is
  // already buffering (preloaded) long before it scrolls into view.
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const playingRef = useRef(false);
  const countedRef = useRef(false);

  const stop = () => {
    try { player.pause(); } catch {}
    playingRef.current = false;
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const stable = useRef(() => stopRef.current()).current;

  useEffect(() => { try { player.muted = muted; } catch {} }, [muted, player]);

  const wantPlay = active && shouldPlay && appActive;
  useEffect(() => {
    if (wantPlay) {
      if (currentFeedStop && currentFeedStop !== stable) currentFeedStop();
      currentFeedStop = stable;
      try { player.play(); } catch {}
      playingRef.current = true;
      if (!countedRef.current) { countedRef.current = true; onPlay?.(); }
    } else if (playingRef.current) {
      stop();
      if (currentFeedStop === stable) currentFeedStop = null;
    }
  }, [wantPlay]);

  // fully scrolled out of view: rewind so it starts from the top next time
  useEffect(() => {
    if (!scrolledAway) return;
    try { player.pause(); } catch {}
    try { player.currentTime = 0; } catch {}
    playingRef.current = false;
  }, [scrolledAway]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => () => {
    if (currentFeedStop === stable) currentFeedStop = null;
  }, []);

  // single tap -> open full screen, double tap -> like
  const tap = useDoubleTap(() => onTap?.(), (x, y) => onDoubleTap?.(x, y));

  return (
    <Pressable onPress={tap} style={{ width: '100%', height: '100%' }}>
      <CroppedVideoView player={player} crop={crop} />
    </Pressable>
  );
}

// ─── REEL ACTION (icon + count, right column in vertical mode) ───────
function ReelAction({
  icon, count, onPress,
}: { icon: React.ReactNode; count?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignItems: 'center', gap: 4 }}>
      {icon}
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

// ─── SPOTLIGHT PREVIEW MODAL (from feed avatar/name tap) ────────────
function SpotlightPreviewModal({
  group, colors, onClose, onOpenProfile,
}: { group: any; colors: any; onClose: () => void; onOpenProfile: (g: any) => void }) {
  const [followers, setFollowers] = useState(0);
  useEffect(() => {
    if (!group?.user_id) return;
    api.get(`/follows/stats/${group.user_id}`)
      .then((r) => setFollowers(r.data.followers ?? 0))
      .catch(() => {});
  }, [group?.user_id]);
  if (!group) return null;
  const spotlightCount = (group.stories || []).filter((s: any) => (s.kind ?? 'story') === 'spotlight').length;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            width: '100%', maxWidth: 380,
            backgroundColor: colors.card,
            borderRadius: 20, overflow: 'hidden',
            borderWidth: 1, borderColor: colors.border,
          }}
        >
          <View style={{ height: 130, position: 'relative', backgroundColor: colors.chipBg }}>
            {group.user_avatar && (
              <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            )}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{ position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              <X size={16} color="#fff" />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: -36 }}>
            <View
              style={{
                width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
                backgroundColor: colors.chipBg, borderWidth: 4, borderColor: colors.card,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {group.user_avatar ? (
                <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.brand }}>
                  {group.user_name?.[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.text }}>
                {group.user_name}
              </Text>
              <PlanBadge plan={group.user_plan} size={14} />
            </View>
            <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 3 }}>
              {formatCount(followers)} {followers === 1 ? 'follower' : 'followers'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
              {spotlightCount} {spotlightCount === 1 ? 'spotlight post' : 'spotlight posts'}
            </Text>
          </View>

          <Pressable
            onPress={() => onOpenProfile(group)}
            style={{
              paddingVertical: 14, backgroundColor: colors.brand,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
            }}
          >
            <Text style={{ color: colors.textOnGold, fontSize: 16, fontWeight: '800' }}>
              View full profile
            </Text>
            <ChevronRight size={16} color={colors.textOnGold} strokeWidth={2.6} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BoostCard({ item, onPress }: { item: any; onPress: () => void }) {
  const colors = useColors();
  const isService = (item.category || item.category_name) === 'Services';
  const min = parseFloat(item.price) || 0;
  const max = parseFloat(item.price_max) || 0;
  const priceText = isService && max > min
    ? `GHS ${min.toFixed(0)} - ${max.toFixed(0)}`
    : `GHS ${min.toFixed(2)}`;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '100%', height: BOOST_CARD_W * 1.4,
        borderRadius: 16, overflow: 'hidden',
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      }}
    >
      <View style={{ flex: 1, backgroundColor: colors.chipBg }}>
        <Image source={{ uri: item.primary_image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        <View
          style={{
            position: 'absolute', top: 6, left: 6,
            flexDirection: 'row', alignItems: 'center', gap: 3,
            backgroundColor: isService ? '#22c55e' : '#38bdf8',
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
          }}
        >
          <Rocket size={9} color="#fff" />
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{isService ? 'Service' : 'Product'}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 8, paddingVertical: 7 }}>
        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '900', color: colors.brand, marginTop: 2 }}>{priceText}</Text>
      </View>
    </Pressable>
  );
}

function BoostedCarousel({ items, onLock, hapticsOn = true }: { items: any[]; onLock?: (locked: boolean) => void; hapticsOn?: boolean }) {
  const hapticsOnRef = useRef(hapticsOn);
  hapticsOnRef.current = hapticsOn;
  useEffect(() => () => onLock?.(false), []);
  const router = useRouter();
  const n = items.length;
  const looped = n > 1;
  let copies = 1;
  if (looped) {
    copies = Math.max(5, Math.ceil(15 / n));
    if (copies % 2 === 0) copies += 1;
  }
  const data = useMemo(
    () => Array.from({ length: copies * n }, (_, i) => items[i % n]),
    [items, copies, n],
  );
  const startIndex = looped ? Math.floor(copies / 2) * n : 0;

  const scrollX = useRef(new Animated.Value(startIndex * BOOST_STEP)).current;
  const scrollRef = useRef<any>(null);
  const activeRef = useRef(startIndex);
  const [active, setActive] = useState(startIndex);
  const sidePad = (SCREEN_WIDTH - BOOST_STEP) / 2;

  useEffect(() => {
    activeRef.current = startIndex;
    setActive(startIndex);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x: startIndex * BOOST_STEP, animated: false }), 0);
    return () => clearTimeout(t);
  }, [startIndex, n]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.x / BOOST_STEP)));
        if (i !== activeRef.current) {
          if (hapticsOnRef.current && i % n !== activeRef.current % n) Haptics.selectionAsync();
          activeRef.current = i;
          setActive(i);
        }
      },
    },
  );

  // after a scroll settles, jump (invisibly) back to the same card in the middle copy
  const recenter = (e: any) => {
    if (!looped) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / BOOST_STEP);
    const target = startIndex + (i % n);
    if (i !== target) scrollRef.current?.scrollTo({ x: target * BOOST_STEP, animated: false });
  };

  // ── Autoplay: advance one card every 3s, paused while the user touches the carousel ──
  const AUTO_DELAY_MS = 3000;
  const autoTimerRef = useRef<any>(null);
  const holdingRef = useRef(false);

  const scheduleAuto = () => {
    clearTimeout(autoTimerRef.current);
    if (n < 2) return;
    autoTimerRef.current = setTimeout(() => {
      if (holdingRef.current) return;
      scrollRef.current?.scrollTo({ x: (activeRef.current + 1) * BOOST_STEP, animated: true });
      // once the slide animation finishes, silently jump back to the middle copy, then queue the next one
      autoTimerRef.current = setTimeout(() => {
        const i = activeRef.current;
        const target = startIndex + (i % n);
        if (i !== target) scrollRef.current?.scrollTo({ x: target * BOOST_STEP, animated: false });
        scheduleAuto();
      }, 500);
    }, AUTO_DELAY_MS);
  };

  const pauseAuto = () => {
    holdingRef.current = true;
    clearTimeout(autoTimerRef.current);
  };

  const resumeAuto = () => {
    holdingRef.current = false;
    scheduleAuto();
  };

  useEffect(() => {
    scheduleAuto();
    return () => clearTimeout(autoTimerRef.current);
  }, [n, startIndex]);

  const { theme } = useTheme();
  const bg = theme === 'dark' ? '#0a0a0a' : '#ffffff';
  const current = data[active];

  return (
    <View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <Image
          source={{ uri: current?.primary_image }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          blurRadius={14}
          transition={500}
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg, opacity: 0.2 }} />
        <LinearGradient colors={[bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28 }} />
      </View>
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={BOOST_STEP}
      snapToAlignment="start"
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={recenter}
      onTouchStart={() => { onLock?.(true); pauseAuto(); }}
      onTouchEnd={() => { onLock?.(false); resumeAuto(); }}
      onScrollBeginDrag={pauseAuto}
      onScrollEndDrag={() => { onLock?.(false); resumeAuto(); }}
      contentOffset={{ x: startIndex * BOOST_STEP, y: 0 }}
contentContainerStyle={{ paddingHorizontal: sidePad, paddingTop: 14, paddingBottom: 30 }}
    >
      {data.map((item: any, i: number) => {
        const S = BOOST_STEP;
        const range = [(i - 2) * S, (i - 1) * S, i * S, (i + 1) * S, (i + 2) * S];
        const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.74, 0.88, 1, 0.88, 0.74], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.45, 0.8, 1, 0.8, 0.45], extrapolate: 'clamp' });
        const translateY = scrollX.interpolate({ inputRange: range, outputRange: [26, 10, 0, 10, 26], extrapolate: 'clamp' });
        const translateX = scrollX.interpolate({ inputRange: range, outputRange: [-26, 0, 0, 0, 26], extrapolate: 'clamp' });
        const rotateY = scrollX.interpolate({ inputRange: range, outputRange: ['38deg', '24deg', '0deg', '-24deg', '-38deg'], extrapolate: 'clamp' });

        return (
          <View
            key={`boost-${item.id}-${i}`}
            style={{ width: BOOST_STEP, alignItems: 'center', zIndex: data.length - Math.abs(i - active) }}
          >
            <Animated.View
              style={{
                width: BOOST_CARD_W,
                opacity,
                transform: [{ perspective: 800 }, { translateX }, { translateY }, { rotateY }, { scale }],
              }}
            >
              <BoostCard
                item={item}
                onPress={() => router.push(((item.category || item.category_name) === 'Services' ? `/service/${item.id}` : `/product/${item.id}`) as any)}
              />
              {i !== active && (
                <Pressable
                  onPress={() => scrollRef.current?.scrollTo({ x: i * BOOST_STEP, animated: true })}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
              )}
            </Animated.View>
          </View>
        );
      })}
    </Animated.ScrollView>
    </View>
  );
}

// Rocket squeezes along its diagonal, shoots off top-right, then re-enters from bottom-left. Loops ~every 3s.
function RocketLaunch({ color }: { color: string }) {
  const x = useRef(new Animated.Value(0)).current;
  const sx = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = (v: Animated.Value, to: number, duration: number, easing?: (n: number) => number) =>
      Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4500),
        Animated.parallel([
          t(sx, 0.6, 900, Easing.inOut(Easing.quad)),
          t(x, -4, 900),
          Animated.sequence(
            Array.from({ length: 18 }).map((_, i) =>
              t(shake, i % 2 === 0 ? 2.5 : -2.5, 50)
            ).concat([t(shake, 0, 0)])
          ),
        ]),
        Animated.parallel([t(sx, 1.3, 260, Easing.in(Easing.cubic)), t(x, 50, 260, Easing.in(Easing.cubic))]),
        Animated.parallel([t(x, -50, 0), t(sx, 1, 0)]),
        t(x, 0, 450, Easing.out(Easing.cubic)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ width: 40, height: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ rotate: '-45deg' }] }}>
        <Animated.View style={{ transform: [{ translateX: x }, { translateY: shake }, { scaleX: sx }] }}>
          <View style={{ transform: [{ rotate: '45deg' }] }}>
            <Rocket size={40} color={color} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── FULL-SCREEN VIEWER ──────────────────────────────────────────────
export function StoryViewerLocal({
  group, story, durationMs, mediaReady, isOwnStory, onMediaReady, onClose, onBack, onNext,
  onSwipeNextGroup, onSwipePrevGroup, prevGroup, nextGroup,onReply, onQuickReact, notice, reelStyle, onPatch, onRepost, replayKey, onRemoveStory, onRemoveUser, onFollow, onArchive,
}: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const isVertical = reelStyle === 'vertical';
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
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
      onRemoveStory?.(story.id);
      Toast.show({ type: 'success', text1: "Got it, you'll see less like this" });
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
              onRemoveUser?.(group.user_id);
              Toast.show({ type: 'success', text1: 'User blocked' });
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
            onRemoveStory?.(story.id);
            Toast.show({ type: 'success', text1: 'Post deleted' });
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
            onArchive?.(story.id);
            Toast.show({ type: 'success', text1: 'Post archived' });
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
      onPatch?.(story.id, { caption: res.data.caption });
      setEditOpen(false);
      showToast('Caption updated');
    } catch {
      showToast("Couldn't update caption");
    } finally {
      setSavingCaption(false);
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
    [group.user_id]
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
    if (!mediaReady) return;

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
  }, [currentIndex, mediaReady, group.user_id, replayKey]);

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
  }, [group.user_id]);
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
  const prevOpacity = translateX.interpolate({ inputRange: [0, HALF, FULL], outputRange: [0, 0.7, 1], extrapolate: 'clamp' });  useLayoutEffect(() => {
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
  scrubCtx.current = { segW: scrubSegW, i: currentIndex, anims: barAnims };

  const scrubEnd = () => {
    clearTimeout(scrubTimerRef.current);
    if (!scrubActiveRef.current) return;
    scrubActiveRef.current = false;
    setIsScrubbing(false); // un-pausing resumes from the bar's current value
  };
  const scrubPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      scrubTimerRef.current = setTimeout(() => {
        const { anims, i } = scrubCtx.current;
        anims[i].stopAnimation((v: number) => { scrubStartRef.current = v; });
        scrubActiveRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsScrubbing(true);
      }, 250);
    },
    onPanResponderMove: (_e, g) => {
      if (!scrubActiveRef.current) return;
      const { segW, i, anims } = scrubCtx.current;
      const f = Math.min(1, Math.max(0, scrubStartRef.current + g.dx / segW));
      anims[i].setValue(f);
      seekRef.current?.(f);
    },
    onPanResponderRelease: scrubEnd,
    onPanResponderTerminate: scrubEnd,
  })).current;

  const barPaused = isPaused || isTyping || commentsOpen || exportOpen || reportOpen || isScrubbing;
  const barPausedRef = useRef(false);
  barPausedRef.current = barPaused;
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
      .filter((s) => s.media_type === 'video')
      .slice(0, 3)
      .map((s) => (
        <VideoPreloader key={s.id} uri={s.media_url} />
      ))}
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        width: maskWidth,
        height: maskHeight,
        borderRadius: maskRadius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        opacity: dragOpacity,
        transform: [{ translateY }],
      }}
    >
    <Animated.View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: [{ translateY: slideY }] }}>
      {isVertical && (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: -SCREEN_HEIGHT, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
            <StoryGroupPreview group={prevGroup} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: SCREEN_HEIGHT, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
            <StoryGroupPreview group={nextGroup} />
          </View>
        </>
      )}
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
          overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: curShiftX }, { scale: curScale }],
        }}
      >
      <AnimatedKeyboardAvoidingView
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, paddingBottom: keyboardHeight }}
      >
        {/* Media area — flex:1 so it stops above the reply bar instead of
            running full-screen underneath it */}
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {story.media_type === 'video' ? (
           <StoryVideoPlayer
  key={story.id}
  uri={story.media_url}
  onReady={onMediaReady}
  paused={barPaused}
  seekRef={seekRef}
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
              />
            </View>
          )}

          {!!story.text_overlay && <ViewerTextOverlay overlay={story.text_overlay} />}

          {!mediaReady && <DelayedLoader key={story.id} delay={500} />}

          {/* ── Horizontal (stories) mode: top bars + header ── */}
          {!isVertical && (
            <>
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
                <Pressable onPress={onClose} style={{ padding: 6 }}>
                  <X size={22} color="#fff" />
                </Pressable>
              </View>
            </>
          )}

          {/* Tap zones */}
          <Pressable
            onPressIn={() => { handlePressIn(); startHoldWatch(); }}
            onPressOut={(e) => { clearTimeout(holdTimerRef.current); handlePressOutSide('back', e.nativeEvent.pageX, e.nativeEvent.pageY); }}
            style={{
              position: 'absolute',
              top: insets.top + 70, bottom: 0,
              left: 0, width: SCREEN_WIDTH * 0.5,
            }}
          />
          <Pressable
            onPressIn={() => { handlePressIn(); startHoldWatch(); }}
            onPressOut={(e) => { clearTimeout(holdTimerRef.current); handlePressOutSide('next', e.nativeEvent.pageX, e.nativeEvent.pageY); }}
            style={{
              position: 'absolute',
              top: insets.top + 70, bottom: 0,
              right: 0, width: SCREEN_WIDTH * 0.5,
            }}
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

          {/* Centered caption (horizontal mode only) */}
          {!isVertical && story.caption && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: insets.top + 80,
                bottom: isOwnStory ? insets.bottom + 20 : 16,
                left: 24, right: 24,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <Text
                style={{
                  fontSize: getCaptionFontSize(story.caption),
                  lineHeight: getCaptionFontSize(story.caption) * 1.3,
                  fontWeight: '700',
                  color: '#fff',
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.75)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 6,
                }}
              >
                {story.caption}
              </Text>
            </View>
          )}

          {/* ── Vertical (Instagram reel) mode overlays ── */}
          {isVertical && (
            <View
              pointerEvents={isHolding ? 'none' : 'box-none'}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: isHolding ? 0 : 1 }}
            >

              {/* Paused play icon */}
              {isPaused && (
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
    {/* Avatar + follow badge */}
    <View style={{ marginBottom: 14, width: 38, height: 38 }}>
      <View
        style={{
          width: 38, height: 38, borderRadius: 19, overflow: 'hidden',
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
            borderWidth: 2, borderColor: '#000',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {followDone
            ? <Check size={12} color="#fff" strokeWidth={3.5} />
            : <Plus size={12} color={colors.textOnGold} strokeWidth={3.5} />}
        </Pressable>
      )}
    </View>

    <ReelAction
      icon={<Heart size={28} color={liked ? '#ef4444' : '#fff'} fill={liked ? '#ef4444' : 'transparent'} />}
      count={formatCount(likeCount)}
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
      onPress={() => onRepost?.(story)}
    />
    <ReelAction icon={<Send size={26} color="#fff" />} count={formatCount(story.export_count ?? 0)} onPress={openExport} />
    <ReelAction icon={<MoreHorizontal size={26} color="#fff" />} onPress={() => { setReportStep('menu'); setReportOpen(true); }} />
  </View>
)}

              {/* Bottom-left: Watch pill, user row + Follow, caption */}
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', left: 16, right: 76, bottom: 16, gap: 12 }}
              >
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 20, fontWeight: '800', color: '#fff' }}>
    {group.user_name}
  </Text>
  <PlanBadge plan={group.user_plan} size={15} />
  {!isOwnStory && (
    <Pressable
      hitSlop={8}
      onPress={() => onReply('')}
      style={{
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Chat</Text>
    </Pressable>
  )}
</View>

                {!!story.caption && (
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 16, lineHeight: 19, color: '#fff',
                      textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
                    }}
                  >
                    {story.caption}
                  </Text>
                )}

                                <RepostedBy story={story} color={colors.brand} nameColor="rgba(255,255,255,0.75)" fontSize={12} />
              </View>

              {/* Segmented thin progress line */}
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}
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

        {toastMsg && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: insets.top + 70,
              left: 0, right: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderWidth: 1,
                borderColor: colors.brand,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{toastMsg}</Text>
            </View>
          </View>
        )}

        {/* Divider between caption and reply bar (horizontal mode only) */}
        {!isOwnStory && !isVertical && (
          <View
            style={{
              height: 2,
              backgroundColor: colors.border,
              marginHorizontal: 16,
              marginTop: 10,
              marginBottom: 6,
              borderRadius: 1,
            }}
          />
        )}

        {/* Reply bar — a real, solid-background footer, not an overlay */}
        {(!isOwnStory || isVertical) && (
  <View
    style={{
      backgroundColor: isVertical ? '#0b0d10' : '#000',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: isVertical ? 12 : 8,
      paddingBottom: keyboardHeight > 0 ? 10 : insets.bottom + 10,
    }}
  >
    <View
      style={{
        flex: 1,
        height: isVertical ? 44 : 38,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: isVertical ? 22 : 19,
        borderWidth: 1.5,
        borderColor: colors.brand,
        backgroundColor: 'transparent',
        paddingHorizontal: 18,
      }}
    >
      {isVertical && (
        <Pressable
          onPress={openComments}
          style={{ flex: 1, height: '100%', justifyContent: 'center' }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>{story.comments_off && !isOwnStory ? 'Comments are turned off' : 'Add comment...'}</Text>
        </Pressable>
      )}
      <TextInput
        ref={replyInputRef}
        value={replyText}
        onChangeText={setReplyText}
        onFocus={handleReplyFocus}
        onBlur={handleReplyBlur}
        placeholder={isVertical ? 'Add comment...' : `Send message to ${group.user_name.split(' ')[0]}...`}
        placeholderTextColor="rgba(255,255,255,0.6)"
        style={isVertical ? { display: 'none' } : { flex: 1, color: '#fff', fontSize: 16 }}
        returnKeyType="send"
        onSubmitEditing={handleSendReply}
        blurOnSubmit={false}
      />
      {!replyText.trim() && !isVertical && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 }}>
{['❤️', '😂', '🔥', '👏'].map((emoji) => (
  <EmojiReact key={emoji} emoji={emoji} onSend={handleQuickReact}/>
))}
        </View>
      )}
    </View>

    {(!isVertical || !!replyText.trim()) && (
      <Pressable
        onPress={handleSendReply}
        disabled={!replyText.trim()}
        style={{
          width: 38, height: 38, borderRadius: 19,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: replyText.trim() ? colors.brand : 'rgba(255,255,255,0.14)',
        }}
      >
        <Send size={18} color={replyText.trim() ? colors.textOnGold : 'rgba(255,255,255,0.5)'} />
      </Pressable>
    )}
  </View>
)}
      </AnimatedKeyboardAvoidingView>
      </Animated.View>
      </View>
    </Animated.View>
    </Animated.View>

    {isVertical && (
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 60,
          opacity: dragOpacity,
        }}
      >
        <View
          pointerEvents="box-none"
          style={{ flex: 1, opacity: isHolding ? 0 : 1 }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{ position: 'absolute', top: insets.top + 10, left: 12, padding: 6, zIndex: 2 }}
          >
            <ChevronLeft size={28} color="#fff" />
          </Pressable>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: insets.top + 10, left: 0, right: 0,
              height: 40, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 23, fontWeight: '800', color: '#fff' }}>Feed</Text>
          </View>
        </View>
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
      />
    )}

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
            <Pressable onPress={() => setEditOpen(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveCaption} disabled={savingCaption} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', opacity: savingCaption ? 0.6 : 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textOnGold }}>{savingCaption ? 'Saving...' : 'Save'}</Text>
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
            <View style={{ position: 'absolute', top: 0, left: 0, width: box.w, height: mediaH }}>{render()}</View>
            <BlurView intensity={100} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </View>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: gap, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', bottom: 0, left: 0, width: box.w, height: mediaH }}>{render()}</View>
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

// Invisible player that just buffers/caches an upcoming video.
function VideoPreloader({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
  });
  useEffect(() => () => { try { player.pause(); } catch {} }, [player]);
  return null;
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

// Shows a person's latest story inside their ring (photo, or a paused video frame)
function StoryCircleThumb({ group, colors }: { group: StoryGroup; colors: any }) {
  const latest = useMemo(
    () => [...group.stories].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0],
    [group.stories]
  );

  if (!latest) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>
          {group.user_name?.[0]?.toUpperCase() || '?'}
        </Text>
      </View>
    );
  }

  return latest.media_type === 'video' ? (
    <ExploreStoryVideoThumb uri={latest.media_url} crop={latest.crop} />
  ) : (
    <Image source={{ uri: latest.media_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
  );
}

// Heroicons device-phone-mobile (outline)
function DevicePhoneMobileIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
      />
    </Svg>
  );
}

function StorefrontIcon({ size = 13, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </Svg>
  );
}

function PlanBadge({ plan, size = 12 }: { plan?: string | null; size?: number }) {
  if (plan === 'premium') return <Sparkles size={size} color="#a855f7" fill="#a855f7" />;
  if (plan === 'pro') return <Star size={size} color="#3b82f6" fill="#3b82f6" />;
  return null;
}

function RingName({ group, colors }: { group: StoryGroup; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, maxWidth: RING_SIZE }}>
<Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: 13,
          fontWeight: group.allViewed ? '500' : '700',
          color: group.allViewed ? colors.textMuted : colors.text,
        }}
      >
        {group.user_name.split(' ')[0]}
      </Text>
      <PlanBadge plan={group.user_plan} size={10} />
    </View>
  );
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
      <Text style={{ fontSize: fontSize + 1, fontWeight: '800', color }}>Reposted by: </Text>
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
  uri, onReady, paused, trimStartMs, trimEndMs, crop, seekRef,
}: {
  seekRef?: React.MutableRefObject<((f: number) => void) | null>;
  uri: string; onReady: (durationMs?: number) => void; paused: boolean;
  trimStartMs?: number | null; trimEndMs?: number | null;
  crop?: VideoCropT | null;
}) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false; // duration is capped/advanced manually now
  });
  const readyRef = useRef(false);
  const durRef = useRef(0);
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
    const sub = player.addListener('statusChange', ({ status }: { status: string }) => {
      if (status === 'readyToPlay' && !readyRef.current) {
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
    return () => sub.remove();
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

type VideoCropT = { x: number; y: number; w: number; h: number; fa?: number | null };

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

// Faint line-grid backdrop — light lines on dark backgrounds, dark lines on light ones.
function GridBackground({ isDark }: { isDark: boolean }) {
  const lineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Defs>
        <Pattern id="grid" width={64} height={64} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={0} y2={64} stroke={lineColor} strokeWidth={1} />
          <Line x1={0} y1={0} x2={64} y2={0} stroke={lineColor} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

function ReelStyleSkeleton({ direction, colors }: { direction: 'horizontal' | 'vertical'; colors: any }) {
  const block = colors.border;
  const horizontal = direction === 'horizontal';
  return (
    <View
      style={{
        width: '100%', aspectRatio: 0.72, borderRadius: 10,
        backgroundColor: colors.chipBg, overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: block }} />
        ))}
      </View>
      <View style={{ position: 'absolute', top: 20, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: block }} />
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: block }} />
      </View>
      <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
        <View style={{ width: '70%', height: 5, borderRadius: 3, backgroundColor: block, marginBottom: 7, alignSelf: 'center' }} />
        <View style={{ height: 12, borderRadius: 6, borderWidth: 1, borderColor: block }} />
      </View>
      {horizontal ? (
        <>
          <View style={{ position: 'absolute', left: 1, top: 0, bottom: 0, justifyContent: 'center' }}>
            <ChevronLeft size={11} color={colors.textMuted} />
          </View>
          <View style={{ position: 'absolute', right: 1, top: 0, bottom: 0, justifyContent: 'center' }}>
            <ChevronRight size={11} color={colors.textMuted} />
          </View>
        </>
      ) : (
        <>
          <View style={{ position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center' }}>
            <ChevronUp size={11} color={colors.textMuted} />
          </View>
          <View style={{ position: 'absolute', bottom: 22, left: 0, right: 0, alignItems: 'center' }}>
            <ChevronDown size={11} color={colors.textMuted} />
          </View>
          <View style={{ position: 'absolute', right: 4, top: '38%', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: block }} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function StoriesSkeleton({ colors }: { colors: any }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const Block = ({ style }: { style: any }) => (
    <Animated.View style={[{ backgroundColor: colors.chipBg, opacity: pulse }, style]} />
  );

  const cardW = (SCREEN_WIDTH - 16 * 2 - 12) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* header: greeting + story rings */}
      <View style={{ backgroundColor: colors.card, paddingBottom: 34 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Block style={{ width: 180, height: 26, borderRadius: 8 }} />
          <Block style={{ width: 240, height: 12, borderRadius: 6, marginTop: 8 }} />
        </View>
        <View
          style={{
            flexDirection: 'row', gap: RING_ROW_GAP, overflow: 'hidden',
            paddingHorizontal: HEADER_PADDING_H, paddingTop: RING_ROW_TOP_PADDING,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ alignItems: 'center', width: RING_SIZE }}>
              <Block style={{ width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 }} />
              <Block style={{ width: 40, height: 10, borderRadius: 5, marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>

      {/* body: status row + discover grid */}
      <View
        style={{
          flex: 1, overflow: 'hidden', marginTop: -14, paddingTop: 20,
          backgroundColor: colors.background,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
        }}
      >
        <Block style={{ width: 70, height: 12, borderRadius: 6, marginLeft: 16, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} style={{ width: STATUS_CARD_WIDTH, height: STATUS_CARD_HEIGHT, borderRadius: 14 }} />
          ))}
        </View>

        <Block style={{ width: 80, height: 12, borderRadius: 6, marginLeft: 16, marginTop: 28, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} style={{ width: cardW, aspectRatio: 0.72, borderRadius: 16 }} />
          ))}
        </View>
      </View>
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
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 18 }}>
              {isImage || noWatermark
                ? 'Your export will have no watermark.'
                : 'Exports include the Tre-X watermark. Upgrade to Premium to remove it.'}
            </Text>
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

// ─── COMMENTS SHEET (opened from the feed's message icon) ────────────
function CommentsSheet({
  story, colors, onClose, onCountChange,
}: {
  story: Story | null; colors: any; onClose: () => void;
  onCountChange: (storyId: string, count: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const storyId = story?.id;
  const ownerId = story?.user_id;
  const isOwner = !!story && String(story.user_id) === String(user?.id);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [total, setTotal] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [repliesById, setRepliesById] = useState<Record<string, any[]>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const sheetDrag = useSheetDrag(() => { Keyboard.dismiss(); onClose(); });
  useEffect(() => {
    if (story) sheetDrag.translateY.setValue(0);
  }, [!!story]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  useEffect(() => {
    if (!storyId) return;
    setComments([]);
    setText('');
    setReplyTo(null);
    setOpenReplies({});
    setRepliesById({});
    setTotal(story?.comment_count ?? 0);
    setLoading(true);
    api.get(`/stories/${storyId}/comments`)
      .then((res) => setComments(res.data || []))
      .catch(() => Toast.show({ type: 'error', text1: "Couldn't load comments" }))
      .finally(() => setLoading(false));
  }, [storyId]);

  const togglePin = async (c: any) => {
    try {
      await api.patch(`/stories/${storyId}/comments/${c.id}/pin`, { pinned: !c.pinned });
      const res = await api.get(`/stories/${storyId}/comments`);
      setComments(res.data || []);
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't update pin" });
    }
  };

  const close = () => { Keyboard.dismiss(); onClose(); };

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
      if (next) await api.post(`/stories/${storyId}/comments/${c.id}/like`);
      else await api.delete(`/stories/${storyId}/comments/${c.id}/like`);
    } catch {
      apply((x) => (x.id === c.id ? { ...x, liked: !next, like_count: count } : x));
      Toast.show({ type: 'error', text1: "Couldn't update like" });
    }
  };

  const loadReplies = async (commentId: string) => {
    setRepliesLoading((p) => ({ ...p, [commentId]: true }));
    try {
      const res = await api.get(`/stories/${storyId}/comments/${commentId}/replies`);
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
      Toast.show({ type: 'error', text1: "Couldn't load replies" });
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !storyId) return;
    const target = replyTo;
    setText('');
    setReplyTo(null);
    try {
      const res = await api.post(`/stories/${storyId}/comments`, {
        text: t,
        ...(target ? { parent_id: target.id } : {}),
      });
      if (target) {
        const threadId = res.data.parent_id;
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
      const next = total + 1;
      setTotal(next);
      onCountChange(storyId, next);
    } catch {
      setText(t);
      if (target) setReplyTo(target);
      Toast.show({ type: 'error', text1: "Couldn't send comment" });
    }
  };

  return (
    <Modal visible={!!story} transparent animationType="none" onRequestClose={close}>
      <Toast />
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={close}
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
              Comments{total > 0 ? ` (${formatCount(total)})` : ''}
            </Text>
          </View>

          <View style={{ flex: 1 }} onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}>
            {loading ? (
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
                          onPress={() => { setReplyTo({ id: c.id, name: c.user_name }); inputRef.current?.focus(); }}
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
                                  onPress={() => { setReplyTo({ id: r.id, name: r.user_name }); inputRef.current?.focus(); }}
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
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
              placeholderTextColor={colors.textMuted}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={send}
              style={{
                flex: 1, height: 42, borderRadius: 21, paddingHorizontal: 16,
                borderWidth: 1.5, borderColor: colors.brand,
                backgroundColor: 'transparent', color: colors.text, fontSize: 16,
              }}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim()}
              style={{
                width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                backgroundColor: text.trim() ? colors.brand : colors.chipBg,
              }}
            >
              <Send size={18} color={text.trim() ? colors.textOnGold : colors.textMuted} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
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

function FeedTabs({ feedTab, onChange, colors }: { feedTab: string; onChange: (k: 'all' | 'foryou' | 'following') => void; colors: any }) {
  const tabs = [
    { key: 'all', label: 'All', outline: GridOutline, solid: GridSolid },
    { key: 'foryou', label: 'For you', outline: FireOutline, solid: FireSolid },
    { key: 'following', label: 'Following', outline: UsersOutline, solid: UsersSolid },
  ] as const;
  return (
    <View style={{ flex: 1, flexDirection: 'row', height: 32 }}>
      {tabs.map((t) => {
        const active = feedTab === t.key;
        const Icon = active ? t.solid : t.outline;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingBottom: active ? 10 : 0 }}
          >
            <Icon size={active ? 18 : 12} color={active ? colors.brand : colors.textFaint} />
            <Text style={{ fontSize: active ? 13 : 10.5, fontWeight: active ? '800' : '500', color: active ? colors.brand : colors.textFaint }}>
              {t.label}
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
  isOwn, commentsOff, onClose, onReport, onHide, onBlock, onDelete, onArchive, onEdit, onToggleComments,
}: {
  isOwn: boolean; commentsOff: boolean; onClose: () => void;
  onReport: () => void; onHide: () => void; onBlock: () => void;
  onDelete: () => void; onArchive: () => void; onEdit: () => void; onToggleComments: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const drag = useSheetDrag(onClose);

  const rows: { key: string; label: string; Icon: any; danger?: boolean; onPress: () => void }[] = isOwn
    ? [
        { key: 'comments', label: commentsOff ? 'Turn on comments' : 'Turn off comments', Icon: MessageCircle, onPress: onToggleComments },
        { key: 'edit', label: 'Edit caption', Icon: Pencil, onPress: onEdit },
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