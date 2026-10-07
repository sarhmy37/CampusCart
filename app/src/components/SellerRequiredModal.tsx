import { View, Text, Pressable, Modal } from 'react-native';
import { Store, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function SellerRequiredModal({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();

  const handleGoToRegister = () => {
    onClose();
    router.push('/register?tab=seller');
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
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
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 28 }}>
            <Store size={20} color={colors.brand} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 }}>
              Seller account required
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{ position: 'absolute', top: 16, right: 16 }}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>

          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 10, lineHeight: 20 }}>
            Your account is set up for buying. To list and sell items, you'll need a seller account.
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleGoToRegister}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: 10,
                backgroundColor: colors.brand,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textOnGold }}>
                Sign up as Seller
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}