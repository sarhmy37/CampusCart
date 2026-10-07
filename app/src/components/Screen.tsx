import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function Screen(props: SafeAreaViewProps) {
  const colors = useColors();
  return (
    <SafeAreaView
      edges={['top']}
      {...props}
      style={[{ backgroundColor: colors.background }, props.style]}
    />
  );
}