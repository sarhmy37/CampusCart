import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, Dimensions, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  Sparkles, MessageCircle, MapPin, ShieldCheck, Gift, Package, Wallet, LayoutDashboard,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import MaskedView from '@react-native-masked-view/masked-view';
import { useColors } from '@/hooks/useColors';
import { emitter } from '@/api/client';
import { TOUR_IMAGES } from '@/data/media';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHONE_WIDTH = Math.min(SCREEN_WIDTH * 0.52, 200);
const PHONE_HEIGHT = PHONE_WIDTH * 1.24;

// ─── SCREENSHOT HELPERS ──────────────────────────────────────────────
const shot = (name: string, pos = '50% 30%', zoom = 1) => ({
  ...TOUR_IMAGES[name],
  pos,
  zoom,
});

const SHOTS = {
  browse:    shot('browse', '50% 0%'),
  services:  shot('services', '50% 0%'),
  pay:       shot('pay', '50% 0%'),
  refer:     shot('refer', '50% 0%'),
  list:      shot('list', '50% 0%'),
  payout:    shot('payout', '50% 0%'),
  dashboard: shot('dashboard', '50% 0%'),
  chat:      shot('chat', '50% 0%'),
};

// ─── STEP DEFINITIONS ────────────────────────────────────────────────
const ARRIVAL_STEP = {
  icon: Sparkles,
  stamp: 'Arrival',
  title: (n: string) => `Welcome to Tre-X, ${n}`,
  body: 'Tre-X is where students on your campus buy, sell and book services. This short tour collects stamps in your passport.',
};

const REFER_STEP = {
  icon: Gift,
  stamp: 'Refer',
  shot: SHOTS.refer,
  title: () => 'Bring a friend, save on a plan',
  body: 'Share your referral code. Each friend who signs up gives you 25% off Pro or Premium for 24 hours, plus 12 more hours for every extra friend.',
};

const BUYER_STEPS = [
  ARRIVAL_STEP,
  {
    icon: MessageCircle,
    stamp: 'Browse',
    shot: SHOTS.browse,
    title: () => 'Find it, then ask about it',
    body: 'Browse listings from verified students and save the ones you like.',
  },
  {
    icon: MapPin,
    stamp: 'Services',
    shot: SHOTS.services,
    title: () => 'Book and track from home',
    body: 'Need a tutor, a haircut or a print job? Book a fellow student and track your service from the comfort of your home, then follow the map to the service point.',
  },
  {
    icon: MessageCircle,
    stamp: 'Chat',
    shot: SHOTS.chat,
    title: () => 'Chat with the seller first',
    body: 'Message the seller before you meet to ask questions, agree on details and confirm the item.',
  },
  {
    icon: ShieldCheck,
    stamp: 'Pay',
    shot: SHOTS.pay,
    title: () => 'Pay safely, confirm on delivery',
    body: 'Pay through Paystack. Confirm the order once you have your item, and that is when the seller gets paid.',
  },
  REFER_STEP,
];

const SELLER_STEPS = [
  ARRIVAL_STEP,
  {
    icon: Package,
    stamp: 'List',
    shot: SHOTS.list,
    title: () => 'List an item in a minute',
    body: 'Add photos and a price, then set your delivery fee for on, near and far campus.',
  },
  {
    icon: MapPin,
    stamp: 'Services',
    shot: SHOTS.services,
    title: () => 'Offer a service too',
    body: 'Students can book you and follow the map to your service point.',
  },
  {
    icon: LayoutDashboard,
    stamp: 'Dashboard',
    shot: SHOTS.dashboard,
    title: () => 'Manage everything in one place',
    body: 'Your dashboard shows your listings, orders, sales and payouts, so you can view and manage your whole store from one screen.',
  },
  {
    icon: MessageCircle,
    stamp: 'Chat',
    shot: SHOTS.chat,
    title: () => 'Chat with your buyers',
    body: 'Buyers message you before they order. Reply quickly to close more sales.',
  },
  {
    icon: Wallet,
    stamp: 'Payout',
    shot: SHOTS.payout,
    title: () => 'Get paid when buyers confirm',
    body: 'Earnings show in your Payouts tab. Request a withdrawal any time, and report it there if it does not arrive.',
  },
  REFER_STEP,
];

const ROTATIONS = [-8, 6, -4, 9, -6];

// Set to false when you finish testing.
const ALWAYS_SHOW = true;
const doneKey = (id: string) => `trex_tour_done_${id}`;

// Converts a '50% 30%' string (from the shot() helper) into the
// {left, top} shape expo-image's contentPosition expects.
function parsePos(pos: string) {
  const [x, y] = (pos || '50% 50%').split(' ');
  return { left: x, top: y };
}
// Mirrors the web version: top-rounded-only frame (bottom fades out, so
// no bottom corners are ever seen), a diagonal 5-stop metallic gradient
// that differs for iOS (silver) vs Android (dark alloy) — matching real
// device colors regardless of app theme — and a diagonal glass highlight.
// The whole thing is wrapped in a bottom-fade mask, same as the web CSS
// mask-image, so the frame dissolves into the background instead of
// getting clipped into a hard-edged rectangle.
function PhoneShot({ shot, colors }: { shot: any; colors: any }) {
  const src = shot.src;
  const isIOS = Platform.OS === 'ios';

  if (!src) {
    return (
      <View
        style={{
          width: PHONE_WIDTH,
          height: PHONE_HEIGHT,
          borderTopLeftRadius: 44,
          borderTopRightRadius: 44,
          backgroundColor: colors.chipBg,
        }}
      />
    );
  }

  const frameColors = isIOS
    ? ['#e6e6e9', '#8d8d93', '#f1f1f3', '#7a7a80', '#d4d4d8']
    : ['#4b4f55', '#15171a', '#5a5e64', '#101113', '#3c4046'];
  const frameLocations = [0, 0.28, 0.52, 0.78, 1];
  const btnColor = isIOS ? '#8d8d93' : '#3a3e44';

  const outerRadius = 44;
  const frameWidth = 3;
  const innerRadius = outerRadius - frameWidth; // 41
  const bezelSize = 6;
  const screenRadius = innerRadius - bezelSize; // 35

  return (
    <MaskedView
      style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT }}
      maskElement={
        <LinearGradient
          colors={['black', 'black', 'transparent']}
          locations={[0, 0.55, 1]}
          style={{ flex: 1 }}
        />
      }
    >
      <View style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT }}>
        {/* Side buttons, drawn outside the metal frame */}
        <View style={sideBtn({ left: -3, top: '24%', height: 24, color: btnColor })} />
        <View style={sideBtn({ left: -3, top: '39%', height: 40, color: btnColor })} />
        <View style={sideBtn({ right: -3, top: '33%', height: 56, color: btnColor })} />

        {/* Outer metal frame — diagonal 5-stop gradient, top-rounded only */}
        <LinearGradient
          colors={frameColors}
          locations={frameLocations}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.65, y: 1 }}
          style={{
            flex: 1,
            borderTopLeftRadius: outerRadius,
            borderTopRightRadius: outerRadius,
            padding: frameWidth,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              borderTopLeftRadius: innerRadius,
              borderTopRightRadius: innerRadius,
              backgroundColor: '#000',
              padding: bezelSize,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flex: 1,
                borderTopLeftRadius: screenRadius,
                borderTopRightRadius: screenRadius,
                overflow: 'hidden',
              }}
            >
              <Image
                source={src}
                style={{
                  width: '100%',
                  height: '100%',
                  transform: [{ scale: shot.zoom || 1 }],
                }}
                contentFit="cover"
                contentPosition={parsePos(shot.pos)}
              />

              {isIOS ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: '50%',
                    marginLeft: -29,
                    width: 58,
                    height: 17,
                    borderRadius: 9,
                    backgroundColor: '#000',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 7,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#1c2a45',
                    }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: '50%',
                    marginLeft: -4.5,
                    width: 9,
                    height: 9,
                    borderRadius: 4.5,
                    backgroundColor: '#000',
                    borderWidth: 1.5,
                    borderColor: '#262626',
                  }}
                />
              )}

              {/* Diagonal glass highlight, matching the web overlay */}
              <LinearGradient
                colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
                locations={[0, 0.38]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.6 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                pointerEvents="none"
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    </MaskedView>
  );
}

// Helper to keep side-button styles consistent
function sideBtn({ left, right, top, height, color = '#2b2d31' }: any) {
  return {
    position: 'absolute' as const,
    left,
    right,
    top,
    width: 3,
    height,
    backgroundColor: color,
    borderRadius: 1.5,
  };
}

// ─── STAMP ───────────────────────────────────────────────────────────
function Stamp({
  icon: Icon, label, rot, colors,
}: { icon: any; label: string; rot: string; colors: any }) {
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const t = setTimeout(() => setScale(1), 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <View
      style={{
        position: 'absolute',
        right: -32,
        bottom: 20,
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: colors.brand,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: rot }, { scale }],
      }}
    >
      <Icon size={20} color={colors.brand} />
      <Text style={{ fontSize: 9, fontWeight: '800', color: colors.brand, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const steps = user?.account_type === 'seller' ? SELLER_STEPS : BUYER_STEPS;
  const isLast = step === steps.length - 1;

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    (async () => {
      let done = false;
      try {
        done = (await AsyncStorage.getItem(doneKey(user.id))) === '1';
      } catch {}
      if (ALWAYS_SHOW || !done) {
        setStep(0);
        setOpen(true);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    emitter.on('trex-replay-tour', replay);
    return () => {
      emitter.off('trex-replay-tour', replay);
    };
  }, []);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [open, step]);

  if (!open || !user) return null;

  const current = steps[step] as any;
  const Icon = current.icon;
  const name = user.username || user.name || 'friend';
  const shotSrc = current.shot ? current.shot.light : null;
  const rot = `${ROTATIONS[step % ROTATIONS.length]}deg`;

  const finish = async (goTo?: string) => {
    try {
      if (user) await AsyncStorage.setItem(doneKey(user.id), '1');
    } catch {}
    setOpen(false);
    if (goTo) router.push(goTo as any);
  };

  const next = () => {
    if (isLast) {
      finish(user?.account_type === 'seller' ? '/sell' : '/browse');
    } else {
      setStep((s) => s + 1);
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => finish()}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(15,23,42,0.7)',
        }}
      >
        <View
          style={{
            width: '100%',
            maxHeight: '92%',
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          {/* Passport header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingTop: 20,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, flex: 1 }}
              numberOfLines={1}
            >
              Campus passport of {name}
            </Text>
            <Pressable onPress={() => finish()}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
                Skip tour
              </Text>
            </Pressable>
          </View>

          {/* Stamp slots */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
              marginTop: 16,
            }}
          >
            {steps.map((s: any, i: number) => {
              const SlotIcon = s.icon;
              const stamped = i < step;
              const active = i === step;
              return (
                <View
                  key={s.stamp + i}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    borderWidth: 2,
                    borderColor: stamped
                      ? colors.brand
                      : active
                        ? colors.brand
                        : colors.border,
                    borderStyle: stamped || active ? 'solid' : 'dashed',
                    backgroundColor: stamped ? colors.brandSoft : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {stamped && <SlotIcon size={14} color={colors.brand} />}
                </View>
              );
            })}
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Visual area */}
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 20,
                height: PHONE_HEIGHT + 20,
              }}
            >
              {shotSrc ? (
                <View style={{ position: 'relative' }}>
                  <PhoneShot shot={{ ...current.shot, src: shotSrc }} colors={colors} />
                  <Stamp icon={Icon} label={current.stamp} rot={rot} colors={colors} />
                </View>
              ) : (
                <View style={{ position: 'relative' }}>
                  <View
                    style={{
                      width: 120, height: 120, borderRadius: 60,
                      borderWidth: 3, borderColor: colors.brand,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        position: 'absolute',
                        top: 8, left: 8, right: 8, bottom: 8,
                        borderRadius: 60, borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.brand,
                        opacity: 0.6,
                      }}
                    />
                    <Icon size={34} color={colors.brand} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand, marginTop: 4 }}>
                      {current.stamp}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Copy */}
            <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: colors.text,
                  textAlign: 'center',
                  lineHeight: 28,
                }}
              >
                {current.title(name)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: 10,
                  lineHeight: 21,
                  paddingHorizontal: 8,
                }}
              >
                {current.body}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: 30,
            }}
          >
            {step > 0 && (
              <Pressable
                onPress={back}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                  Back
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={next}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.brand,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>
                {step === 0
                  ? 'Start the tour'
                  : isLast
                    ? (user.account_type === 'seller' ? 'List my first item' : 'Start exploring')
                    : 'Next stamp'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}