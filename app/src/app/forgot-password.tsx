import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import PasswordStrength, { isPasswordValid } from '@/components/PasswordStrength';

export default function ForgotPassword() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Enter your email' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { university_email: email.trim() });
      Toast.show({ type: 'success', text1: 'If that account exists, a code was sent.' });
      setStep('reset');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Passwords do not match' });
      return;
    }
    if (!isPasswordValid(newPassword)) {
      Toast.show({ type: 'error', text1: 'Password must be 8+ chars with letter, number, symbol' });
      return;
    }
    if (code.length !== 6) {
      Toast.show({ type: 'error', text1: 'Enter the 6-digit code' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        university_email: email.trim(),
        code,
        new_password: newPassword,
      });
      Toast.show({ type: 'success', text1: 'Password reset! Please log in.' });
      router.replace('/login');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 14,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 24 }}
        >
          <ArrowLeft size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Back</Text>
        </Pressable>

        {step === 'request' ? (
          <>
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
              Reset your password
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6 }}>
              Enter your university email and we'll send you a reset code.
            </Text>

            <View style={{ marginTop: 28, gap: 16 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                  University Email
                </Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <Mail size={16} color={colors.textFaint} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@st.knust.edu.gh"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={inputStyle}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleRequestCode}
                disabled={loading}
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                  alignItems: 'center',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.textOnGold} />
                ) : (
                  <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                    Send reset code
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={{ alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Already have your code?{' '}
              </Text>
              <Pressable onPress={() => setStep('reset')}>
                <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '600' }}>
                  Enter it here
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
              Enter your code
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6 }}>
              Check your email for the 6-digit reset code, then set a new password.
            </Text>

            <View style={{ marginTop: 28, gap: 16 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                  University Email
                </Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <Mail size={16} color={colors.textFaint} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@st.knust.edu.gh"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={inputStyle}
                  />
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                  Reset Code
                </Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <KeyRound size={16} color={colors.textFaint} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                    placeholder="123456"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[inputStyle, { letterSpacing: 6, fontWeight: '600' }]}
                  />
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                  New Password
                </Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <Lock size={16} color={colors.textFaint} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textFaint}
                    secureTextEntry={!showPassword}
                    style={[inputStyle, { paddingRight: 44 }]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((s) => !s)}
                    style={{ position: 'absolute', right: 14, padding: 4 }}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={colors.textFaint} />
                    ) : (
                      <Eye size={16} color={colors.textFaint} />
                    )}
                  </Pressable>
                </View>
                <PasswordStrength password={newPassword} />
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                  Confirm New Password
                </Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <Lock size={16} color={colors.textFaint} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textFaint}
                    secureTextEntry={!showPassword}
                    style={inputStyle}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleResetPassword}
                disabled={loading}
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                  alignItems: 'center',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.textOnGold} />
                ) : (
                  <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                    Reset password
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={{ alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Didn't get a code?{' '}
              </Text>
              <Pressable onPress={() => setStep('request')}>
                <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '600' }}>
                  Send again
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={{ alignItems: 'center', marginTop: 32, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            Remembered your password?{' '}
          </Text>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '600' }}>
              Log in
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}