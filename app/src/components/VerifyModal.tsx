import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { X, Mail, CheckCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function VerifyModal({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const colors = useColors();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [inputCode, setInputCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Reset when opened/closed
  useEffect(() => {
    if (!open) {
      setStep('start');
      setInputCode('');
    }
  }, [open]);

  const handleSendCode = async () => {
    setSending(true);
    try {
      await api.post('/auth/me/send-verification');
      setStep('code');
      Toast.show({ type: 'success', text1: 'Verification code sent to your email' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to send code' });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.post('/auth/me/verify', { code: inputCode });
      await AsyncStorage.setItem('cc_user', JSON.stringify(res.data));
      setUser(res.data);
      Toast.show({ type: 'success', text1: "You're verified!" });
      handleClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Incorrect code' });
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setStep('start');
    setInputCode('');
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleClose}
            style={{ position: 'absolute', top: 14, right: 14, padding: 6, zIndex: 10 }}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>

          {step === 'start' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                  Verify your account
                </Text>
                <CheckCircle size={18} color={colors.success} />
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 }}>
                We'll email a 6-digit code to confirm this is really you.
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: colors.chipBg,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  marginTop: 16,
                }}
              >
                <Mail size={16} color={colors.textFaint} />
                <Text
                  style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }}
                  numberOfLines={1}
                >
                  {user?.university_email}
                </Text>
              </View>

              <Pressable
                onPress={handleSendCode}
                disabled={sending}
                style={{
                  marginTop: 20,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                  alignItems: 'center',
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textOnGold} />
                ) : (
                  <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                    Send verification code
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                Enter your code
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 }}>
                Check your inbox — the code expires in 10 minutes.
              </Text>

              <TextInput
                value={inputCode}
                onChangeText={(v) => setInputCode(v.replace(/\D/g, ''))}
                placeholder="6-digit code"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={6}
                style={{
                  marginTop: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                  letterSpacing: 6,
                  textAlign: 'center',
                }}
              />

              <Pressable
                onPress={handleVerify}
                disabled={verifying || inputCode.length !== 6}
                style={{
                  marginTop: 16,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                  alignItems: 'center',
                  opacity: verifying || inputCode.length !== 6 ? 0.5 : 1,
                }}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={colors.textOnGold} />
                ) : (
                  <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
                    Verify
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleSendCode}
                disabled={sending}
                style={{ marginTop: 8, paddingVertical: 8, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textFaint }}>
                  {sending ? 'Sending…' : "Didn't get it? Send again"}
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}