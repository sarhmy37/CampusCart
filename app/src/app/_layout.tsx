import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Dimensions, Pressable, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatModal from '@/components/ChatModal';
import Toast, { SuccessToast, ErrorToast, InfoToast } from 'react-native-toast-message';
import BottomTabBar from '@/components/BottomTabBar';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import Header from '@/components/Header';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ChatProvider } from '@/context/ChatContext';
import { CallProvider } from '@/context/CallContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/context/ThemeContext';
import { FontProvider } from '@/context/FontContext';
import { ReviewPromptProvider } from '@/context/ReviewPromptContext';
import { Colors } from '@/constants/theme';
import '../global.css';
import SessionRevokedModal from '@/components/SessionRevokedModal';
import PostPurchaseReviewModal from '@/components/PostPurchaseReviewModal';
import OnboardingTour from '@/components/OnboardingTour';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter, usePathname } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function ThemedToast({ ToastComponent, ...props }: any) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const { hide } = props;
  const { width } = Dimensions.get('window');
  const toastHeight = 60;
  const blurTopMargin = 64;
  const blurBottomMargin = 36;

  return (
    <View style={{ width, minHeight: 60, position: 'relative', alignItems: 'center' }}>
      <Pressable
        onPress={hide}
        style={{
          position: 'absolute',
          width,
          height: toastHeight + blurTopMargin + blurBottomMargin,
          top: -blurTopMargin,
          left: 0,
          zIndex: 0,
          elevation: 0,
        }}
      >
        <MaskedView
          style={{ flex: 1 }}
          maskElement={
            <LinearGradient
              colors={['transparent', '#000000', '#000000', 'transparent']}
              locations={[
                0,
                blurTopMargin / (toastHeight + blurTopMargin + blurBottomMargin),
                (blurTopMargin + toastHeight) / (toastHeight + blurTopMargin + blurBottomMargin),
                1,
              ]}
              style={{ flex: 1 }}
            />
          }
        >
          <BlurView
            intensity={24}
            tint={theme === 'dark' ? 'dark' : 'light'}
            style={{ flex: 1 }}
          />
        </MaskedView>
      </Pressable>
      <View style={{ zIndex: 1, elevation: 1 }}>
        <ToastComponent
          {...props}
          text1NumberOfLines={0}
          text2NumberOfLines={0}
          style={{
            height: undefined,
            minHeight: 60,
            paddingVertical: 10,
            backgroundColor: colors.card,
            borderLeftColor: colors.brand,
          }}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          text1Style={{
            color: isDark ? '#ffffff' : '#000000',
            fontSize: 14,
            fontWeight: '700',
          }}
          text2Style={{
            color: isDark ? colors.brandDark : '#000000',
            fontSize: 12.5,
          }}
        />
      </View>
    </View>
  );
}

const toastConfig = {
  success: (props: any) => (
    <ThemedToast ToastComponent={SuccessToast} {...props} />
  ),
  error: (props: any) => (
    <ThemedToast ToastComponent={ErrorToast} {...props} />
  ),
  info: (props: any) => (
    <ThemedToast ToastComponent={InfoToast} {...props} />
  ),
};

// Every Toast.show gets a visible time based on how long its text is (min 4s, max 12s),
// unless the caller already set visibilityTime.
const originalShow = Toast.show.bind(Toast);
Toast.show = (options: any) => {
  const len = String(options?.text1 || '').length + String(options?.text2 || '').length;
  const time = Math.min(12000, Math.max(4000, 2500 + len * 60));
  return originalShow({ visibilityTime: time, ...options });
};

const TAB_BAR_HEIGHT = 56;

function ThemedShell() {
  const { theme } = useTheme();
  const colors = Colors[theme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const hideTabs = pathname?.toLowerCase().startsWith('/spotlightprofile');

  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !url.startsWith('app://payment/callback')) return;
      const isCancel = url.includes('status=cancel');
      const boostRefMatch = url.match(/[?&]boost_ref=([^&]+)/);
      const boostRef = boostRefMatch ? decodeURIComponent(boostRefMatch[1]) : null;

      if (boostRef) {
        if (isCancel) {
          Toast.show({ type: 'info', text1: 'Boost payment cancelled' });
          router.replace('/browse');
        } else {
          Toast.show({ type: 'success', text1: 'Payment received!' });
          router.replace(`/browse?boost_ref=${boostRef}`);
        }
        return;
      }

      if (isCancel) {
        Toast.show({ type: 'info', text1: 'Payment cancelled' });
        router.replace('/cart');
      } else {
        Toast.show({ type: 'success', text1: 'Payment received!' });
        router.replace('/dashboard?tab=orders');
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const bottomInset = user && !isAdmin && !hideTabs ? TAB_BAR_HEIGHT + insets.bottom : 0;

  return (
    <>
      <AnimatedSplashOverlay />
      <SessionRevokedModal />

      {!hideTabs && (
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
          <Header />
        </SafeAreaView>
      )}

      <View style={{ flex: 1, paddingBottom: bottomInset }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(browse)" />
          <Stack.Screen name="browse" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="service/[id]" />
          <Stack.Screen name="orders/[id]" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="search" />
          <Stack.Screen
            name="profile"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="cart" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="login" />
          <Stack.Screen name="SpotlightProfile" />
          <Stack.Screen name="register" />
          <Stack.Screen name="stories" />
          <Stack.Screen
            name="seller/[id]"
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              headerShown: false,
            }}
          />
          <Stack.Screen name="benefits" />
          <Stack.Screen name="contact" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="sell" />
          <Stack.Screen name="help" />
          <Stack.Screen name="admin-login" />
          <Stack.Screen name="sellers" />
          <Stack.Screen name="admin" />
        </Stack>
      </View>

      {user && !isAdmin && !hideTabs && <BottomTabBar />}
      <ChatModal />
      <PostPurchaseReviewModal />
      <OnboardingTour />

      <Toast topOffset={64} config={toastConfig} />
    </>
  );
}

function NavThemeSync({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <NavThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <FontProvider>
        <NavThemeSync>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <ChatProvider>
                  <NotificationProvider>
                    <CallProvider>
                      <ReviewPromptProvider>
                        <ThemedShell />
                      </ReviewPromptProvider>
                    </CallProvider>
                  </NotificationProvider>
                </ChatProvider>
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </NavThemeSync>
      </FontProvider>
    </AppThemeProvider>
  );
}