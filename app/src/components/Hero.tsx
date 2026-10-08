import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import HeroSlideshow from './HeroSlideshow';
import Reveal from './Reveal';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { HERO_IMAGES } from '@/data/media';
import { useColors } from '@/hooks/useColors';

const CTA_HOLD_MS = 6000;
const CTA_VIBRATE_MS = 700;
const CTA_SHRINK_MS = 100;
const CTA_ROTATE_MS = 450;
const CTA_SLIDE_MS = 500;
const CTA_DELETE_CHAR_MS = 20;
const CTA_TYPE_CHAR_MS = 45;

const SELL_LABEL_DEFAULT = 'Start Selling';
const SELL_LABEL_ALT = 'Offer Services';
const BROWSE_LABEL_DEFAULT = 'Browse Products';
const BROWSE_LABEL_ALT = 'Browse Services';

export default function Hero() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();

  const [sellIsAlt, setSellIsAlt] = useState(false);
  const [browseDisplay, setBrowseDisplay] = useState(BROWSE_LABEL_DEFAULT);
  const browseIsAltRef = useRef(false);

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
        setBrowseDisplay(current);
        await sleep(CTA_DELETE_CHAR_MS);
      }
    };
    const typeText = async (text: string) => {
      let current = '';
      while (current.length < text.length) {
        if (cancelled) return;
        current = text.slice(0, current.length + 1);
        setBrowseDisplay(current);
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

        const currentBrowseLabel = browseIsAltRef.current ? BROWSE_LABEL_ALT : BROWSE_LABEL_DEFAULT;
        const nextBrowseLabel = browseIsAltRef.current ? BROWSE_LABEL_DEFAULT : BROWSE_LABEL_ALT;

        await deleteText(currentBrowseLabel);
        if (cancelled) return;
        await typeText(nextBrowseLabel);
        if (cancelled) return;

        browseIsAltRef.current = !browseIsAltRef.current;
      }
    };

    runCycle();
    return () => { cancelled = true; };
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
    router.push('/sell');
  };
  const handleBrowseClick = () => {
    if (user) {
      router.push('/browse');
    } else {
      router.push('/register');
    }
  };

  return (
    <View style={{ height: 400, position: 'relative', overflow: 'hidden' }}>
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
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>Students sell. Everyone buys.</Text>
          </View>
        </Reveal>

        <Reveal delay={100}>
          <Text style={{ marginTop: 20, fontSize: 44, fontWeight: '800', lineHeight: 48, color: 'white' }}>
            Buy and Sell within your campus,Safely.
          </Text>
        </Reveal>

        <Reveal delay={200}>
          <Text style={{ marginTop: 20, color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '500' }}>
            Verified university students only. Textbooks, gadgets, furniture and more — right on campus, no middlemen, no scams.
          </Text>
        </Reveal>

        <Reveal delay={300}>
          <View style={{ marginTop: 32, flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleStartSellingClick}
              style={{
                position: 'relative',
                overflow: 'hidden',
                width: 130,
                backgroundColor: 'white',
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
                <Text style={{ color: colors.brandDark, fontWeight: '700', fontSize: 13 }}>{sellCurrentLabel}</Text>
                <Animated.View style={{ transform: [{ scale: arrowScale }, { rotate: rotateInterpolate }] }}>
                  <ArrowRight size={16} color={colors.brandDark} />
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
                <Text style={{ color: colors.brandDark, fontWeight: '700', fontSize: 13 }}>{sellNextLabel}</Text>
                <ArrowRight size={16} color={colors.brandDark} />
              </Animated.View>

              <Text style={{ opacity: 0, fontWeight: '700', fontSize: 13 }}>{sellCurrentLabel}</Text>
            </Pressable>

            <Pressable
              onPress={handleBrowseClick}
              style={{
                width: 130,
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
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{browseDisplay}</Text>
            </Pressable>
          </View>
        </Reveal>
      </View>
    </View>
  );
}