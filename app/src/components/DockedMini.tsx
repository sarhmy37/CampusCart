import { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Play, Pause, X } from 'lucide-react-native';

export const MINI_W = 104;
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function createProgressStore() {
  let t = 0;
  let d = 0;
  const subs = new Set<() => void>();
  return {
    get: () => ({ t, d }),
    set: (nt: number, nd: number) => {
      t = nt;
      d = nd;
      subs.forEach((f) => f());
    },
    sub: (f: () => void) => {
      subs.add(f);
      return () => { subs.delete(f); };
    },
  };
}
export type ProgressStore = ReturnType<typeof createProgressStore>;

export function useProgress(store: ProgressStore) {
  const [, force] = useState(0);
  useEffect(() => store.sub(() => force((n) => n + 1)), [store]);
  return store.get();
}

export default function DockedMini({
  video, store, onExpand, onClose, onToggle, playing, colors, isDark, bottom, slotH, thumbnail,
}: {
  video: { title: string; channel: string };
  store: ProgressStore; onExpand: () => void; onClose: () => void; onToggle: () => void;
  playing: boolean; colors: any; isDark: boolean; bottom: number; slotH: number;
  thumbnail?: string;
}) {
  const { t, d } = useProgress(store);
  return (
    <View
      style={{
        position: 'absolute', left: 8, right: 8, bottom, height: slotH + 16, zIndex: 9,
        borderRadius: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8,
      }}
    >
      {GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />
      ) : (
        <BlurView
          intensity={60}
          tint={isDark ? 'dark' : 'light'}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: isDark ? 'rgba(20,18,15,0.55)' : 'rgba(255,255,255,0.6)',
            borderWidth: 1, borderColor: colors.border, borderRadius: 16,
          }}
          pointerEvents="none"
        />
      )}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 12 }}>
        <View style={{ width: MINI_W, height: slotH, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' }}>
          {!!thumbnail && <Image source={{ uri: thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
        </View>
        <Pressable onPress={onExpand} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={3} style={{ fontSize: 13, fontWeight: '800', color: colors.text, lineHeight: 17 }}>{video.title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.brand, marginTop: 4 }}>{video.channel}</Text>
        </Pressable>
        <Pressable onPress={onToggle} hitSlop={8} style={{ display: 'none' }}>
          {GLASS ? (
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              tintColor={colors.brand}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              {playing
                ? <Pause size={14} color={colors.textOnGold} fill={colors.textOnGold} />
                : <Play size={14} color={colors.textOnGold} fill={colors.textOnGold} style={{ marginLeft: 2 }} />}
            </GlassView>
          ) : (
            <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <BlurView
                intensity={40}
                tint={isDark ? 'dark' : 'light'}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft }}
              >
                {playing
                  ? <Pause size={14} color={colors.brand} fill={colors.brand} />
                  : <Play size={14} color={colors.brand} fill={colors.brand} style={{ marginLeft: 2 }} />}
              </BlurView>
            </View>
          )}
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8}>
          {GLASS ? (
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              <X size={16} color={colors.text} />
            </GlassView>
          ) : (
            <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color={colors.text} />
              </BlurView>
            </View>
          )}
        </Pressable>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: colors.border }}>
        <View style={{ height: 2.5, width: `${d ? Math.min(100, (t / d) * 100) : 0}%`, backgroundColor: colors.brand }} />
      </View>
    </View>
  );
}