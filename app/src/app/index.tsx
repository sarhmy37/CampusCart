import { useRef, useState } from 'react';
import { View, ScrollView, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import Hero from '@/components/Hero';
import ValueStrip from '@/components/ValueStrip';
import PullLine from '@/components/PullLine';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import HomeFooter from '@/components/HomeFooter';
import ExclusiveOffers from '@/components/ExclusiveOffers';
import HomePlans from '@/components/HomePlans';
import TopSellers from '@/components/TopSellers';
import { LinearGradient } from 'expo-linear-gradient';
import { triggerLogoBounce } from '@/utils/logoBounce';

function InsetShadow({ direction, red = false }: { direction: 'down' | 'up'; red?: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Gold by default, or red (lighter red in dark mode, deeper red in light mode)
  const rgb = '245,158,11';
  const dark = isDark ? `rgba(${rgb},0.22)` : `rgba(${rgb},0.14)`;
  const mid = `rgba(${rgb},0.06)`;
  const clear = `rgba(${rgb},0)`;
  const edge = `rgba(${rgb},0.25)`;

  return (
    <View pointerEvents="none">
      {direction === 'down' && <View style={{ height: 1, backgroundColor: edge }} />}
      <LinearGradient
        colors={direction === 'down' ? [dark, mid, clear] : [clear, mid, dark]}
        style={{ height: 16, width: '100%' }}
      />
      {direction === 'up' && <View style={{ height: 1, backgroundColor: edge }} />}
    </View>
  );
}

function SectionDivider() {
  const colors = useColors();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gold = isDark ? '245,158,11' : '217,119,6';
  const Diamond = ({ size, opacity }: { size: number; opacity: number }) => (
    <View
      style={{
        width: size, height: size, marginHorizontal: 5, opacity,
        backgroundColor: colors.brand, transform: [{ rotate: '45deg' }],
      }}
    />
  );
  return (
    <View style={{ height: 64, justifyContent: 'center' }}>
      <LinearGradient
        colors={[`rgba(${gold},0)`, `rgba(${gold},${isDark ? 0.05 : 0.04})`, `rgba(${gold},0)`]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 }}>
        <LinearGradient
          colors={[`rgba(${gold},0)`, `rgba(${gold},0.7)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, height: 2, borderRadius: 1 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 }}>
          <Diamond size={5} opacity={0.5} />
          <Diamond size={10} opacity={1} />
          <Diamond size={5} opacity={0.5} />
        </View>
        <LinearGradient
          colors={[`rgba(${gold},0.7)`, `rgba(${gold},0)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, height: 2, borderRadius: 1 }}
        />
      </View>
    </View>
  );
}

const PULL_THRESHOLD = 70; // how far the line must "fill" before release refreshes
const PULL_FACTOR = 0.8;   // finger distance -> pull distance (lower = need to drag further)

export default function HomeScreen() {
  const colors = useColors();
  const [scrolled, setScrolled] = useState(false);
  const [hasOffers, setHasOffers] = useState(false);
  const [hasSellers, setHasSellers] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrolledRef = useRef(false);

  // ── Pull-to-refresh WITHOUT any bounce ──
  // The scroll view never overscrolls. Instead we measure the finger drag
  // while the page is at the very top and feed it to the PullLine.
  const pullY = useRef(new Animated.Value(0)).current; // 0 -> -PULL_THRESHOLD, same shape PullLine expects
  const scrollYRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const armedRef = useRef(false);
  const refreshingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const t0 = Date.now();
    setRefreshKey((k) => k + 1);
    triggerLogoBounce();
    await new Promise((r) => setTimeout(r, 800));
    setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    }, Math.max(0, 1000 - (Date.now() - t0)));
  };

  const resetPull = () => {
    Animated.timing(pullY, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const onTouchStart = (e: any) => {
    touchStartRef.current =
      scrollYRef.current <= 0 && !refreshingRef.current
        ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
        : null;
    armedRef.current = false;
  };

  const onTouchMove = (e: any) => {
    const start = touchStartRef.current;
    if (!start) return;
    const dx = e.nativeEvent.pageX - start.x;
    const dy = e.nativeEvent.pageY - start.y;
    // mostly-horizontal drag (carousels) → not a pull
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      touchStartRef.current = null;
      armedRef.current = false;
      pullY.setValue(0);
      return;
    }
    if (dy <= 0) {
      pullY.setValue(0);
      armedRef.current = false;
      return;
    }
    const pull = Math.min(PULL_THRESHOLD, dy * PULL_FACTOR);
    pullY.setValue(-pull);
    const reached = dy * PULL_FACTOR >= PULL_THRESHOLD;
    if (reached && !armedRef.current) {
      armedRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else if (!reached && armedRef.current) {
      armedRef.current = false;
    }
  };

  const onTouchEnd = () => {
    if (!touchStartRef.current) return;
    const shouldRefresh = armedRef.current;
    touchStartRef.current = null;
    armedRef.current = false;
    resetPull();
    if (shouldRefresh) doRefresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollYRef.current = y;
          if (!scrolledRef.current && y > 24) {
            scrolledRef.current = true;
            setScrolled(true);
          }
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* Pull line sits at the very top of the content */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <PullLine scrollY={pullY} refreshing={refreshing} colors={colors} />
        </View>

        <View key={refreshKey} style={{ flexGrow: 1 }}>
          {/* ── Above-the-fold: hero + balance fill remaining viewport ── */}
          <View style={{ flexGrow: 1, minHeight: 0 }}>
            <Hero fillViewport />
            <ValueStrip />
          </View>

          {/* ── Below the fold: scrolls normally ── */}
          {hasOffers && <InsetShadow direction="down" />}
          <View style={{ paddingBottom: hasOffers ? 6 : 0 }}>
            <ExclusiveOffers active={scrolled} onHasOffers={setHasOffers} />
          </View>
          {hasOffers && <InsetShadow direction="up" />}
          {hasOffers && <View style={{ height: 1, backgroundColor: colors.border }} />}
          {hasOffers && (hasSellers ? <SectionDivider /> : <View style={{ height: 28 }} />)}
          {hasSellers && <InsetShadow direction="down" red />}
          <View style={{ paddingBottom: hasSellers ? 6 : 0 }}>
            <TopSellers onHasSellers={setHasSellers} />
          </View>
          {hasSellers && <InsetShadow direction="up" red />}
          {hasSellers && <View style={{ height: 1, backgroundColor: colors.border }} />}
          <HomePlans />
          <HomeFooter />
        </View>
      </ScrollView>
    </View>
  );
}