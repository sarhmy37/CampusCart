import { useRef } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const GAP_DEG = 10;

export default function StoryRing({
  size, flags, dimColor, children,
}: { size: number; flags: boolean[]; dimColor: string; children: React.ReactNode }) {
  const id = useRef(`ring-${Math.random().toString(36).slice(2)}`).current;
  const allViewed = flags.every(Boolean);
  const strokeWidth = allViewed ? 2 : 2.5;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const n = Math.max(1, flags.length);
  const gap = n > 1 ? (GAP_DEG / 360) * circ : 0;
  const seg = n > 1 ? (circ - n * gap) / n : circ;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#f59e0b" />
            <Stop offset="25%" stopColor="#ef4444" />
            <Stop offset="50%" stopColor="#a855f7" />
            <Stop offset="75%" stopColor="#3b82f6" />
            <Stop offset="100%" stopColor="#f59e0b" />
          </LinearGradient>
        </Defs>
        {flags.map((viewed, i) => (
          <Circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            stroke={viewed ? dimColor : `url(#${id})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg}, ${circ - seg}`}
            strokeDashoffset={-i * (seg + gap)}
            strokeLinecap={n > 1 ? 'round' : 'butt'}
            fill="none"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}