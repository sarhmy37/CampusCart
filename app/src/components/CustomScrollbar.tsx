import { useEffect, useRef, useState } from 'react';
import { View, Animated, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

export const BAR_H = 140;
const KNOB = 18;
const TRAVEL = BAR_H - KNOB;
const GOLD = '#f59e0b';
const FLAME = '#f97316';
const MAX_TRAIL = 64;

export default function CustomScrollbar({
  progress,
  centerY,
  onDrag,
  scrolling,
}: {
  progress: Animated.Value;
  centerY: number;
  onDrag: (ratio: number) => void;
  scrolling: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [dragging, setDragging] = useState(false);
  const current = useRef(0);
  const startRatio = useRef(0);
  const trailAbove = useRef(new Animated.Value(0)).current; // shows when moving down
  const trailBelow = useRef(new Animated.Value(0)).current; // shows when moving up

  useEffect(() => {
    let last = 0;
    const id = progress.addListener(({ value }) => {
      current.current = value;
      const px = (value - last) * TRAVEL;
      last = value;
      if (Math.abs(px) < 0.4) return;
      const len = Math.min(Math.abs(px) * 4, MAX_TRAIL);
      const active = px > 0 ? trailAbove : trailBelow;
      const other = px > 0 ? trailBelow : trailAbove;
      other.setValue(0);
      active.setValue(len);
      Animated.timing(active, { toValue: 0, duration: 320, useNativeDriver: false }).start();
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { startRatio.current = current.current; setDragging(true); },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
      onPanResponderMove: (_, g) => {
        const r = Math.min(Math.max(startRatio.current + g.dy / TRAVEL, 0), 1);
        onDrag(r);
      },
    })
  ).current;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 4,
        opacity: scrolling || dragging ? 1 : 0.2,
        top: centerY - BAR_H / 2,
        width: KNOB,
        height: BAR_H,
        alignItems: 'center',
      }}
    >
      {/* thin track with golden edge */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 5,
          borderRadius: 3,
          backgroundColor: isDark ? '#1f1f23' : '#f3f4f6',
        
        }}
      />

      <Animated.View
        {...pan.panHandlers}
        style={{
          position: 'absolute',
          top: 0,
          width: KNOB,
          height: KNOB,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, TRAVEL],
              }),
            },
          ],
        }}
      >
        {/* fire trail behind the knob (moving down) */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: KNOB / 2, width: 8, height: trailAbove }}
        >
          <LinearGradient
            colors={['rgba(249,115,22,0)', FLAME, '#fde047']}
            style={{ flex: 1, borderRadius: 4 }}
          />
        </Animated.View>

        {/* fire trail behind the knob (moving up) */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: KNOB / 2, width: 8, height: trailBelow }}
        >
          <LinearGradient
            colors={['#fde047', FLAME, 'rgba(249,115,22,0)']}
            style={{ flex: 1, borderRadius: 4 }}
          />
        </Animated.View>

        {/* knob */}
        <View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
            borderWidth: 2,
            borderColor: GOLD,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: GOLD,
            shadowOpacity: 0.7,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
            elevation: 4,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD }} />
        </View>
      </Animated.View>
    </View>
  );
}