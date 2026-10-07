import { View, Text, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moon, Sun } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

const COUNTRIES = [
  { value: 'GH', label: 'Ghana (English)' },
  { value: 'NG', label: 'Nigeria (English)' },
  { value: 'KE', label: 'Kenya (English)' },
  { value: 'ZA', label: 'South Africa (English)' },
];

export default function HomeFooter() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme } = useTheme();

  const links = [
    { label: 'Terms of Service', route: '/terms' },
    { label: 'Privacy Policy', route: '/privacy' },
    { label: 'Help Center', route: '/help' },
    { label: 'Contact Us', route: '/contact' },
  ];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: insets.bottom + 24,
      }}
    >
      {/* Row 1: country picker + links */}
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 12 }}>🌍</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              {COUNTRIES[0].label}
            </Text>
          </View>

          <Pressable
            onPress={toggleTheme}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            {theme === 'dark' ? <Moon size={13} color={colors.textSecondary} /> : <Sun size={13} color={colors.textSecondary} />}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 8 }}>
          {links.map((l) => (
            <Pressable
              key={l.route}
              onPress={() => router.push(l.route as any)}
              style={{ marginRight: 12 }}
            >
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginTop: 20,
          marginBottom: 4,
        }}
      />

      {/* Row 2: copyright + prices note */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 11, color: colors.textFaint }}>
          © {new Date().getFullYear()} Tre-X. Made for university students, across Ghana.
        </Text>
        <Text style={{ fontSize: 11, color: colors.textFaint }}>
          Prices shown in GHS.
        </Text>
      </View>
    </View>
  );
}