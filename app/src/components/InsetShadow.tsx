import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

export default function InsetShadow({ direction }: { direction: 'down' | 'up' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const dark = isDark ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.14)';
  const clear = 'rgba(245,158,11,0)';

  return (
    <View pointerEvents="none">
      {direction === 'down' && (
        <View style={{ height: 1, backgroundColor: 'rgba(245,158,11,0.25)' }} />
      )}
      <LinearGradient
        colors={direction === 'down' ? [dark, 'rgba(245,158,11,0.06)', clear] : [clear, 'rgba(245,158,11,0.06)', dark]}
        style={{ height: 28, width: '100%' }}
      />
      {direction === 'up' && (
        <View style={{ height: 1, backgroundColor: 'rgba(245,158,11,0.25)' }} />
      )}
    </View>
  );
}