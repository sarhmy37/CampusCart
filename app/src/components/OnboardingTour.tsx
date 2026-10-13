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
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { emitter } from '@/api/client';
import { TOUR_IMAGES } from '@/data/media';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHONE_WIDTH = Math.min(SCREEN_WIDTH * 0.52, 200);
const PHONE_HEIGHT = PHONE_WIDTH * 1.24;

// Computed once — native capability check, same pattern as CreateListing.
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

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
  refer:     shot('refer', '50% 80%'),
  list:      shot('list', '50% 0%'),
  payout:    shot('payout', '50% 70%'),
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

  const frameColors: [string, string, string, string, string] = isIOS
    ? ['#e6e6e9', '#8d8d93', '#f1f1f3', '#7a7a80', '#d4d4d8']
    : ['#4b4f55', '#15171a', '#5a5e64', '#101113', '#3c4046'];
  const frameLocations: [number, number, number, number, number] = [0, 0.28, 0.52, 0.78, 1];
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
      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brand, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── GRADIENT EDGE ───────────────────────────────────────────────────
// Story-ring style gradient outline, inset from the sheet edge and
// following its rounded top corners. Open at the bottom.
const EDGE_INSET = 12;
const EDGE_WIDTH = 4;
const SHEET_RADIUS = 24;

function GradientEdge({ w, h }: { w: number; h: number }) {
  if (!w || !h) return null;
  const i = EDGE_INSET;
  const r = SHEET_RADIUS - i;
  const d =
    `M ${i} ${h} L ${i} ${i + r} A ${r} ${r} 0 0 1 ${i + r} ${i} ` +
    `L ${w - i - r} ${i} A ${r} ${r} 0 0 1 ${w - i} ${i + r} L ${w - i} ${h}`;
  return (
    <Svg
      width={w}
      height={h}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <SvgGradient id="tourEdge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2={h}>
          <Stop offset="0%" stopColor="#f59e0b" />
          <Stop offset="25%" stopColor="#ef4444" />
          <Stop offset="50%" stopColor="#a855f7" />
          <Stop offset="75%" stopColor="#3b82f6" />
          <Stop offset="100%" stopColor="#f59e0b" />
        </SvgGradient>
      </Defs>
      <Path d={d} stroke="url(#tourEdge)" strokeWidth={EDGE_WIDTH} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ─── GLASS BUTTON ────────────────────────────────────────────────────
// Duplicates the SubmitButton glass treatment from CreateListing.
// Padding + radius MUST live inside GlassView — the glass shape is
// derived from the GlassView's own bounds, not the outer Pressable.
function GlassButton({
  onPress,
  disabled,
  label,
  colors,
  tint,
  textColor,
  outerStyle,
  innerStyle,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  colors: any;
  tint?: string;
  textColor?: string;
  outerStyle?: any;
  innerStyle?: any;
}) {
  const bg = tint ?? colors.brand;
  const fg = textColor ?? colors.textOnGold;

  if (GLASS) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[{ opacity: disabled ? 0.6 : 1 }, outerStyle]}
      >
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={bg}
          style={[
            {
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            },
            innerStyle,
          ]}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: fg }}>{label}</Text>
        </GlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
        },
        outerStyle,
        innerStyle,
      ]}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
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
  const [sheetSize, setSheetSize] = useState({ w: 0, h: 0 });

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

  const nextLabel =
    step === 0
      ? 'Start the tour'
      : isLast
        ? (user.account_type === 'seller' ? 'List my first item' : 'Start exploring')
        : 'Next stamp';

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
          onLayout={(e) =>
            setSheetSize({
              w: e.nativeEvent.layout.width,
              h: e.nativeEvent.layout.height,
            })
          }
          style={{
            width: '100%',
            maxHeight: '92%',
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <GradientEdge w={sheetSize.w} h={sheetSize.h} />

          {/* Skip tour — keeps the original brand-background tab shape.
              GlassView only supports uniform borderRadius, so we keep
              this as a solid button (matches the primary CTA on non-glass
              devices, and stays visually distinct from the glass Next). */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingTop: 20,
            }}
          >
            <Pressable
              onPress={() => finish()}
              style={{
                paddingLeft: 16,
                paddingRight: 20,
                paddingVertical: 8,
                backgroundColor: colors.brand,
                borderTopLeftRadius: 16,
                borderBottomLeftRadius: 16,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>
                Skip tour
              </Text>
            </Pressable>
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
                marginTop: 10,
                height: shotSrc ? PHONE_HEIGHT : 130,
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
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand, marginTop: 4 }}>
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
                  fontSize: 23,
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
                  fontSize: 15,
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

          {/* Dots navigation */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              paddingTop: 10,
            }}
          >
            {steps.map((s: any, i: number) => (
              <Pressable key={s.stamp + i} onPress={() => setStep(i)} hitSlop={8}>
                <View
                  style={{
                    width: i === step ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i === step ? colors.brand : colors.border,
                  }}
                />
              </Pressable>
            ))}
          </View>

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
              <GlassButton
                onPress={back}
                label="Back"
                colors={colors}
                tint="rgba(255,255,255,0.10)"
                textColor={colors.textSecondary}
                outerStyle={{
                  borderWidth: GLASS ? 0 : 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                }}
                innerStyle={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                }}
              />
            )}
            <GlassButton
              onPress={next}
              label={nextLabel}
              colors={colors}
              outerStyle={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}