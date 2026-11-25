import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, Animated, Easing, Platform, StyleSheet, useWindowDimensions,
  Modal, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';

import { Sparkles, ArrowRight, X, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';
import HeroSlideshow from './HeroSlideshow';
import Reveal from './Reveal';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { HERO_IMAGES } from '@/data/media';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import api from '@/api/client';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const CTA_HOLD_MS = 6000;
const CTA_VIBRATE_MS = 700;
const CTA_SHRINK_MS = 100;
const CTA_ROTATE_MS = 450;
const CTA_SLIDE_MS = 500;
const CTA_DELETE_CHAR_MS = 20;
const CTA_TYPE_CHAR_MS = 45;

const SELL_LABEL_DEFAULT = 'Start Selling';
const SELL_LABEL_ALT = 'Offer Services';
const SUPPORT_LABEL_DEFAULT = 'Contact Support';
const SUPPORT_LABEL_ALT = 'Message People';

const RIGHT_R = 20; // bottom-right corner of the hero
const LEFT_R = 32;  // how far the hero curves down on the left
const GESTURE_TIMEOUT_MS = 4000;
const DOUBLE_TAP_MS = 220;

// ─── ROTATING HEADLINE ("Ember Swap") ────────────────────────────────
const HEADLINE_PHRASES = [
  'Buy and Sell within your campus,Safely.',
  'Book a service and track it on the map.',
  'Post a story, tag it and watch it sell.',
  'Learn how to grow your campus business.',
  'Boost a listing and get seen on campus.',
  'Follow sellers and never miss any drop.',
  'Get paid when your buyer says received.',
];
// Destination per phrase, same order as HEADLINE_PHRASES.
// null = open the services modal instead of navigating.
const HEADLINE_ROUTES: (string | null)[] = [
  '/browse',
  null,
  '/stories/new',          // Post a story -> new story screen
  '/stories?tab=learn',    // Learn -> Stories screen, Learn tab
  '/browse?boost=1',       // Boost a listing -> Browse, auto-launches boost mode
  '/stories?tab=feed',     // Follow sellers -> Stories screen, Feed tab
  '/dashboard?tab=orders',
];
const HEADLINE_SIZE = 45;
const HEADLINE_LINE = 48;
const HEADLINE_MIN = 28;       // smallest size a phrase may shrink to, to stay on 2 lines
const HEADLINE_MAX_LINES = 2;
const HEADLINE_HOLD_MS = 4500;
const HEADLINE_OUT_MS = 240;
const HEADLINE_OUT_STAGGER = 14;
const HEADLINE_IN_STAGGER = 20;
const HEADLINE_MAX_CHARS = 48;
const HEADLINE_GOLD = '#f5b301';

// Module-level, so they survive the home screen unmounting
let lastHeadlinePhrase = 0;
let savedHeadlineSizes: number[] = HEADLINE_PHRASES.map(() => HEADLINE_SIZE);

// ─── EMBER BLAST (tap animation) ─────────────────────────────────────
const BLAST_MS = 650;
const FLOOD_MS = 480;
const FLOOD_DELAY_MS = 170;
const NAVIGATE_AT_MS = 640;
const REFORM_DELAY_MS = 450;

type GlyphToken = { text: string; start: number; spaceAfter: boolean };

function tokenizeHeadline(phrase: string): GlyphToken[] {
  const out: GlyphToken[] = [];
  let idx = 0;
  phrase.split(' ').forEach((word, wi, arr) => {
    const pieces = word.replace(/,(?=\S)/g, ',\u0000').split('\u0000');
    pieces.forEach((piece, pi) => {
      out.push({
        text: piece,
        start: idx,
        spaceAfter: pi === pieces.length - 1 && wi < arr.length - 1,
      });
      idx += piece.length;
    });
    idx += 1;
  });
  return out;
}

function HeadlineGlyph({
  ch, i, p, burst, size,
}: { ch: string; i: number; p: Animated.Value; burst: Animated.Value; size: number }) {
  const tilt = (i % 2 === 0 ? 1 : -1) * (5 + ((i * 7) % 6));
  const drift = ((i * 13) % 9) - 4;
  const translateY = p.interpolate({ inputRange: [-1, 0, 1], outputRange: [18, 0, -20] });
  const translateX = p.interpolate({ inputRange: [-1, 0, 1], outputRange: [-drift, 0, drift] });
  const scaleY = p.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.15, 1, 0.05] });
  const rotate = p.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [`${-tilt}deg`, '0deg', `${tilt}deg`],
  });
  const opacity = p.interpolate({
    inputRange: [-1, -0.75, 0, 0.7, 1],
    outputRange: [0, 1, 1, 0.9, 0],
  });
  const gold = p.interpolate({
    inputRange: [-1, -0.6, 0, 0.3, 1],
    outputRange: [1, 1, 0, 1, 1],
  });

  // Blast: each letter ignites, then flies off in its own direction (waves left to right)
  const d = 0.02 + Math.min(i, 44) * 0.007;
  const angle = ((i * 47) % 360) * (Math.PI / 180);
  const dist = 140 + ((i * 29) % 120);
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist - 70;
  const spin = ((i * 53) % 720) - 360;
  const blastX = burst.interpolate({ inputRange: [0, d, 1], outputRange: [0, 0, dx] });
  const blastY = burst.interpolate({ inputRange: [0, d, 1], outputRange: [0, 0, dy] });
  const blastRot = burst.interpolate({ inputRange: [0, d, 1], outputRange: ['0deg', '0deg', `${spin}deg`] });
  const blastScale = burst.interpolate({ inputRange: [0, d, 0.5, 1], outputRange: [1, 1, 1.35, 0.1] });
  const blastOpacity = burst.interpolate({ inputRange: [0, d, 0.75, 1], outputRange: [1, 1, 0.9, 0] });
  const ignite = burst.interpolate({ inputRange: [0, d, d + 0.12, 1], outputRange: [0, 0, 1, 1] });
  const goldOpacity = Animated.add(gold, ignite);

  const base = {
    fontSize: size,
    fontWeight: '800' as const,
    lineHeight: Math.round((size * HEADLINE_LINE) / HEADLINE_SIZE),
  };

  return (
    <Animated.View
      style={{
        opacity: blastOpacity,
        transform: [{ translateX: blastX }, { translateY: blastY }, { rotate: blastRot }, { scale: blastScale }],
      }}
    >
      <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { rotate }, { scaleY }] }}>
        <Text style={[base, { color: 'white' }]}>{ch}</Text>
        <Animated.Text
          style={[base, { color: HEADLINE_GOLD, position: 'absolute', left: 0, top: 0, opacity: goldOpacity }]}
        >
          {ch}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

function RotatingHeadline({
  onBuyHold, onAndPress, onSellHold, onSellPress, flash, onNavigate,
}: {
  onBuyHold: () => void;
  onAndPress: () => boolean;   // returns true if the press was consumed by the admin gesture
  onSellHold: () => void;
  onSellPress: () => boolean;  // returns true if the press was consumed by the admin gesture
  flash: Animated.Value;
  onNavigate: (phraseIndex: number) => void;
}) {
  const [phrase, setPhrase] = useState(lastHeadlinePhrase);
  const phraseRef = useRef(lastHeadlinePhrase);
  const busy = useRef(false);
  const glyphs = useRef(
    Array.from({ length: HEADLINE_MAX_CHARS }, () => new Animated.Value(0))
  ).current;
  const burst = useRef(new Animated.Value(0)).current;

  // Font size per phrase. A phrase that wraps past 2 lines shrinks 2px at a time
  // until it fits, and keeps that size for later cycles.
  const [sizes, setSizesState] = useState<number[]>(() => savedHeadlineSizes);
  const setSizes = (fn: (s: number[]) => number[]) =>
    setSizesState((s) => (savedHeadlineSizes = fn(s)));
  const size = sizes[phrase];
  const lineH = (size * HEADLINE_LINE) / HEADLINE_SIZE;

  const heightAnim = useRef(new Animated.Value(HEADLINE_LINE * HEADLINE_MAX_LINES)).current;
  const measuredOnce = useRef(false);
  const fitHeight = (h: number) => {
    if (h > lineH * HEADLINE_MAX_LINES + 2 && size > HEADLINE_MIN) {
      setSizes((s) => s.map((v, i) => (i === phrase ? Math.max(HEADLINE_MIN, v - 2) : v)));
      return;
    }
    const target = Math.ceil(h);
    if (!measuredOnce.current) {
      measuredOnce.current = true;
      heightAnim.setValue(target);
      return;
    }
    Animated.timing(heightAnim, {
      toValue: target,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      while (!cancelled) {
        await sleep(HEADLINE_HOLD_MS);
        if (cancelled) return;
        while (busy.current) {
          await sleep(100);
          if (cancelled) return;
        }

        // 1) letters burn off, left to right
        const cur = HEADLINE_PHRASES[phraseRef.current];
        await new Promise<void>((resolve) => {
          Animated.stagger(
            HEADLINE_OUT_STAGGER,
            glyphs.slice(0, cur.length).map((g) =>
              Animated.timing(g, {
                toValue: 1,
                duration: HEADLINE_OUT_MS,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              })
            )
          ).start(() => resolve());
        });
        if (cancelled) return;

        // 2) swap the text while every letter is invisible
        const next = (phraseRef.current + 1) % HEADLINE_PHRASES.length;
        phraseRef.current = next;
        lastHeadlinePhrase = next;
        glyphs.forEach((g) => g.setValue(-1));
        setPhrase(next);
        await sleep(60);
        if (cancelled) return;

        // 3) new letters rise in hot, then cool to white
        await new Promise<void>((resolve) => {
          Animated.stagger(
            HEADLINE_IN_STAGGER,
            glyphs.slice(0, HEADLINE_PHRASES[next].length).map((g) =>
              Animated.spring(g, { toValue: 0, friction: 5, tension: 150, useNativeDriver: true })
            )
          ).start(() => resolve());
        });
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const reform = () => {
    burst.setValue(0);
    flash.setValue(0);
    const len = HEADLINE_PHRASES[phraseRef.current].length;
    glyphs.forEach((g) => g.setValue(-1));
    Animated.stagger(
      HEADLINE_IN_STAGGER,
      glyphs.slice(0, len).map((g) =>
        Animated.spring(g, { toValue: 0, friction: 5, tension: 150, useNativeDriver: true })
      )
    ).start(() => { busy.current = false; });
  };

  const tapHeadline = () => {
    if (busy.current) return;
    busy.current = true;
    const idx = phraseRef.current;

    Animated.parallel([
      Animated.timing(burst, {
        toValue: 1,
        duration: BLAST_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 1,
        duration: FLOOD_MS,
        delay: FLOOD_DELAY_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      onNavigate(idx);
      setTimeout(reform, REFORM_DELAY_MS);
    }, NAVIGATE_AT_MS);
  };

  const tokens = tokenizeHeadline(HEADLINE_PHRASES[phrase]);
  const SPACE = size * 0.28;

  return (
    <Animated.View style={{ height: heightAnim }}>
      <View
        onLayout={(e) => fitHeight(e.nativeEvent.layout.height)}
        style={{ flexDirection: 'row', flexWrap: 'wrap' }}
      >
        {tokens.map((tk, ti) => {
          const row = (
            <View style={{ flexDirection: 'row', marginRight: tk.spaceAfter ? SPACE : 0 }}>
              {tk.text.split('').map((ch, ci) => (
                <HeadlineGlyph
                  key={ci}
                  ch={ch}
                  i={tk.start + ci}
                  p={glyphs[tk.start + ci]}
                  burst={burst}
                  size={size}
                />
              ))}
            </View>
          );
          const key = `${phrase}-${ti}`;
          // hidden admin gesture only works on the first phrase (Buy, and, Sell)
          if (phrase === 0 && tk.text === 'Buy') {
            return (
              <Pressable key={key} delayLongPress={150} onLongPress={onBuyHold} onPress={tapHeadline}>
                {row}
              </Pressable>
            );
          }
          if (phrase === 0 && tk.text === 'and') {
            return (
              <Pressable key={key} onPress={() => { if (!onAndPress()) tapHeadline(); }}>
                {row}
              </Pressable>
            );
          }
          if (phrase === 0 && tk.text === 'Sell') {
            return (
              <Pressable
                key={key}
                delayLongPress={150}
                onLongPress={onSellHold}
                onPress={() => { if (!onSellPress()) tapHeadline(); }}
              >
                {row}
              </Pressable>
            );
          }
          return <Pressable key={key} onPress={tapHeadline}>{row}</Pressable>;
        })}
      </View>
    </Animated.View>
  );
}

// ─── SERVICES MODAL (glass) ──────────────────────────────────────────
function servicePriceText(s: any) {
  const min = parseFloat(s.price) || 0;
  const max = parseFloat(s.price_max) || 0;
  return max > min ? `GHS ${min.toFixed(0)} - ${max.toFixed(0)}` : `GHS ${min.toFixed(2)}`;
}

function ServicesModal({
  visible, onClose, onPick, items, loading, failed, colors, isDark,
}: {
  visible: boolean; onClose: () => void; onPick: (s: any) => void;
  items: any[]; loading: boolean; failed: boolean; colors: any; isDark: boolean;
}) {
  const { height: H } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current;
  const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  useEffect(() => {
    if (!visible) return;
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }).start();
  }, [visible]);

  const content = (
    <View style={{ paddingTop: 18, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Book a service</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
            Pick one to see details and track it on the map.
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
          <X size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: 32 }} />
      ) : failed ? (
        <Text style={{ textAlign: 'center', color: colors.textMuted, marginVertical: 32, paddingHorizontal: 18 }}>
          Couldn't load services. Check your connection and try again.
        </Text>
      ) : items.length === 0 ? (
        <Text style={{ textAlign: 'center', color: colors.textMuted, marginVertical: 32, paddingHorizontal: 18 }}>
          No services listed yet.
        </Text>
      ) : (
        <ScrollView
          style={{ maxHeight: H * 0.5 }}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onPick(s)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 10, borderRadius: 18,
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
                borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <View style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.chipBg }}>
                {!!s.primary_image && (
                  <Image source={{ uri: s.primary_image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{s.title}</Text>
                {!!s.seller_name && (
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted, marginTop: 1 }}>{s.seller_name}</Text>
                )}
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '900', color: colors.brand, marginTop: 3 }}>
                  {servicePriceText(s)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const panelStyle = { borderRadius: 28, overflow: 'hidden' as const };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
        />
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          }}
        >
          {glass ? (
            <GlassView glassEffectStyle="regular" style={panelStyle}>{content}</GlassView>
          ) : (
            <View
              style={[
                panelStyle,
                {
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)',
                  backgroundColor: isDark ? 'rgba(30,30,34,0.6)' : 'rgba(255,255,255,0.6)',
                },
              ]}
            >
              <BlurView
                intensity={isDark ? 60 : 80}
                tint={isDark ? 'dark' : 'light'}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              {content}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function GlassButton({ onPress, style, tint, children, allowGlass = true }: any) {
  if (allowGlass && Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    const { backgroundColor, borderWidth, borderColor, width, borderRadius, ...inner } = StyleSheet.flatten(style) as any;
    return (
      <Pressable onPress={onPress}>
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={tint}
          style={{ width, borderRadius, overflow: 'hidden' }}
        >
          <View style={{ ...inner, paddingVertical: (inner.paddingVertical || 0) + (borderWidth || 0) }}>
            {children}
          </View>
        </GlassView>
      </Pressable>
    );
  }
  return <Pressable onPress={onPress} style={style}>{children}</Pressable>;
}

export default function Hero({ fillViewport = false }: { fillViewport?: boolean }) {
  const colors = useColors();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const sellFg = isDark ? '#0D0C0A' : colors.brandDark;
  // Must match ValueStrip's background exactly. Change this if ValueStrip uses another color.
  const stripBg = colors.card;
  const { width: W, height: H } = useWindowDimensions();
  const { user } = useAuth();
  const router = useRouter();

  const [glassKey, setGlassKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setGlassKey((k) => k + 1);
    }, [])
  );

  const [sellIsAlt, setSellIsAlt] = useState(false);
  const [supportDisplay, setSupportDisplay] = useState(SUPPORT_LABEL_DEFAULT);
  const supportIsAltRef = useRef(false);
  const adminGestureStep = useRef(0);
  const lastAndTap = useRef(0);
  const gestureTimer = useRef<any>(null);

  const arrowScale = useRef(new Animated.Value(1)).current;
  const arrowRotate = useRef(new Animated.Value(0)).current;
  const oldLabelX = useRef(new Animated.Value(0)).current;
  const newLabelX = useRef(new Animated.Value(100)).current;

  // Ember flood that rises from the bottom when a headline is tapped
  const flash = useRef(new Animated.Value(0)).current;
  const FLOOD_H = H + 160;
  const floodTranslate = flash.interpolate({ inputRange: [0, 1], outputRange: [FLOOD_H, 0] });

  // Services modal (opened by the "Book a service" headline)
  const [servicesOpen, setServicesOpen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesFailed, setServicesFailed] = useState(false);

  const openServices = () => {
    setServicesOpen(true);
    setServicesLoading(true);
    setServicesFailed(false);
    api.get('/products', { params: { itemCategory: 'Services', limit: 20 } })
      .then((res) => setServices(res.data || []))
      .catch(() => setServicesFailed(true))
      .finally(() => setServicesLoading(false));
  };

  const pickService = (s: any) => {
    setServicesOpen(false);
    // let the modal close before navigating, otherwise iOS can glitch
    setTimeout(() => router.push(`/service/${s.id}` as any), 250);
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    let cancelled = false;

    const deleteText = async (text: string) => {
      let current = text;
      while (current.length > 0) {
        if (cancelled) return;
        current = current.slice(0, -1);
        setSupportDisplay(current);
        await sleep(CTA_DELETE_CHAR_MS);
      }
    };
    const typeText = async (text: string) => {
      let current = '';
      while (current.length < text.length) {
        if (cancelled) return;
        current = text.slice(0, current.length + 1);
        setSupportDisplay(current);
        await sleep(CTA_TYPE_CHAR_MS);
      }
    };

    const runCycle = async () => {
      while (!cancelled) {
        await sleep(CTA_HOLD_MS);
        if (cancelled) return;

        await new Promise<void>((resolve) => {
          Animated.timing(arrowScale, {
            toValue: 1.75,
            duration: CTA_VIBRATE_MS,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }).start(() => resolve());
        });
        if (cancelled) return;

        await new Promise<void>((resolve) => {
          Animated.timing(arrowScale, {
            toValue: 1,
            duration: CTA_SHRINK_MS,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }).start(() => resolve());
        });
        if (cancelled) return;

        await new Promise<void>((resolve) => {
          Animated.timing(arrowRotate, {
            toValue: 1,
            duration: CTA_ROTATE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }).start(() => resolve());
        });
        if (cancelled) return;

        oldLabelX.setValue(0);
        newLabelX.setValue(100);
        await new Promise<void>((resolve) => {
          Animated.parallel([
            Animated.timing(oldLabelX, {
              toValue: -100,
              duration: CTA_SLIDE_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(newLabelX, {
              toValue: 0,
              duration: CTA_SLIDE_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]).start(() => resolve());
        });
        if (cancelled) return;

        setSellIsAlt((prev) => !prev);
        arrowRotate.setValue(0);
        oldLabelX.setValue(0);
        newLabelX.setValue(100);

        const currentSupportLabel = supportIsAltRef.current ? SUPPORT_LABEL_ALT : SUPPORT_LABEL_DEFAULT;
        const nextSupportLabel = supportIsAltRef.current ? SUPPORT_LABEL_DEFAULT : SUPPORT_LABEL_ALT;

        await deleteText(currentSupportLabel);
        if (cancelled) return;
        await typeText(nextSupportLabel);
        if (cancelled) return;

        supportIsAltRef.current = !supportIsAltRef.current;
      }
    };

    runCycle();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (gestureTimer.current) clearTimeout(gestureTimer.current);
  }, []);

  const sellCurrentLabel = sellIsAlt ? SELL_LABEL_ALT : SELL_LABEL_DEFAULT;
  const sellNextLabel = sellIsAlt ? SELL_LABEL_DEFAULT : SELL_LABEL_ALT;

  const rotateInterpolate = arrowRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const oldTranslate = oldLabelX.interpolate({ inputRange: [-100, 0], outputRange: [-150, 0] });
  const newTranslate = newLabelX.interpolate({ inputRange: [0, 100], outputRange: [0, 150] });

  const handleStartSellingClick = () => {
    if (!user) {
      router.push('/register?tab=seller');
      return;
    }
    if (user.account_type === 'buyer') {
      Toast.show({
        type: 'info',
        text1: 'Seller account required',
        text2: 'Tap here to sign up as a seller',
        visibilityTime: 6000,
        onPress: () => {
          Toast.hide();
          router.push('/register?tab=seller');
        },
      });
      return;
    }
    router.push(sellIsAlt ? { pathname: '/sell', params: { type: 'service' } } : '/sell');
  };
  const handleSupportClick = () => {
    if (supportIsAltRef.current) {
      if (!user) {
        router.push('/register')
        return;
      }
      router.push('/chat' as any)
    } else {
      router.push('/contact' as any);
    }
  };

  const handleHeadlineNavigate = (phraseIndex: number) => {
    const route = HEADLINE_ROUTES[phraseIndex];
    if (route === null) {
      openServices();
      return;
    }
    router.push(route as any);
  };

  const resetAdminGesture = () => {
    adminGestureStep.current = 0;
    lastAndTap.current = 0;
    if (gestureTimer.current) {
      clearTimeout(gestureTimer.current);
      gestureTimer.current = null;
    }
  };

  const armGestureTimer = () => {
    if (gestureTimer.current) clearTimeout(gestureTimer.current);
    gestureTimer.current = setTimeout(resetAdminGesture, GESTURE_TIMEOUT_MS);
  };

  const handleAdminWordHold = (word: 'buy' | 'sell') => {
    if (word === 'buy' && adminGestureStep.current === 0) {
      adminGestureStep.current = 1;
      armGestureTimer();
      return;
    }
    if (word === 'sell' && adminGestureStep.current === 1) {
      adminGestureStep.current = 2;
      return;
    }
    resetAdminGesture();
  };

  // returns true if consumed by the admin gesture (headline should not navigate)
  const handleAdminAndPress = (): boolean => {
    if (adminGestureStep.current !== 2) {
      resetAdminGesture();
      return false;
    }
    const now = Date.now();
    if (now - lastAndTap.current < DOUBLE_TAP_MS) {
      adminGestureStep.current = 3;
    } else {
      lastAndTap.current = now;
    }
    return true;
  };

  // returns true if consumed by the admin gesture (headline should not navigate)
  const handleAdminFinalSellPress = (): boolean => {
    if (adminGestureStep.current === 3) {
      resetAdminGesture();
      router.push('/admin-login');
      return true;
    }
    resetAdminGesture();
    return false;
  };

  return (
    <View style={fillViewport ? { flex: 1, minHeight: 320 } : { height: 400 + LEFT_R }}>
      <View
        style={
          fillViewport
            ? { flex: 1, position: 'relative', overflow: 'hidden' }
            : { height: 400 + LEFT_R, position: 'relative', overflow: 'hidden' }
        }
      >
        <HeroSlideshow images={HERO_IMAGES} />

        <LinearGradient
          colors={['rgba(13,12,10,0.6)', 'rgba(22,20,17,0.35)', 'rgba(184,117,21,0.3)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Bottom shadow so the subtext and buttons read clearly on any image */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(13,12,10,0)', 'rgba(13,12,10,0.55)', 'rgba(13,12,10,0.9)']}
          locations={[0, 0.5, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' }}
        />

        <View style={{ paddingHorizontal: SCREEN_PADDING_X, paddingTop: 64, paddingBottom: 64, position: 'relative', zIndex: 10 }}>
          <Reveal>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <Sparkles size={13} color="white" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>Students sell. Everyone buys.</Text>
            </View>
          </Reveal>

          <Reveal delay={100}>
            <View style={{ marginTop: 20 }}>
              <RotatingHeadline
                onBuyHold={() => handleAdminWordHold('buy')}
                onAndPress={handleAdminAndPress}
                onSellHold={() => handleAdminWordHold('sell')}
                onSellPress={handleAdminFinalSellPress}
                flash={flash}
                onNavigate={handleHeadlineNavigate}
              />
            </View>
          </Reveal>

          <Reveal delay={200}>
            <Text style={{ marginTop: 14, color: 'rgba(255,255,255,0.85)', fontSize: 19, fontWeight: '500' }}>
              Shop products, book services and buy data from verified students. Payments are held safely until you confirm delivery.
            </Text>
          </Reveal>

          <Reveal delay={300}>
            <View key={glassKey} style={{ marginTop: 32, flexDirection: 'row', gap: 8 }}>
              <GlassButton
                onPress={handleStartSellingClick}
                tint={isDark ? colors.brand : 'rgba(255,255,255,0.85)'}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  width: 140,
                  backgroundColor: isDark ? colors.brand : 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transform: [{ translateX: oldTranslate }],
                  }}
                >
                  <Text style={{ color: sellFg, fontWeight: '700', fontSize: 14 }}>{sellCurrentLabel}</Text>
                  <Animated.View style={{ transform: [{ scale: arrowScale }, { rotate: rotateInterpolate }] }}>
                    <ArrowRight size={16} color={sellFg} />
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transform: [{ translateX: newTranslate }],
                  }}
                >
                  <Text style={{ color: sellFg, fontWeight: '700', fontSize: 14 }}>{sellNextLabel}</Text>
                  <ArrowRight size={16} color={sellFg} />
                </Animated.View>

                <Text style={{ opacity: 0, fontWeight: '700', fontSize: 14 }}>{sellCurrentLabel}</Text>
              </GlassButton>

              <GlassButton
                onPress={handleSupportClick}
                allowGlass={isDark}
                style={{
                  width: 140,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{supportDisplay}</Text>
              </GlassButton>
            </View>
          </Reveal>
        </View>

        {/* Ember flood: rises from the bottom when a headline is tapped */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: FLOOD_H,
            zIndex: 15,
            transform: [{ translateY: floodTranslate }],
          }}
        >
          <LinearGradient
            colors={['rgba(245,179,1,0)', HEADLINE_GOLD, '#e08a00', '#b87515']}
            locations={[0, 0.12, 0.5, 1]}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* Bottom edge: rounded-out on the right, strip's rounded top-left corner on the left */}
        <Svg
          pointerEvents="none"
          width={W}
          height={RIGHT_R + LEFT_R}
          style={{ position: 'absolute', left: 0, bottom: 0, zIndex: 20 }}
        >
          <Path
            fill={stripBg}
            d={`M${W} 0 A${RIGHT_R} ${RIGHT_R} 0 0 1 ${W - RIGHT_R} ${RIGHT_R} L${LEFT_R} ${RIGHT_R} A${LEFT_R} ${LEFT_R} 0 0 0 0 ${RIGHT_R + LEFT_R} L0 ${RIGHT_R + LEFT_R} L${W} ${RIGHT_R + LEFT_R} Z`}
          />
        </Svg>
      </View>

      <ServicesModal
        visible={servicesOpen}
        onClose={() => setServicesOpen(false)}
        onPick={pickService}
        items={services}
        loading={servicesLoading}
        failed={servicesFailed}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}