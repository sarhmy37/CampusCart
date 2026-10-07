import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export function SkeletonList() {
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 64, borderRadius: 16, backgroundColor: colors.cardAlt }} />
      ))}
    </View>
  );
}

export function ErrorState({
  icon: Icon, text, onRetry,
}: {
  icon: any; text: string; onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={24} color={colors.error} />
      </View>
      <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center' }}>{text}</Text>
      <Pressable onPress={onRetry} style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}>
        <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({
  icon: Icon, text, cta, ctaLink,
}: {
  icon: any; text: string; cta?: string; ctaLink?: string;
}) {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={24} color={colors.brand} />
      </View>
      <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center', maxWidth: 260 }}>{text}</Text>
      {cta && ctaLink && (
        <Pressable onPress={() => router.push(ctaLink as any)} style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}>
          <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>{cta} →</Text>
        </Pressable>
      )}
    </View>
  );
}