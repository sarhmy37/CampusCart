import { View, Text, Modal, Pressable, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useColors } from '@/hooks/useColors';
import { Toast } from 'react-native-toast-message/lib/src/Toast';

export default function WishlistPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { items, removeItem } = useWishlist();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight }} onPress={onClose}>
        <View
          style={{
            position: 'absolute',
            top: 90,
            left: 12,
            right: 12,
            maxHeight: 420,
            backgroundColor: colors.card,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderMuted }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Wishlist</Text>
          </View>

          {items.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, paddingVertical: 32, textAlign: 'center', fontSize: 14, color: colors.textFaint }}>
              Nothing saved yet. Tap the heart on any listing to add it here.
            </Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item: p }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderMuted }}>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/product/${p.id}`);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
                  >
                    {p.primary_image ? (
                      <Image source={{ uri: p.primary_image }} style={{ width: 48, height: 48, borderRadius: 12 }} />
                    ) : null}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        {p.title}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                        GHS {parseFloat(p.price).toFixed(2)} · {p.condition}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                        {p.seller_name}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => removeItem(p.id)} style={{ padding: 6 }}>
                    <Trash2 size={16} color={colors.textFaint} />
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      </Pressable>
      <Toast />
    </Modal>
  );
}