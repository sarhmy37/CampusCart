import { Pressable, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { lightHaptic } from '@/utils/haptics';

const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

export default function GlassButton({
  onPress, children, style, fallbackStyle, disabled,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const Wrapper: any = GLASS ? GlassView : View;
  return (
    <Pressable
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Wrapper
        {...(GLASS ? { glassEffectStyle: 'regular', isInteractive: true } : {})}
        style={[style, GLASS ? {} : fallbackStyle]}
      >
        {children}
      </Wrapper>
    </Pressable>
  );
}
