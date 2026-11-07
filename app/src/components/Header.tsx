import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Platform, Alert, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Search, Heart, Bell, BellOff, LayoutDashboard } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useNotifications } from '@/context/NotificationContext';
import NotificationsPanel from './NotificationsPanel';
import { LOGO_DARK, LOGO_LIGHT } from '@/data/media';
import WishlistPanel from './WishlistPanel';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import AuthRollBall from './AuthRollBall';
import { onLogoBounce } from '@/utils/logoBounce';
import { useState } from 'react';

function formatBadgeCount(n: number) {
  return n > 9 ? '9+' : String(n);
}

function Badge({ count, colors }: { count: number; colors: any }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: colors.brand,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: colors.textOnGold,
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 16,
          textAlign: 'center',
          includeFontPadding: false,
        }}
      >
        {formatBadgeCount(count)}
      </Text>
    </View>
  );
}

export default function Header() {
  const colors = useColors();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isSearchScreen = pathname === '/search';
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const { unreadCount: notifUnread, markAllRead, muted } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);

  const isAdmin = user?.role === 'admin';
  const logoSrc = theme === 'dark' ? LOGO_LIGHT : LOGO_DARK;

  const logoClickCount = useRef(0);
  const logoClickTimeout = useRef<any>(null);

  // Logo animation values
  const logoY = useRef(new Animated.Value(0)).current;
  const logoSX = useRef(new Animated.Value(1)).current;
  const logoSY = useRef(new Animated.Value(1)).current;
  const logoRot = useRef(new Animated.Value(0)).current;
  const logoBusy = useRef(false);

  const playLogoAnimation = () => {
    if (logoBusy.current) return;
    logoBusy.current = true;

    const t = (v: Animated.Value, to: number, duration: number, easing?: (n: number) => number) =>
      Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 140);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 560);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 790);
    setTimeout(() => Haptics.selectionAsync().catch(() => {}), 900);

    Animated.sequence([
      // 1. anticipation: squash down
      Animated.parallel([
        t(logoSY, 0.65, 120, Easing.out(Easing.quad)),
        t(logoSX, 1.25, 120, Easing.out(Easing.quad)),
        t(logoY, 4, 120, Easing.out(Easing.quad)),
      ]),
      // 2. launch: stretch up and tilt
      Animated.parallel([
        t(logoY, -34, 230, Easing.out(Easing.cubic)),
        t(logoSY, 1.25, 230, Easing.out(Easing.cubic)),
        t(logoSX, 0.82, 230, Easing.out(Easing.cubic)),
        t(logoRot, 1, 230, Easing.out(Easing.cubic)),
      ]),
      // 3. fall: tilt the other way
      Animated.parallel([
        t(logoY, 0, 200, Easing.in(Easing.quad)),
        t(logoSY, 1, 200, Easing.in(Easing.quad)),
        t(logoSX, 1, 200, Easing.in(Easing.quad)),
        t(logoRot, -1, 200, Easing.in(Easing.quad)),
      ]),
      // 4. landing squash
      Animated.parallel([
        t(logoSY, 0.72, 70, Easing.out(Easing.quad)),
        t(logoSX, 1.22, 70, Easing.out(Easing.quad)),
        t(logoRot, 0.5, 70),
      ]),
      // 5. small rebound
      Animated.parallel([
        t(logoY, -12, 130, Easing.out(Easing.quad)),
        t(logoSY, 1.1, 130, Easing.out(Easing.quad)),
        t(logoSX, 0.94, 130, Easing.out(Easing.quad)),
        t(logoRot, -0.6, 130),
      ]),
      Animated.parallel([
        t(logoY, 0, 110, Easing.in(Easing.quad)),
        t(logoSY, 0.88, 110, Easing.in(Easing.quad)),
        t(logoSX, 1.1, 110, Easing.in(Easing.quad)),
        t(logoRot, 0.3, 110),
      ]),
      // 6. settle with jelly wobble
      Animated.parallel([
        Animated.spring(logoSY, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
        Animated.spring(logoSX, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
        Animated.spring(logoRot, { toValue: 0, friction: 3, tension: 120, useNativeDriver: true }),
      ]),
    ]).start(() => {
      logoBusy.current = false;
    });
  };

  // Play the animation every time the app loads / reloads
  useEffect(() => {
    const id = setTimeout(playLogoAnimation, 500);
    const unsub = onLogoBounce(playLogoAnimation);
    return () => {
      clearTimeout(id);
      unsub();
    };
  }, []);

  const logoRotate = logoRot.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  const resetLogoCounter = () => {
    if (logoClickTimeout.current) clearTimeout(logoClickTimeout.current);
    logoClickTimeout.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 3000);
  };

  const handleAdminLogout = () => {
    Alert.alert(
      'Log out of Admin?',
      "You'll be redirected to the login screen.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            Toast.show({ type: 'success', text1: 'Logged out successfully.' });
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleLogoPress = () => {
    const next = logoClickCount.current + 1;
    logoClickCount.current = next;

    if (isAdmin) {
      // Admin: 5 taps → confirm logout
      if (next === 5) {
        logoClickCount.current = 0;
        handleAdminLogout();
        return;
      }
    } else {
      // Regular user (or logged out): 5 taps → admin login
      if (next === 5) {
        logoClickCount.current = 0;
        router.push('/admin-login');
        return;
      }
    }

    playLogoAnimation();
    resetLogoCounter();
  };

  const toggleNotifications = () => {
    if (showNotifications) {
      closeNotifications();
    } else {
      setShowNotifications(true);
    }
  };

  const closeNotifications = () => {
    setShowNotifications(false);
    markAllRead();
  };

  if (pathname?.toLowerCase().startsWith('/spotlightprofile')) return null;

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: SCREEN_PADDING_X,
          paddingVertical: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* Logo */}
        <Pressable onPress={handleLogoPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {logoSrc && (
            <Animated.View
              style={{
                zIndex: 10,
                transform: [
                  { translateY: logoY },
                  { rotate: logoRotate },
                  { scaleX: logoSX },
                  { scaleY: logoSY },
                ],
              }}
            >
              <Image
                source={logoSrc}
                style={{ width: 44, height: 44, marginRight: 8 }}
                contentFit="contain"
                cachePolicy="disk"
              />
            </Animated.View>
          )}
        </Pressable>

        {/* Search bar — hidden on /search screen */}
        {isSearchScreen ? (
          <View style={{ flex: 1 }} />
        ) : (
          <Pressable
            onPress={() => router.push('/search')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.chipBg,
            }}
          >
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: colors.textFaint }}>
              Search textbooks, electronics...
            </Text>
            <Search size={16} color={colors.textFaint} strokeWidth={2} />
          </Pressable>
        )}

        {/* Icon row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, flexShrink: 0 }}>
          {user && !isAdmin && (
            <Pressable onPress={() => setShowWishlist(true)} style={{ padding: 6, position: 'relative' }}>
              <Heart size={16} color={colors.textSecondary} strokeWidth={2} />
              <Badge count={wishlistCount} colors={colors} />
            </Pressable>
          )}

          {user && (
            <Pressable onPress={toggleNotifications} style={{ padding: 6, position: 'relative' }}>
              {muted
                ? <BellOff size={16} color={colors.textFaint} strokeWidth={2} />
                : <Bell size={16} color={colors.textSecondary} strokeWidth={2} />}
              <Badge count={muted ? 0 : notifUnread} colors={colors} />
            </Pressable>
          )}

          {isAdmin && (
            <Pressable
              onPress={() => router.push('/admin')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brandSoft,
              }}
            >
              <LayoutDashboard size={16} color={colors.brand} />
            </Pressable>
          )}

          {!user && <AuthRollBall startIndex={0} />}
        </View>
      </View>

      <NotificationsPanel visible={showNotifications} onClose={closeNotifications} />
      <WishlistPanel visible={showWishlist} onClose={() => setShowWishlist(false)} />
    </>
  );
}