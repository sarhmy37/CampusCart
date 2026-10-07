import { useRef } from 'react';
import { View, Text, Pressable, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Search, Heart, Bell, LayoutDashboard } from 'lucide-react-native';
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
          fontSize: 10,
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
  const { unreadCount: notifUnread, markAllRead } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);

  const isAdmin = user?.role === 'admin';
  const logoSrc = theme === 'dark' ? LOGO_LIGHT : LOGO_DARK;

  const logoClickCount = useRef(0);
  const logoClickTimeout = useRef<any>(null);

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
      // Regular user (or logged out): 5 taps → admin login, else → home
      if (next === 5) {
        logoClickCount.current = 0;
        router.push('/admin-login');
        return;
      }
      router.push('/');
    }

    resetLogoCounter();
  };

  const toggleNotifications = () => {
    setShowNotifications((s) => {
      const next = !s;
      if (next) markAllRead();
      return next;
    });
  };

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
            <Image
              source={logoSrc}
              style={{ width: 28, height: 28, marginRight: 4 }}
              contentFit="contain"
              cachePolicy="disk"
            />
          )}
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>Tre</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, marginHorizontal: 1, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>-</Text>
          <Text style={{ fontSize: 24, fontWeight: '900', fontStyle: 'italic', color: colors.brand, marginLeft: 1, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>X</Text>
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
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: colors.textFaint }}>
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
              <Bell size={16} color={colors.textSecondary} strokeWidth={2} />
              <Badge count={notifUnread} colors={colors} />
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

      <NotificationsPanel visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <WishlistPanel visible={showWishlist} onClose={() => setShowWishlist(false)} />
    </>
  );
}