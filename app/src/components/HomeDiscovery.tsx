import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';

const CARD_W = 128;

export default function HomeDiscovery({ onHasItems }: { onHasItems?: (v: boolean) => void }) {
  const colors = useColors();
  const router = useRouter();
  const [fresh, setFresh] = useState<any[]>([]);

  useEffect(() => {
    api.get('/products', { params: { contentType: 'new', excludeServices: true } })
      .then((res) => setFresh((res.data || []).slice(0, 12)))
      .catch(() => setFresh([]));
  }, []);

  const shownFresh = useMemo(
    () => fresh.filter((item) => item.primary_image && item.status !== 'hidden'),
    [fresh],
  );

  useEffect(() => {
    onHasItems?.(shownFresh.length > 0);
  }, [shownFresh.length]);

  if (shownFresh.length === 0) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Sparkles size={40} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Fresh this week
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
            New listings from students on campus.
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(browse)/all?newOnly=true' as any)} hitSlop={8}>
          <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '800' }}>See all</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {shownFresh.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/product/${item.id}`)}
            style={{ width: CARD_W, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
          >
            <Image source={{ uri: item.primary_image }} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" />
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
