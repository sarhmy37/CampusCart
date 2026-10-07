import { Slot } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { View } from 'react-native';

export default function BrowseTabsLayout() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Slot />
    </View>
  );
}