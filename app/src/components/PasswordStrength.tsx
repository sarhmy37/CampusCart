import { View, Text } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

export function getPasswordRules(pw: string) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

export function getPasswordScore(pw: string) {
  const rules = getPasswordRules(pw);
  return Object.values(rules).filter(Boolean).length;
}

export function isPasswordValid(pw: string) {
  return getPasswordScore(pw) === 4;
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

export default function PasswordStrength({ password }: { password: string }) {
  const colors = useColors();
  const score = getPasswordScore(password);
  const rules = getPasswordRules(password);

  if (password.length === 0) return null;

  const barColors = [
    colors.chipBg,
    '#ef4444',
    '#f59e0b',
    '#eab308',
    '#10b981',
  ];

  const textColors = [
    colors.textFaint,
    '#dc2626',
    '#d97706',
    '#ca8a04',
    '#059669',
  ];

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              backgroundColor: i < score ? barColors[score] : colors.chipBg,
            }}
          />
        ))}
      </View>

      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 8,
          color: textColors[score],
        }}
      >
        {LABELS[score]}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 4 }}>
          <Rule ok={rules.length} text="8+ characters" colors={colors} />
        </View>
        <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 4 }}>
          <Rule ok={rules.letter} text="Letter" colors={colors} />
        </View>
        <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 4 }}>
          <Rule ok={rules.number} text="Number" colors={colors} />
        </View>
        <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 4 }}>
          <Rule ok={rules.special} text="Symbol (@, #, $)" colors={colors} />
        </View>
      </View>
    </View>
  );
}

function Rule({ ok, text, colors }: { ok: boolean; text: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {ok ? (
        <Check size={11} color="#10b981" />
      ) : (
        <X size={11} color={colors.textFaint} />
      )}
      <Text
        style={{
          fontSize: 11,
          color: ok ? '#10b981' : colors.textFaint,
        }}
      >
        {text}
      </Text>
    </View>
  );
}