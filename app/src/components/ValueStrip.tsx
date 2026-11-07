import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, Animated, Easing, PanResponder, Dimensions, Platform, TextInput, ScrollView, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Eye, EyeOff, ChevronUp, ChevronDown, X, Shirt, Footprints, Gem, Utensils, Armchair, Dumbbell, Sparkles, Star, Check } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';
import { ShieldCheckIcon, StarIcon, CurrencyDollarIcon } from 'react-native-heroicons/solid';
import {
  SignalIcon, WrenchScrewdriverIcon, ShoppingBagIcon, DevicePhoneMobileIcon, PencilIcon, BookOpenIcon,
  BeakerIcon, SparklesIcon, ScissorsIcon, ShoppingCartIcon, HomeIcon, LightBulbIcon, MusicalNoteIcon,
  TicketIcon, EllipsisHorizontalCircleIcon,
} from 'react-native-heroicons/outline';

import api from '@/api/client';
import Reveal from './Reveal';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const FALLBACK_GHS_TO_USD_RATE = 0.067;
// `key` is sent to /sellers/overview as ?period= (backend: week | 2weeks | month | 6months | year).
// These are rolling windows compared against the previous window of the same length.
const PERIODS = [
  { key: 'week', label: 'past week', title: 'Past week' },
  { key: '2weeks', label: 'past 2 weeks', title: 'Past 2 weeks' },
  { key: 'month', label: 'past month', title: 'Past month' },
  { key: '6months', label: 'past 6 months', title: 'Past 6 months' },
  { key: 'year', label: 'past year', title: 'Past year' },
];

const money = (n: number | string) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Same route the hero and tab bar use
const BROWSE_PATH = '/(browse)/all';

// Unsplash images per category. Missing/failed ones fall back to the icon.
const CATEGORY_IMAGES: Record<string, any> = {
  'Mobile Data':       'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=200&q=80',
  'Services':          'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&q=80',
  'Clothes':           'https://images.unsplash.com/photo-1594938291221-94f18cbb5660?w=200&q=80',
  'Sneakers':          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80',
  'Bags':              'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&q=80',
  'Gadgets':           'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&q=80',
  'Stationery':        'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=200&q=80',
  'Books':             'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&q=80',
  'Perfumes':          'https://images.unsplash.com/photo-1541643600914-78b084683601?w=200&q=80',
  'Beauty & Skincare': 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=200&q=80',
  'Hair & Wigs':       'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&q=80',
  'Jewelry & Watches': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80',
  'Food':              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80',
  'Groceries':         'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=80',
  'Room Essentials':   'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=200&q=80',
  'Furniture':         'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&q=80',
  'Appliances':        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&q=80',
  'Sports & Fitness':  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&q=80',
  'Music & Instruments':'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&q=80',
  'Tickets & Events':  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200&q=80',
  'Other':             'https://images.unsplash.com/photo-1526406915894-7bcd65f60845?w=200&q=80',
};

const CATEGORY_CHIPS: { label: string; Icon: any }[] = [
  { label: 'Mobile Data', Icon: SignalIcon },
  { label: 'Services', Icon: WrenchScrewdriverIcon },
  { label: 'Clothes', Icon: Shirt },
  { label: 'Sneakers', Icon: Footprints },
  { label: 'Bags', Icon: ShoppingBagIcon },
  { label: 'Gadgets', Icon: DevicePhoneMobileIcon },
  { label: 'Stationery', Icon: PencilIcon },
  { label: 'Books', Icon: BookOpenIcon },
  { label: 'Perfumes', Icon: BeakerIcon },
  { label: 'Beauty & Skincare', Icon: SparklesIcon },
  { label: 'Hair & Wigs', Icon: ScissorsIcon },
  { label: 'Jewelry & Watches', Icon: Gem },
  { label: 'Food', Icon: Utensils },
  { label: 'Groceries', Icon: ShoppingCartIcon },
  { label: 'Room Essentials', Icon: HomeIcon },
  { label: 'Furniture', Icon: Armchair },
  { label: 'Appliances', Icon: LightBulbIcon },
  { label: 'Sports & Fitness', Icon: Dumbbell },
  { label: 'Music & Instruments', Icon: MusicalNoteIcon },
  { label: 'Tickets & Events', Icon: TicketIcon },
  { label: 'Other', Icon: EllipsisHorizontalCircleIcon },
];

const CIRCLE = 60;
const ITEM_W = 76;
const DIVIDER_W = 1.5;
const LOOP_W = CATEGORY_CHIPS.length * (ITEM_W + DIVIDER_W); // width of one full copy of the list
const AUTO_SPEED = 28;      // pixels per second
const RESUME_AFTER_MS = 2500;

function CategoryItem({
  label, Icon, first, colors, onGo,
}: { label: string; Icon: any; first: boolean; colors: any; onGo: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  const img = CATEGORY_IMAGES[label];
  const source = typeof img === 'string' ? { uri: img } : img;

  const press = () => {
    if (on) return;
    setOn(true);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      onGo();
      setOn(false);
    }, 320);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: DIVIDER_W, height: 56, borderRadius: 1, backgroundColor: first ? 'transparent' : colors.border }} />
      <Pressable onPress={press} style={{ width: ITEM_W, alignItems: 'center', paddingVertical: 6 }}>
        <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
          <View
            style={{
              width: CIRCLE,
              height: CIRCLE,
              borderRadius: CIRCLE / 2,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.inputBg ?? `${colors.border}30`,
              borderWidth: on ? 2 : 0,
              borderColor: colors.brand,
            }}
          >
            {source && !failed ? (
              <Image source={source} style={{ width: CIRCLE, height: CIRCLE }} onError={() => setFailed(true)} />
            ) : (
              <Icon size={26} color={colors.brand} />
            )}
          </View>
          <Text
            numberOfLines={2}
            style={{ marginTop: 6, fontSize: 11.5, fontWeight: '700', color: colors.text, textAlign: 'center' }}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const VALUES = [
  {
    Icon: ShieldCheckIcon,
    label: 'Safe, Protected Payments',
    title: 'Safe, Protected Payments',
    details:
      'When you pay at checkout, your money is held safely and is only released to the seller after you confirm you received your order. If something goes wrong, you can report a problem right from your Orders tab.',
  },
  {
    Icon: StarIcon,
    label: 'Built-in Reviews & Ratings',
    title: 'Built-in Reviews & Ratings',
    details:
      'After completing transactions, verified buyers leave ratings and photo reviews. Check seller credibility before chatting, ordering, or booking to trade with complete peace of mind.',
  },
  {
    Icon: CurrencyDollarIcon,
    label: 'Free to List, Low Fees',
    title: 'Free to List, Low Fees',
    details:
      'Listing products or services on Antika costs nothing. A transparent 1.5% fee is applied only when a sale is completed, with instant transfer options right to your Payouts tab.',
  },
];

const ACTIONS: { label: string; path: string | null }[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Got it', path: null },
  { label: 'List now', path: '/sell' },
];

export default function ValueStrip() {
  const colors = useColors();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const isSeller = !!user && user.account_type !== 'buyer';
  const isPlanActive = !!(user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date());
  const planTier: 'free' | 'pro' | 'premium' = isPlanActive ? (String(user!.plan).toLowerCase() as any) : 'free';
  const tierColor = planTier === 'premium' ? '#a855f7' : planTier === 'pro' ? '#3b82f6' : colors.brand;
  const tierLabel = planTier === 'premium' ? 'Premium · Active' : planTier === 'pro' ? 'Pro · Active' : 'Free plan';

  // ── Value sheet (buyers) ──
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected !== null ? VALUES[selected] : null;
  const action = selected !== null ? ACTIONS[selected] : null;

  const translateY = useRef(new Animated.Value(0)).current;
  const openItem = (i: number) => {
    translateY.setValue(0);
    setSelected(i);
  };
  const runAction = () => {
    const path = action?.path;
    setSelected(null);
    if (path) setTimeout(() => router.push(path as any), 250);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 100 || g.vy > 0.8) {
          Animated.timing(translateY, { toValue: Dimensions.get('window').height, duration: 200, useNativeDriver: true })
            .start(() => setSelected(null));
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  // ── Seller balance ──
  const [balance, setBalance] = useState(0);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [periodOpen, setPeriodOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isSeller) return;
      api.get('/payouts/balance')
        .then((res) => setBalance(res.data?.availableBalance || 0))
        .catch(() => {});
      api.get('/sellers/overview', { params: { period: period.key } })
        .then((res) => {
          const raw = res.data?.net_change_percentage;
          setChangePct(raw !== undefined && raw !== null ? parseFloat(raw) : null);
        })
        .catch(() => setChangePct(null));
    }, [isSeller, period.key])
  );

  useEffect(() => {
    if (!isSeller) return;
    fetch('https://open.er-api.com/v6/latest/GHS')
      .then((r) => r.json())
      .then((d) => setRate(typeof d?.rates?.USD === 'number' ? d.rates.USD : FALLBACK_GHS_TO_USD_RATE))
      .catch(() => setRate(FALLBACK_GHS_TO_USD_RATE));
  }, [isSeller]);

  // Reveal behind the password, same as the dashboard
  const [revealed, setRevealed] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [pendingWithdraw, setPendingWithdraw] = useState(false);

  const toggleReveal = () => {
    if (revealed) { setRevealed(false); return; }
    setPendingWithdraw(false);
    setPw('');
    setPwOpen(true);
  };
  const handleWithdraw = () => {
    if (revealed) { router.push('/dashboard' as any); return; }
    setPendingWithdraw(true);
    setPw('');
    setPwOpen(true);
  };
  const verify = async () => {
    if (!pw) return Toast.show({ type: 'error', text1: 'Enter your password' });
    setVerifying(true);
    try {
      await api.post('/auth/me/verify-password', { password: pw });
      setRevealed(true);
      setPwOpen(false);
      setPw('');
      if (pendingWithdraw) {
        setPendingWithdraw(false);
        router.push('/dashboard' as any);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Incorrect password' });
    } finally {
      setVerifying(false);
    }
  };

  const GlassPill = ({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) => {
    const pad = small
      ? { paddingHorizontal: 14, paddingVertical: 6 }
      : { paddingHorizontal: 18, paddingVertical: 9 };
    const fs = small ? 13 : 14;
    return (
      <Pressable onPress={onPress} hitSlop={6}>
        {useGlass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={colors.brand}
            style={{ ...pad, borderRadius: 999, overflow: 'hidden' }}
          >
            <Text style={{ fontSize: fs, fontWeight: '800', color: colors.textOnGold }}>{label}</Text>
          </GlassView>
        ) : (
          <View style={{ ...pad, borderRadius: 999, backgroundColor: colors.brand }}>
            <Text style={{ fontSize: fs, fontWeight: '800', color: colors.textOnGold }}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  // ── Auto-sliding categories ──
  const catRef = useRef<ScrollView>(null);
  const catX = useRef(LOOP_W);
  const catPaused = useRef(false);
  const catDir = useRef(1); // 1 = slides left (default), -1 = slides right
  const catResumeTimer = useRef<any>(null);

  const pauseCats = () => {
    clearTimeout(catResumeTimer.current);
    catPaused.current = true;
  };
  const resumeCatsLater = () => {
    clearTimeout(catResumeTimer.current);
    catResumeTimer.current = setTimeout(() => { catPaused.current = false; }, RESUME_AFTER_MS);
  };

  useEffect(() => {
    const t = setTimeout(() => catRef.current?.scrollTo({ x: LOOP_W, animated: false }), 0);
    let raf = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!catPaused.current) {
        let x = catX.current + catDir.current * AUTO_SPEED * dt;
        if (x >= LOOP_W * 2) x -= LOOP_W;
        else if (x < LOOP_W) x += LOOP_W;
        catX.current = x;
        catRef.current?.scrollTo({ x, animated: false });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); clearTimeout(catResumeTimer.current); };
  }, []);

  const onCatScroll = (e: any) => {
    let x = e.nativeEvent.contentOffset.x;
    if (catPaused.current) {
      const delta = x - catX.current;
      if (Math.abs(delta) > 0.5 && Math.abs(delta) < LOOP_W / 2) catDir.current = delta > 0 ? 1 : -1;
      // the user is driving: keep the loop seamless in both directions
      if (x >= LOOP_W * 2) { x -= LOOP_W; catRef.current?.scrollTo({ x, animated: false }); }
      else if (x <= 10) { x += LOOP_W; catRef.current?.scrollTo({ x, animated: false }); }
    }
    catX.current = x;
  };

  // ── Background circles: idle = gold, tint appears only while moving ──
  const orb = useRef(new Animated.Value(0)).current;      // drives position/scale 0 -> 1 -> 0
  const orbTint = useRef(new Animated.Value(0)).current;  // 0 = gold, 1 = tier color (only during motion)
  const [cardSize, setCardSize] = useState({ w: Dimensions.get('window').width - SCREEN_PADDING_X * 2, h: 170 });

  useEffect(() => {
    if (!isSeller) return;
    const ease = Easing.inOut(Easing.cubic);
    const HOLD_MS = 10000;   // idle time at rest (gold)
    const MOVE_MS = 1700;   // one-way motion duration
    const TINT_IN_MS = 400; // how fast the color blends in when motion starts
    const TINT_OUT_MS = 400; // how fast it fades back to gold after motion ends

    const cycle = () =>
      Animated.sequence([
        Animated.delay(HOLD_MS),
        Animated.parallel([
          Animated.timing(orbTint, { toValue: 1, duration: TINT_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(orb, { toValue: 1, duration: MOVE_MS, easing: ease, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(orbTint, { toValue: 0, duration: TINT_OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(orb, { toValue: 0, duration: MOVE_MS, easing: ease, useNativeDriver: false }),
        ]),
      ]).start(({ finished }) => {
        if (finished) cycle();
      });

    const first = setTimeout(cycle, 1000); // let layout settle before the first hold
    return () => { clearTimeout(first); orb.stopAnimation(); orbTint.stopAnimation(); };
  }, [isSeller]);

  // circle A sits top-right (center ≈ w-60, 40), circle B bottom-left (center ≈ 50, h-30)
  const swapDx = 110 - cardSize.w;
  const swapDy = cardSize.h - 70;

  const orbAStyle = {
    opacity: orb.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.2, 0.08] }),
    transform: [
      { translateX: orb.interpolate({ inputRange: [0, 1], outputRange: [0, swapDx] }) },
      { translateY: orb.interpolate({ inputRange: [0, 1], outputRange: [0, swapDy] }) },
      { scale: orb.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.55, 1.1] }) },
    ],
  };
  const orbBStyle = {
    opacity: orb.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.05, 0.16, 0.05] }),
    transform: [
      { translateX: orb.interpolate({ inputRange: [0, 1], outputRange: [0, -swapDx] }) },
      { translateY: orb.interpolate({ inputRange: [0, 1], outputRange: [0, -swapDy] }) },
      { scale: orb.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 0.85] }) },
    ],
  };

  // Color blend: gold at rest, tier color during motion
  const orbColor = orbTint.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.brand, tierColor],
  });

  const up = (changePct ?? 0) >= 0;

  // slightly lighter shade of the plan color for text/icon on the glass chip
  const chipFg = planTier === 'premium' ? '#c084fc' : planTier === 'pro' ? '#60a5fa' : tierColor;
  const planChip = (fg: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
      {planTier === 'premium' ? (
        <Sparkles size={13} color={fg} fill={fg} />
      ) : planTier === 'pro' ? (
        <Star size={13} color={fg} fill={fg} />
      ) : (
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} />
      )}
      <Text style={{ fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: fg }}>
        {tierLabel}
      </Text>
    </View>
  );

  const periodContent = (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, paddingHorizontal: 10, paddingVertical: 6 }}>
        Change period
      </Text>
      {PERIODS.map((p) => {
        const sel = p.key === period.key;
        return (
          <Pressable
            key={p.key}
            onPress={() => { setPeriod(p); setPeriodOpen(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12,
              backgroundColor: sel ? `${colors.brand}22` : 'transparent',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: sel ? '800' : '600', color: sel ? colors.brand : colors.text }}>
              {p.title}
            </Text>
            {sel && <Check size={16} color={colors.brand} />}
          </Pressable>
        );
      })}
    </View>
  );

  const pwContent = (
    <View>
      <Pressable onPress={() => setPwOpen(false)} hitSlop={10} style={{ position: 'absolute', top: 0, right: 0, zIndex: 2 }}>
        <X size={18} color={colors.textFaint} />
      </Pressable>
      <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>Confirm it's you</Text>
      <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 4 }}>
        Enter your password to continue.
      </Text>
      <TextInput
        value={pw}
        onChangeText={setPw}
        placeholder="••••••••••"
        placeholderTextColor={colors.textFaint}
        secureTextEntry
        style={{
          marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
          borderWidth: 1, borderColor: colors.border, fontSize: 15, color: colors.text,
          backgroundColor: colors.inputBg,
        }}
      />
      <Pressable onPress={verify} disabled={verifying} style={{ marginTop: 16, opacity: verifying ? 0.6 : 1 }}>
        {useGlass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={colors.brand}
            style={{ paddingVertical: 12, borderRadius: 14, alignItems: 'center', overflow: 'hidden' }}
          >
            <Text style={{ color: colors.textOnGold, fontWeight: '800', fontSize: 15 }}>
              {verifying ? 'Verifying…' : 'Continue'}
            </Text>
          </GlassView>
        ) : (
          <View style={{ paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: colors.brand }}>
            <Text style={{ color: colors.textOnGold, fontWeight: '800', fontSize: 15 }}>
              {verifying ? 'Verifying…' : 'Continue'}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: colors.card,
        paddingHorizontal: SCREEN_PADDING_X,
        paddingBottom: 8,
      }}
    >
      {/* Category chips (auto-sliding loop), first for everyone */}
      <ScrollView
        ref={catRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onCatScroll}
        onTouchStart={pauseCats}
        onTouchEnd={resumeCatsLater}
        onTouchCancel={resumeCatsLater}
        onScrollBeginDrag={pauseCats}
        onScrollEndDrag={resumeCatsLater}
        onMomentumScrollBegin={pauseCats}
        onMomentumScrollEnd={resumeCatsLater}
        style={{ marginHorizontal: -SCREEN_PADDING_X, marginTop: 4 }}
      >
        {[0, 1, 2].flatMap((copy) =>
          CATEGORY_CHIPS.map(({ label, Icon }, i) => (
            <CategoryItem
              key={`${label}-${copy}`}
              label={label}
              Icon={Icon}
              first={copy === 0 && i === 0}
              colors={colors}
              onGo={() => router.push({ pathname: BROWSE_PATH, params: { category: label } } as any)}
            />
          ))
        )}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: colors.border, marginTop: 6, marginBottom: 10 }} />

      {/* SELLER: balance card */}
      {isSeller && (
        <Reveal>
          <View
            onLayout={(e) => setCardSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            style={{
              marginTop: 0,
              marginBottom: 2,
              borderRadius: 20,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.card }} />
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: orbColor },
                orbAStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', bottom: -80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: orbColor },
                orbBStyle,
              ]}
            />
            <View
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20,
                borderWidth: 1, borderColor: `${colors.brand}22`,
              }}
            />

            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              {/* Plan chip (left) + payout (far right) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable onPress={() => router.push('/benefits' as any)} hitSlop={8}>
                  {useGlass ? (
                    <GlassView
                      glassEffectStyle="regular"
                      isInteractive
                      tintColor={`${tierColor}33`}
                      style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: `${tierColor}30` }}
                    >
                      {planChip(chipFg)}
                    </GlassView>
                  ) : (
                    <BlurView
                      intensity={30}
                      tint={theme === 'dark' ? 'dark' : 'light'}
                      style={{
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: `${tierColor}1f`,
                        borderWidth: 1,
                        borderColor: `${tierColor}40`,
                      }}
                    >
                      {planChip(tierColor)}
                    </BlurView>
                  )}
                </Pressable>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>
                  {isPlanActive ? '100% payout' : '98.5% payout'}
                </Text>
              </View>

              {/* Label + eye */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', letterSpacing: 0.3, color: colors.textMuted }}>
                  Available Balance
                </Text>
                <Pressable onPress={toggleReveal} hitSlop={12}>
                  {revealed ? (
                    <EyeOff size={19} color={colors.textMuted} />
                  ) : (
                    <Eye size={19} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>

              {/* Big number + USD */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textMuted, marginRight: 6, marginBottom: 5 }}>
                    GHS
                  </Text>
                  <Text
                    style={{
                      fontSize: 38,
                      fontWeight: '900',
                      color: colors.text,
                      letterSpacing: -1.2,
                      fontVariant: ['tabular-nums'],
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {revealed ? money(balance) : '••••••'}
                  </Text>
                </View>

                <View
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: colors.inputBg ?? `${colors.border}30`,
                    borderWidth: 1,
                    borderColor: `${colors.border}60`,
                    marginLeft: 10,
                    marginBottom: 5,
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.2 }}>
                    {revealed
                      ? rate !== null
                        ? `≈ $${money(balance * rate)}`
                        : '≈ $—'
                      : '≈ $••.••'}
                  </Text>
                </View>
              </View>

              {/* Trend tag (left, tap to change period) + Withdraw (far right) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <Pressable
                  onPress={() => setPeriodOpen(true)}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: changePct === null ? (colors.inputBg ?? `${colors.border}30`) : up ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {changePct !== null && (up ? (
                      <ChevronUp size={13} color="#fff" strokeWidth={3} />
                    ) : (
                      <ChevronDown size={13} color="#fff" strokeWidth={3} />
                    ))}
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: changePct === null ? colors.textMuted : '#fff' }}>
                      {changePct === null ? '—' : `${Math.abs(changePct).toFixed(1)}%`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{period.label}</Text>
                    <ChevronDown size={12} color={colors.textMuted} strokeWidth={2.5} />
                  </View>
                </Pressable>

                <GlassPill small label="Withdraw" onPress={handleWithdraw} />
              </View>
            </View>
          </View>
        </Reveal>
      )}

      {/* BUYER: value row */}
      {!isSeller && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {VALUES.map((v, i) => (
            <View key={v.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {i > 0 && (
                <View style={{ width: 1.5, height: 48, borderRadius: 1, backgroundColor: colors.border }} />
              )}
              <View style={{ flex: 1 }}>
                <Reveal delay={i * 90}>
                  <Pressable
                    onPress={() => openItem(i)}
                    style={{ alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 10 }}
                  >
                    <v.Icon size={30} color={colors.brand} />
                    <Text
                      numberOfLines={3}
                      style={{ fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 17 }}
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                </Reveal>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Value detail sheet */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          onPress={() => setSelected(null)}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
        >
          {active && (
            <Animated.View style={{ transform: [{ translateY }] }}>
              <Pressable
                onPress={() => {}}
                style={{
                  backgroundColor: colors.card,
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  paddingHorizontal: 24,
                  paddingTop: 8,
                  paddingBottom: 36,
                  borderTopWidth: 1,
                  borderColor: colors.borderMuted ?? `${colors.border}40`,
                }}
              >
                <View
                  {...pan.panHandlers}
                  style={{ alignSelf: 'stretch', alignItems: 'center', paddingTop: 4, paddingBottom: 16 }}
                >
                  <View
                    style={{
                      width: 36, height: 4, borderRadius: 2,
                      backgroundColor: colors.borderMuted ?? `${colors.border}60`,
                    }}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <active.Icon size={28} color={colors.brand} />
                  <Text style={{ flex: 1, fontSize: 21, fontWeight: '800', color: colors.text, lineHeight: 27 }}>
                    {active.title}
                  </Text>
                  {!!action && <GlassPill label={action.label} onPress={runAction} />}
                </View>

                <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textMuted }}>
                  {active.details}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>

      {/* Period picker (glass) */}
      <Modal visible={periodOpen} transparent animationType="fade" onRequestClose={() => setPeriodOpen(false)}>
        <Pressable
          onPress={() => setPeriodOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}
        >
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 300, borderRadius: 22, overflow: 'hidden' }}>
            {useGlass ? (
              <GlassView glassEffectStyle="regular" style={{ padding: 8 }}>
                {periodContent}
              </GlassView>
            ) : (
              <BlurView
                intensity={60}
                tint={theme === 'dark' ? 'dark' : 'light'}
                style={{
                  padding: 8,
                  backgroundColor: theme === 'dark' ? 'rgba(22,20,17,0.75)' : 'rgba(255,255,255,0.75)',
                }}
              >
                {periodContent}
              </BlurView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Password modal (glass) */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 20 }}
          onPress={() => setPwOpen(false)}
        >
          <Pressable onPress={() => {}} style={{ borderRadius: 22, overflow: 'hidden' }}>
            {useGlass ? (
              <GlassView glassEffectStyle="regular" style={{ padding: 24 }}>
                {pwContent}
              </GlassView>
            ) : (
              <BlurView
                intensity={60}
                tint={theme === 'dark' ? 'dark' : 'light'}
                style={{
                  padding: 24,
                  backgroundColor: theme === 'dark' ? 'rgba(22,20,17,0.78)' : 'rgba(255,255,255,0.78)',
                }}
              >
                {pwContent}
              </BlurView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}