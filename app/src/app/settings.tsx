import { useState, useEffect, useRef } from 'react';
import { View, TextInput, Pressable, ScrollView, Modal, Linking, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
import { Text as AppText } from 'react-native';
import { getScrollbarEnabled, setScrollbarEnabled } from '@/utils/scrollbarPref';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Lock, Bell, Eye, EyeOff, MapPin, Shield,
  ChevronDown, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Moon, Sun, Gift, Store, Copy, X,
} from 'lucide-react-native';
import { BadgeCheck } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SETTINGS_VIDEO } from '@/data/media';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import PasswordStrength, { isPasswordValid } from '@/components/PasswordStrength';
import StorePage from '@/app/seller/[id]';

const BUYER_SERVICE_FEE_RATE = 2;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { height } = useWindowDimensions();
  const heroHeight = 200;
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTextOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const backButtonOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const isSeller = user?.account_type === 'seller';
  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  const API_ORIGIN = ((api.defaults.baseURL || '') as string).replace(/\/api\/?$/, '');
  const referralLink = `${API_ORIGIN}/register?ref=${user?.referral_code || ''}`;
  const businessProfileUrl = user?.id ? `${API_ORIGIN}/store/${user.id}` : '';

  const [nowTs, setNowTs] = useState(Date.now());
  const discountExpiry = user?.plan_discount_expires_at
    ? new Date(user.plan_discount_expires_at).getTime() : 0;
  const discountActive = discountExpiry > nowTs;
  useEffect(() => {
    if (!discountActive) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [discountActive]);
  const formatCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const [storeStats, setStoreStats] = useState<any>(null);
  const [storeStatsLoading, setStoreStatsLoading] = useState(false);
  useEffect(() => {
    if (!isSeller || !isPlanActive || !user?.id) return;
    setStoreStatsLoading(true);
    Promise.all([
      api.get('/products/mine').catch(() => ({ data: [] })),
      api.get(`/reviews/seller/${user.id}`).catch(() => ({ data: { avg_rating: null, total: 0 } })),
      api.get('/orders/sales').catch(() => ({ data: [] })),
    ])
      .then(([listingsRes, reviewsRes, salesRes]) => {
        setStoreStats({
          listingCount: listingsRes.data.filter((p: any) => p.stock > 0).length,
          avgRating: reviewsRes.data.avg_rating,
          reviewCount: reviewsRes.data.total || 0,
          salesCount: salesRes.data.length,
        });
      })
      .finally(() => setStoreStatsLoading(false));
  }, [isSeller, isPlanActive, user?.id]);

  const [socialsExpanded, setSocialsExpanded] = useState(false);
  const [showStorePreview, setShowStorePreview] = useState(false);
  const [businessExpanded, setBusinessExpanded] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const [bodyHeight, setBodyHeight] = useState(0);
  const toggleBusiness = () => {
    const next = !businessExpanded;
    Animated.parallel([
      Animated.timing(chevronAnim, {
        toValue: next ? 1 : 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(bodyAnim, {
        toValue: next ? 1 : 0,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start();
    setBusinessExpanded(next);
  };

  const [referrals, setReferrals] = useState<any[]>([]);
  useEffect(() => {
    api.get('/auth/me').then((res) => setUser(res.data)).catch(() => {});
    api.get('/auth/me/referrals').then((res) => setReferrals(res.data)).catch(() => {});
  }, []);

  const [showHandlesModal, setShowHandlesModal] = useState(false);
  const [savingHandles, setSavingHandles] = useState(false);
  const [handles, setHandles] = useState({
    social_tiktok: '', social_whatsapp: '', social_instagram: '', social_snapchat: '',
    social_facebook: '', social_twitter: '', social_telegram: '',
  });
  useEffect(() => {
    if (!user) return;
    setHandles({
      social_tiktok: user.social_tiktok || '',
      social_whatsapp: user.social_whatsapp || '',
      social_instagram: user.social_instagram || '',
      social_snapchat: user.social_snapchat || '',
      social_facebook: user.social_facebook || '',
      social_twitter: user.social_twitter || '',
      social_telegram: user.social_telegram || '',
    });
  }, [user]);
  const handleSaveHandles = async () => {
    setSavingHandles(true);
    try {
      const res = await api.patch('/auth/me/socials', handles);
      setUser(res.data);
      Toast.show({ type: 'success', text1: 'Social handles updated' });
      setShowHandlesModal(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to update handles' });
    } finally {
      setSavingHandles(false);
    }
  };

  const [pwStep, setPwStep] = useState(1);
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const requestPasswordCode = async () => {
    setSaving(true);
    try {
      await api.post('/auth/me/password/request-code', { current_password: current });
      Toast.show({ type: 'success', text1: 'Code sent to your university email' });
      setPwStep(2);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to send code' });
    } finally {
      setSaving(false);
    }
  };

  const confirmPasswordChange = async () => {
    if (next !== confirm) return Toast.show({ type: 'error', text1: "New passwords don't match" });
    if (!isPasswordValid(next)) return Toast.show({ type: 'error', text1: 'Password must be 8+ chars with letter, number, symbol' });
    setSaving(true);
    try {
      await api.patch('/auth/me/password', { code, new_password: next });
      Toast.show({ type: 'success', text1: 'Password updated' });
      setPwStep(1); setCurrent(''); setCode(''); setNext(''); setConfirm('');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/auth/me', { data: { password: deletePassword } });
      Toast.show({ type: 'success', text1: 'Account deleted' });
      await logout();
      router.replace('/');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setDeleteOpen(false);
        setDeletePassword('');
      }
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to delete account' });
    } finally {
      setDeleting(false);
    }
  };

  const [termsOpen, setTermsOpen] = useState(false);
  const [scrollbarOn, setScrollbarOn] = useState(true);
  useEffect(() => { getScrollbarEnabled().then(setScrollbarOn); }, []);

  const [notifyListings, setNotifyListings] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(user?.notify_messages !== false);

  const copyReferralLink = async () => {
    await Clipboard.setStringAsync(referralLink);
    Toast.show({ type: 'success', text1: 'Referral link copied' });
  };
  const copyBusinessLink = async () => {
    if (!businessProfileUrl) return;
    await Clipboard.setStringAsync(businessProfileUrl);
    Toast.show({ type: 'success', text1: 'Profile link copied!' });
  };
  const shareOnSocial = (platform: string) => {
    if (!businessProfileUrl) return;
    const url = encodeURIComponent(businessProfileUrl);
    const text = encodeURIComponent('Check out my store on TreX! 🛍️');
    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      whatsapp: `https://wa.me/?text=${text} ${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    };
    if (shareUrls[platform]) Linking.openURL(shareUrls[platform]);
  };
  const shareInstagram = async () => {
    if (!businessProfileUrl) return;
    await Clipboard.setStringAsync(businessProfileUrl);
    Toast.show({ type: 'success', text1: 'Link copied! Paste it in your Instagram bio.' });
  };
  const shareSnapchat = async () => {
    if (!businessProfileUrl) return;
    await Clipboard.setStringAsync(businessProfileUrl);
    Toast.show({ type: 'success', text1: 'Link copied! Paste it in Snapchat.' });
  };

  const sellerInitial = user?.name?.charAt(0)?.toUpperCase() || '?';

  const inputStyle = {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, fontSize: 14,
    color: colors.text, backgroundColor: colors.inputBg,
  };
  const primaryBtn = {
    paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand,
    alignItems: 'center' as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* FIXED VIDEO BACKGROUND */}
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, overflow: 'hidden', backgroundColor: '#0f172a',
        }}
      >
        <SettingsVideo uri={SETTINGS_VIDEO as string} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)' }} />
        <LinearGradient
          colors={['transparent', '#000']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 50 }}
        />
      </View>

      {/* HEADER TEXT (fades on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: heroHeight, paddingHorizontal: 16, paddingTop: 16,
          opacity: headerTextOpacity,
        }}
      >
        <View style={{ height: 30 }} />
        <AppText style={{ fontSize: 26, fontWeight: '800', color: 'white', marginTop: 40 }}>Settings</AppText>
        <AppText style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Manage your account and preferences</AppText>
      </Animated.View>

      {/* BACK BUTTON (fades on scroll) */}
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, opacity: backButtonOpacity }}
      >
        <Pressable
          onPress={() => router.replace('/profile')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={14} color="white" />
          <AppText style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Back</AppText>
        </Pressable>
      </Animated.View>

      {/* SCROLLABLE BODY (scrolls over the video) */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: heroHeight - 24 }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            paddingTop: 24,
            paddingBottom: 40,
            gap: 16,
            minHeight: height,
          }}
        >
        {/* BUSINESS PROFILE */}
        {isSeller && isPlanActive && (
          <Card colors={colors}>
            <View style={{ backgroundColor: colors.cardAlt, padding: 20, borderRadius: 16, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
               {/* Blurred avatar background — radial fade to hide the hard circular edge */}
              {user?.avatar_url && (
                <View
                  style={{
                    position: 'absolute',
                    right: -100, top: -80,
                    width: 360, height: 280,
                  }}
                  pointerEvents="none"
                >
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={{
                      width: 360, height: 280,
                      opacity: theme === 'dark' ? 0.55 : 0.3,
                    }}
                    blurRadius={theme === 'dark' ? 22 : 8}
                    contentFit="cover"
                  />
                  {/* Radial fade overlay — transparent in center, card color at edges */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <Svg width={360} height={280}>
                      <Defs>
                        <RadialGradient id="edgeFade" cx="50%" cy="50%" r="50%">
                          <Stop offset="30%" stopColor={colors.cardAlt} stopOpacity="0" />
                          <Stop offset="72%" stopColor={colors.cardAlt} stopOpacity="1" />
                        </RadialGradient>
                      </Defs>
                      <SvgRect x="0" y="0" width={360} height={280} fill="url(#edgeFade)" />
                    </Svg>
                  </View>
                </View>
              )}

              <Pressable
                onPress={toggleBusiness}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.chipBg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                   {user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%' }} cachePolicy="disk" />
                  ) : (
                    <AppText style={{ fontSize: 22, fontWeight: '800', color: colors.textSecondary }}>{sellerInitial}</AppText>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{user?.name}</AppText>
                    {user?.verified && <BadgeCheck size={20} color={colors.success} />}
                  </View>
                  <AppText style={{ fontSize: 14, color: colors.textMuted }}>{user?.school}</AppText>
                </View>
                <Animated.View
                  style={{
                    transform: [{
                      rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
                    }],
                  }}
                >
                  <ChevronDown size={20} color={colors.textMuted} />
                </Animated.View>
              </Pressable>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ alignItems: 'flex-start' }}>
                  <AppText style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{storeStatsLoading ? '···' : storeStats?.listingCount ?? 0}</AppText>
                  <AppText style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Listings</AppText>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <AppText style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{storeStatsLoading ? '···' : storeStats?.salesCount ?? 0}</AppText>
                  <AppText style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Sales</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{storeStatsLoading ? '···' : (storeStats?.avgRating ? `★ ${storeStats.avgRating}` : '—')}</AppText>
                  <AppText style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>{storeStats?.reviewCount ?? 0} reviews</AppText>
                </View>
              </View>
            </View>

                 <Animated.View
              style={{
                height: bodyHeight > 0
                  ? bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [0, bodyHeight] })
                  : undefined,
                opacity: bodyAnim,
                overflow: 'hidden',
              }}
            >
              <View
                onLayout={(e) => {
                  if (bodyHeight === 0) setBodyHeight(e.nativeEvent.layout.height);
                }}
              >
            <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Store size={16} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Business Profile</AppText>
                <AppText style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>Your storefront link</AppText>
              </View>
            </View>

            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput value={businessProfileUrl} editable={false} style={[inputStyle, { flex: 1, fontSize: 13, color: colors.textMuted }]} />
                <Pressable onPress={copyBusinessLink} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.chipBg }}>
                  <Copy size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Share on:</AppText>
                <Pressable onPress={() => setShowStorePreview(true)}>
                  <AppText style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>Preview →</AppText>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <SocialBtn bg="#1877F2" label="f" onPress={() => shareOnSocial('facebook')} />
                <SocialBtn bg={colors.text} label="X" textColor={colors.card} onPress={() => shareOnSocial('twitter')} />
                <SocialBtn bg="#25D366" label="W" onPress={() => shareOnSocial('whatsapp')} />
                <SocialBtn bg="#0A66C2" label="in" onPress={() => shareOnSocial('linkedin')} />
                {socialsExpanded && (
                  <>
                    <SocialBtn bg="#26A5E4" label="Tg" onPress={() => shareOnSocial('telegram')} />
                    <SocialBtn bg="#d62976" label="Ig" onPress={shareInstagram} />
                    <SocialBtn bg="#FFFC00" label="Sc" textColor="#000" onPress={shareSnapchat} />
                  </>
                )}
                <Pressable onPress={() => setSocialsExpanded((v) => !v)} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                  {socialsExpanded ? <ChevronLeft size={16} color={colors.textMuted} /> : <ChevronRight size={16} color={colors.textMuted} />}
                </Pressable>
              </View>

              <Pressable onPress={() => setShowHandlesModal(true)} style={{ marginTop: 12 }}>
                <AppText style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>+ Add your social handles</AppText>
              </Pressable>
            </View>
              </View>
            </Animated.View>
          </Card>
        )}

        {/* APPEARANCE */}
        <Card colors={colors}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  {theme === 'dark' ? <Moon size={16} color={colors.brand} /> : <Sun size={16} color={colors.brand} />}
                </View>
                <View>
                  <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Appearance</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                    {theme === 'dark' ? 'Dark mode is on' : 'Light mode is on'}
                  </AppText>
                </View>
              </View>
              <Toggle value={theme === 'dark'} onToggle={toggleTheme} colors={colors} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Browse scrollbar</AppText>
                <AppText style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                  Show the draggable scrollbar on Browse
                </AppText>
              </View>
              <Toggle
                value={scrollbarOn}
                onToggle={() => {
                  const next = !scrollbarOn;
                  setScrollbarOn(next);
                  setScrollbarEnabled(next);
                }}
                colors={colors}
              />
            </View>
          </View>
        </Card>

        {/* BUYER TERMS */}
        {!isSeller && (
          <Card colors={colors}>
            <Pressable onPress={() => setTermsOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Buyer Terms of Service</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>Your shopping rights and protections</AppText>
                </View>
              </View>
              {termsOpen ? <ChevronDown size={18} color={colors.textFaint} style={{ transform: [{ rotate: '180deg' }] }} /> : <ChevronDown size={18} color={colors.textFaint} />}
            </Pressable>
            {termsOpen && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}>
                {[
                  'You are protected by our Buyer Guarantee — if an item doesn\'t match the listing, contact support for a full refund.',
                  'Only confirm "Order Received" once you have physically received the item in the agreed condition.',
                  'Sellers are responsible for delivering items as described. You will never be charged a platform fee as a buyer.',
                  'Always communicate with sellers through our built-in messaging system for safety and dispute resolution.',
                  `A small service fee (${BUYER_SERVICE_FEE_RATE}%) is applied to your checkout to cover payment processing charges by our payment provider (Paystack).`,
                ].map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <AppText style={{ color: colors.brand, fontWeight: '800' }}>•</AppText>
                    <AppText style={{ flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>{t}</AppText>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* DELIVERY LOCATIONS */}
        {!isSeller && <DeliveryLocations colors={colors} inputStyle={inputStyle} />}

        {/* CHANGE PASSWORD */}
        <Card colors={colors}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={16} color={colors.brand} />
              </View>
              <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Change password</AppText>
            </View>

            {pwStep === 1 ? (
              <View style={{ gap: 12 }}>
                <AppText style={{ fontSize: 12, color: colors.textFaint }}>
                  Confirm your current password — we'll email a verification code to your university email.
                </AppText>
                <TextInput
                  value={current}
                  onChangeText={setCurrent}
                  placeholder="Current password"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry={!show}
                  style={inputStyle}
                />
                <Pressable onPress={() => setShow((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {show ? <EyeOff size={13} color={colors.textMuted} /> : <Eye size={13} color={colors.textMuted} />}
                  <AppText style={{ fontSize: 12, color: colors.textMuted }}>{show ? 'Hide' : 'Show'} password</AppText>
                </Pressable>
                <Pressable onPress={requestPasswordCode} disabled={saving} style={[primaryBtn, { opacity: saving ? 0.6 : 1 }]}>
                  <AppText style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{saving ? 'Sending code…' : 'Send verification code'}</AppText>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <AppText style={{ fontSize: 12, color: colors.textFaint }}>
                  Enter the code we emailed you, along with your new password.
                </AppText>
                <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor={colors.textFaint} maxLength={6} keyboardType="number-pad" style={[inputStyle, { textAlign: 'center', letterSpacing: 6, fontWeight: '600' }]} />
                <TextInput value={next} onChangeText={setNext} placeholder="New password" placeholderTextColor={colors.textFaint} secureTextEntry={!show} style={inputStyle} />
                <PasswordStrength password={next} />
                <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" placeholderTextColor={colors.textFaint} secureTextEntry={!show} style={inputStyle} />
                <Pressable onPress={() => setShow((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {show ? <EyeOff size={13} color={colors.textMuted} /> : <Eye size={13} color={colors.textMuted} />}
                  <AppText style={{ fontSize: 12, color: colors.textMuted }}>{show ? 'Hide' : 'Show'} passwords</AppText>
                </Pressable>
                <Pressable onPress={confirmPasswordChange} disabled={saving} style={[primaryBtn, { opacity: saving ? 0.6 : 1 }]}>
                  <AppText style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{saving ? 'Updating…' : 'Confirm & update password'}</AppText>
                </Pressable>
                <Pressable onPress={() => setPwStep(1)}>
                  <AppText style={{ fontSize: 12, color: colors.textFaint, textAlign: 'center' }}>← Start over</AppText>
                </Pressable>
              </View>
            )}
          </View>
        </Card>

        {/* NOTIFICATIONS */}
        <Card colors={colors}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={16} color={colors.brand} />
              </View>
              <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Notifications</AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>New listings</AppText>
                <AppText style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>Get notified when new items match your interests</AppText>
              </View>
              <Toggle value={notifyListings} onToggle={() => setNotifyListings((v) => !v)} colors={colors} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Messages</AppText>
                <AppText style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>Get notified when a buyer or seller messages you</AppText>
              </View>
              <Toggle value={notifyMessages} onToggle={() => setNotifyMessages((v) => !v)} colors={colors} />
            </View>
          </View>
        </Card>

        {/* REFER A FRIEND */}
        <Card colors={colors}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Gift size={16} color={colors.brand} />
              </View>
              <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Refer a friend</AppText>
            </View>
            <AppText style={{ fontSize: 12, color: colors.textFaint, marginBottom: 16 }}>
              When a friend signs up with your link, you get 25% off Pro and Premium for 24 hours. Every extra friend adds 12 more hours.
            </AppText>

            {discountActive && (
              <View style={{ backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <AppText style={{ fontSize: 14, fontWeight: '700', color: colors.warning }}>25% off Pro and Premium is active</AppText>
                <AppText style={{ fontSize: 12, color: colors.warning, marginTop: 2 }}>
                  Ends in {formatCountdown(discountExpiry - nowTs)}. Each new friend adds 12 hours.
                </AppText>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={referralLink} editable={false} style={[inputStyle, { flex: 1, fontSize: 13, color: colors.textMuted }]} />
              <Pressable onPress={copyReferralLink} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}>
                <AppText style={{ color: colors.textOnGold, fontSize: 13, fontWeight: '600' }}>Copy</AppText>
              </Pressable>
            </View>

            {referrals.length > 0 && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderMuted, gap: 8 }}>
                <AppText style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Friends you referred ({referrals.length})
                </AppText>
                {referrals.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>{r.name}</AppText>
                    <AppText style={{ fontSize: 12, color: colors.textFaint }}>
                      Joined {new Date(r.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* DANGER ZONE */}
        <Card colors={colors} borderColor={colors.error}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={16} color={colors.error} />
              </View>
              <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Danger zone</AppText>
            </View>
            <AppText style={{ fontSize: 12, color: colors.textFaint, marginBottom: 16 }}>
              Deleting your account is permanent — your listings, orders, and messages will be removed and cannot be recovered.
            </AppText>
            <Pressable onPress={() => setDeleteOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.error, alignSelf: 'flex-start' }}>
              <Trash2 size={15} color={colors.error} />
              <AppText style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>Delete my account</AppText>
            </Pressable>
          </View>
        </Card>
        </View>
      </Animated.ScrollView>

      {/* DELETE ACCOUNT MODAL */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setDeleteOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertTriangle size={20} color={colors.error} />
            </View>
            <AppText style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Delete your account?</AppText>
            <AppText style={{ fontSize: 14, color: colors.textMuted, marginTop: 6 }}>This can't be undone. Enter your password to confirm.</AppText>

            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={[inputStyle, { marginTop: 16 }]}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <Pressable onPress={() => { setDeleteOpen(false); setDeletePassword(''); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</AppText>
              </Pressable>
              <Pressable onPress={handleDeleteAccount} disabled={deleting || !deletePassword} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.error, alignItems: 'center', opacity: deleting || !deletePassword ? 0.6 : 1 }}>
                <AppText style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>{deleting ? 'Deleting…' : 'Delete account'}</AppText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SOCIAL HANDLES MODAL */}
      <Modal visible={showHandlesModal} transparent animationType="fade" onRequestClose={() => setShowHandlesModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={() => setShowHandlesModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, maxHeight: '85%', borderWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => setShowHandlesModal(false)} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
              <X size={18} color={colors.textFaint} />
            </Pressable>
            <AppText style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Add your social handles</AppText>
            <AppText style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>All optional — shown on your store page.</AppText>

            <ScrollView style={{ marginTop: 16 }}>
              {[
                { key: 'social_tiktok', label: 'TikTok', placeholder: '@yourhandle' },
                { key: 'social_whatsapp', label: 'WhatsApp', placeholder: 'e.g. 0551234567' },
                { key: 'social_instagram', label: 'Instagram', placeholder: '@yourhandle' },
                { key: 'social_snapchat', label: 'Snapchat', placeholder: '@yourhandle' },
                { key: 'social_facebook', label: 'Facebook', placeholder: 'Profile or page link' },
                { key: 'social_twitter', label: 'Twitter / X', placeholder: '@yourhandle' },
                { key: 'social_telegram', label: 'Telegram', placeholder: '@yourhandle' },
              ].map(({ key, label, placeholder }) => (
                <View key={key} style={{ marginBottom: 12 }}>
                  <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>{label}</AppText>
                  <TextInput
                    value={(handles as any)[key]}
                    onChangeText={(v) => setHandles((h) => ({ ...h, [key]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textFaint}
                    style={inputStyle}
                  />
                </View>
              ))}
            </ScrollView>

            <Pressable onPress={handleSaveHandles} disabled={savingHandles} style={[primaryBtn, { marginTop: 12, opacity: savingHandles ? 0.6 : 1 }]}>
              <AppText style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{savingHandles ? 'Updating…' : 'Update'}</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

       {/* STORE PREVIEW MODAL */}
      <Modal visible={showStorePreview} transparent animationType="fade" onRequestClose={() => setShowStorePreview(false)}>
        <Pressable
          onPress={() => setShowStorePreview(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 420,
              height: '60%',
              backgroundColor: colors.card,
              borderRadius: 24,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {/* Top bar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <AppText style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Store preview</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={() => {
                    setShowStorePreview(false);
                    router.push(`/seller/${user?.id}` as any);
                  }}
                >
                  <AppText style={{ fontSize: 13, fontWeight: '700', color: colors.brand }}>Open →</AppText>
                </Pressable>
                <Pressable onPress={() => setShowStorePreview(false)} hitSlop={10}>
                  <X size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {/* Scrollable preview */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {user?.id && <StorePage id={user.id} embedded />}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SettingsVideo({ uri }: { uri: string | number }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => { player.play(); }, [player]);
  return (
    <VideoView
      player={player}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ---- Delivery Locations sub-component ----
function DeliveryLocations({ colors, inputStyle }: { colors: any; inputStyle: any }) {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [settingDefault, setSettingDefault] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<any>(null);
  const pendingDeleteTimerRef = useRef<any>(null);

  const load = () => {
    setLoading(true);
    api.get('/locations/mine').then((res) => setLocations(res.data)).catch(() => setLocations([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!newLocation.trim()) return Toast.show({ type: 'error', text1: 'Enter a location first' });
    setAdding(true);
    try {
      await api.post('/locations', { location: newLocation.trim() });
      Toast.show({ type: 'success', text1: 'Location added' });
      setNewLocation('');
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to add location' });
    } finally {
      setAdding(false);
    }
  };

  const setDefault = async (id: any) => {
    setSettingDefault(id);
    try {
      await api.patch(`/locations/default/${id}`);
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to set default' });
    } finally {
      setSettingDefault(null);
    }
  };

  const handleDeleteClick = (id: any) => {
    if (pendingDeleteId === id) {
      clearTimeout(pendingDeleteTimerRef.current);
      setPendingDeleteId(null);
      deleteLocation(id);
      return;
    }
    setPendingDeleteId(id);
    Toast.show({ type: 'info', text1: 'Tap again to delete permanently' });
    clearTimeout(pendingDeleteTimerRef.current);
    pendingDeleteTimerRef.current = setTimeout(() => setPendingDeleteId(null), 4000);
  };

  const deleteLocation = async (id: any) => {
    setDeletingId(id);
    try {
      await api.delete(`/locations/${id}`);
      Toast.show({ type: 'success', text1: 'Location deleted' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to delete' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card colors={colors}>
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={16} color={colors.brand} />
          </View>
          <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Delivery Locations</AppText>
        </View>
        <AppText style={{ fontSize: 12, color: colors.textFaint, marginBottom: 16 }}>
          Your first saved location is used by default at checkout.
        </AppText>

        {loading ? (
          <View style={{ height: 60, borderRadius: 12, backgroundColor: colors.cardAlt }} />
        ) : locations.length === 0 ? (
          <AppText style={{ fontSize: 14, color: colors.textFaint, marginBottom: 16 }}>No saved locations yet.</AppText>
        ) : (
          <View style={{ gap: 8, marginBottom: 16 }}>
            {locations.map((loc) => (
              <View key={loc.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: loc.is_default ? colors.brand : colors.border, backgroundColor: loc.is_default ? colors.brandSoft : colors.card }}>
                <Pressable onPress={() => !loc.is_default && setDefault(loc.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: loc.is_default ? colors.brand : colors.textFaint, alignItems: 'center', justifyContent: 'center' }}>
                    {loc.is_default && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{loc.location}</AppText>
                    {loc.is_default && <AppText style={{ fontSize: 10, fontWeight: '700', color: colors.brand }}>Default</AppText>}
                  </View>
                </Pressable>
                <Pressable onPress={() => handleDeleteClick(loc.id)} disabled={deletingId === loc.id} style={{ padding: 6, borderRadius: 8, backgroundColor: pendingDeleteId === loc.id ? colors.errorSoft : 'transparent' }}>
                  <Trash2 size={16} color={pendingDeleteId === loc.id ? colors.error : colors.textFaint} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={newLocation}
            onChangeText={setNewLocation}
            placeholder="e.g. Ayeduase Gate, West End Hostel"
            placeholderTextColor={colors.textFaint}
            style={[inputStyle, { flex: 1 }]}
          />
          <Pressable onPress={handleAdd} disabled={adding} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand, opacity: adding ? 0.6 : 1 }}>
            <AppText style={{ color: colors.textOnGold, fontSize: 14, fontWeight: '600' }}>{adding ? 'Adding…' : 'Add'}</AppText>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

// ---- small helpers ----
function Card({ children, borderColor, colors }: { children: React.ReactNode; borderColor?: string; colors: any }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: borderColor || colors.border, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

function Toggle({ value, onToggle, colors }: { value: boolean; onToggle: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: value ? colors.brand : colors.chipBg,
        justifyContent: 'center',
      }}
    >
      <View style={{
        width: 20, height: 20, borderRadius: 10, backgroundColor: 'white',
        marginLeft: value ? 22 : 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
      }} />
    </Pressable>
  );
}

function SocialBtn({ bg, label, onPress, textColor = 'white' }: { bg: string; label: string; onPress: () => void; textColor?: string }) {
  return (
    <Pressable onPress={onPress} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>{label}</AppText>
    </Pressable>
  );
}