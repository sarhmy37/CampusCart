import { View, Text } from 'react-native';
import { Users, Star, DollarSign } from 'lucide-react-native';
import Reveal from './Reveal';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';

const VALUES = [
  { Icon: Users, label: 'Verified university students', desc: 'Every account is email-verified' },
  { Icon: Star, label: 'Built-in reviews', desc: 'Know who you\u2019re dealing with' },
  { Icon: DollarSign, label: 'Zero listing fees', desc: 'Sell what you don\u2019t need, keep what you earn' },
];

export default function ValueStrip() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderMuted,
        paddingHorizontal: SCREEN_PADDING_X,
        paddingVertical: 24,
        gap: 16,
        width: '100%',
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: 480 }}>
      {VALUES.map((v, i) => (
        <Reveal key={v.label} delay={i * 100}>
          <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <v.Icon size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{v.label}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{v.desc}</Text>
            </View>
          </View>
          {i < VALUES.length - 1 && (
            <View style={{ height: 1, marginLeft: 56, backgroundColor: colors.borderMuted }} />
          )}
          </View>
        </Reveal>
      ))}
      </View>
    </View>
  );
}