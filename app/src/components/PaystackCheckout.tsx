import { useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

const DARK_MODE_JS = `
(function () {
  var css = 'html{filter:invert(1) hue-rotate(180deg);background:#fff;} img,video,canvas,picture{filter:invert(1) hue-rotate(180deg);}';
  var s = document.createElement('style');
  s.innerHTML = css;
  (document.head || document.documentElement).appendChild(s);
})();
true;
`;

type Props = {
  visible: boolean;
  authorizationUrl: string | null;
  callbackUrl: string;            // the same callback_url you pass to Paystack on initialize
  onSuccess: (reference: string) => void;
  onClose: () => void;            // user cancelled / closed
};

export default function PaystackCheckout({ visible, authorizationUrl, callbackUrl, onSuccess, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);

  const handleNav = (url: string) => {
    // Paystack redirects here after payment
    if (url.startsWith(callbackUrl)) {
      if (/[?&]status=cancel/.test(url)) {
        onClose();
        return false;
      }
      const ref = /[?&](?:reference|trxref)=([^&]+)/.exec(url)?.[1];
      onSuccess(ref ? decodeURIComponent(ref) : '');
      return false; // don't actually load your callback page
    }
    // Paystack's own "close" redirect
    if (url.includes('paystack.co/close')) {
      onClose();
      return false;
    }
    return true;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>Secure payment</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.text} />
          </Pressable>
        </View>

        {authorizationUrl && (
          <WebView
            source={{ uri: authorizationUrl }}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={(req) => handleNav(req.url)}
            javaScriptEnabled
            domStorageEnabled
            injectedJavaScriptBeforeContentLoaded={isDark ? DARK_MODE_JS : undefined}
            forceDarkOn={isDark}
            style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}
          />
        )}

        {loading && (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        )}
      </View>
    </Modal>
  );
}