import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

// ─── TAG ─────────────────────────────────────────────────────────────
export function Tag({ children, color = 'slate' }: { children: any; color?: string }) {
  const colors = useColors();
  const styles: Record<string, { bg: string; text: string }> = {
    slate: { bg: colors.chipBg, text: colors.textMuted },
    gold: { bg: 'rgba(184,117,21,0.15)', text: colors.brand },
    red: { bg: colors.errorSoft, text: colors.error },
    blue: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
    emerald: { bg: colors.successSoft, text: colors.success },
    amber: { bg: colors.warningSoft, text: colors.warning },
  };
  const s = styles[color] || styles.slate;

  return (
    <View
      style={{
        backgroundColor: s.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: s.text,
          textTransform: 'capitalize',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// ─── ICON BUTTON ─────────────────────────────────────────────────────
export function IconButton({
  children, onPress, active, danger,
}: {
  children: any; onPress: () => void; active?: boolean; danger?: boolean;
}) {
  const colors = useColors();
  let bg = 'transparent';
  let tint: string = colors.textFaint;

  if (active) {
    if (danger) {
      bg = colors.errorSoft;
      tint = colors.error;
    } else {
      bg = colors.brandSoft;
      tint = colors.brand;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 8,
        borderRadius: 8,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {typeof children === 'function' ? children(tint) : children}
    </Pressable>
  );
}

// ─── SKELETON ────────────────────────────────────────────────────────
export function SkeletonList({ count = 4 }: { count?: number }) {
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 64,
            borderRadius: 16,
            backgroundColor: colors.chipBg,
            opacity: 0.6,
          }}
        />
      ))}
    </View>
  );
}

// ─── STAT CARD (header stats) ────────────────────────────────────────
export function StatCard({
  icon: Icon, label, value, highlight,
}: {
  icon: any; label: string; value: any; highlight?: boolean;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 100,
        backgroundColor: highlight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: highlight ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
        borderRadius: 14,
        padding: 10,
      }}
    >
      <Icon size={16} color="rgba(255,255,255,0.85)" />
      <Text style={{ fontSize: 19, fontWeight: '800', color: 'white', marginTop: 4 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── CENTERED LOADING ────────────────────────────────────────────────
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
      <ActivityIndicator color={colors.brand} />
      <Text style={{ fontSize: 13, color: colors.textFaint }}>{label}</Text>
    </View>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon, text,
}: { icon: any; text: string }) {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center', gap: 10 }}>
      <Icon size={28} color={colors.textFaint} />
      <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center', paddingHorizontal: 20 }}>
        {text}
      </Text>
    </View>
  );
}

// ─── CONFIRM HELPER (native Alert wrapper for consistency) ───────────
import { Alert } from 'react-native';
export function confirmAsync(title: string, message: string, confirmLabel = 'Confirm') {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

// ─── STYLE HELPERS ───────────────────────────────────────────────────
export const cardStyle = (colors: any) => ({
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 16,
  padding: 14,
});

export const inputStyle = (colors: any) => ({
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.inputBg,
  color: colors.text,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 11,
  fontSize: 15,
});