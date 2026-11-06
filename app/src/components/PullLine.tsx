import { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';

export default function PullLine({
  scrollY, refreshing, colors,
}: { scrollY: Animated.Value; refreshing: boolean; colors: any }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    Animated.timing(fade, { toValue: refreshing ? 1 : 0, duration: 120, useNativeDriver: true }).start();
    if (!refreshing) return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing]);

  const pull = scrollY.interpolate({ inputRange: [-70, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const pullOpacity = fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const barW = w * 0.4;

  return (
    <View pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 3, overflow: 'hidden' }}>
      {/* pull layer: grows from the centre while dragging */}
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: pullOpacity }}>
        <Animated.View style={{ height: 3, width: w, borderRadius: 2, backgroundColor: colors.brand, transform: [{ scaleX: pull }] }} />
      </Animated.View>

      {/* refreshing layer: faint track + moving bar, loops until the refresh ends */}
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: fade }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.brand, opacity: 0.25 }} />
        <Animated.View
          style={{
            position: 'absolute', top: 0, bottom: 0, width: barW, borderRadius: 2, backgroundColor: colors.brand,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-barW, w] }) }],
          }}
        />
      </Animated.View>
    </View>
  );
}