import { useState, useRef, useEffect } from 'react';
import { View, Text, PanResponder } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

const ITEM_W = 60;

export default function AuthRollBall({ startIndex = 0 }: { startIndex?: number }) {
  const colors = useColors();
  const router = useRouter();
  const [index, setIndex] = useState(startIndex);
  const [dragPixels, setDragPixels] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hintOffset, setHintOffset] = useState(0);
  const movedRef = useRef(false);
  const indexRef = useRef(startIndex);
  indexRef.current = index;
  const pathname = usePathname();

  useEffect(() => setIndex(startIndex), [startIndex]);

  useEffect(() => {
    if (pathname === '/register') setIndex(1);
    else if (pathname === '/login') setIndex(0);
  }, [pathname]);

  // Nudge hint animation until user touches it
  useEffect(() => {
    if (hasInteracted) return;
    const seq = [8, -8, 4, 0];
    let i = 0;
    const timer = setInterval(() => {
      setHintOffset(seq[i]);
      i++;
      if (i >= seq.length) clearInterval(timer);
    }, 260);
    return () => clearInterval(timer);
  }, [hasInteracted]);

  const label = (i: number) => (((i % 2) + 2) % 2 === 0 ? 'Sign up' : 'Log in');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setHasInteracted(true);
        movedRef.current = false;
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 4) movedRef.current = true;
        setDragPixels(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (movedRef.current) {
          const rawIndex = indexRef.current - gesture.dx / ITEM_W;
          setIndex(Math.round(rawIndex));
        } else {
          router.push(label(indexRef.current) === 'Log in' ? '/login' : '/register');
        }
        setDragPixels(0);
      },
    })
  ).current;

  const visible = Array.from({ length: 21 }, (_, k) => index - 10 + k);
  const translateX = -10 * ITEM_W + dragPixels + (hasInteracted ? 0 : hintOffset);

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        width: ITEM_W,
        height: 31,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.cardAlt,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', height: '100%', transform: [{ translateX }] }}>
        {visible.map((i) => (
          <View key={i} style={{ width: ITEM_W, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {label(i) === 'Sign up' ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.brand }}>
                <Text style={{ color: colors.textOnGold, fontSize: 12, fontWeight: '600' }}>Sign up</Text>
              </View>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Log in</Text>
            )}
          </View>
        ))}
      </View>

      {/* Left gradient + chevron */}
      <LinearGradient
        colors={[colors.cardAlt, 'rgba(248,250,252,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 16,
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <ChevronLeft size={14} color={colors.textFaint} />
      </LinearGradient>

      {/* Right gradient + chevron */}
      <LinearGradient
        colors={['rgba(248,250,252,0)', colors.cardAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 16,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <ChevronRight size={14} color={colors.textFaint} />
      </LinearGradient>
    </View>
  );
}