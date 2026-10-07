import { useTheme } from '@/context/ThemeContext';
import { Colors, ThemeColors } from '@/constants/theme';

export function useColors(): ThemeColors {
  const { theme } = useTheme();
  return Colors[theme === 'dark' ? 'dark' : 'light'] as ThemeColors;
}