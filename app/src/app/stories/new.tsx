import { useState, useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Dimensions,
  ActivityIndicator, Modal, Alert, Platform, KeyboardAvoidingView, Keyboard, PanResponder, Animated,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X, Plus, Trash2, ArrowLeft, Eye, Heart, Play, Pause, Tag, ChevronLeft, ChevronRight,
  Crop, Pencil, Music, Smile, ShoppingBag, RotateCw, Settings,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '@/context/AuthContext';
import StorePage from '@/app/seller/[id]';
import api from '@/api/client';
import PostSettingsSheet, { PostSettingsT } from '@/components/PostSettingsSheet';
import { STORY_MUSIC } from '@/data/storyMusic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();
const MAX_ITEMS = 10;
const MAX_MUSIC_MS = 30_000;
const SPOTLIGHT_PROFILE_ROUTE = '/SpotlightProfile' as const;
const hasPostSettings = (s?: Partial<PostSettingsT>) =>
  !!s && Object.values(s).some((v) => v !== undefined);

type PlayerControl = {
  seek: (ms: number) => void;
  pause: () => void;
  play: () => void;
  scrubbing: boolean;
};

const MAX_VIDEO_MS = 60000;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // keep in sync with the backend

const STORY_TAGS = [
  { key: 'entertainment', label: '🎭 Entertainment' },
  { key: 'educational', label: '📚 Educational' },
  { key: 'news', label: '📰 News & Commentary' },
  { key: 'commercial', label: '🛍️ Commercial' },
  { key: 'lifestyle', label: '🌴 Lifestyle' },
  { key: 'creative', label: '🎨 Creative & Craft' },
  { key: 'inspirational', label: '✨ Inspirational' },
];

const TOOLS = [
  { key: 'crop', label: 'Crop', Icon: Crop },
  { key: 'pencil', label: 'Text', Icon: Pencil },
  { key: 'music', label: 'Music', Icon: Music },
  { key: 'emoji', label: 'Emoji', Icon: Smile },
    { key: 'product', label: 'Product', Icon: ShoppingBag }, // sellers only
  { key: 'settings', label: 'Settings', Icon: Settings }, // feed posts only
] as const;

type TextOverlayT = { text: string; y: number }; // y = 0 (top) … 1 (bottom) of the preview
// x / y = card centre as 0..1 of the preview, rot = degrees
type ProductTagT = { id: string; title: string; price: number; image: string | null; x: number; y: number; rot: number };

type PickedItem = {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
  overLimit?: boolean;
  contentType?: string | null;
  caption?: string;
  durationMs?: number;
  trimStart?: number;
  trimEnd?: number;
  imgW?: number;
  imgH?: number;
  originalUri?: string;
  origW?: number;
  origH?: number;
  cropped?: boolean;
  crop?: { x: number; y: number; w: number; h: number };
  textOverlay?: TextOverlayT;
    productTag?: ProductTagT;
  settings?: Partial<PostSettingsT>;
  music?: {
    key: string;
    title: string;
    artist: string;
    uri: string;
    startMs: number;
    endMs: number;
    avatar?: string | null;
  } | null;
};

// Heroicons adjustments-horizontal (outline)
function AdjustmentsHorizontalIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
      />
    </Svg>
  );
}

const PICKER_BARS = 56;
const PICKER_PAD = 8;
const PICKER_H = 48;

function MusicRangePicker({
  startMs, endMs, durationMs, onChange, onDragStart, onDragEnd,
}: {
  startMs: number; endMs: number; durationMs: number;
  onChange: (startMs: number, endMs: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [outerW, setOuterW] = useState(0);
  const width = Math.max(0, outerW - PICKER_PAD * 2);
  const range = Math.max(durationMs, 1000);
  const latest = useRef({ startMs, endMs, range, width, onChange, onDragStart, onDragEnd });
  latest.current = { startMs, endMs, range, width, onChange, onDragStart, onDragEnd };
  const grab = useRef({ s: 0, e: 0 });

  const heights = useMemo(
    () => Array.from({ length: PICKER_BARS }, (_, i) => {
      const x = Math.sin((Math.round(durationMs / 1000) + 1) * (i + 1) * 12.9898) * 43758.5453;
      return 8 + (x - Math.floor(x)) * 28;
    }),
    [durationMs],
  );

  const makeResponder = (handle: 'start' | 'end' | 'move') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      grab.current = { s: latest.current.startMs, e: latest.current.endMs };
      latest.current.onDragStart?.();
    },
    onPanResponderMove: (_, g) => {
      const { range, width, onChange } = latest.current;
      if (width <= 0) return;
      const dMs = (g.dx / width) * range;
      const { s, e } = grab.current;
      const len = e - s;
      const atMax = len >= MAX_MUSIC_MS - 50;
      if (handle === 'move' || atMax) {
        // slide the whole section
        const ns = Math.max(0, Math.min(s + dMs, range - len));
        onChange(Math.round(ns), Math.round(ns + len));
      } else if (handle === 'start') {
        const ns = Math.max(0, Math.min(s + dMs, e - 1000));
        const ne = e - ns > MAX_MUSIC_MS ? ns + MAX_MUSIC_MS : e;
        onChange(Math.round(ns), Math.round(ne));
      } else {
        const ne = Math.min(range, Math.max(e + dMs, s + 1000));
        const ns = ne - s > MAX_MUSIC_MS ? ne - MAX_MUSIC_MS : s;
        onChange(Math.round(ns), Math.round(ne));
      }
    },
    onPanResponderRelease: () => latest.current.onDragEnd?.(),
    onPanResponderTerminate: () => latest.current.onDragEnd?.(),
  });

  const startResponder = useRef(makeResponder('start')).current;
  const endResponder = useRef(makeResponder('end')).current;
  const moveResponder = useRef(makeResponder('move')).current;

  const startX = PICKER_PAD + Math.max(0, Math.min(width, (startMs / range) * width));
  const endX = PICKER_PAD + Math.max(0, Math.min(width, (endMs / range) * width));
  const HIT = 32;

  return (
    <View style={{ marginTop: 16 }}>
      <View
        onLayout={(e) => setOuterW(e.nativeEvent.layout.width)}
        style={{ height: PICKER_H, justifyContent: 'center' }}
      >
        {/* waveform */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: PICKER_PAD, width, height: PICKER_H,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          {heights.map((h, i) => {
            const frac = (i + 0.5) / PICKER_BARS;
            const inside = frac >= startMs / range && frac <= endMs / range;
            return (
              <View
                key={i}
                style={{
                  width: 3, height: h, borderRadius: 2,
                  backgroundColor: inside ? '#f5b301' : 'rgba(255,255,255,0.3)',
                }}
              />
            );
          })}
        </View>

        {/* selected frame, drag to slide the whole section */}
        <View
          {...moveResponder.panHandlers}
          style={{
            position: 'absolute', left: startX, width: Math.max(8, endX - startX), height: PICKER_H,
            borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#f5b301',
            backgroundColor: 'rgba(245,179,1,0.12)',
          }}
        />

        {/* handles */}
        <View
          {...startResponder.panHandlers}
          style={{ position: 'absolute', left: startX - HIT / 2, width: HIT, height: PICKER_H, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 14, height: PICKER_H, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, backgroundColor: '#f5b301', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: '#000' }} />
          </View>
        </View>
        <View
          {...endResponder.panHandlers}
          style={{ position: 'absolute', left: endX - HIT / 2, width: HIT, height: PICKER_H, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 14, height: PICKER_H, borderTopRightRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#f5b301', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: '#000' }} />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PICKER_PAD, marginTop: 6 }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>{Math.round(startMs / 1000)}s</Text>
        <Text style={{ color: '#fff', fontSize: 12 }}>{Math.round((endMs - startMs) / 1000)}s selected</Text>
        <Text style={{ color: '#fff', fontSize: 12 }}>{Math.round(endMs / 1000)}s</Text>
      </View>
    </View>
  );
}

function DraggableSheet({ colors, insets, onClose, children, maxHeight = '70%' }: {
  colors: any; insets: any; onClose: () => void; children: ReactNode; maxHeight?: string | number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const drag = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 2,
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 120 || gesture.vy > 0.8) {
        Animated.timing(translateY, { toValue: 700, duration: 180, useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20 }).start();
      }
    },
  })).current;
  return (
    <Animated.View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: insets.bottom + 18, maxHeight, transform: [{ translateY }] }}>
      <View {...drag.panHandlers} style={{ paddingVertical: 8, marginTop: -8 }}>
        <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 10 }} />
      </View>
      {children}
    </Animated.View>
  );
}

export default function NewStory() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { soundId, soundOwner } = useLocalSearchParams<{ soundId?: string; soundOwner?: string }>();
  const [useSound, setUseSound] = useState(true);
  const [soundInfo, setSoundInfo] = useState<any>(null);
  const [selectedSoundId, setSelectedSoundId] = useState(soundId || '');
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicTab, setMusicTab] = useState<'sounds' | 'mine'>('sounds');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [mode, setMode] = useState<'story' | 'spotlight'>('story');
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];
  const selectedMusic = active?.music ?? null;
  const musicPlayer = useAudioPlayer(selectedMusic?.uri ?? null);
  const musicStatus = useAudioPlayerStatus(musicPlayer);
  useEffect(() => {
    if (selectedMusic) {
      musicPlayer.loop = false;
      musicPlayer.seekTo(selectedMusic.startMs / 1000);
      musicPlayer.play();
    }
    return () => musicPlayer.pause();
  }, [selectedMusic?.key, musicPlayer]);
  useEffect(() => {
    if (!selectedMusic) return;
    const timer = setInterval(() => {
      if (musicPlayer.currentTime * 1000 >= selectedMusic.endMs) {
        musicPlayer.pause();
        musicPlayer.seekTo(selectedMusic.startMs / 1000);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [selectedMusic, musicPlayer]);
  useEffect(() => {
    if (!selectedSoundId) {
      setSoundInfo(null);
      return;
    }
    api.get(`/stories/sound/${selectedSoundId}`)
      .then((r) => setSoundInfo(r.data.original))
      .catch(() => {
        setSoundInfo(null);
        setSelectedSoundId('');
        setUseSound(false);
        Toast.show({ type: 'error', text1: 'This sound is no longer available' });
      });
  }, [selectedSoundId]);
  // arriving from "Use audio": open the picker straight away, as a feed post
  useEffect(() => { if (soundId) pickMedia('spotlight'); }, [soundId]);
  // only sellers see the product tag tool
  const isSeller = user?.account_type === 'seller';

  const [cropIndex, setCropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (cropIndex !== null) playerControl.current?.pause();
    else playerControl.current?.play();
  }, [cropIndex]);
  const [posting, setPosting] = useState(false);
  const [myStories, setMyStories] = useState<any[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const playhead = useRef(new Animated.Value(0)).current;
  const playerControl = useRef<PlayerControl | null>(null);
  const [typeModal, setTypeModal] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
    const [storeOpen, setStoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textEditing, setTextEditing] = useState(false);
  const [previewH, setPreviewH] = useState(0);
  const missCount = useRef(0);
  const blink = useRef(new Animated.Value(1)).current;

  // switching to another item always leaves text-editing mode
  useEffect(() => { setTextEditing(false); }, [activeIndex]);

  const blinkTypeBtn = () => {
    Animated.sequence(
      Array.from({ length: 4 }).flatMap(() => [
        Animated.timing(blink, { toValue: 0.15, duration: 200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ).start();
  };

  const fetchMine = () => {
    api.get('/stories/mine')
      .then((res) => setMyStories(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingMine(false));
  };

  useEffect(() => { fetchMine(); }, []);

  const deleteStory = async (id: string) => {
    try {
      await api.delete(`/stories/${id}`);
      setMyStories((prev) => prev.filter((s) => s.id !== id));
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to delete' });
    }
  };

  const planActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  const pickMedia = async (m?: 'story' | 'spotlight') => {
    if (m === 'story' || m === 'spotlight') setMode(m);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access photos' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ITEMS,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    const tooBig = result.assets.filter(
      (a) => a.type === 'video' && (a.fileSize ?? 0) > MAX_VIDEO_BYTES,
    );
    const okAssets = result.assets.filter((a) => !tooBig.includes(a));
    if (tooBig.length > 0) {
      Toast.show({
        type: 'error',
        position: 'top',
        text1: tooBig.length > 1 ? 'Some videos are too large' : 'Video too large',
        text2: 'Videos must be under 100MB. Pick a shorter one or trim it first.',
      });
    }
    if (okAssets.length === 0) return;

    const picked: PickedItem[] = okAssets.map((a) => {
      const isVideo = a.type === 'video';
      const dur = isVideo ? (a.duration ?? 0) : 0;
      return {
        uri: a.uri,
        type: isVideo ? 'video' : 'image',
        fileName: a.fileName || `story_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        durationMs: dur,
        trimStart: 0,
        trimEnd: Math.min(dur, MAX_VIDEO_MS),
        imgW: a.width,
        imgH: a.height,
        origW: a.width,
        origH: a.height,
        originalUri: a.uri,
      };
    });

    setItems((prev) => [...prev, ...picked].slice(0, MAX_ITEMS));
    setActiveIndex(0);
  };

  const trimVideoIOS = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    if ((a.fileSize ?? 0) > MAX_VIDEO_BYTES) {
      Toast.show({
        type: 'error',
        position: 'top',
        text1: 'Video too large',
        text2: 'Videos must be under 100MB.',
      });
      return;
    }
    const updated: PickedItem = {
      uri: a.uri,
      type: 'video',
      fileName: a.fileName || `story_${Date.now()}.mp4`,
      mimeType: a.mimeType || 'video/mp4',
      overLimit: (a.duration ?? 0) > MAX_VIDEO_MS,
    };
    setItems((prev) => prev.map((it, i) => (
      i === index ? { ...updated, contentType: it.contentType, caption: it.caption } : it
    )));
  };

  const toggleCrop = () => {
    const it = items[activeIndex];
    if (!it || it.type !== 'image') return;
    if (it.cropped && it.originalUri) {
      setItems((prev) => prev.map((x, i) => (
        i === activeIndex
          ? { ...x, uri: x.originalUri!, imgW: x.origW, imgH: x.origH, cropped: false }
          : x
      )));
      Toast.show({ type: 'success', position: 'top', text1: 'Crop undone' });
      return;
    }
    if (!it.imgW || !it.imgH) {
      Toast.show({ type: 'error', position: 'top', text1: "Can't crop this image" });
      return;
    }
    setCropIndex(activeIndex);
  };

  const applyCrop = async (r: { originX: number; originY: number; width: number; height: number }) => {
    const idx = cropIndex;
    setCropIndex(null);
    if (idx === null) return;
    const it = items[idx];
    try {
      const out = await ImageManipulator.manipulateAsync(it.uri, [{ crop: r }], {
        compress: 0.9,
        format: it.mimeType === 'image/png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
      });
      setItems((prev) => prev.map((x, i) => (
        i === idx ? { ...x, uri: out.uri, imgW: out.width, imgH: out.height, cropped: true } : x
      )));
    } catch {
      Toast.show({ type: 'error', position: 'top', text1: "Couldn't crop image" });
    }
  };

  const [videoCropThumb, setVideoCropThumb] = useState<{ uri: string; w: number; h: number } | null>(null);

  const toggleVideoCrop = async () => {
    const it = items[activeIndex];
    if (!it || it.type !== 'video') return;
    if (it.crop) {
      setItems((prev) => prev.map((x, i) => (
        i === activeIndex ? { ...x, crop: undefined, cropped: false } : x
      )));
      Toast.show({ type: 'success', position: 'top', text1: 'Crop undone' });
      return;
    }
    try {
      const t = await VideoThumbnails.getThumbnailAsync(it.uri, { time: 0, quality: 0.7 });
      setVideoCropThumb({ uri: t.uri, w: t.width, h: t.height });
      setCropIndex(activeIndex);
    } catch {
      Toast.show({ type: 'error', position: 'top', text1: "Can't crop this video" });
    }
  };

  const applyVideoCrop = (r: { originX: number; originY: number; width: number; height: number }) => {
    const idx = cropIndex;
    const t = videoCropThumb;
    setCropIndex(null);
    setVideoCropThumb(null);
    if (idx === null || !t) return;
    const crop = { x: r.originX / t.w, y: r.originY / t.h, w: r.width / t.w, h: r.height / t.h, fa: t.w / t.h };
    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, crop, cropped: true } : x)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex((i) => Math.max(0, Math.min(i, items.length - 2)));
  };

  const handlePost = async () => {
    if (items.length === 0) return;

    const missingIndex = mode === 'spotlight' ? items.findIndex((it) => !it.contentType) : -1;
    if (missingIndex !== -1) {
      // Error haptic fires immediately on the blocked attempt, alongside the blink
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setActiveIndex(missingIndex);
      blinkTypeBtn();
      missCount.current += 1;
      if (missCount.current >= 3) {
        missCount.current = 0;
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Set your content type',
          text2: 'Tap the tag icon at the top to choose one.',
        });
        return;
      }
      return;
    }

    setPosting(true);
    try {
      const uploaded: {
        media_url: string; media_type: string; content_type: string | null; caption: string | null;
        trim_start_ms: number | null; trim_end_ms: number | null;
        crop: { x: number; y: number; w: number; h: number } | null;
        text_overlay: { text: string; y: number } | null;
        sound_story_id: number | null;
        music_url: string | null;
        music_start_ms: number | null;
        music_end_ms: number | null;
        allow_chat: boolean | null; show_likes: boolean | null;
        allow_repost: boolean | null; allow_export: boolean | null;
        product_tag: { product_id: string; title: string; price: number; image: string | null; x: number; y: number; rot: number } | null;
      }[] = [];

      for (const item of items) {
        const form = new FormData();
        form.append('file', {
          uri: item.uri,
          name: item.fileName,
          type: item.mimeType,
        } as any);

        const res = await api.post('/uploads', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000,
          onUploadProgress: (e) => console.log('upload', item.type, e.loaded, '/', e.total),
        });
        const overlayText = item.textOverlay?.text.trim();
        uploaded.push({
          media_url: res.data.url,
          media_type: item.type,
          content_type: item.contentType || null,
          caption: item.caption?.trim() || null,
          trim_start_ms: item.type === 'video' ? Math.round(item.trimStart ?? 0) : null,
          trim_end_ms: item.type === 'video' ? Math.round(item.trimEnd ?? 0) : null,
          crop: item.type === 'video' ? (item.crop ?? null) : null,
          text_overlay: overlayText ? { text: overlayText, y: item.textOverlay!.y } : null,
          sound_story_id: useSound && selectedSoundId ? Number(selectedSoundId) : null,
          music_url: item.music?.uri || null,
          music_start_ms: item.music ? Math.round(item.music.startMs) : null,
          music_end_ms: item.music ? Math.round(item.music.endMs) : null,
          allow_chat: mode === 'spotlight' ? (item.settings?.allow_chat ?? null) : null,
          show_likes: mode === 'spotlight' ? (item.settings?.show_likes ?? null) : null,
          allow_repost: mode === 'spotlight' ? (item.settings?.allow_repost ?? null) : null,
          allow_export: mode === 'spotlight' ? (item.settings?.allow_export ?? null) : null,
          product_tag: item.productTag
            ? {
                product_id: item.productTag.id,
                title: item.productTag.title,
                price: item.productTag.price,
                image: item.productTag.image,
                x: item.productTag.x,
                y: item.productTag.y,
                rot: item.productTag.rot,
              }
            : null,
        });
      }

      await api.post('/stories', {
        media: uploaded,
        kind: mode,
      });

      setItems([]);
      fetchMine();

      if (mode === 'spotlight') {
        Toast.show({
          type: 'success',
          text1: 'Posted to Feed',
          text2: 'Tap to check it in your profile',
          onPress: () => {
            Toast.hide();
            router.push(SPOTLIGHT_PROFILE_ROUTE);
          },
        });
      } else {
        Toast.show({ type: 'success', text1: 'Story posted' });
      }
    } catch (err: any) {
      console.log('POST STORY ERROR', err?.message, err?.response?.status, err?.response?.data);
      Toast.show({
        type: 'error',
        position: 'top',
        text1: err?.response?.data?.error || 'Failed to post story',
      });
    } finally {
      setPosting(false);
    }
  };

  // ── Picker screen (before anything selected) ──
  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingTop: 10, paddingHorizontal: 16, paddingBottom: 14,
          }}
        >
          <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>
            New story
          </Text>
        </View>

        {loadingMine ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} colors={colors} pulse />)}
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              {!myStories.some((s) => (s.kind ?? 'story') === 'story') && (
                <>
                  {[0, 1, 2].map((i) => <SkeletonRow key={i} colors={colors} />)}
                  <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 15, fontWeight: '600', color: colors.textMuted }}>
                    No stories yet. Tap "Add to Story" to post one.
                  </Text>
                </>
              )}
              {(['story'] as const).map((k) => {
                const list = myStories.filter((s) => (s.kind ?? 'story') === k);
                if (list.length === 0) return null;
                return (
                  <View key={k} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', letterSpacing: 0.6, color: colors.textMuted }}>
                        {k === 'story' ? 'STORIES' : 'FEED'}
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>
                    {list.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push({ pathname: '/stories', params: { openStoryId: s.id } })}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.card, borderRadius: 14,
                    borderWidth: 1, borderColor: colors.border,
                    padding: 8, gap: 12,
                  }}
                >
                  <View style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                    {s.media_type === 'video' ? (
                      <VideoThumb uri={s.media_url} />
                    ) : (
                      <Image source={{ uri: s.media_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    )}
                  </View>

                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 }}>
                    <Eye size={14} color={colors.textMuted} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted }}>
                      {s.view_count ?? 0}
                    </Text>
                    {s.kind === 'spotlight' && (
                      <>
                        <Heart size={14} color={colors.textMuted} style={{ marginLeft: 12 }} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted }}>
                          {s.like_count ?? 0}
                        </Text>
                      </>
                    )}
                  </View>

                  <Pressable
                    onPress={() => Alert.alert('Delete story?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteStory(s.id) },
                    ])}
                    style={{ padding: 6 }}
                  >
                    <Trash2 size={18} color="#ef4444" />
                  </Pressable>
                </Pressable>
                    ))}
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 2, marginBottom: insets.bottom + 12 }}>
              <GlassActionButton
                onPress={() => pickMedia('story')}
                colors={colors}
                style={{
                  borderTopLeftRadius: 999,
                  borderBottomLeftRadius: 999,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }}
                label="Add to Story"
              />
              <GlassActionButton
                onPress={() => pickMedia('spotlight')}
                colors={colors}
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderTopRightRadius: 999,
                  borderBottomRightRadius: 999,
                }}
                label="Post to Feed"
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── Preview modal ──
  // patch (or clear, with null) the active item's text overlay
  const setOverlay = (patch: Partial<TextOverlayT> | null) => {
    setItems((prev) => prev.map((x, i) => {
      if (i !== activeIndex) return x;
      if (patch === null) return { ...x, textOverlay: undefined };
      return { ...x, textOverlay: { ...(x.textOverlay ?? { text: '', y: 0.5 }), ...patch } };
    }));
  };

  const finishTextEdit = () => {
    setTextEditing(false);
    if (!items[activeIndex]?.textOverlay?.text.trim()) setOverlay(null);
  };

    const setPostSetting = (key: keyof PostSettingsT, value: boolean | undefined) => {
    setItems((prev) => prev.map((x, i) => (
      i === activeIndex ? { ...x, settings: { ...(x.settings ?? {}), [key]: value } } : x
    )));
  };

  const setTag = (next: ProductTagT | null) => {
    setItems((prev) => prev.map((x, i) => (i === activeIndex ? { ...x, productTag: next ?? undefined } : x)));
  };

  const setActiveMusic = (track: (typeof STORY_MUSIC)[number] | null) => {
    setItems((prev) => prev.map((item, index) => (
      index === activeIndex
        ? {
            ...item,
            music: track
              ? { ...track, startMs: 0, endMs: Math.min(track.durationMs, MAX_MUSIC_MS) }
              : null,
          }
        : item
    )));
  };

  const setMusicRange = (startMs: number, endMs: number) => {
    if (!active?.music) return;
    const maxDuration = Math.max(active.music.durationMs, 1000);
    const nextStart = Math.max(0, Math.min(startMs, maxDuration - 1000));
    const nextEnd = Math.min(Math.max(endMs, nextStart + 1000), Math.min(maxDuration, nextStart + MAX_MUSIC_MS));
    setItems((prev) => prev.map((item, index) => (
      index === activeIndex && item.music
        ? { ...item, music: { ...item.music, startMs: nextStart, endMs: nextEnd } }
        : item
    )));
    musicPlayer.seekTo(nextStart / 1000);
  };

  const moveTag = (patch: Partial<ProductTagT>) => {
    setItems((prev) => prev.map((x, i) => (
      i === activeIndex && x.productTag ? { ...x, productTag: { ...x.productTag, ...patch } } : x
    )));
  };

  const pickTool = (key: string) => {
    setToolsOpen(false);
    if (key === 'crop') {
      // let the modal close first so the crop overlay doesn't glitch
      setTimeout(() => (active.type === 'image' ? toggleCrop() : toggleVideoCrop()), 250);
    } else if (key === 'pencil') {
      if (!active.textOverlay) setOverlay({ text: '', y: 0.5 });
      setTimeout(() => setTextEditing(true), 250);
        } else if (key === 'settings') {
      setTimeout(() => setSettingsOpen(true), 250);
    } else if (key === 'product') {
      setTimeout(() => setStoreOpen(true), 250);
    } else if (key === 'music') {
      setTimeout(() => setMusicOpen(true), 250);
    } else {
      Toast.show({ position: 'top', text1: 'Coming soon' });
    }
  };

  return (
    <Modal visible transparent={false} animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#000' }}
        behavior="padding"
      >
        {/* Preview */}
        <Pressable
          style={{ flex: 1 }}
          onPress={Keyboard.dismiss}
          onLayout={(e) => setPreviewH(e.nativeEvent.layout.height)}
        >
          {active.type === 'video' ? (
            <StoryPreviewVideo
              key={active.uri}
              uri={active.uri}
              startMs={active.trimStart ?? 0}
              endMs={active.trimEnd ?? active.durationMs ?? 0}
              crop={active.crop}
              playhead={playhead}
              control={playerControl}
              muted={!!soundId && useSound}
            />
          ) : (
            <Image
              source={{ uri: active.uri }}
              style={{ width: SCREEN_WIDTH, height: '100%' }}
              contentFit="contain"
            />
          )}

          {!!selectedSoundId && useSound && !!soundInfo && (
            <PreviewSound url={soundInfo.media_url} start={soundInfo.trim_start_ms} end={soundInfo.trim_end_ms} />
          )}

          {!!active.textOverlay && previewH > 0 && (
            <TextOverlay
              key={activeIndex}
              text={active.textOverlay.text}
              y={active.textOverlay.y}
              editing={textEditing}
              previewH={previewH}
              onChangeText={(t) => setOverlay({ text: t })}
              onMove={(y) => setOverlay({ y })}
              onStartEdit={() => setTextEditing(true)}
              onDoneEdit={finishTextEdit}
            />
          )}

          {!!active.productTag && previewH > 0 && (
            <ProductTagCard
              key={`tag-${activeIndex}`}
              tag={active.productTag}
              previewW={SCREEN_WIDTH}
              previewH={previewH}
              onChange={moveTag}
              onRemove={() => setTag(null)}
            />
          )}

          {!!selectedMusic && (
            <Pressable
              onPress={() => { setMusicTab('sounds'); setMusicOpen(true); }}
              hitSlop={6}
              style={{
                position: 'absolute', top: insets.top + 12, right: mode === 'spotlight' ? 160 : 112,
                width: 34, height: 34, borderRadius: 17, overflow: 'hidden',
                backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {!!selectedMusic.avatar && (
                <Image source={{ uri: selectedMusic.avatar }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
              )}
              <BlurView intensity={25} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Music size={16} color="#fff" />
              </BlurView>
            </Pressable>
          )}

          <Animated.View
            style={{
              position: 'absolute', top: insets.top + 14, right: 112, opacity: blink,
              display: mode === 'spotlight' ? 'flex' : 'none',
            }}
          >
            <Pressable
              onPress={() => setTypeModal(true)}
              style={{
                backgroundColor: items[activeIndex]?.contentType ? '#f5b301' : '#ef4444',
                borderRadius: 999,
                paddingHorizontal: 12, paddingVertical: 7,
              }}
            >
              <Tag size={16} color={items[activeIndex]?.contentType ? '#000' : '#fff'} />
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={() => setToolsOpen(true)}
            style={{
              position: 'absolute', top: insets.top + 14, right: 64,
              backgroundColor: (active.cropped || !!active.textOverlay || !!active.productTag) ? '#f5b301' : 'rgba(0,0,0,0.55)',
              borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
            }}
          >
            <AdjustmentsHorizontalIcon size={16} color={(active.cropped || !!active.textOverlay || !!active.productTag) ? '#000' : '#fff'} />
          </Pressable>

          <Pressable
            onPress={() => (items.length === 1 ? setItems([]) : removeItem(activeIndex))}
            style={{
              position: 'absolute', top: insets.top + 14, right: 16,
              backgroundColor: '#ef4444', borderRadius: 999,
              paddingHorizontal: 12, paddingVertical: 7,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <Trash2 size={16} color="#fff" />

          </Pressable>

          <Pressable
            onPress={() => setItems([])}
            style={{
              position: 'absolute', top: insets.top + 14, left: 16,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
        </Pressable>

        {/* Thumbnail strip */}
        {items.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10, flexGrow: 1, justifyContent: 'center' }}
            style={{ maxHeight: 64 }}
          >
            {items.map((item, i) => (
              <Pressable key={item.uri + i} onPress={() => setActiveIndex(i)}>
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 8, overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: i === activeIndex ? '#fff' : 'transparent',
                  }}
                >
                  <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </View>
              </Pressable>
            ))}
            {items.length < MAX_ITEMS && (
              <Pressable
                onPress={() => pickMedia()}
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderStyle: 'dashed',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={20} color="#fff" />
              </Pressable>
            )}
          </ScrollView>
        )}

        {/* Caption + post */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 16,
            gap: 12,
          }}
        >
          {!!soundId && useSound && (
            <Pressable
              onPress={() => setUseSound(false)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Text style={{ color: '#f5b301', fontSize: 13, fontWeight: '700' }}>
                ♪ Using sound from {soundOwner}
              </Text>
              <X size={14} color="#f5b301" strokeWidth={3} />
            </Pressable>
          )}
          {active.type === 'video' && !!active.durationMs && (
            <View style={{ marginHorizontal: -16 }}>
              <TrimBar
                uri={active.uri}
                playhead={playhead}
                control={playerControl}
                durationMs={active.durationMs}
                start={active.trimStart ?? 0}
                end={active.trimEnd ?? active.durationMs}
                onChange={(s, e) =>
                  setItems((prev) => prev.map((it, i) => (
                    i === activeIndex ? { ...it, trimStart: s, trimEnd: e } : it
                  )))
                }
              />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              value={items[activeIndex]?.caption ?? ''}
              onChangeText={(text) => setItems((prev) => prev.map((it, i) => (
                i === activeIndex ? { ...it, caption: text } : it
              )))}
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={{
                flex: 7,
                height: 38,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderTopLeftRadius: 12,
                borderBottomLeftRadius: 12,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                paddingHorizontal: 14,
                color: '#fff',
                fontSize: 16,
              }}
              maxLength={150}
            />

            <Pressable
              onPress={handlePost}
              disabled={posting}
              style={{
                flex: 3,
                height: 38,
                backgroundColor: colors.brand,
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                borderTopRightRadius: 12,
                borderBottomRightRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: posting ? 0.7 : 1,
              }}
            >
              {posting ? (
                <ActivityIndicator color={colors.textOnGold} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textOnGold }}>
                  {items.length > 1 ? `Post (${items.length})` : 'Post'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
        {cropIndex !== null && (() => {
          const it = items[cropIndex];
          if (!it) return null;
          if (it.type === 'video') {
            if (!videoCropThumb) return null;
            return (
              <CropOverlay
                uri={videoCropThumb.uri}
                videoUri={it.uri}
                startMs={it.trimStart ?? 0}
                endMs={it.trimEnd ?? it.durationMs ?? 0}
                imgW={videoCropThumb.w}
                imgH={videoCropThumb.h}
                onCancel={() => { setCropIndex(null); setVideoCropThumb(null); }}
                onDone={applyVideoCrop}
              />
            );
          }
          if (!it.imgW || !it.imgH) return null;
          return (
            <CropOverlay
              uri={it.uri}
              imgW={it.imgW}
              imgH={it.imgH}
              onCancel={() => setCropIndex(null)}
              onDone={applyCrop}
            />
          );
        })()}
        {/* Editing tools (centered, horizontal) */}
        <Modal
          visible={toolsOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setToolsOpen(false)}
        >
          <Pressable
            onPress={() => setToolsOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          >
            <DraggableSheet colors={colors} insets={insets} onClose={() => setToolsOpen(false)} maxHeight="70%">
              {TOOLS.filter((t) => (t.key !== 'product' || isSeller) && (t.key !== 'settings' || mode === 'spotlight')).map(({ key, label, Icon }) => {
                const on = (key === 'crop' && !!active.cropped) || (key === 'pencil' && !!active.textOverlay)
                  || (key === 'product' && !!active.productTag)
                  || (key === 'settings' && hasPostSettings(active.settings));
                return (
                  <Pressable key={key} onPress={() => pickTool(key)} style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Icon size={20} color={on ? colors.brand : colors.textMuted} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{label}</Text>
                  </Pressable>
                );
              })}
            </DraggableSheet>
          </Pressable>
        </Modal>

        <Modal
          visible={musicOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setMusicOpen(false)}
        >
          <Pressable
            onPress={() => setMusicOpen(false)}
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <DraggableSheet colors={colors} insets={insets} onClose={() => setMusicOpen(false)}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Music & sounds</Text>
              <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 14 }}>
                Choose a temporary demo track or reuse an available video sound.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                {([['sounds', 'Sounds'], ['mine', 'My sounds']] as const).map(([k, label]) => (
                  <Pressable
                    key={k}
                    onPress={() => setMusicTab(k)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: musicTab === k ? colors.brand : colors.chipBg }}
                  >
                    <Text style={{ fontWeight: '800', color: musicTab === k ? colors.textOnGold : colors.text }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => { setSelectedSoundId(''); setSoundInfo(null); setUseSound(false); setActiveMusic(null); setMusicOpen(false); }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>No sound</Text>
              </Pressable>
              {musicTab === 'sounds' && STORY_MUSIC.map((track) => (
                <Pressable
                  key={track.key}
                  onPress={() => { setActiveMusic(track); setSelectedSoundId(''); setSoundInfo(null); setUseSound(false); }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {track.avatar ? <Image source={{ uri: track.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Music size={18} color={colors.brand} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{track.title}</Text>
                    <Text style={{ color: colors.textMuted, marginTop: 3 }}>{track.artist}</Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      if (selectedMusic?.key === track.key) {
                        if (musicStatus.playing) musicPlayer.pause();
                        else musicPlayer.play();
                      } else {
                        setActiveMusic(track); setSelectedSoundId(''); setSoundInfo(null); setUseSound(false);
                      }
                    }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: selectedMusic?.key === track.key ? colors.brand : colors.chipBg, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {selectedMusic?.key === track.key && musicStatus.playing
                      ? <Pause size={16} color={colors.textOnGold} fill={colors.textOnGold} />
                      : <Play size={16} color={selectedMusic?.key === track.key ? colors.textOnGold : colors.text} fill={selectedMusic?.key === track.key ? colors.textOnGold : colors.text} />}
                  </Pressable>
                </Pressable>
              ))}
              <ScrollView style={{ display: musicTab === 'mine' ? 'flex' : 'none' }}>
                {(myStories || []).filter((s: any) => s.media_type === 'video' && s.id).map((s: any) => (
                  <Pressable
                    key={String(s.id)}
                    onPress={() => { setSelectedSoundId(String(s.id)); setActiveMusic(null); setUseSound(true); }}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {s.user_avatar || s.media_url ? <Image source={{ uri: s.user_avatar || s.media_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Music size={18} color={colors.brand} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{s.caption?.trim() || 'My video sound'}</Text>
                      <Text style={{ color: colors.textMuted, marginTop: 3 }}>Your original audio</Text>
                    </View>
                    {String(selectedSoundId) === String(s.id) && <Text style={{ color: colors.brand, fontWeight: '800' }}>Selected</Text>}
                  </Pressable>
                ))}
              </ScrollView>
              {selectedMusic && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>Choose music section</Text>
                    <Pressable onPress={() => setActiveMusic(null)} hitSlop={8}>
                      <Text style={{ color: colors.brand, fontWeight: '800' }}>Remove</Text>
                    </Pressable>
                  </View>
                  <MusicRangePicker
                    startMs={selectedMusic.startMs}
                    endMs={selectedMusic.endMs}
                    durationMs={selectedMusic.durationMs}
                    onChange={setMusicRange}
                    onDragStart={() => musicPlayer.pause()}
                    onDragEnd={() => musicPlayer.play()}
                  />
                </View>
              )}
              <Pressable
                onPress={() => { musicPlayer.pause(); setMusicOpen(false); }}
                style={{ backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 14 }}
              >
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textOnGold }}>Done</Text>
              </Pressable>
            </DraggableSheet>
          </Pressable>
        </Modal>

        <PostSettingsSheet
          visible={settingsOpen}
          settings={active.settings ?? {}}
          onChange={setPostSetting}
          onClose={() => setSettingsOpen(false)}
        />

        <StorePicker
          visible={storeOpen}
          sellerId={user?.id}
          onClose={() => setStoreOpen(false)}
          onDone={(p) => {
            setStoreOpen(false);
            setTag({
              id: String(p.id),
              title: p.title,
              price: parseFloat(p.price) || 0,
              image: p.primary_image ?? null,
              x: active.productTag?.x ?? 0.5,
              y: active.productTag?.y ?? 0.7,
              rot: active.productTag?.rot ?? 0,
            });
          }}
        />

        <Modal
          visible={typeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setTypeModal(false)}
        >
          <Pressable
            onPress={() => setTypeModal(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          >
            <View
              style={{
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                padding: 16, paddingBottom: insets.bottom + 16, gap: 6,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 6 }}>
                Set content type
              </Text>
              {STORY_TAGS.map((t) => {
                const selected = items[activeIndex]?.contentType === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => {
                      setItems((prev) => prev.map((it, i) => (
                        i === activeIndex ? { ...it, contentType: t.key } : it
                      )));
                      setTypeModal(false);
                      missCount.current = 0;
                    }}
                    style={{
                      paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12,
                      backgroundColor: selected ? 'rgba(245,179,1,0.18)' : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: selected ? '#f5b301' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: selected ? '800' : '600', color: selected ? '#f5b301' : '#fff' }}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── TEXT OVERLAY ────────────────────────────────────────────────────
// Semi-transparent dark band spanning the full width of the preview. Tap the
// text to edit it; once the keyboard is dismissed the whole band can be
// dragged up/down the full height. `y` is stored as 0..1 so it maps to any
// screen size.
function TextOverlay({
  text, y, editing, previewH, onChangeText, onMove, onStartEdit, onDoneEdit,
}: {
  text: string; y: number; editing: boolean; previewH: number;
  onChangeText: (t: string) => void;
  onMove: (y: number) => void;
  onStartEdit: () => void;
  onDoneEdit: () => void;
}) {
  const [bandH, setBandH] = useState(60);
  const bandHRef = useRef(60);
  const yRef = useRef(y);
  const previewHRef = useRef(previewH);
  const editingRef = useRef(editing);
  const onMoveRef = useRef(onMove);
  const startTopRef = useRef(0);
  yRef.current = y;
  previewHRef.current = previewH;
  editingRef.current = editing;
  onMoveRef.current = onMove;

  const travel = Math.max(0, previewH - bandH);
  const top = y * travel;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // capture so a drag wins over the tap-to-edit Pressable inside the band
    onMoveShouldSetPanResponderCapture: (_e, g) =>
      !editingRef.current && Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      startTopRef.current = yRef.current * Math.max(0, previewHRef.current - bandHRef.current);
    },
    onPanResponderMove: (_e, g) => {
      const t = Math.max(0, previewHRef.current - bandHRef.current);
      if (t <= 0) return;
      const next = Math.min(t, Math.max(0, startTopRef.current + g.dy));
      onMoveRef.current(next / t);
    },
    onPanResponderTerminationRequest: () => false,
  })).current;

  const textStyle = {
    color: '#fff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    padding: 0,
  };

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        bandHRef.current = h;
        setBandH(h);
      }}
      style={{
        position: 'absolute', left: 0, right: 0, top,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingVertical: 14, paddingHorizontal: 16,
      }}
    >
      {editing ? (
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={onChangeText}
          onBlur={onDoneEdit}
          placeholder="Type something..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          maxLength={200}
          style={[textStyle, { textAlignVertical: 'center' }]}
        />
      ) : (
        <Pressable onPress={onStartEdit}>
          <Text style={textStyle}>{text}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CropOverlay({
  uri, imgW, imgH, onCancel, onDone, videoUri, startMs = 0, endMs = 0,
}: {
  uri: string; imgW: number; imgH: number;
  onCancel: () => void;
  onDone: (r: { originX: number; originY: number; width: number; height: number }) => void;
  videoUri?: string; startMs?: number; endMs?: number;
}) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = false;
    if (videoUri) { p.currentTime = startMs / 1000; p.play(); }
  });
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  playingRef.current = playing;

  useEffect(() => {
    if (!videoUri) return;
    const t = setInterval(() => {
      if (!playingRef.current) return;
      const nowMs = player.currentTime * 1000;
      if (endMs > 0 && (nowMs >= endMs || nowMs < startMs - 500)) {
        player.currentTime = startMs / 1000;
        player.play();
      }
    }, 100);
    return () => clearInterval(t);
  }, [player]);

  const togglePlay = () => {
    if (playing) { player.pause(); setPlaying(false); }
    else { player.play(); setPlaying(true); }
  };
  const areaW = SCREEN_WIDTH;
  const areaH = Dimensions.get('window').height - insets.top - insets.bottom - 90;
  const scale = Math.min(areaW / imgW, areaH / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  const offX = (areaW - dispW) / 2;
  const offY = (areaH - dispH) / 2;

  const [rect, setRect] = useState({ x: 0, y: 0, w: dispW, h: dispH });
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const startRef = useRef(rect);
  const dimRef = useRef({ W: dispW, H: dispH });
  dimRef.current = { W: dispW, H: dispH };
  const MIN = 60;

  const makePan = (mode: 'move' | 'tl' | 'tr' | 'bl' | 'br') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startRef.current = rectRef.current; },
    onPanResponderMove: (_e, g) => {
      const s = startRef.current;
      const { W, H } = dimRef.current;
      let { x, y, w, h } = s;
      if (mode === 'move') {
        x = Math.min(Math.max(0, s.x + g.dx), W - s.w);
        y = Math.min(Math.max(0, s.y + g.dy), H - s.h);
      } else {
        if (mode === 'tl' || mode === 'bl') {
          const nx = Math.min(Math.max(0, s.x + g.dx), s.x + s.w - MIN);
          w = s.w + (s.x - nx);
          x = nx;
        } else {
          w = Math.min(Math.max(MIN, s.w + g.dx), W - s.x);
        }
        if (mode === 'tl' || mode === 'tr') {
          const ny = Math.min(Math.max(0, s.y + g.dy), s.y + s.h - MIN);
          h = s.h + (s.y - ny);
          y = ny;
        } else {
          h = Math.min(Math.max(MIN, s.h + g.dy), H - s.y);
        }
      }
      setRect({ x, y, w, h });
    },
  });
  const pans = useRef({
    move: makePan('move'), tl: makePan('tl'), tr: makePan('tr'), bl: makePan('bl'), br: makePan('br'),
  }).current;

  const save = () => {
    const originX = Math.max(0, Math.round(rect.x / scale));
    const originY = Math.max(0, Math.round(rect.y / scale));
    onDone({
      originX,
      originY,
      width: Math.max(1, Math.min(imgW - originX, Math.round(rect.w / scale))),
      height: Math.max(1, Math.min(imgH - originY, Math.round(rect.h / scale))),
    });
  };

  const dim = 'rgba(0,0,0,0.6)';
  const HS = 28;
  const corner = (key: 'tl' | 'tr' | 'bl' | 'br', left: number, top: number) => (
    <View
      key={key}
      {...pans[key].panHandlers}
      style={{
        position: 'absolute', left: left - HS / 2, top: top - HS / 2, width: HS, height: HS,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: '#f5b301' }} />
    </View>
  );

  return (
    <Modal visible animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
        <View style={{ width: areaW, height: areaH }}>
          <View style={{ position: 'absolute', left: offX, top: offY, width: dispW, height: dispH }}>
            {videoUri ? (
              <VideoView
                player={player}
                style={{ width: dispW, height: dispH }}
                contentFit="fill"
                nativeControls={false}
              />
            ) : (
              <Image source={{ uri }} style={{ width: dispW, height: dispH }} contentFit="fill" />
            )}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: dispW, height: rect.y, backgroundColor: dim }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: rect.y + rect.h, width: dispW, height: dispH - rect.y - rect.h, backgroundColor: dim }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: rect.y, width: rect.x, height: rect.h, backgroundColor: dim }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: rect.x + rect.w, top: rect.y, width: dispW - rect.x - rect.w, height: rect.h, backgroundColor: dim }} />
            <View
              {...pans.move.panHandlers}
              style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderWidth: 2, borderColor: '#f5b301' }}
            />
            {corner('tl', rect.x, rect.y)}
            {corner('tr', rect.x + rect.w, rect.y)}
            {corner('bl', rect.x, rect.y + rect.h)}
            {corner('br', rect.x + rect.w, rect.y + rect.h)}
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 10,
          }}
        >
          <Pressable onPress={onCancel} style={{ paddingVertical: 10, paddingHorizontal: 18 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          {!!videoUri && (
            <Pressable
              onPress={togglePlay}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {playing
                ? <Pause size={20} color="#fff" fill="#fff" />
                : <Play size={20} color="#fff" fill="#fff" />}
            </Pressable>
          )}
          <Pressable
            onPress={save}
            style={{ backgroundColor: '#f5b301', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 }}
          >
            <Text style={{ color: '#000', fontSize: 17, fontWeight: '800' }}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function StoryPreviewVideo({
  uri, startMs, endMs, playhead, control, crop, muted,
}: {
  muted?: boolean;
  crop?: any;
  uri: string; startMs: number; endMs: number; playhead: Animated.Value;
  control: React.MutableRefObject<PlayerControl | null>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => { try { player.muted = !!muted; } catch {} }, [muted, player]);
  const rangeRef = useRef({ startMs, endMs });
  rangeRef.current = { startMs, endMs };

  const [userPaused, setUserPaused] = useState(false);
  const userPausedRef = useRef(false);
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<any>(null);
  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const togglePlay = () => {
    // while the keyboard is up, a tap on the video only dismisses it
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    clearTimeout(hideTimerRef.current);
    if (userPausedRef.current) {
      userPausedRef.current = false;
      setUserPaused(false);
      player.play();
    } else {
      userPausedRef.current = true;
      setUserPaused(true);
      player.pause();
    }
    // show the icon, then fade it out after a couple of seconds either way
    btnOpacity.setValue(1);
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(btnOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 2000);
  };

  useEffect(() => {
    control.current = {
      scrubbing: false,
      seek: (ms: number) => {
        player.currentTime = ms / 1000;
        playhead.setValue(ms);
      },
      pause: () => {
        if (control.current) control.current.scrubbing = true;
        player.pause();
      },
      play: () => {
        if (control.current) control.current.scrubbing = false;
        if (!userPausedRef.current) player.play();
      },
    };
    return () => { control.current = null; };
  }, [player]);

  // jump to the start whenever the left handle moves
  useEffect(() => {
    player.currentTime = startMs / 1000;
  }, [startMs]);

  // loop inside the selected range
  useEffect(() => {
    const t = setInterval(() => {
      if (control.current?.scrubbing || userPausedRef.current) return;
      const { startMs: s, endMs: e } = rangeRef.current;
      const nowMs = player.currentTime * 1000;
      playhead.setValue(nowMs);
      if (e > 0 && (nowMs >= e || nowMs < s - 500)) {
        player.currentTime = s / 1000;
        player.play();
      }
    }, 50);
    return () => clearInterval(t);
  }, [player]);

  return (
    <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
      <CroppedVideoView player={player} crop={crop} />
      <Pressable
        onPress={togglePlay}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            opacity: btnOpacity,
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {userPaused
            ? <Play size={28} color="#fff" fill="#fff" />
            : <Pause size={28} color="#fff" fill="#fff" />}
        </Animated.View>
      </Pressable>
    </View>
  );
}

// Plays the reused sound under the preview, looping inside its trimmed range.
function PreviewSound({ url, start, end }: { url: string; start?: number | null; end?: number | null }) {
  const player = useVideoPlayer({ uri: url, useCaching: true }, (p) => {
    p.loop = !end;
    p.currentTime = (start ?? 0) / 1000;
    p.play();
  });
  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => {
      try {
        if (player.currentTime * 1000 >= end) {
          player.currentTime = (start ?? 0) / 1000;
          player.play();
        }
      } catch {}
    }, 200);
    return () => clearInterval(t);
  }, [player]);
  return null;
}

function GlassActionButton({
  onPress, colors, style, label,
}: { onPress: () => void; colors: any; style?: any; label: string }) {
  const Wrapper: any = GLASS ? GlassView : View;
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={{ flex: 1 }}
    >
      <Wrapper
        {...(GLASS ? { glassEffectStyle: 'regular', isInteractive: true } : {})}
        style={{
          paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
          ...(GLASS ? {} : { backgroundColor: colors.brand }),
          ...style,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '800', color: GLASS ? colors.brand : colors.textOnGold }}>
          {label}
        </Text>
      </Wrapper>
    </Pressable>
  );
}

function SkeletonRow({ colors, pulse = false }: { colors: any; pulse?: boolean }) {
  const opacity = useRef(new Animated.Value(pulse ? 0.4 : 0.5)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        opacity,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.card, borderRadius: 14,
        borderWidth: 1, borderColor: colors.border,
        padding: 8, gap: 12,
      }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.chipBg }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '45%', height: 10, borderRadius: 5, backgroundColor: colors.chipBg }} />
        <View style={{ width: '25%', height: 10, borderRadius: 5, backgroundColor: colors.chipBg }} />
      </View>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.chipBg }} />
    </Animated.View>
  );
}

const TRIM_MIN_MS = 1000;
const THUMB_COUNT = 8;
const HANDLE_W = 16;

function fmt(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function TrimBar({
  uri, playhead, control, durationMs, start, end, onChange,
}: {
  uri: string; playhead: Animated.Value; control: React.MutableRefObject<PlayerControl | null>;
  durationMs: number; start: number; end: number;
  onChange: (s: number, e: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [nowSec, setNowSec] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setThumbs([]);
    (async () => {
      const out: string[] = [];
      for (let i = 0; i < THUMB_COUNT; i++) {
        const time = Math.floor(((i + 0.5) / THUMB_COUNT) * durationMs);
        try {
          const { uri: t } = await VideoThumbnails.getThumbnailAsync(uri, { time, quality: 0.3 });
          out.push(t);
        } catch {
          out.push('');
        }
        if (cancelled) return;
        setThumbs([...out]);
      }
    })();
    return () => { cancelled = true; };
  }, [uri, durationMs]);
  const widthRef = useRef(0);
  const startRef = useRef(start);
  const endRef = useRef(end);
  const durRef = useRef(durationMs);
  const onChangeRef = useRef(onChange);
  const dragRef = useRef({ s: 0, e: 0 });
  startRef.current = start;
  endRef.current = end;
  durRef.current = durationMs;
  onChangeRef.current = onChange;

  const msFromDx = (dx: number) => (dx / Math.max(1, widthRef.current)) * durRef.current;

  const playheadMsRef = useRef(0);
  useEffect(() => {
    const id = playhead.addListener(({ value }) => {
      playheadMsRef.current = value;
      const sec = Math.floor(Math.max(0, value - startRef.current) / 1000);
      setNowSec((p) => (p === sec ? p : sec));
    });
    return () => playhead.removeListener(id);
  }, [playhead]);

  const scrubPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragRef.current = { s: playheadMsRef.current, e: 0 };
      control.current?.pause();
    },
    onPanResponderMove: (_e, g) => {
      const ms = Math.min(endRef.current, Math.max(startRef.current, dragRef.current.s + msFromDx(g.dx)));
      control.current?.seek(Math.round(ms));
    },
    onPanResponderRelease: () => { control.current?.play(); },
    onPanResponderTerminate: () => { control.current?.play(); },
  })).current;

  const startPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragRef.current = { s: startRef.current, e: endRef.current }; },
    onPanResponderMove: (_e, g) => {
      const e = endRef.current;
      let s = dragRef.current.s + msFromDx(g.dx);
      s = Math.max(0, Math.min(s, e - TRIM_MIN_MS));
      s = Math.max(s, e - MAX_VIDEO_MS);
      onChangeRef.current(Math.round(s), e);
    },
  })).current;

  const endPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragRef.current = { s: startRef.current, e: endRef.current };
      control.current?.pause();
    },
    onPanResponderMove: (_e, g) => {
      const s = startRef.current;
      let e = dragRef.current.e + msFromDx(g.dx);
      e = Math.min(durRef.current, Math.max(e, s + TRIM_MIN_MS));
      e = Math.min(e, s + MAX_VIDEO_MS);
      onChangeRef.current(s, Math.round(e));
      control.current?.seek(Math.round(e));
    },
    onPanResponderRelease: () => {
      control.current?.seek(startRef.current);
      control.current?.play();
    },
    onPanResponderTerminate: () => {
      control.current?.seek(startRef.current);
      control.current?.play();
    },
  })).current;
  const left = (start / durationMs) * width;
  const right = (end / durationMs) * width;

  return (
    <View style={{ paddingHorizontal: 16 + HANDLE_W / 2 }}>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
        {fmt(nowSec * 1000)} / {fmt(end - start)}
      </Text>
      <View
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; setWidth(e.nativeEvent.layout.width); }}
        style={{ height: 36, justifyContent: 'center' }}
      >
        <View style={{ height: 36, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)' }}>
          {Array.from({ length: THUMB_COUNT }).map((_, i) => (
            <View key={i} style={{ flex: 1, height: '100%' }}>
              {!!thumbs[i] && (
                <Image source={{ uri: thumbs[i] }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              )}
            </View>
          ))}
        </View>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, width: left, height: 36, backgroundColor: 'rgba(0,0,0,0.6)', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}
        />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: right, right: 0, height: 36, backgroundColor: 'rgba(0,0,0,0.6)', borderTopRightRadius: 6, borderBottomRightRadius: 6 }}
        />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left, width: Math.max(0, right - left), height: 36, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#f5b301' }}
        />
        <Animated.View
          {...scrubPan.panHandlers}
          style={{
            position: 'absolute', top: -4, left: 0, width: 28, height: 44,
            alignItems: 'center',
            transform: [{
              translateX: playhead.interpolate({
                inputRange: [0, durationMs],
                outputRange: [-14, width - 14],
                extrapolate: 'clamp',
              }),
            }],
          }}
        >
          <View style={{ width: 3, height: 44, borderRadius: 2, backgroundColor: '#fff' }} />
        </Animated.View>
        <View
          {...startPan.panHandlers}
          style={{
            position: 'absolute', top: 0, left: left - HANDLE_W / 2, width: HANDLE_W, height: 36,
            borderRadius: 4, backgroundColor: '#f5b301',
            alignItems: 'center', justifyContent: 'center',
          }}
          hitSlop={{ left: 10, right: 10, top: 10, bottom: 10 }}
        >
          <ChevronLeft size={14} color="#000" strokeWidth={3} />
        </View>
        <View
          {...endPan.panHandlers}
          style={{
            position: 'absolute', top: 0, left: right - HANDLE_W / 2, width: HANDLE_W, height: 36,
            borderRadius: 4, backgroundColor: '#f5b301',
            alignItems: 'center', justifyContent: 'center',
          }}
          hitSlop={{ left: 10, right: 10, top: 10, bottom: 10 }}
        >
          <ChevronRight size={14} color="#000" strokeWidth={3} />
        </View>
      </View>
    </View>
  );
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

// ─── PRODUCT TAG CARD (editor) ───────────────────────────────────────
// Small card the seller drags with one finger and rotates with the handle at
// its top-right corner. x / y are the card centre as 0..1 of the preview.
const TAG_W = 150;
const TAG_H = 56;

function ProductTagCard({
  tag, previewW, previewH, onChange, onRemove,
}: {
  tag: ProductTagT; previewW: number; previewH: number;
  onChange: (patch: Partial<ProductTagT>) => void;
  onRemove: () => void;
}) {
  const tagRef = useRef(tag);
  const dimRef = useRef({ w: previewW, h: previewH });
  const onChangeRef = useRef(onChange);
  const startRef = useRef({ x: 0, y: 0, rot: 0 });
  tagRef.current = tag;
  dimRef.current = { w: previewW, h: previewH };
  onChangeRef.current = onChange;

  const clamp = (v: number) => Math.min(0.95, Math.max(0.05, v));

  const movePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startRef.current = { x: tagRef.current.x, y: tagRef.current.y, rot: tagRef.current.rot };
    },
    onPanResponderMove: (_e, g) => {
      const { w, h } = dimRef.current;
      onChangeRef.current({
        x: clamp(startRef.current.x + g.dx / w),
        y: clamp(startRef.current.y + g.dy / h),
      });
    },
  })).current;

  // handle sits at (+W/2, -H/2) from the centre; make it follow the finger around the centre
  const rotatePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startRef.current.rot = tagRef.current.rot; },
    onPanResponderMove: (_e, g) => {
      const hx = TAG_W / 2;
      const hy = -TAG_H / 2;
      const r0 = (startRef.current.rot * Math.PI) / 180;
      const v0x = hx * Math.cos(r0) - hy * Math.sin(r0);
      const v0y = hx * Math.sin(r0) + hy * Math.cos(r0);
      const ang = Math.atan2(v0y + g.dy, v0x + g.dx) - Math.atan2(hy, hx);
      onChangeRef.current({ rot: (ang * 180) / Math.PI });
    },
  })).current;

  return (
    <View
      {...movePan.panHandlers}
      style={{
        position: 'absolute',
        left: tag.x * previewW - TAG_W / 2,
        top: tag.y * previewH - TAG_H / 2,
        width: TAG_W, height: TAG_H,
        transform: [{ rotate: `${tag.rot}deg` }],
      }}
    >
      <View
        pointerEvents="none"
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: '#fff', borderRadius: 12, padding: 6,
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          elevation: 6,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e5e7eb' }}>
          {!!tag.image && (
            <Image source={{ uri: tag.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>{tag.title}</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#b45309', marginTop: 2 }}>
            GHS {tag.price.toFixed(2)}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={{
          position: 'absolute', left: -12, top: -12, width: 24, height: 24, borderRadius: 12,
          backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={14} color="#fff" strokeWidth={3} />
      </Pressable>

      <View
        {...rotatePan.panHandlers}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          position: 'absolute', right: -13, top: -13, width: 26, height: 26, borderRadius: 13,
          backgroundColor: '#f5b301', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <RotateCw size={14} color="#000" strokeWidth={2.6} />
      </View>
    </View>
  );
}

// ─── STORE PICKER (the real store page in pick mode) ─────────────────
function StorePicker({
  visible, sellerId, onClose, onDone,
}: {
  visible: boolean; sellerId?: string | number;
  onClose: () => void; onDone: (product: any) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<any | null>(null);

  useEffect(() => { if (visible) setChosen(null); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0f172a', paddingTop: insets.top }}>
        {!!sellerId && (
          <StorePage
            id={String(sellerId)}
            embedded
            pickMode
            selectedId={chosen ? String(chosen.id) : null}
            onSelect={setChosen}
          />
        )}

        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={{
            position: 'absolute', top: insets.top + 10, right: 16, zIndex: 20,
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={20} color="#fff" />
        </Pressable>

        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12,
            backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 8 }}>
            {chosen ? chosen.title : 'Tap one product to tag'}
          </Text>
          <Pressable
            onPress={() => chosen && onDone(chosen)}
            disabled={!chosen}
            style={{
              backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14,
              alignItems: 'center', opacity: chosen ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textOnGold }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
function CroppedVideoView({ player, crop }: { player: any; crop?: any }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (!crop || !crop.fa || crop.w <= 0 || crop.h <= 0) {
    return (
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls={false}
      />
    );
  }
  const fa = crop.fa;
  const s = box.w > 0 ? Math.min(box.w / (crop.w * fa), box.h / crop.h) : 0;
  const FW = fa * s;
  const FH = s;
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