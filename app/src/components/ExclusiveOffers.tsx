import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Flame } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import { getExclusiveOffers } from '@/utils/exclusiveOffers';

const CARD_W = 128;

const DESCRIPTION =
  "Products priced way below similar items on Browse.\nGrab them before they're gone.";

// Types the text out, pauses, deletes it backwards (faster), pauses, repeats.
function useTypewriter(text: string, start: boolean, speed = 15, deleteSpeed = 5, pauseMs = 7000) {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  useEffect(() => {
    if (!start) return;

    if (phase === 'typing') {
      if (count < text.length) {
        const t = setTimeout(() => setCount((c) => c + 1), speed);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('deleting'), pauseMs);
      return () => clearTimeout(t);
    }

    if (phase === 'deleting') {
      if (count > 0) {
        const t = setTimeout(() => setCount((c) => c - 1), deleteSpeed);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('typing'), 400);
      return () => clearTimeout(t);
    }
  }, [start, count, phase, text, speed, deleteSpeed, pauseMs]);

  return count;
}

export default function ExclusiveOffers({ active = false, onHasOffers }: { active?: boolean; onHasOffers?: (v: boolean) => void }) {
  const colors = useColors();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    api.get('/products')
      .then((res) => setProducts(res.data || []))
      .catch(() => {});
  }, []);

  const offers = useMemo(() => getExclusiveOffers(products), [products]);

  useEffect(() => {
    onHasOffers?.(offers.length > 0);
  }, [offers.length]);

  // Must stay above the early return below (hooks can't be called after it)
  const typedCount = useTypewriter(DESCRIPTION, active);

  if (offers.length === 0) {
    const steps = [
      { title: 'Verify with your university email', desc: 'Sign up in seconds. Your university email confirms you’re a real student — no strangers, no spam accounts.' },
      { title: 'Chat, ask, agree', desc: 'Message the seller directly. Ask about condition, haggle a little, agree a spot on campus.' },
      { title: 'Meet up & swap', desc: 'Pay however you’ve agreed, hand it over, leave a review. Simple as that.' },
    ];
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 24, backgroundColor: colors.card }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand, letterSpacing: 0.7, textTransform: 'uppercase' }}>
          How it works
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4 }}>
          From listing to handshake, in three steps
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          {steps.map((s, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 30, fontWeight: '900', color: colors.textFaint, lineHeight: 30, marginBottom: 4 }}>
                {i + 1}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 4, textAlign: 'center' }}>
                {s.title}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, lineHeight: 14, textAlign: 'center', maxWidth: 110 }}>
                {s.desc}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Flame size={40} color={colors.brand} fill={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Exclusive offers
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
            {DESCRIPTION.slice(0, typedCount)}
            <Text style={{ color: 'transparent' }}>{DESCRIPTION.slice(typedCount)}</Text>
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {offers.map(({ product, discountPct, marketPrice }) => (
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
              <Image
                source={{ uri: product.primary_image }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              <View
                style={{
                  position: 'absolute', top: 6, left: 6,
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>
                  {discountPct}% OFF
                </Text>
              </View>
            </View>
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                {product.title}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '900', color: colors.brand, marginTop: 3 }}>
                GHS {parseFloat(product.price).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, textDecorationLine: 'line-through' }}>
                GHS {marketPrice.toFixed(2)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}