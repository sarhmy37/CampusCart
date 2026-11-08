import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { History } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import { getRecentlyViewed, ViewedItem } from '@/utils/recentlyViewed';

const CARD_W = 128;

export default function RecentlyViewed({ onHasItems }: { onHasItems?: (v: boolean) => void }) {
  const colors = useColors();
  const router = useRouter();
  const [items, setItems] = useState<ViewedItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      getRecentlyViewed().then((list) => {
        setItems(list);
        onHasItems?.(list.length > 0);
      });
    }, []),
  );

  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <History size={40} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Recently viewed
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
            Pick up where you left off.
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/product/${item.id}`)}
            style={{ width: CARD_W, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
          >
            <Image source={{ uri: item.primary_image }} style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.chipBg }} contentFit="cover" />
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.brand, fontSize: 14, fontWeight: '900', marginTop: 3 }}>
                GHS {Number(item.price || 0).toFixed(2)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}