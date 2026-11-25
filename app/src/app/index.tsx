import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import Hero from '@/components/Hero';
import ValueStrip from '@/components/ValueStrip';
import PullLine from '@/components/PullLine';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import HomeFooter from '@/components/HomeFooter';
import ExclusiveOffers from '@/components/ExclusiveOffers';
import HomePlans from '@/components/HomePlans';
import TopSellers from '@/components/TopSellers';
import HomeDiscovery from '@/components/HomeDiscovery';
import ActiveOrders from '@/components/ActiveOrders';
import RecentlyViewed from '@/components/RecentlyViewed';
import SponsoredProducts from '@/components/SponsoredProducts';
import { LinearGradient } from 'expo-linear-gradient';
import { triggerLogoBounce } from '@/utils/logoBounce';
import { emitter } from '@/api/client';
import { SCREEN_PADDING_X } from '@/constants/theme';

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

function Section({
  show, divider, colors, children,
}: { show: boolean; divider: boolean; colors: any; children: React.ReactNode }) {
  return (
    <>
      {show && divider && <SectionDivider />}
      {show && <InsetShadow direction="down" />}
      <View style={{ paddingBottom: show ? 6 : 0 }}>{children}</View>
      {show && <InsetShadow direction="up" />}
      {show && <View style={{ height: 1, backgroundColor: colors.border }} />}
    </>
  );
}

function HomeSkeleton({ colors }: { colors: any }) {
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

  return (
    <View style={{ flexGrow: 1, backgroundColor: colors.background }}>
      {/* hero */}
      <View style={{ backgroundColor: colors.card, paddingHorizontal: SCREEN_PADDING_X, paddingTop: 24, paddingBottom: 16 }}>
        <Block style={{ width: '75%', height: 28, borderRadius: 8 }} />
        <Block style={{ width: '55%', height: 28, borderRadius: 8, marginTop: 10 }} />
        <Block style={{ width: '90%', height: 14, borderRadius: 7, marginTop: 16 }} />
        <Block style={{ width: 140, height: 44, borderRadius: 22, marginTop: 20 }} />
      </View>

      {/* categories + card */}
      <View style={{ backgroundColor: colors.card, paddingHorizontal: SCREEN_PADDING_X, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 16, overflow: 'hidden', marginTop: 4 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ alignItems: 'center', width: 60 }}>
              <Block style={{ width: 60, height: 60, borderRadius: 30 }} />
              <Block style={{ width: 44, height: 10, borderRadius: 5, marginTop: 8 }} />
            </View>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: colors.border, marginTop: 10, marginBottom: 12 }} />
        <Block style={{ width: '100%', height: 170, borderRadius: 20 }} />
      </View>

      {/* a section */}
      <View style={{ paddingHorizontal: SCREEN_PADDING_X, paddingTop: 28 }}>
        <Block style={{ width: 140, height: 14, borderRadius: 7, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 12, overflow: 'hidden' }}>
          {[0, 1, 2].map((i) => (
            <Block key={i} style={{ width: 150, height: 190, borderRadius: 16 }} />
          ))}
        </View>
      </View>
    </View>
  );
}

const PULL_THRESHOLD = 70; // how far the line must "fill" before release refreshes
const PULL_FACTOR = 0.8;   // finger distance -> pull distance (lower = need to drag further)

export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();

  // People on an active Pro/Premium plan manage everything from the Benefits screen,
  // so the pricing section is hidden for them. An expired plan counts as free.
  const hidePlans = !!(
    user?.plan &&
    String(user.plan).toLowerCase() !== 'free' &&
    user?.plan_expires_at &&
    new Date(user.plan_expires_at) > new Date()
  );

  const [scrolled, setScrolled] = useState(false);
  const [hasOffers, setHasOffers] = useState(false);
  const [hasSellers, setHasSellers] = useState(false);
  const [hasSponsored, setHasSponsored] = useState(false);
  const [hasDiscovery, setHasDiscovery] = useState(false);
  const [hasRecent, setHasRecent] = useState(false);
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

  const [tourOpen, setTourOpen] = useState(false);
  const resumeTimerRef = useRef<any>(null);
  useEffect(() => {
    const onOpen = () => {
      clearTimeout(resumeTimerRef.current);
      setTourOpen(true);
    };
    const onClosed = () => {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        setTourOpen(false);
        doRefresh();
      }, 1500);
    };
    emitter.on('trex-tour-open', onOpen);
    emitter.on('trex-tour-closed', onClosed);
    return () => {
      emitter.off('trex-tour-open', onOpen);
      emitter.off('trex-tour-closed', onClosed);
      clearTimeout(resumeTimerRef.current);
    };
  }, []);

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

        {tourOpen ? <HomeSkeleton colors={colors} /> : (
        <View key={refreshKey} style={{ flexGrow: 1 }}>
          {/* ── Above-the-fold: hero + balance fill remaining viewport ── */}
          <View style={{ flexGrow: 1, minHeight: 0 }}>
            <Hero fillViewport />
            <ValueStrip />
          </View>

          {/* ── Below the fold: scrolls normally ── */}
          <ActiveOrders />

          <Section show={hasOffers} divider={false} colors={colors}>
            <ExclusiveOffers active={scrolled} onHasOffers={setHasOffers} />
          </Section>

          <Section show={hasSponsored} divider={hasOffers} colors={colors}>
            <SponsoredProducts onHasProducts={setHasSponsored} />
          </Section>

          <Section show={hasDiscovery} divider={hasOffers || hasSponsored} colors={colors}>
            <HomeDiscovery onHasItems={setHasDiscovery} />
          </Section>

          <Section show={hasRecent} divider={hasOffers || hasSponsored || hasDiscovery} colors={colors}>
            <RecentlyViewed onHasItems={setHasRecent} />
          </Section>

          <Section show={hasSellers} divider={hasOffers || hasSponsored || hasDiscovery || hasRecent} colors={colors}>
            <TopSellers onHasSellers={setHasSellers} />
          </Section>

          {user && !hidePlans && <HomePlans />}
          <HomeFooter />
        </View>
        )}
      </ScrollView>
    </View>
  );
}