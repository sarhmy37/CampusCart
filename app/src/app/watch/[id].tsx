// app/watch/[id].tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, Dimensions, Animated, Easing,
  Share, Switch, Modal, ScrollView, PanResponder, Linking, TextInput, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import DockedMini, { createProgressStore, useProgress, MINI_W, type ProgressStore } from '@/components/DockedMini';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, Play, Heart, Share2, Clock, Sparkles, MoreVertical,
  Pause, SkipForward, SkipBack, Maximize2, Minimize2, Settings,
  EyeOff, Link2, Check, X, ChevronDown, ChevronUp, ListVideo,
  LayoutGrid, List, SlidersHorizontal, Trash2, GripVertical,
  Volume2, VolumeX, Moon, ThumbsUp, ThumbsDown, Send, Bookmark,
  UserPlus, UserCheck, Pencil,
} from 'lucide-react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { PlayCircleIcon } from 'react-native-heroicons/solid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { DEMO_VIDEOS, PullLine } from '../stories';

/* ──────────────────────────────────────────────────────────────
   Types & constants
   ────────────────────────────────────────────────────────────── */

type Video = (typeof DEMO_VIDEOS)[number] & {
  views?: number;
  published_at?: string;
  description?: string;
  hashtags?: string[];
  chapters?: { t: number; label: string }[];
};

type Note = { id: string; t: number; text: string; at: number };
type Mark = { id: string; t: number; label: string };
type ResumeMap = Record<string, { t: number; d: number }>;

const FAVS_KEY = 'podcast_favs';
const LATER_KEY = 'podcast_later';
const HIST_KEY = 'podcast_history';
const RESUME_KEY = 'podcast_resume';
const PREFS_KEY = 'podcast_prefs';
const QUEUE_KEY = 'podcast_queue';
const FOLLOW_KEY = 'podcast_followed';
const NOTES_KEY = 'podcast_notes';
const MARKS_KEY = 'podcast_bookmarks';
const REACT_KEY = 'podcast_reactions';
const HIDDEN_KEY = 'podcast_hidden';
const LAST_KEY = 'podcast_last';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAD = 16;
const THUMB_W = 152;
const THUMB_H = (THUMB_W * 9) / 16;
const GAP = 12;
const VIDEO_H = (SCREEN_WIDTH * 9) / 16;
const THEATER_H = Math.min(SCREEN_HEIGHT * 0.4, SCREEN_WIDTH * 0.78);
const DECK_PAD = 14;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as any;

/* ──────────────────────────────────────────────────────────────
   Storage helpers
   ────────────────────────────────────────────────────────────── */

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJSON<T>(key: string, val: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

/* ──────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────── */

const fmtViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : `${n}`;

const fmtTime = (s: number) => {
  const total = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    : `${m}:${sec.toString().padStart(2, '0')}`;
};

let HAPTICS_ON = true;
const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (!HAPTICS_ON) return;
  Haptics.impactAsync(style).catch(() => {});
};


/* ──────────────────────────────────────────────────────────────
   EqBars
   ────────────────────────────────────────────────────────────── */

function EqBars({ color, paused }: { color: string; paused?: boolean }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (paused) {
      bars.forEach((b) => b.stopAnimation());
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 280 + i * 90, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.25, duration: 260 + i * 70, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [paused]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 12 }}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{ width: 2.5, height: 12, borderRadius: 1.25, backgroundColor: color, transform: [{ scaleY: b }] }}
        />
      ))}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────
   ActionBtn (icon over label, bounces)
   ────────────────────────────────────────────────────────────── */

function ActionBtn({
  label, Icon, active, fillIcon, onPress, colors,
}: { label: string; Icon: any; active?: boolean; fillIcon?: boolean; onPress: () => void; colors: any }) {
  const s = useRef(new Animated.Value(1)).current;
  const press = () => {
    haptic();
    Animated.sequence([
      Animated.spring(s, { toValue: 0.82, speed: 40, bounciness: 0, useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, speed: 20, bounciness: 14, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  const c = active ? colors.brand : colors.text;
  return (
    <Pressable onPress={press} style={{ flex: 1, minWidth: 92, alignItems: 'center', paddingVertical: 12, gap: 5 }}>
      <Animated.View style={{ transform: [{ scale: s }] }}>
        <Icon size={21} color={c} {...(active && fillIcon ? { fill: c } : {})} />
      </Animated.View>
      <Text style={{ fontSize: 11, fontWeight: active ? '800' : '600', color: active ? colors.brand : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pill (rounded chip button)
   ────────────────────────────────────────────────────────────── */

function Pill({
  label, Icon, active, onPress, colors, surface,
}: { label?: string; Icon: any; active?: boolean; onPress: () => void; colors: any; surface: string }) {
  const fg = active ? colors.textOnGold : colors.text;
  return (
    <Pressable
      onPress={() => { haptic(); onPress(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6,
        justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 16,
        backgroundColor: active ? colors.brand : surface,
        borderWidth: 1, borderColor: active ? colors.brand : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon size={15} color={fg} {...(active && (Icon === ThumbsUp || Icon === ThumbsDown) ? { fill: fg } : {})} />
      {!!label && <Text style={{ fontSize: 12, fontWeight: '800', color: fg }}>{label}</Text>}
    </Pressable>
  );
}

/* ──────────────────────────────────────────────────────────────
   Bottom Sheet (animates in AND out)
   ────────────────────────────────────────────────────────────── */

function Sheet({
  open, onClose, title, children, colors, isDark,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; colors: any; isDark: boolean }) {
  const y = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(y, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(y, { toValue: 1, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open]);
  if (!mounted) return null;
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            opacity: y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }}
        >
          <Pressable onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          style={{
            backgroundColor: isDark ? colors.card : '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 32,
            maxHeight: '80%',
            transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) }],
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────
   Toast (fades in and out)
   ────────────────────────────────────────────────────────────── */

function Toast({ msg, bottom }: { msg: string | null; bottom: number }) {
  const a = useRef(new Animated.Value(0)).current;
  const [text, setText] = useState('');
  useEffect(() => {
    if (msg) {
      setText(msg);
      Animated.timing(a, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [msg]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.88)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </Animated.View>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pulse ring for "Up Next"
   ────────────────────────────────────────────────────────────── */

function Ring({ color, size = 20 }: { color: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
        }}
      />
      <Play size={9} color={color} fill={color} />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────
   Player deck: real seek bar + transport (sits right under the video)
   ────────────────────────────────────────────────────────────── */

function PlayerDeck({
  store, playing, onToggle, onSeek, onSkip, speed, onSpeedPress, colors, surface, subtitle,
}: {
  store: ProgressStore; playing: boolean; onToggle: () => void; onSeek: (sec: number) => void;
  onSkip: (delta: number) => void; speed: number; onSpeedPress: () => void;
  colors: any; surface: string; subtitle: string;
}) {
  const { t, d } = useProgress(store);
  const [scrub, setScrub] = useState<number | null>(null);
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const trackW = SCREEN_WIDTH - PAD * 2 - DECK_PAD * 2;
  const frac = (x: number) => Math.min(1, Math.max(0, (x - (PAD + DECK_PAD)) / trackW));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_e, g) => { haptic(); setScrub(frac(g.x0)); },
      onPanResponderMove: (_e, g) => setScrub(frac(g.moveX)),
      onPanResponderRelease: (_e, g) => {
        const f = frac(g.moveX || g.x0);
        setScrub(null);
        const dd = store.get().d;
        if (dd) onSeekRef.current(f * dd);
      },
      onPanResponderTerminate: () => setScrub(null),
    })
  ).current;

  const shown = scrub ?? (d ? Math.min(1, t / d) : 0);
  const shownTime = scrub != null ? scrub * d : t;

  return (
    <View
      style={{
        marginHorizontal: PAD, marginTop: 14, paddingHorizontal: DECK_PAD, paddingTop: 10, paddingBottom: 12,
        borderRadius: 20, backgroundColor: surface, borderWidth: 1, borderColor: colors.border,
      }}
    >
      <View {...pan.panHandlers} style={{ height: 30, justifyContent: 'center' }}>
        <View pointerEvents="none" style={{ height: scrub != null ? 7 : 4, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${shown * 100}%`, height: '100%', backgroundColor: colors.brand }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: shown * trackW - 8, width: 16, height: 16, borderRadius: 8,
            backgroundColor: colors.brand, borderWidth: 2, borderColor: '#fff',
            transform: [{ scale: scrub != null ? 1.3 : 1 }],
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: scrub != null ? colors.brand : subtitle }}>{fmtTime(shownTime)}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: subtitle }}>{d ? `-${fmtTime(Math.max(0, d - shownTime))}` : '--:--'}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Pressable onPress={onSpeedPress} hitSlop={8} style={{ width: 54, alignItems: 'flex-start' }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.brandSoft }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: colors.brand }}>{speed}×</Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
          <Pressable onPress={() => { haptic(); onSkip(-10); }} hitSlop={10} style={{ alignItems: 'center' }}>
            <SkipBack size={24} color={colors.text} fill={colors.text} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: subtitle, marginTop: 2 }}>10s</Text>
          </Pressable>
          <Pressable
            onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); onToggle(); }}
            style={{
              width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: colors.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
            }}
          >
            {playing
              ? <Pause size={24} color={colors.textOnGold} fill={colors.textOnGold} />
              : <Play size={24} color={colors.textOnGold} fill={colors.textOnGold} style={{ marginLeft: 3 }} />}
          </Pressable>
          <Pressable onPress={() => { haptic(); onSkip(10); }} hitSlop={10} style={{ alignItems: 'center' }}>
            <SkipForward size={24} color={colors.text} fill={colors.text} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: subtitle, marginTop: 2 }}>10s</Text>
          </Pressable>
        </View>

        <View style={{ width: 54, alignItems: 'flex-end' }}>
          <EqBars color={colors.brand} paused={!playing} />
        </View>
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────
   Chapter / bookmark row highlight uses live progress
   ────────────────────────────────────────────────────────────── */

function ChapterList({
  chapters, store, onSeek, colors, playing,
}: { chapters: { t: number; label: string }[]; store: ProgressStore; onSeek: (t: number) => void; colors: any; playing: boolean }) {
  const { t } = useProgress(store);
  const activeChapter = [...chapters].reverse().find((c) => t >= c.t)?.t ?? -1;
  return (
    <View>
      {chapters.map((c) => {
        const active = c.t === activeChapter;
        return (
          <Pressable
            key={c.t}
            onPress={() => { haptic(); onSeek(c.t); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingVertical: 9,
              backgroundColor: active ? colors.brand + '18' : 'transparent',
              marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8,
            }}
          >
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: active ? colors.brand : colors.border }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: active ? colors.textOnGold : colors.text }}>{fmtTime(c.t)}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? colors.brand : colors.text, flex: 1 }}>
              {c.label}
            </Text>
            {active && <EqBars color={colors.brand} paused={!playing} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────
   Live "Note at 1:23" stamp for the notes composer
   ────────────────────────────────────────────────────────────── */

function NowStamp({ store, color }: { store: ProgressStore; color: string }) {
  const { t } = useProgress(store);
  return <Text style={{ fontSize: 11, fontWeight: '800', color }}>Note at {fmtTime(t)}</Text>;
}

/* ──────────────────────────────────────────────────────────────
   Mini player
   ────────────────────────────────────────────────────────────── */

function MiniPlayer({
  video, store, onTap, onClose, onPlayPause, playing, colors, isDark, bottom,
}: {
  video: Video; store: ProgressStore; onTap: () => void; onClose: () => void; onPlayPause: () => void;
  playing: boolean; colors: any; isDark: boolean; bottom: number;
}) {
  const { t, d } = useProgress(store);
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: 1, speed: 20, bounciness: 6, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        bottom,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: isDark ? colors.card : '#fff',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 8,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10 }}>
        <Pressable onPress={onTap} style={{ width: 64, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.chipBg }}>
          <Image source={{ uri: video.thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </Pressable>
        <Pressable onPress={onTap} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{video.title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{video.channel}</Text>
        </Pressable>
        <Pressable onPress={onPlayPause} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          {playing ? <Pause size={14} color={colors.textOnGold} fill={colors.textOnGold} /> : <Play size={14} color={colors.textOnGold} fill={colors.textOnGold} />}
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
          <X size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={{ height: 2.5, backgroundColor: colors.border }}>
        <View style={{ height: 2.5, width: `${d ? Math.min(100, (t / d) * 100) : 0}%`, backgroundColor: colors.brand }} />
      </View>
    </Animated.View>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main Screen
   ────────────────────────────────────────────────────────────── */

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

function GlassCircle({
  Icon, onPress, colors, isDark, tinted, fillIcon, nudge,
}: { Icon: any; onPress: () => void; colors: any; isDark: boolean; tinted?: boolean; fillIcon?: boolean; nudge?: boolean }) {
  const fg = GLASS ? (tinted ? colors.textOnGold : colors.text) : colors.brand;
  const icon = (
    <Icon
      size={16}
      color={fg}
      {...(fillIcon ? { fill: fg } : {})}
      style={nudge ? { marginLeft: 2 } : undefined}
    />
  );
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={tinted ? colors.brand : undefined}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {icon}
        </GlassView>
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tinted ? colors.brandSoft : 'transparent' }}
          >
            {icon}
          </BlurView>
        </View>
      )}
    </Pressable>
  );
}

function GlassFollow({ isFollowed, onPress, colors, isDark }: { isFollowed: boolean; onPress: () => void; colors: any; isDark: boolean }) {
  const fg = GLASS ? (isFollowed ? colors.text : colors.textOnGold) : colors.brand;
  const body = (
    <>
      {isFollowed ? <UserCheck size={14} color={fg} /> : <UserPlus size={14} color={fg} />}
      <Text style={{ fontSize: 13, fontWeight: '800', color: fg }}>{isFollowed ? 'Following' : 'Follow'}</Text>
    </>
  );
  const base = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: 'hidden' as const };
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {GLASS ? (
        <GlassView glassEffectStyle="regular" isInteractive tintColor={isFollowed ? undefined : colors.brand} style={base}>
          {body}
        </GlassView>
      ) : (
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={{ ...base, borderWidth: 1, borderColor: colors.border, backgroundColor: isFollowed ? 'transparent' : colors.brandSoft }}
        >
          {body}
        </BlurView>
      )}
    </Pressable>
  );
}

export default function Watch() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bodyBg = isDark ? colors.background : '#ffffff';
  const fadeFrom = isDark ? 'rgba(13,12,10,0)' : 'rgba(255,255,255,0)';
  const surface = isDark ? colors.card : '#f6f7f9';
  const subtitle = isDark ? '#9ca3af' : '#6b7280';
  const onBrand = colors.textOnGold;

  const [currentId, setCurrentId] = useState(String(id));
  const [playing, setPlaying] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [resumeOn, setResumeOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [theater, setTheater] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [sleepMin, setSleepMin] = useState(0);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [descTab, setDescTab] = useState<'desc' | 'notes'>('desc');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<'all' | 'channel' | 'rec' | 'seen'>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [sheet, setSheet] = useState<null | 'speed' | 'options' | 'timer' | 'share' | 'queue'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [favs, setFavs] = useState<Video[]>([]);
  const [later, setLater] = useState<Video[]>([]);
  const [history, setHistory] = useState<Record<string, number>>({});
  const [resume, setResume] = useState<ResumeMap>({});
  const [queue, setQueue] = useState<Video[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [marks, setMarks] = useState<Record<string, Mark[]>>({});
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [mini, setMini] = useState(false);
  const [bigMini, setBigMini] = useState(false);
  const [miniClosed, setMiniClosed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [mountPlayer, setMountPlayer] = useState(false);
  const showMini = mini && !miniClosed;

  const listRef = useRef<any>(null);
  const playerRef = useRef<YoutubeIframeRef>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const PULL_THRESHOLD = 70;
  const PULL_FACTOR = 0.8;
  const pullY = useRef(new Animated.Value(0)).current;
  const lastYRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pullArmedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);
  const doRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setShuffleKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 1000);
  };
  const resetPull = () =>
    Animated.timing(pullY, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  const pullHandlers = {
    onTouchStart: (e: any) => {
      const { pageX, pageY } = e.nativeEvent;
      touchStartRef.current = lastYRef.current <= 0 && !refreshing ? { x: pageX, y: pageY } : null;
      pullArmedRef.current = false;
    },
    onTouchMove: (e: any) => {
      const start = touchStartRef.current;
      if (!start) return;
      const dx = e.nativeEvent.pageX - start.x;
      const dy = e.nativeEvent.pageY - start.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        touchStartRef.current = null;
        pullArmedRef.current = false;
        pullY.setValue(0);
        return;
      }
      if (dy <= 0) { pullY.setValue(0); pullArmedRef.current = false; return; }
      pullY.setValue(-Math.min(PULL_THRESHOLD, dy * PULL_FACTOR));
      const reached = dy * PULL_FACTOR >= PULL_THRESHOLD;
      if (reached && !pullArmedRef.current) {
        pullArmedRef.current = true;
        haptic(Haptics.ImpactFeedbackStyle.Medium);
      } else if (!reached && pullArmedRef.current) {
        pullArmedRef.current = false;
      }
    },
    onTouchEnd: () => {
      if (!touchStartRef.current) return;
      const go = pullArmedRef.current;
      touchStartRef.current = null;
      pullArmedRef.current = false;
      resetPull();
      if (go) doRefresh();
    },
    onTouchCancel: () => {
      touchStartRef.current = null;
      pullArmedRef.current = false;
      resetPull();
    },
  };
  const headerAnim = useRef(new Animated.Value(1)).current;
  const toastTimer = useRef<any>(null);
  const store = useRef(createProgressStore()).current;
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;
  const resumeRef = useRef<ResumeMap>({});
  const resumeOnRef = useRef(resumeOn);
  resumeOnRef.current = resumeOn;
  const resumedRef = useRef<Set<string>>(new Set());
  const retryRef = useRef(0);
  const endedRef = useRef<() => void>(() => {});
  const kickPlay = () => {
    setPlaying(false);
    setTimeout(() => setPlaying(true), 80);
  };
  const unmuteAt = useRef(0);
  const autoStartedFor = useRef<string | null>(null);
  const startedRef = useRef(false);
  const pushTimer = useRef<any>(null);
  const forcePlay = () => {
    clearInterval(pushTimer.current);
    startedRef.current = false;
    let n = 0;
    pushTimer.current = setInterval(() => {
      n += 1;
      if (startedRef.current || n > 15) { clearInterval(pushTimer.current); return; }
      (playerRef.current as any)?.injectJavaScript?.('player.playVideo(); true;');
    }, 400);
  };
  useEffect(() => () => clearInterval(pushTimer.current), []);

  const playerHeight = theater ? THEATER_H : VIDEO_H;

  useEffect(() => {
    console.log('PLAYING PROP', playing);
    (playerRef.current as any)?.injectJavaScript?.(
      playing ? 'player.playVideo(); true;' : 'player.pauseVideo(); true;'
    );
  }, [playing]);
  const playerY = scrollY.interpolate({
    inputRange: [0, playerHeight],
    outputRange: [0, -playerHeight],
    extrapolate: 'clamp',
  });
  const backOpacity = scrollY.interpolate({
    inputRange: [0, playerHeight * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  HAPTICS_ON = hapticsOn;

  /* docked mini player geometry */
  const [rootH, setRootH] = useState(SCREEN_HEIGHT);
  const dock = useRef(new Animated.Value(0)).current;
  const miniS = MINI_W / SCREEN_WIDTH;
  const miniH = playerHeight * miniS;
  const dockX = 16 - (SCREEN_WIDTH * (1 - miniS)) / 2;
  const dockY = rootH - (insets.bottom + 8) - miniH - (playerHeight * (1 - miniS)) / 2;
  const BIG_W = Math.round(SCREEN_WIDTH * 0.62);
  const bigS = BIG_W / SCREEN_WIDTH;
  const bigH = playerHeight * bigS;
  const bigX = SCREEN_WIDTH - 12 - BIG_W - (SCREEN_WIDTH * (1 - bigS)) / 2;
  const bigY = rootH - (insets.bottom + 16) - bigH - (playerHeight * (1 - bigS)) / 2;
  const bigDrag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastDrag = useRef({ x: 0, y: 0 }).current;
  const dragStart = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);
  const [bigSide, setBigSide] = useState<'left' | 'right'>('right');
  const bigSideRef = useRef(bigSide);
  bigSideRef.current = bigSide;
  const bigState = useRef({ bigMini, top: insets.top, bottom: insets.bottom, rootH, bigH });
  bigState.current = { bigMini, top: insets.top, bottom: insets.bottom, rootH, bigH };

  const bigPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStart.current = { x: lastDrag.x, y: lastDrag.y };
        dragMoved.current = false;
      },
      onPanResponderMove: (_e, g) => {
        const s = bigState.current;
        if (!s.bigMini) return;
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) dragMoved.current = true;
        const baseLeft = SCREEN_WIDTH - 12 - BIG_W;
        const baseTop = s.rootH - (s.bottom + 16) - s.bigH;
        const x = Math.min(0, Math.max(dragStart.current.x + g.dx, 12 - baseLeft));
        const y = Math.min(s.bottom + 8, Math.max(dragStart.current.y + g.dy, s.top + 8 - baseTop));
        lastDrag.x = x;
        lastDrag.y = y;
        bigDrag.setValue({ x, y });
        const side = baseLeft + x + BIG_W / 2 > SCREEN_WIDTH / 2 ? 'right' : 'left';
        if (side !== bigSideRef.current) {
          bigSideRef.current = side;
          setBigSide(side);
        }
      },
      onPanResponderRelease: () => {
        if (bigState.current.bigMini && dragMoved.current) return;
        haptic();
        if (bigState.current.bigMini) setPlaying((p) => !p);
        else setBigMini(true);
      },
    })
  ).current;

  const layerX = Animated.add(
    dock.interpolate({ inputRange: [0, 1, 2], outputRange: [0, dockX, bigX] }),
    bigDrag.x
  );
  const layerY = Animated.add(
    Animated.add(
      Animated.multiply(playerY, dock.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 0, 0] })),
      dock.interpolate({ inputRange: [0, 1, 2], outputRange: [0, dockY, bigY] })
    ),
    bigDrag.y
  );
  const layerScale = dock.interpolate({ inputRange: [0, 1, 2], outputRange: [1, miniS, bigS] });
  useEffect(() => {
    if (!mini && bigMini) setBigMini(false);
    if (!mini) setMiniClosed(false);
    Animated.spring(dock, { toValue: !mini ? 0 : bigMini ? 2 : 1, speed: 14, bounciness: 5, useNativeDriver: true }).start();
    Animated.spring(bigDrag, {
      toValue: bigMini && mini ? { x: lastDrag.x, y: lastDrag.y } : { x: 0, y: 0 },
      speed: 14, bounciness: 5, useNativeDriver: true,
    }).start();
    if (bigMini) setBigSide(SCREEN_WIDTH - 12 - BIG_W + lastDrag.x + BIG_W / 2 > SCREEN_WIDTH / 2 ? 'right' : 'left');
  }, [mini, bigMini]);

  /* load persisted state */
  useEffect(() => {
    readJSON<Video[]>(FAVS_KEY, []).then(setFavs);
    readJSON<Video[]>(LATER_KEY, []).then(setLater);
    readJSON<Record<string, number>>(HIST_KEY, {}).then((h) => setHistory((prev) => ({ ...h, ...prev })));
    readJSON<ResumeMap>(RESUME_KEY, {}).then((r) => {
      resumeRef.current = { ...r, ...resumeRef.current };
      setResume(resumeRef.current);
    });
    readJSON<Video[]>(QUEUE_KEY, []).then(setQueue);
    readJSON<string[]>(FOLLOW_KEY, []).then(setFollowed);
    readJSON<Record<string, Note[]>>(NOTES_KEY, {}).then(setNotes);
    readJSON<Record<string, Mark[]>>(MARKS_KEY, {}).then(setMarks);
    readJSON<Record<string, 'like' | 'dislike'>>(REACT_KEY, {}).then(setReactions);
    readJSON<string[]>(HIDDEN_KEY, []).then(setHidden);
    readJSON<{ autoplay?: boolean; speed?: number; resume?: boolean; haptics?: boolean }>(PREFS_KEY, {}).then((p) => {
      if (p.autoplay !== undefined) setAutoplay(p.autoplay);
      if (p.speed) setSpeed(p.speed);
      if (p.resume !== undefined) setResumeOn(p.resume);
      if (p.haptics !== undefined) setHapticsOn(p.haptics);
    });
  }, []);

  /* create the player only after the screen has finished opening */
  useEffect(() => {
    const t = setTimeout(() => setMountPlayer(true), 250);
    return () => clearTimeout(t);
  }, []);

  /* persist prefs */
  useEffect(() => {
    writeJSON(PREFS_KEY, { autoplay, speed, resume: resumeOn, haptics: hapticsOn });
  }, [autoplay, speed, resumeOn, hapticsOn]);

  /* remember every video that gets opened */
  useEffect(() => {
    readJSON<Record<string, number>>(HIST_KEY, {}).then((stored) => {
      const n = { ...stored, [currentId]: Date.now() };
      writeJSON(HIST_KEY, n);
      setHistory((h) => ({ ...h, ...n }));
    });
  }, [currentId]);

  /* mini player appears once the big player has scrolled away */
  useEffect(() => {
    const sid = scrollY.addListener(({ value }) => {
      setMini(value > playerHeight - 24);
    });
    return () => scrollY.removeListener(sid);
  }, [playerHeight]);

  /* new layout = new list instance, so reset the scroll value */
  useEffect(() => {
    scrollY.setValue(0);
    setMini(false);
  }, [layout]);

  /* sleep timer (real) */
  useEffect(() => {
    if (!sleepMin) return;
    const tid = setTimeout(() => {
      setPlaying(false);
      setSleepMin(0);
      showToast('Sleep timer: video paused');
    }, sleepMin * 60000);
    return () => clearTimeout(tid);
  }, [sleepMin]);

  /* player clock + resume saving */
  const commitResume = () => {
    const { t, d } = store.get();
    const vid = currentIdRef.current;
    if (!d || t < 3) return;
    const next = { ...resumeRef.current };
    if (t > d - 8) delete next[vid];
    else next[vid] = { t, d };
    resumeRef.current = next;
    writeJSON(RESUME_KEY, next);
  };

  useEffect(() => {
    let ticks = 0;
    const tid = setInterval(async () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const [t, d] = await Promise.all([p.getCurrentTime(), p.getDuration()]);
        store.set(t, d);
        ticks += 1;
        if (ticks % 10 === 0) commitResume();
      } catch {}
    }, 500);
    return () => {
      clearInterval(tid);
      commitResume();
    };
  }, []);

  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const current: Video = (DEMO_VIDEOS as Video[]).find((v) => v.video_id === currentId) ?? (DEMO_VIDEOS[0] as Video);
  const isFav = favs.some((x) => x.video_id === current.video_id);
  const isLater = later.some((x) => x.video_id === current.video_id);
  const isFollowed = followed.includes(current.channel);
  const reaction = reactions[current.video_id];
  const myNotes = notes[current.video_id] ?? [];
  const myMarks = marks[current.video_id] ?? [];
  const savedPoint = resume[current.video_id];

  useEffect(() => {
    writeJSON(LAST_KEY, current);
  }, [currentId]);

  /* similar videos: shuffled "All", "Recommended" from watch behaviour */
  const similar = useMemo(() => {
    const all = DEMO_VIDEOS as Video[];
    const mix = (id: string) => {
      const s = `${id}|${current.video_id}|${shuffleKey}`;
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    };
    let arr = all.filter((v) => v.video_id !== current.video_id && !hidden.includes(v.video_id));
    if (filter === 'channel') arr = arr.filter((v) => v.channel === current.channel);
    if (filter === 'seen') arr = arr.filter((v) => !!history[v.video_id]);
    if (hideWatched) arr = arr.filter((v) => !history[v.video_id]);
    if (onlyFollowed) arr = arr.filter((v) => followed.includes(v.channel));

    if (filter === 'all') {
      arr = [...arr].sort((a, b) => mix(a.video_id) - mix(b.video_id));
    }

    if (filter === 'rec') {
      const ch: Record<string, number> = {};
      const tags: Record<string, number> = {};
      const bump = (m: Record<string, number>, k: string, n: number) => { m[k] = (m[k] ?? 0) + n; };
      all.filter((v) => history[v.video_id]).forEach((v) => {
        bump(ch, v.channel, 2);
        v.hashtags?.forEach((h) => bump(tags, h, 1));
      });
      favs.forEach((v) => bump(ch, v.channel, 3));
      followed.forEach((c) => bump(ch, c, 3));
      Object.entries(reactions).forEach(([vid, r]) => {
        const v = all.find((x) => x.video_id === vid);
        if (v) bump(ch, v.channel, r === 'like' ? 3 : -4);
      });
      const score = (v: Video) =>
        (ch[v.channel] ?? 0) +
        (v.hashtags ?? []).reduce((s, h) => s + (tags[h] ?? 0), 0) -
        (history[v.video_id] ? 2 : 0);
      arr = arr
        .map((v) => ({ v, s: score(v) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || mix(a.v.video_id) - mix(b.v.video_id))
        .map((x) => x.v);
    }
    return arr;
  }, [current.video_id, current.channel, filter, hideWatched, onlyFollowed, hidden, followed, history, favs, reactions, shuffleKey]);

  /* actions */
  const toggleList = (list: Video[], setList: (l: Video[]) => void, key: string, msg: string) => {
    const has = list.some((x) => x.video_id === current.video_id);
    const next = has ? list.filter((x) => x.video_id !== current.video_id) : [...list, current];
    setList(next);
    writeJSON(key, next);
    showToast(msg);
  };

  const react = (kind: 'like' | 'dislike') => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    const next = { ...reactions };
    if (next[current.video_id] === kind) delete next[current.video_id];
    else next[current.video_id] = kind;
    setReactions(next);
    writeJSON(REACT_KEY, next);
    showToast(next[current.video_id] === 'like' ? 'Marked as helpful' : next[current.video_id] === 'dislike' ? 'Marked as not helpful' : 'Reaction removed');
  };

  const toggleFollow = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    const next = isFollowed ? followed.filter((c) => c !== current.channel) : [...followed, current.channel];
    setFollowed(next);
    writeJSON(FOLLOW_KEY, next);
    showToast(isFollowed ? `Unfollowed ${current.channel}` : `Following ${current.channel}`);
  };

  const notInterested = () => {
    const next = [...hidden, current.video_id];
    setHidden(next);
    writeJSON(HIDDEN_KEY, next);
    showToast('Got it, we will show less like this');
    if (!playNext()) return;
  };

  const shareVideo = () => {
    Share.share({ message: `${current.title} https://youtu.be/${current.video_id}` })
      .then((r) => { if (r.action === Share.sharedAction) showToast('Shared'); })
      .catch(() => {});
    setSheet(null);
  };

  const shareLinkOnly = () => {
    Share.share({ message: `https://youtu.be/${current.video_id}` }).catch(() => {});
    setSheet(null);
  };

  const openYouTube = () => {
    setSheet(null);
    Linking.openURL(`https://youtu.be/${current.video_id}`).catch(() => showToast('Could not open YouTube'));
  };

  const addToQueue = (v: Video) => {
    haptic();
    if (queue.some((q) => q.video_id === v.video_id)) { showToast('Already in queue'); return; }
    const next = [...queue, v];
    setQueue(next);
    writeJSON(QUEUE_KEY, next);
    showToast('Added to queue');
  };

  const removeFromQueue = (vid: string, silent?: boolean) => {
    if (!silent) haptic();
    const next = queue.filter((q) => q.video_id !== vid);
    setQueue(next);
    writeJSON(QUEUE_KEY, next);
  };

  const clearQueue = () => {
    haptic();
    setQueue([]);
    writeJSON(QUEUE_KEY, []);
    showToast('Queue cleared');
  };

  const play = (vid: string) => {
    haptic();
    commitResume();
    setResume(resumeRef.current);
    store.set(0, 0);
    setCurrentId(vid);
    setVideoReady(false);
    setMuted(true);
    setPlaying(true);
    setExpandedDesc(false);
    setDescTab('desc');
    setNoteDraft('');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    headerAnim.setValue(0);
    Animated.timing(headerAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const playNext = () => {
    if (queue[0]) {
      const n = queue[0];
      removeFromQueue(n.video_id, true);
      play(n.video_id);
      return true;
    }
    if (similar[0]) {
      play(similar[0].video_id);
      return true;
    }
    return false;
  };

  endedRef.current = () => {
    if (autoplay && playNext()) return;
    setPlaying(false);
  };

  const seekTo = (sec: number) => {
    const { d } = store.get();
    const target = Math.max(0, d ? Math.min(sec, d - 1) : sec);
    playerRef.current?.seekTo(target, true);
    store.set(target, d);
  };

  const skip = (delta: number) => {
    seekTo(store.get().t + delta);
    showToast(delta > 0 ? `Forward ${delta}s` : `Back ${Math.abs(delta)}s`);
  };

  const maybeResume = () => {
    const vid = currentIdRef.current;
    if (resumedRef.current.has(vid)) return;
    resumedRef.current.add(vid);
    const r = resumeRef.current[vid];
    if (resumeOnRef.current && r && r.t > 10 && r.d && r.t < r.d - 10) {
      playerRef.current?.seekTo(r.t, true);
      showToast(`Resumed at ${fmtTime(r.t)}`);
    }
  };

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    haptic();
    const n: Note = { id: String(Date.now()), t: Math.floor(store.get().t), text, at: Date.now() };
    const next = { ...notes, [current.video_id]: [n, ...myNotes] };
    setNotes(next);
    writeJSON(NOTES_KEY, next);
    setNoteDraft('');
    showToast(`Note saved at ${fmtTime(n.t)}`);
  };

  const deleteNote = (nid: string) => {
    haptic();
    const next = { ...notes, [current.video_id]: myNotes.filter((n) => n.id !== nid) };
    setNotes(next);
    writeJSON(NOTES_KEY, next);
  };

  const addMark = () => {
    haptic();
    const t = Math.floor(store.get().t);
    if (myMarks.some((m) => m.t === t)) { showToast('Already bookmarked'); return; }
    const m: Mark = { id: String(Date.now()), t, label: `Bookmark at ${fmtTime(t)}` };
    const next = { ...marks, [current.video_id]: [...myMarks, m].sort((a, b) => a.t - b.t) };
    setMarks(next);
    writeJSON(MARKS_KEY, next);
    showToast(`Bookmarked ${fmtTime(t)}`);
  };

  const deleteMark = (mid: string) => {
    haptic();
    const next = { ...marks, [current.video_id]: myMarks.filter((m) => m.id !== mid) };
    setMarks(next);
    writeJSON(MARKS_KEY, next);
  };

  const chapters = current.chapters ?? [];

  const metaBits: string[] = [];
  if (current.views) metaBits.push(`${fmtViews(current.views)} views`);
  if (current.published_at) metaBits.push(new Date(current.published_at).toLocaleDateString());
  if (savedPoint) metaBits.push(`Left off at ${fmtTime(savedPoint.t)}`);
  if (myNotes.length) metaBits.push(`${myNotes.length} note${myNotes.length === 1 ? '' : 's'}`);

  const tabLabel = (t: 'desc' | 'notes') =>
    t === 'desc' ? 'About' : `Notes${myNotes.length ? ` · ${myNotes.length}` : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: bodyBg }} onLayout={(e) => setRootH(e.nativeEvent.layout.height)}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ─── CONTENT (the video slides away with it) ─── */}
      <AnimatedFlatList
        ref={listRef}
        data={similar}
        extraData={`${autoplay}|${layout}|${filter}|${Object.keys(history).length}|${queue.length}|${hidden.length}|${Object.keys(resume).length}`}
        key={layout}
        numColumns={layout === 'grid' ? 2 : 1}
        keyExtractor={(i: Video) => i.video_id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
        {...pullHandlers}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (e: any) => { lastYRef.current = e.nativeEvent.contentOffset.y; },
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + (bigMini ? 190 : 120) }}
        ItemSeparatorComponent={() => layout === 'list' ? (
          <View
            style={{
              height: 1, backgroundColor: colors.border,
              marginLeft: PAD + THUMB_W + GAP, marginRight: PAD, marginVertical: 10,
            }}
          />
        ) : null}
        ListHeaderComponent={
          <View>
            {/* space where the fixed player sits */}
            <View style={{ height: playerHeight }} />
            <PullLine scrollY={pullY} refreshing={refreshing} colors={colors} />


            <Animated.View
              style={{
                opacity: headerAnim,
                transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              }}
            >
              <View style={{ overflow: 'hidden' }}>
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 360 }}>
                  <Image
                    source={{ uri: current.thumbnail }}
                    style={{ width: '100%', height: '100%', opacity: isDark ? 0.5 : 0.35 }}
                    contentFit="cover"
                    blurRadius={40}
                    transition={400}
                  />
                  <LinearGradient
                    colors={[fadeFrom, bodyBg]}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                </View>

                <View style={{ paddingHorizontal: PAD, paddingTop: 20 }}>
                  {/* now playing */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <EqBars color={colors.brand} paused={!playing} />
                    <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: colors.brand }}>
                      {playing ? 'NOW PLAYING' : 'PAUSED'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    {sleepMin > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.brandSoft }}>
                        <Moon size={11} color={colors.brand} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brand }}>{sleepMin}m</Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={{
                      fontSize: 23, fontWeight: '900', lineHeight: 29, letterSpacing: -0.3,
                      color: colors.text, marginTop: 10,
                    }}
                  >
                    {current.title}
                  </Text>

                  {metaBits.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {metaBits.map((b, i) => (
                        <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {i > 0 && <Text style={{ fontSize: 13, color: subtitle }}>•</Text>}
                          <Text style={{ fontSize: 13, color: subtitle }}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* channel */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
                    <LinearGradient
                      colors={['#f59e0b', '#ef4444', '#a855f7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 42, height: 42, borderRadius: 21, padding: 2 }}
                    >
                      <View style={{ flex: 1, borderRadius: 19, backgroundColor: bodyBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.brand }}>
                          {current.channel?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                        {current.channel}
                      </Text>
                      <Text style={{ fontSize: 13, color: subtitle, marginTop: 1 }}>
                        {isFollowed ? 'Following · YouTube channel' : 'YouTube channel'}
                      </Text>
                    </View>
                    <GlassFollow isFollowed={isFollowed} onPress={toggleFollow} colors={colors} isDark={isDark} />
                  </View>

                  {/* main actions */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{
                      marginTop: 18,
                      borderRadius: 20,
                      backgroundColor: surface, borderWidth: 1, borderColor: colors.border,
                    }}
                    contentContainerStyle={{ paddingHorizontal: 4 }}
                  >
                    <ActionBtn
                      label={isFav ? 'Favourited' : 'Favourite'}
                      Icon={Heart}
                      active={isFav}
                      fillIcon
                      colors={colors}
                      onPress={() => toggleList(favs, setFavs, FAVS_KEY, isFav ? 'Removed from favourites' : 'Added to favourites')}
                    />
                    <ActionBtn
                      label={isLater ? 'Saved' : 'Watch Later'}
                      Icon={Clock}
                      active={isLater}
                      colors={colors}
                      onPress={() => toggleList(later, setLater, LATER_KEY, isLater ? 'Removed from watch later' : 'Saved for later')}
                    />
                    <ActionBtn label="Share" Icon={Share2} colors={colors} onPress={() => setSheet('share')} />
                    <ActionBtn
                      label="Helpful"
                      Icon={ThumbsUp}
                      active={reaction === 'like'}
                      fillIcon
                      colors={colors}
                      onPress={() => react('like')}
                    />
                    <ActionBtn
                      label="Not helpful"
                      Icon={ThumbsDown}
                      active={reaction === 'dislike'}
                      fillIcon
                      colors={colors}
                      onPress={() => react('dislike')}
                    />
                  </ScrollView>


                  {/* tabs */}
                  <View
                    style={{
                      flexDirection: 'row', marginTop: 18,
                      borderRadius: 16, overflow: 'hidden',
                      backgroundColor: surface, borderWidth: 1, borderColor: colors.border,
                    }}
                  >
                    {(['desc', 'notes'] as const).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => { haptic(); setDescTab(t); }}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: descTab === t ? colors.brand : subtitle }}>
                          {tabLabel(t)}
                        </Text>
                        {descTab === t && (
                          <View style={{ marginTop: 6, height: 2, width: 22, borderRadius: 1, backgroundColor: colors.brand }} />
                        )}
                      </Pressable>
                    ))}
                  </View>

                  {/* tab content */}
                  <View style={{ marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: surface, borderWidth: 1, borderColor: colors.border }}>
                    {descTab === 'desc' && (
                      <>
                        <Text numberOfLines={expandedDesc ? undefined : 3} style={{ fontSize: 13, lineHeight: 19, color: colors.text }}>
                          {current.description ??
                            `${current.title} by ${current.channel}. Open it on YouTube to read the full description from the creator.`}
                        </Text>
                        <Pressable onPress={() => { haptic(); setExpandedDesc((e) => !e); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>
                            {expandedDesc ? 'Show less' : 'Show more'}
                          </Text>
                          {expandedDesc ? <ChevronUp size={12} color={colors.brand} /> : <ChevronDown size={12} color={colors.brand} />}
                        </Pressable>
                        {!!current.hashtags?.length && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                            {current.hashtags.map((h) => (
                              <Text key={h} style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>{h}</Text>
                            ))}
                          </View>
                        )}
                      </>
                    )}

                    {descTab === 'notes' && (
                      <View>
                        <View style={{ borderRadius: 16, backgroundColor: bodyBg, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.brandSoft }}>
                              <Clock size={12} color={colors.brand} />
                              <NowStamp store={store} color={colors.brand} />
                            </View>
                            <Text style={{ fontSize: 11, color: subtitle }}>{noteDraft.length}/300</Text>
                          </View>
                          <TextInput
                            value={noteDraft}
                            onChangeText={setNoteDraft}
                            placeholder="What did you just learn?"
                            placeholderTextColor={subtitle}
                            maxLength={300}
                            multiline
                            style={{ minHeight: 64, marginTop: 10, fontSize: 14, lineHeight: 20, color: colors.text, textAlignVertical: 'top' }}
                          />
                          <Pressable
                            onPress={addNote}
                            disabled={!noteDraft.trim()}
                            style={{
                              marginTop: 8, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
                              backgroundColor: noteDraft.trim() ? colors.brand : colors.chipBg,
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: noteDraft.trim() ? onBrand : subtitle }}>Save note</Text>
                          </Pressable>
                        </View>

                        {myNotes.length === 0 && (
                          <View style={{ alignItems: 'center', paddingVertical: 22, gap: 8 }}>
                            <Pencil size={22} color={subtitle} />
                            <Text style={{ fontSize: 13, color: subtitle, textAlign: 'center' }}>
                              Notes you save are pinned to the exact second.
                            </Text>
                          </View>
                        )}

                        <View style={{ marginTop: myNotes.length ? 16 : 0 }}>
                          {myNotes.map((n, i) => (
                            <View key={n.id} style={{ flexDirection: 'row', gap: 12 }}>
                              <View style={{ alignItems: 'center', width: 12 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: colors.brand }} />
                                {i < myNotes.length - 1 && <View style={{ flex: 1, width: 2, marginTop: 4, backgroundColor: colors.border }} />}
                              </View>
                              <View style={{ flex: 1, marginBottom: 14, padding: 12, borderRadius: 14, backgroundColor: bodyBg, borderWidth: 1, borderColor: colors.border }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Pressable
                                    onPress={() => { haptic(); seekTo(n.t); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.brand }}
                                  >
                                    <Play size={9} color={onBrand} fill={onBrand} />
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: onBrand }}>{fmtTime(n.t)}</Text>
                                  </Pressable>
                                  <Pressable onPress={() => deleteNote(n.id)} hitSlop={8}>
                                    <Trash2 size={15} color={subtitle} />
                                  </Pressable>
                                </View>
                                <Text style={{ fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 8 }}>{n.text}</Text>
                                <Text style={{ fontSize: 11, color: subtitle, marginTop: 6 }}>{new Date(n.at).toLocaleDateString()}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* similar header */}
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: PAD, marginTop: 26, marginBottom: 14,
                }}
              >
                <PlayCircleIcon size={30} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Similar videos
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 14, color: colors.textMuted, marginTop: 3 }}>
                    Keep the learning going
                  </Text>
                </View>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Switch
                    value={autoplay}
                    onValueChange={(v) => { haptic(); setAutoplay(v); }}
                    trackColor={{ false: colors.border, true: colors.brand }}
                    thumbColor="#ffffff"
                    style={{ transform: [{ scale: 0.8 }] }}
                  />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: autoplay ? colors.brand : subtitle }}>Autoplay</Text>
                </View>
              </View>

              {/* filter tabs — same style as the app tabs */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12 }}>
                <View style={{ flex: 1, flexDirection: 'row', paddingLeft: PAD - 6 }}>
                  {(['all', 'channel', 'rec', 'seen'] as const).map((f) => {
                    const active = filter === f;
                    return (
                      <Pressable
                        key={f}
                        onPress={() => { haptic(); setFilter(f); }}
                        style={{ flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 10 }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: active ? 13 : 12, fontWeight: active ? '800' : '500', color: active ? colors.brand : colors.textFaint }}>
                          {f === 'all' ? 'All' : f === 'channel' ? 'Same channel' : f === 'rec' ? 'Recommended' : 'Watched'}
                        </Text>
                        {active && (
                          <View style={{ position: 'absolute', bottom: -1, alignSelf: 'center', height: 3, width: 33, borderRadius: 999, backgroundColor: colors.brand }} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 8, paddingRight: PAD }}>
                  <Pressable onPress={() => { haptic(); setShowFilter((s) => !s); }} hitSlop={8}>
                    <SlidersHorizontal
                      size={16}
                      color={showFilter || hideWatched || onlyFollowed ? colors.brand : colors.textFaint}
                      strokeWidth={2.4}
                    />
                  </Pressable>
                </View>
              </View>

              {showFilter && (
                <View
                  style={{
                    marginHorizontal: PAD, marginBottom: 12, borderRadius: 16, overflow: 'hidden',
                    backgroundColor: surface, borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>Hide videos I have watched</Text>
                    <Switch
                      value={hideWatched}
                      onValueChange={(v) => { haptic(); setHideWatched(v); }}
                      trackColor={{ false: colors.border, true: colors.brand }}
                      thumbColor="#ffffff"
                      style={{ transform: [{ scale: 0.8 }] }}
                    />
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>Only channels I follow</Text>
                    <Switch
                      value={onlyFollowed}
                      onValueChange={(v) => { haptic(); setOnlyFollowed(v); }}
                      trackColor={{ false: colors.border, true: colors.brand }}
                      thumbColor="#ffffff"
                      style={{ transform: [{ scale: 0.8 }] }}
                    />
                  </View>
                </View>
              )}
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: subtitle, marginTop: 24, paddingHorizontal: 32, fontSize: 14 }}>
            No videos match these filters.
          </Text>
        }
        renderItem={({ item, index }: { item: Video; index: number }) => {
          const isNext = index === 0 && autoplay && queue.length === 0;
          const watched = !!history[item.video_id];
          const rr = resume[item.video_id];
          const frac = rr?.d ? Math.min(1, rr.t / rr.d) : 0;
          if (layout === 'grid') {
            return (
              <View style={{ width: SCREEN_WIDTH / 2, paddingHorizontal: 6, paddingVertical: 8 }}>
                <Pressable
                  onPress={() => play(item.video_id)}
                  onLongPress={() => addToQueue(item)}
                  style={{
                    borderRadius: 12, overflow: 'hidden',
                    backgroundColor: surface, borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.chipBg }}>
                    <Image source={{ uri: item.thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }} />
                    {!!rr?.d && (
                      <View style={{ position: 'absolute', bottom: 6, right: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.8)' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{fmtTime(rr.d)}</Text>
                      </View>
                    )}
                    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={11} color="#fff" fill="#fff" />
                      </View>
                    </View>
                    {isNext && (
                      <View style={{ position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.brand }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: onBrand, letterSpacing: 0.6 }}>UP NEXT</Text>
                      </View>
                    )}
                    {frac > 0 && (
                      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                        <View style={{ height: 3, width: `${frac * 100}%`, backgroundColor: colors.brand }} />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: 8 }}>
                    <Text numberOfLines={2} style={{ fontSize: 12.5, fontWeight: '800', color: colors.text, lineHeight: 16 }}>{item.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: subtitle, marginTop: 3 }}>{item.channel}</Text>
                  </View>
                </Pressable>
              </View>
            );
          }
          return (
            <Pressable
              onPress={() => play(item.video_id)}
              onLongPress={() => addToQueue(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: PAD,
              }}
            >
              <View
                style={{
                  width: THUMB_W, height: THUMB_H, borderRadius: 12,
                  overflow: 'hidden', backgroundColor: surface, marginRight: GAP,
                  flexShrink: 0,
                  borderWidth: isNext ? 1.5 : 0,
                  borderColor: colors.brand,
                }}
              >
                <Image source={{ uri: item.thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }} />
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={13} color="#fff" fill="#fff" />
                  </View>
                </View>
                {!!rr?.d && (
                  <View style={{ position: 'absolute', bottom: 6, right: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{fmtTime(rr.d)}</Text>
                  </View>
                )}
                {frac > 0 && (
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                    <View style={{ height: 3, width: `${frac * 100}%`, backgroundColor: colors.brand }} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                {isNext && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <Ring color={colors.brand} />
                    <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: colors.brand }}>UP NEXT</Text>
                  </View>
                )}
                <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '800', color: colors.text, lineHeight: 18 }}>{item.title}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600', color: colors.brand, marginTop: 4 }}>{item.channel}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: subtitle, marginTop: 2 }}>
                  {frac > 0 ? `${Math.round(frac * 100)}% watched` : watched ? 'Watched' : 'New to you'}
                  {item.published_at ? ` • ${new Date(item.published_at).toLocaleDateString()}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => addToQueue(item)} hitSlop={10} style={{ width: 24, alignItems: 'flex-end', paddingTop: 2, flexShrink: 0 }}>
                <MoreVertical size={16} color={subtitle} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      {/* ─── PLAYER (fixed layer that slides up as you scroll) ─── */}
      <Animated.View
        pointerEvents={mini ? 'none' : 'auto'}
        style={{
          position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: playerHeight,
          backgroundColor: '#000', zIndex: 10,
          ...(mini ? { borderRadius: 24, overflow: 'hidden' as const } : {}),
          ...(mini && miniClosed ? { opacity: 0 } : {}),
          transform: [{ translateX: layerX }, { translateY: layerY }, { scale: layerScale }],
        }}
      >
        {mountPlayer && (
          <YoutubePlayer
            key={current.video_id}
            ref={playerRef}
            height={playerHeight}
            width={SCREEN_WIDTH}
            play={playing}
            mute={muted}
            forceAndroidAutoplay
            webViewProps={{
              allowsInlineMediaPlayback: true,
              mediaPlaybackRequiresUserAction: false,
              androidLayerType: 'hardware',
            }}
            onReady={() => { console.log('YT ready'); forcePlay(); }}
            onError={(e: string) => console.log('YT error', e)}
            playbackRate={speed}
            videoId={current.video_id}
            initialPlayerParams={{ rel: false, iv_load_policy: 3, controls: true }}
            onChangeState={(s: string) => {
              console.log('YT state', s);
              if (s === 'ended') endedRef.current();
              if (s === 'buffering' || s === 'playing') setVideoReady(true);
              if (s === 'playing') {
                setPlaying(true);
                startedRef.current = true;
                maybeResume();
                setTimeout(() => setMuted(false), 800);
              }
              if (s === 'paused' && videoReady) setPlaying(false);
            }}
          />
        )}

        {!videoReady && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }}>
            <Image source={{ uri: current.thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, opacity: mini ? 0 : 1 }}
          pointerEvents="none"
        />

      </Animated.View>

      {/* back button (fades out once the player scrolls away) */}
      <Animated.View
        pointerEvents={mini ? 'none' : 'auto'}
        style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, opacity: backOpacity }}
      >
        <Pressable
          onPress={() => { haptic(); router.back(); }}
          hitSlop={12}
          style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden' }}
        >
          {GLASS ? (
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              <ChevronLeft size={22} color="#fff" />
            </GlassView>
          ) : (
            <BlurView intensity={60} tint="light" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 19 }}>
              <ChevronLeft size={22} color="#fff" />
            </BlurView>
          )}
        </Pressable>
      </Animated.View>

      {/* mini player */}
      {showMini && !bigMini && (
        <DockedMini
          video={current}
          store={store}
          onExpand={() => { listRef.current?.scrollToOffset({ offset: 0, animated: true }); }}
          onClose={() => { haptic(); setPlaying(false); setBigMini(false); setMiniClosed(true); }}
          onToggle={() => { console.log('MINI TOGGLE'); haptic(); setPlaying((p) => !p); }}
          playing={playing}
          colors={colors}
          isDark={isDark}
          bottom={insets.bottom}
          slotH={miniH}
        />
      )}

      {showMini && (
        <Animated.View
          {...bigPan.panHandlers}
          style={{
            position: 'absolute', zIndex: 12, borderRadius: 12,
            left: bigMini ? SCREEN_WIDTH - 12 - BIG_W : 16,
            bottom: insets.bottom + (bigMini ? 16 : 8),
            width: bigMini ? BIG_W : MINI_W,
            height: bigMini ? bigH : miniH,
            transform: [{ translateX: bigDrag.x }, { translateY: bigDrag.y }],
          }}
        />
      )}

      {showMini && bigMini && (
        <Animated.View
          style={{
            position: 'absolute', zIndex: 12, gap: 10, width: 40,
            left: bigSide === 'right' ? SCREEN_WIDTH - 12 - BIG_W - 50 : SCREEN_WIDTH - 12 + 10,
            bottom: insets.bottom + 16,
            transform: [{ translateX: bigDrag.x }, { translateY: bigDrag.y }],
          }}
        >
          <GlassCircle Icon={Minimize2} onPress={() => { haptic(); setBigMini(false); }} colors={colors} isDark={isDark} />
          <GlassCircle
            Icon={playing ? Pause : Play}
            fillIcon
            nudge={!playing}
            tinted
            onPress={() => { haptic(); setPlaying((p) => !p); }}
            colors={colors}
            isDark={isDark}
          />
        </Animated.View>
      )}

      <Toast msg={toast} bottom={showMini ? insets.bottom + (bigMini ? bigH : miniH) + 28 : insets.bottom + 40} />

      {/* ─── SHEETS ─── */}
      <Sheet open={sheet === 'speed'} onClose={() => setSheet(null)} title="Playback speed" colors={colors} isDark={isDark}>
        <View style={{ paddingVertical: 6 }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((sp) => (
            <Pressable
              key={sp}
              onPress={() => { haptic(); setSpeed(sp); setSheet(null); showToast(`${sp}× speed`); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{sp === 1 ? 'Normal' : `${sp}×`}</Text>
              {speed === sp && <Check size={16} color={colors.brand} />}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet open={sheet === 'options'} onClose={() => setSheet(null)} title="Player options" colors={colors} isDark={isDark}>
        <View style={{ paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>Autoplay next video</Text>
            <Switch value={autoplay} onValueChange={(v) => { setAutoplay(v); haptic(); }} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>Resume where I left off</Text>
            <Switch value={resumeOn} onValueChange={(v) => { setResumeOn(v); haptic(); }} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>Haptic feedback</Text>
            <Switch value={hapticsOn} onValueChange={(v) => setHapticsOn(v)} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <Pressable
            onPress={() => { haptic(); setHidden([]); writeJSON(HIDDEN_KEY, []); showToast('Hidden videos restored'); }}
            style={{ paddingHorizontal: 20, paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Restore hidden videos ({hidden.length})</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic();
              const keep = { [currentId]: Date.now() };
              setHistory(keep);
              writeJSON(HIST_KEY, keep);
              resumeRef.current = {};
              setResume({});
              writeJSON(RESUME_KEY, {});
              showToast('Watch history cleared');
            }}
            style={{ paddingHorizontal: 20, paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#ef4444' }}>Clear watch history</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet open={sheet === 'timer'} onClose={() => setSheet(null)} title="Sleep timer" colors={colors} isDark={isDark}>
        <View style={{ paddingVertical: 6 }}>
          {[0, 5, 10, 15, 30, 60].map((m) => (
            <Pressable
              key={m}
              onPress={() => { haptic(); setSleepMin(m); setSheet(null); showToast(m === 0 ? 'Timer off' : `Pausing in ${m} minutes`); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{m === 0 ? 'Off' : `${m} minutes`}</Text>
              {sleepMin === m && <Check size={16} color={colors.brand} />}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet open={sheet === 'share'} onClose={() => setSheet(null)} title="Share" colors={colors} isDark={isDark}>
        <View style={{ paddingVertical: 6 }}>
          <Pressable onPress={shareVideo} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Share2 size={16} color={colors.brand} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Share title and link</Text>
          </Pressable>
          <Pressable onPress={shareLinkOnly} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Link2 size={16} color={colors.brand} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Share link only</Text>
          </Pressable>
          <Pressable onPress={openYouTube} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={16} color={colors.brand} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Open in YouTube</Text>
          </Pressable>
          <Pressable onPress={() => { setSheet(null); addToQueue(current); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
              <ListVideo size={16} color={colors.brand} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Add to queue</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet open={sheet === 'queue'} onClose={() => setSheet(null)} title={`Queue · ${queue.length}`} colors={colors} isDark={isDark}>
        <ScrollView style={{ maxHeight: 420 }}>
          {queue.length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <ListVideo size={28} color={subtitle} />
              <Text style={{ fontSize: 13, color: subtitle, marginTop: 8, textAlign: 'center' }}>
                Your queue is empty. Long-press any video to add it. Queued videos play before the similar ones.
              </Text>
            </View>
          )}
          {queue.map((q) => (
            <View key={q.video_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
              <GripVertical size={16} color={subtitle} />
              <Pressable
                onPress={() => { setSheet(null); removeFromQueue(q.video_id, true); play(q.video_id); }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}
              >
                <View style={{ width: 64, height: 40, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                  <Image source={{ uri: q.thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{q.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: subtitle, marginTop: 1 }}>{q.channel}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => removeFromQueue(q.video_id)} hitSlop={8} style={{ padding: 6 }}>
                <Trash2 size={15} color={subtitle} />
              </Pressable>
            </View>
          ))}
          {queue.length > 0 && (
            <Pressable onPress={clearQueue} style={{ alignItems: 'center', paddingVertical: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#ef4444' }}>Clear queue</Text>
            </Pressable>
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}