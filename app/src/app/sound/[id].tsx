import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Dimensions, Modal } from 'react-native';
import StoryViewer from '@/components/StoryViewer';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { STORY_MUSIC } from '@/data/storyMusic';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Play, Pause, Eye, Music } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_W = (SCREEN_WIDTH - 4) / 3;

const fmt = (ms: number) => {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

function Tile({ uri, views, original, isImage, onPress }: { uri: string; views: number; original: boolean; isImage?: boolean; onPress: () => void }) {
  const player = useVideoPlayer(isImage ? null : { uri, useCaching: true }, (p) => { p.muted = true; p.loop = false; });
  return (
    <Pressable onPress={onPress} style={{ width: TILE_W, aspectRatio: 0.62, backgroundColor: '#222' }}>
      {isImage
        ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        : <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />}
      {original && (
        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Original</Text>
        </View>
      )}
      <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Eye size={14} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{count(views)}</Text>
      </View>
    </Pressable>
  );
}

export default function SoundScreen() {
  const { id, url } = useLocalSearchParams<{ id: string; url?: string }>();
  const isMusic = id === 'music';
  const track = isMusic ? STORY_MUSIC.find((t) => t.uri === url) : undefined;
  const musicPlayer = useAudioPlayer(track?.uri ?? null);
  const musicStatus = useAudioPlayerStatus(musicPlayer);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const o = data?.original;
  const { user } = useAuth();
  const { openChat, sendQuickMessage } = useChat();
  const [groups, setGroups] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const durRef = useRef<Record<string, number>>({});

  useEffect(() => { if (data?.groups) setGroups(data.groups); }, [data]);

  const openAt = (i: number) => { setMediaReady(false); setActiveIdx(i); };
  const goTo = (i: number) => { if (i >= 0 && i < groups.length) { setMediaReady(false); setActiveIdx(i); } };
  const patchStory = (sid: string, patch: any) =>
    setGroups((prev) => prev.map((g) => ({
      ...g, stories: g.stories.map((s: any) => (s.id === sid ? { ...s, ...patch } : s)),
    })));
  const removeStory = (sid: string) => {
    setActiveIdx(null);
    setGroups((prev) => prev.filter((g) => g.stories[0].id !== sid));
  };
  const removeUser = (uid: string) => {
    setActiveIdx(null);
    setGroups((prev) => prev.filter((g) => String(g.user_id) !== String(uid)));
  };
  const activeGroup = activeIdx !== null ? groups[activeIdx] : null;
  const activeStory = activeGroup?.stories[0];

  useEffect(() => {
    const req = isMusic
      ? api.get('/stories/music', { params: { url } })
      : api.get(`/stories/sound/${id}`);
    req.then((r) => setData(r.data)).catch(() => setFailed(true));
  }, [id, url]);

  const player = useVideoPlayer(o ? { uri: o.media_url, useCaching: true } : null, (p) => { p.loop = false; });
  const oRef = useRef<any>(null);
  oRef.current = o;

  useEffect(() => {
    const t = setInterval(() => {
      const x = oRef.current;
      if (!x || !x.trim_end_ms) return;
      if (player.currentTime * 1000 >= x.trim_end_ms) { player.pause(); setPlaying(false); }
    }, 200);
    return () => clearInterval(t);
  }, [player]);

  const shownPlaying = isMusic ? musicStatus.playing : playing;
  const toggle = () => {
    if (isMusic) {
      if (musicStatus.playing) musicPlayer.pause();
      else { musicPlayer.seekTo(0); musicPlayer.play(); }
      return;
    }
    if (playing) { player.pause(); setPlaying(false); return; }
    player.currentTime = (o?.trim_start_ms ?? 0) / 1000;
    player.play();
    setPlaying(true);
  };

  const useAudio = () => {
    player.pause();
    router.push({ pathname: '/stories/new', params: { soundId: String(o.id), soundOwner: o.owner_name } } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 14 }}>
        <ChevronLeft size={28} color={colors.text} />
      </Pressable>

      {failed ? (
        <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>This sound is no longer available</Text>
      ) : !o ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, alignItems: 'center' }}>
            <Pressable onPress={toggle} style={{ width: 112, height: 112, borderRadius: 18, overflow: 'hidden', backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
              {isMusic
                ? (track?.avatar
                    ? <Image source={{ uri: track.avatar }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
                    : <Music size={40} color="#fff" />)
                : <VideoView player={player} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />}
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                {shownPlaying ? <Pause size={22} color="#fff" fill="#fff" /> : <Play size={22} color="#fff" fill="#fff" />}
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{isMusic ? (track?.title ?? 'Music') : 'Original audio'}</Text>
              {(!isMusic || !!track?.artist) && (
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.textMuted, marginTop: 4 }}>{isMusic ? track?.artist : o.owner_name}</Text>
              )}
            </View>
          </View>

          <Text style={{ paddingHorizontal: 16, marginTop: 14, fontSize: 15, color: colors.textMuted }}>
            {o.duration_ms ? `${fmt(o.duration_ms)} · ` : ''}{data.posts.length} {data.posts.length === 1 ? 'reel' : 'reels'}
          </Text>

          <Pressable onPress={useAudio} style={{ display: isMusic ? 'none' : 'flex', marginHorizontal: 16, marginTop: 14, marginBottom: 16, backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textOnGold }}>Use audio</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingBottom: insets.bottom + 20 }}>
            {data.posts.map((p: any, i: number) => (
              <Tile
                key={p.id}
                uri={p.media_url}
                views={p.view_count}
                original={p.is_original}
                isImage={p.media_type === 'image'}
                onPress={() => openAt(i)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <Modal visible={!!activeStory} transparent animationType="fade" onRequestClose={() => setActiveIdx(null)}>
        {!!activeGroup && !!activeStory && (
          <StoryViewer
            group={activeGroup}
            story={activeStory}
            durationMs={durRef.current[activeStory.id] ?? 6000}
            mediaReady={mediaReady}
            replayKey={replayKey}
            reelStyle="vertical"
            feedTab="foryou"
            onFeedTabChange={() => false}
            isOwnStory={String(activeGroup.user_id) === String(user?.id)}
            onMediaReady={(ms?: number) => {
              if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) durRef.current[activeStory.id] = Math.min(ms, 60000);
              setMediaReady(true);
            }}
            onClose={() => setActiveIdx(null)}
            onBack={() => {}}
            onNext={() => { setMediaReady(false); setReplayKey((k) => k + 1); }}
            onSwipeNextGroup={() => goTo((activeIdx ?? 0) + 1)}
            onSwipePrevGroup={() => goTo((activeIdx ?? 0) - 1)}
            prevGroup={activeIdx !== null ? groups[activeIdx - 1] : undefined}
            nextGroup={activeIdx !== null ? groups[activeIdx + 1] : undefined}
            onPatch={patchStory}
            onRemoveStory={removeStory}
            onArchive={removeStory}
            onRemoveUser={removeUser}
            onRepost={() => {}}
            onFollow={() => {}}
            onQuickReact={(emoji: string) => sendQuickMessage(activeGroup.user_id, emoji, activeStory.id)}
            onReply={(text: string) => {
              setActiveIdx(null);
              openChat({
                sellerId: activeGroup.user_id, sellerName: activeGroup.user_name, draftMessage: text,
                storyId: activeStory.id, storyMediaUrl: activeStory.media_url,
                storyMediaType: activeStory.media_type, storyCaption: activeStory.caption,
              });
            }}
          />
        )}
      </Modal>
    </View>
  );
}