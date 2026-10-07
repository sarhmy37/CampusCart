import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function AdminLogin() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Enter email and password' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/admin/auth/login', { email: email.trim(), password });
      await AsyncStorage.setItem('cc_token', res.data.token);
      await AsyncStorage.setItem('cc_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      Toast.show({ type: 'success', text1: 'Welcome, Admin' });
      router.replace('/admin');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Invalid credentials' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 14,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            padding: 24,
          }}
        >
          <View
            style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: colors.text,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ShieldCheck size={20} color={colors.card} />
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            Admin Login
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
            Restricted access.
          </Text>

          <View style={{ marginTop: 20, gap: 12 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Admin email"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              style={inputStyle}
            />
            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: colors.text,
                alignItems: 'center',
                marginTop: 4,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={{ color: colors.card, fontWeight: '700', fontSize: 14 }}>
                  Log in
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}