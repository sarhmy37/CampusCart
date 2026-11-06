import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

type RefreshFn = (() => Promise<any> | void) | null;

type Ctx = {
  scrollY: Animated.Value;
  refreshing: boolean;
  armed: boolean;
  pullProps: any;
  registerRefresh: (fn: RefreshFn) => void;
};

const PullRefreshContext = createContext<Ctx | null>(null);

export function PullRefreshProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const armedRef = useRef(false);
  const refreshingRef = useRef(false);
  const refreshFn = useRef<RefreshFn>(null);
  const [armed, setArmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const startRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const t0 = Date.now();
    try { await refreshFn.current?.(); } catch {}
    setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    }, Math.max(0, 1000 - (Date.now() - t0)));
  };

  const pullProps = useRef({
    scrollEventThrottle: 16,
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener: (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        if (y < -70 && !armedRef.current) {
          armedRef.current = true;
          setArmed(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else if (y > -70 && armedRef.current) {
          armedRef.current = false;
          setArmed(false);
        }
      },
    }),
    onScrollEndDrag: (e: any) => {
      if (e.nativeEvent.contentOffset.y < -70) startRefresh();
    },
  }).current;

  const registerRefresh = useCallback((fn: RefreshFn) => { refreshFn.current = fn; }, []);

  return (
    <PullRefreshContext.Provider value={{ scrollY, refreshing, armed, pullProps, registerRefresh }}>
      {children}
    </PullRefreshContext.Provider>
  );
}

export function usePullRefreshState() {
  return useContext(PullRefreshContext)!;
}

// Call this in any screen. Spread the result onto an Animated.ScrollView / Animated.FlatList.
export function usePullRefresh(onRefresh?: () => Promise<any> | void) {
  const ctx = useContext(PullRefreshContext)!;
  const fnRef = useRef(onRefresh);
  fnRef.current = onRefresh;

  useFocusEffect(
    useCallback(() => {
      ctx.scrollY.setValue(0);
      ctx.registerRefresh(() => fnRef.current?.());
      return () => ctx.registerRefresh(null);
    }, [ctx])
  );

  return ctx.pullProps;
}