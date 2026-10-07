import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, Animated, Easing, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const AnimatedImage = Animated.createAnimatedComponent(ExpoImage);
import { Link, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { LOGO_DARK, LOGO_LIGHT } from '@/data/media';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

const LOGO_FULL = 'Tre-X';
const TAGLINE_FULL = 'Redefining Campus Shopping';
const TYPE_SPEED_MS = 50;
const PULSE_ALONE_MS = 800;
const HOLD_MS = 10000;

export default function LoginScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const logoSrc = theme === 'dark' ? LOGO_LIGHT : LOGO_DARK;

  // pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 1750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const pulseOpacity = pulse.interpolate({ inputRange: [1, 1.35], outputRange: [0.55, 1] });

  // typewriter sequence
  const [phase, setPhase] = useState<'pulse' | 'typing-logo' | 'typing-tagline' | 'hold'>('pulse');
  const [logoText, setLogoText] = useState('');
  const [taglineText, setTaglineText] = useState('');
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    setPhase('pulse'); setLogoText(''); setTaglineText('');
    const t = setTimeout(() => setPhase('typing-logo'), PULSE_ALONE_MS);
    return () => clearTimeout(t);
  }, [cycle]);

  useEffect(() => {
    if (phase !== 'typing-logo') return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setLogoText(LOGO_FULL.slice(0, i));
      if (i >= LOGO_FULL.length) { clearInterval(interval); setPhase('typing-tagline'); }
    }, TYPE_SPEED_MS);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'typing-tagline') return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTaglineText(TAGLINE_FULL.slice(0, i));
      if (i >= TAGLINE_FULL.length) { clearInterval(interval); setPhase('hold'); }
    }, TYPE_SPEED_MS);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'hold') return;
    const t = setTimeout(() => setCycle((c) => c + 1), HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const isShifted = phase !== 'pulse';

  const onSubmit = async () => {
    if (!form.identifier || !form.password) return;
    setLoading(true);
    try {
      const loggedInUser = await login(form.identifier, form.password);
      Toast.show({ type: 'success', text1: `Welcome back, ${loggedInUser.name}!` });
      router.replace('/');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Login failed', text2: err?.response?.data?.error || 'Check your internet connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    height: 46, paddingLeft: 40, paddingRight: 16, paddingVertical: 0,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBg, color: colors.text, fontSize: 14,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, paddingHorizontal: SCREEN_PADDING_X, paddingVertical: 40, justifyContent: 'center' }}>

            {/* Animated logo */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ translateX: isShifted ? -8 : 0 }] }}>
                  {logoSrc && (
                    <AnimatedImage
                      source={logoSrc}
                      style={{ width: 48, height: 48, transform: [{ scale: pulse }], opacity: pulseOpacity }}
                      contentFit="contain"
                      cachePolicy="disk"
                    />
                  )}
                </Animated.View>

                <View style={{ marginLeft: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>
                      {logoText.slice(0, 3)}
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, marginHorizontal: 2, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>
                      {logoText.slice(3, 4)}
                    </Text>
                    <Text style={{ fontSize: 30, fontWeight: '900', fontStyle: 'italic', color: colors.brand, fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined }}>
                      {logoText.slice(4, 5)}
                    </Text>
                    {phase === 'typing-logo' && (
                      <View style={{ width: 2, height: 20, backgroundColor: colors.text, marginLeft: 4 }} />
                    )}
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 12, color: colors.textMuted, minHeight: 16 }}>
                    {taglineText}
                    {phase === 'typing-tagline' && <Text style={{ color: colors.textMuted }}>|</Text>}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card */}
            <View style={{
              backgroundColor: colors.card,
              borderWidth: 1, borderColor: colors.border,
              borderRadius: 24, padding: 24,
            }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center' }}>Welcome back</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>
                Log in with your email or username.
              </Text>

              {/* Identifier */}
              <Text style={{ marginTop: 24, fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Email or Username</Text>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Mail size={16} color={colors.textFaint} />
                </View>
                <TextInput
                  value={form.identifier}
                  onChangeText={(v) => setForm({ ...form, identifier: v })}
                  placeholder="campusking"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  style={inputStyle}
                />
              </View>

              {/* Password */}
              <Text style={{ marginTop: 16, fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Password</Text>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <Lock size={16} color={colors.textFaint} />
                </View>
                <TextInput
                  value={form.password}
                  onChangeText={(v) => setForm({ ...form, password: v })}
                  secureTextEntry={!showPassword}
                  style={[inputStyle, { paddingRight: 40 }]}
                />
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} color={colors.textFaint} /> : <Eye size={16} color={colors.textFaint} />}
                </Pressable>
              </View>

              <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                <Link href="/forgot-password" asChild>
                  <Pressable>
                    <Text style={{ fontSize: 12, color: colors.brand, fontWeight: '600' }}>Forgot password?</Text>
                  </Pressable>
                </Link>
              </View>

              <Pressable
                onPress={onSubmit}
                disabled={loading}
                style={{
                  marginTop: 16, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: colors.brand, alignItems: 'center',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                  {loading ? 'Logging in…' : 'Log in'}
                </Text>
              </Pressable>

              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>
                  Don't have an account?{' '}
                  <Text
                    onPress={() => router.push('/register')}
                    style={{ color: colors.brand, fontWeight: '600' }}
                  >
                    Sign up
                  </Text>
                </Text>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* Floating back button — outside ScrollView so it doesn't move */}
        <Pressable
          onPress={() => router.replace('/')}
          style={{
            position: 'absolute',
            bottom: 40,
            right: 40,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 100,
          }}
        >
          <ArrowLeft size={16} color={colors.textOnGold} />
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}