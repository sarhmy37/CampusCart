import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Megaphone } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';

const CARD_W = 128;

export default function SponsoredProducts({ onHasProducts }: { onHasProducts?: (value: boolean) => void }) {
  const colors = useColors();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    api.get('/products/showcase')
      .then((res) => setProducts((res.data || []).filter((item: any) => item.primary_image).slice(0, 12)))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    onHasProducts?.(products.length > 0);
  }, [products.length, onHasProducts]);

  if (products.length === 0) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Megaphone size={40} color={colors.brand} strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Featured on Antika
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
            Promoted picks and standout sellers worth discovering.
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            onPress={() => router.push(`/product/${product.id}`)}
            style={{
              width: CARD_W,
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.chipBg }}>
              <Image source={{ uri: product.primary_image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: colors.brand, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textOnGold }}>
                  {product.boosted ? 'SPONSORED' : 'FEATURED'}
                </Text>
              </View>
            </View>
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                {product.title}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: colors.brand, marginTop: 3 }}>
                GHS {Number(product.price || 0).toFixed(2)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
