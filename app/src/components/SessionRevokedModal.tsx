import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import ReportModal from './ReportModal';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { emitter, SESSION_REVOKED_EVENT } from '@/api/client';

export default function SessionRevokedModal() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    emitter.on(SESSION_REVOKED_EVENT, handler);
    return () => {
      emitter.off(SESSION_REVOKED_EVENT, handler);
    };
  }, []);

  if (!show) return null;

  if (showReport) {
    return (
      <ReportModal
        open={showReport}
        onClose={async () => {
          setShowReport(false);
          setShow(false);
          await AsyncStorage.removeItem('cc_token');
          await AsyncStorage.removeItem('cc_user');
          router.replace('/login');
        }}
        productId={null}
        reportedUserId={user?.id || null}
        publicReporterId={user?.id || null}
        initialReason="account_security"
        initialDetails="My account was accessed from another device without my knowledge."
      />
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 300,
        backgroundColor: 'rgba(15,23,42,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 340,
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.errorSoft,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <ShieldAlert size={26} color={colors.error} />
        </View>

        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
          Signed out — new login detected
        </Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>
          Your account was accessed on another device, so this session was signed out.
          If this wasn't you, report it immediately.
        </Text>

        <Pressable
          onPress={() => setShowReport(true)}
          style={{
            width: '100%',
            marginTop: 20,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.error,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
            Report this — it wasn't me
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await AsyncStorage.removeItem('cc_token');
            await AsyncStorage.removeItem('cc_user');
            setShow(false);
            router.replace('/login');
          }}
          style={{
            width: '100%',
            marginTop: 8,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
            Okay, take me to login
          </Text>
        </Pressable>
      </View>
    </View>
  );
}