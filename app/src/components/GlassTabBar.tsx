import { View, Text, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Home, ShoppingCart } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ROUTE_ICONS: Record<string, any> = {
  browse: Compass,
  index: Home,
  cart: ShoppingCart,
};

const ROUTE_LABELS: Record<string, string> = {
  browse: 'Browse',
  index: 'Home',
  cart: 'Cart',
};

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 70 : 100}
        tint="systemChromeMaterial"
        style={{
          flexDirection: 'row',
          paddingVertical: 10,
          paddingHorizontal: 8,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = ROUTE_ICONS[route.name] ?? Home;
          const label = ROUTE_LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  paddingHorizontal: isFocused ? 18 : 0,
                  paddingVertical: isFocused ? 4 : 0,
                  borderRadius: 999,
                  backgroundColor: isFocused ? 'rgba(147, 88, 20, 0.15)' : 'transparent',
                }}
              >
                <Icon
                  size={20}
                  color={isFocused ? '#935814' : '#64748b'}
                  strokeWidth={isFocused ? 2.5 : 2}
                />
              </View>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: isFocused ? '700' : '500',
                  color: isFocused ? '#935814' : '#64748b',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}