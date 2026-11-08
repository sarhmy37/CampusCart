import { View, Text, Pressable } from 'react-native';
import { ExclamationTriangleIcon, InboxIcon } from 'react-native-heroicons/solid';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { lightHaptic } from '@/utils/haptics';

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
    <View style={{ paddingVertical: 60, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <ExclamationTriangleIcon size={24} color={colors.error} />
        <Text style={{ flex: 1, fontSize: 15, color: colors.textFaint }}>{text}</Text>
      </View>
      <Pressable onPress={() => { lightHaptic(); onRetry(); }} style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}>
        <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 15 }}>Try again</Text>
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
    <View style={{ paddingVertical: 60, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <InboxIcon size={24} color={colors.brand} />
        <Text style={{ flex: 1, fontSize: 15, color: colors.textFaint }}>{text}</Text>
      </View>
      {cta && ctaLink && (
        <Pressable onPress={() => { lightHaptic(); router.push(ctaLink as any); }} style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}>
          <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 15 }}>{cta} →</Text>
        </Pressable>
      )}
    </View>
  );
}