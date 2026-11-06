import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDown } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

const LINE = 2;
const H = Dimensions.get('window').height;

export default function PullRefreshBar({
  scrollY, refreshing, armed,
}: { scrollY: Animated.Value; refreshing: boolean; armed: boolean }) {
  const colors = useColors();
  const settle = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    Animated.timing(settle, { toValue: refreshing ? 1 : 0, duration: 120, useNativeDriver: true }).start();
    if (!refreshing) return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing]);

  useEffect(() => {
    if (!armed) return;
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.3, friction: 4, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [armed]);

  const pullLive = scrollY.interpolate({ inputRange: [-H, 0], outputRange: [H, 0], extrapolate: 'clamp' });
  const pullTight = scrollY.interpolate({ inputRange: [-H, -4, 0], outputRange: [H - 4, 0, 0], extrapolate: 'clamp' });
  const pull = Animated.add(
    Animated.multiply(pullLive, settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
    Animated.multiply(pullTight, settle)
  );
  const base = settle.interpolate({ inputRange: [0, 1], outputRange: [-H, LINE - H] });
  const translateY = Animated.add(pull, base);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-160, width] });

  const reveal = scrollY.interpolate({ inputRange: [-70, -30], outputRange: [1, 0], extrapolate: 'clamp' });
  const contentOpacity = Animated.multiply(reveal, settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const rotate = scrollY.interpolate({ inputRange: [-70, -40], outputRange: ['180deg', '0deg'], extrapolate: 'clamp' });

  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: H, backgroundColor: colors.brandDark, overflow: 'hidden', transform: [{ translateY }] }}
    >
      <LinearGradient
        colors={[colors.brandDark, colors.brand]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 }}
      />
      <Animated.View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', opacity: contentOpacity }}
      >
        <Animated.View
          style={{
            width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }],
          }}
        >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.textOnGold, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <ArrowDown size={18} color={colors.brand} strokeWidth={3} />
          </Animated.View>
        </View>
        </Animated.View>
        <Text style={{ marginTop: 6, fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>
          {armed ? 'Release to refresh' : 'Pull to refresh'}
        </Text>
      </Animated.View>

      {refreshing && (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 160, transform: [{ translateX }] }}>
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}