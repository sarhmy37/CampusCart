import { Text, TextProps, StyleSheet } from 'react-native';
import { useFontSettings } from '@/context/FontContext';

// Swap `Text` for `AppText` on any screen you want to respect the user's
// text-size / bold / font-style preferences from Settings → Appearance.
// It reads whatever fontSize/fontWeight/fontFamily the caller already set,
// scales/overrides them per the current preference, and applies them last
// so they win over the caller's own style.
export default function AppText({ style, ...props }: TextProps) {
  const { scaleFont, fontFamily, fontWeight } = useFontSettings();

  const flat: any = StyleSheet.flatten(style) || {};
  const isBold =
    flat.fontWeight !== undefined &&
    (flat.fontWeight === 'bold' || parseInt(String(flat.fontWeight), 10) >= 600);

  const resolvedFamily = fontFamily(isBold ? 'bold' : 'regular');

  return (
    <Text
      {...props}
      style={[
        style,
        {
          fontSize: flat.fontSize ? scaleFont(flat.fontSize) : undefined,
          fontWeight: fontWeight(flat.fontWeight),
          ...(resolvedFamily ? { fontFamily: resolvedFamily } : null),
        },
      ]}
    />
  );
}