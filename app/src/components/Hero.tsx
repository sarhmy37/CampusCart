import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';

import { Sparkles, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import HeroSlideshow from './HeroSlideshow';
import Reveal from './Reveal';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { HERO_IMAGES } from '@/data/media';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
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
  const { width: W } = useWindowDimensions();
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
      // "Message People" opens the chat screen (needs an account)
      if (!user) {
        router.push('/register');
        return;
      }
      router.push('/chat' as any);
    } else {
      // "Contact Support" opens the support page
      router.push('/support' as any);
    }
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

  const handleAdminAndPress = () => {
    if (adminGestureStep.current !== 2) {
      resetAdminGesture();
      return;
    }
    const now = Date.now();
    if (now - lastAndTap.current < DOUBLE_TAP_MS) {
      adminGestureStep.current = 3;
    } else {
      lastAndTap.current = now;
    }
  };

  const handleAdminFinalSellPress = () => {
    if (adminGestureStep.current === 3) {
      resetAdminGesture();
      router.push('/admin-login');
      return;
    }
    resetAdminGesture();
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

        <View style={{ paddingHorizontal: SCREEN_PADDING_X, paddingTop: 64, paddingBottom: 64, position: 'relative', zIndex: 10 }}>
          <Reveal>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <Sparkles size={13} color="white" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>Students sell. Everyone buys.</Text>
            </View>
          </Reveal>

          <Reveal delay={100}>
            <Text style={{ marginTop: 20, fontSize: 45, fontWeight: '800', lineHeight: 48, color: 'white' }}>
              <Text
                suppressHighlighting
                selectable={false}
                delayLongPress={150}
                onLongPress={() => handleAdminWordHold('buy')}
              >
                Buy
              </Text>
              <Text> </Text>
              <Text
                suppressHighlighting
                selectable={false}
                onPress={handleAdminAndPress}
              >
                and
              </Text>
              <Text> </Text>
              <Text
                suppressHighlighting
                selectable={false}
                delayLongPress={150}
                onLongPress={() => handleAdminWordHold('sell')}
                onPress={handleAdminFinalSellPress}
              >
                Sell
              </Text>
              <Text> within your campus,Safely.</Text>
            </Text>
          </Reveal>

          <Reveal delay={200}>
            <Text style={{ marginTop: 20, color: 'rgba(255,255,255,0.85)', fontSize: 19, fontWeight: '500' }}>
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
    </View>
  );
}