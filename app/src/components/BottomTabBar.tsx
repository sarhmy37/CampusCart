import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { UserIcon as UserOutline, HomeModernIcon as HomeOutline, ChatBubbleLeftRightIcon as ChatOutline, ShoppingCartIcon as CartOutline, GlobeAltIcon as StoriesOutline } from 'react-native-heroicons/outline';
import { UserIcon as UserSolid, HomeModernIcon as HomeSolid, ChatBubbleLeftRightIcon as ChatSolid, ShoppingCartIcon as CartSolid, GlobeAltIcon as StoriesSolid } from 'react-native-heroicons/solid';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { useChat } from '@/context/ChatContext';

const TABS = [
  { key: 'cart', label: 'Cart', outline: CartOutline, solid: CartSolid, route: '/cart' },
  { key: 'stories', label: 'Stories', outline: StoriesOutline, solid: StoriesSolid, route: '/stories' },
  { key: 'home', label: 'Home', outline: HomeOutline, solid: HomeSolid, route: '/' },
  { key: 'messages', label: 'Messages', outline: ChatOutline, solid: ChatSolid, route: '/chat' },
  { key: 'profile', label: 'Profile', outline: UserOutline, solid: UserSolid, route: '/profile' },
];

const PROFILE_ROUTES = ['/profile', '/dashboard', '/settings', '/benefits', '/contact', '/terms', '/privacy'];

export default function BottomTabBar() {
  const colors = useColors();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { count: cartCount } = useCart();
  const { unreadCount: chatUnread } = useChat();

  const badgeFor = (key: string) => {
    if (key === 'cart') return cartCount;
    if (key === 'messages') return chatUnread;
    return 0;
  };

  const isProfileRoute = PROFILE_ROUTES.some((r) => pathname.startsWith(r));

  const isActive = (route: string) => {
    if (route === '/profile') return isProfileRoute;
    if (route === '/') return pathname === '/';
    return pathname.startsWith(route);
  };

  const content = (
    <View style={{ flexDirection: 'row', height: 56 }}>
      {TABS.map((tab) => {
        const active = isActive(tab.route);
        const Icon = active ? tab.solid : tab.outline;
        const badge = badgeFor(tab.key);
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (!active) router.navigate(tab.route as any);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <View style={{ position: 'relative' }}>
              <Icon
                size={active ? 22 : 18}
                color={active ? colors.brand : colors.textFaint}
              />
{badge > 0 && (
  <View
    style={{
      position: 'absolute', top: -4, right: -8,
      backgroundColor: colors.brand,
      minWidth: 16, height: 16, borderRadius: 8,
      paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center',
    }}
  >
    <Text style={{ color: colors.textOnGold, fontSize: 10, fontWeight: '700' }}>
      {badge > 9 ? '9+' : badge}
    </Text>
  </View>
)}
            </View>
            <Text
              style={{
                fontSize: 9.5,
                fontWeight: active ? '700' : '500',
                color: active ? colors.brand : colors.textFaint,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={{
        position: 'absolute',
        left: 0, right: 0,
        bottom: 0,
        zIndex: 200,
        borderTopWidth: 1,
        borderTopColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
        shadowRadius: 12,
        elevation: Platform.OS === 'android' ? 0 : 12,
      }}
    >
      <View
        style={{
          paddingBottom: insets.bottom,
          backgroundColor: colors.card,
        }}
      >
        {content}
      </View>
    </View>
  );
}