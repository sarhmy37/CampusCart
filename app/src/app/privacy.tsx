import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

export default function Privacy() {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.replace('/profile')} style={{ padding: 6 }}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          Privacy Policy
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 20 }}>
          Last updated: 2026
        </Text>

        <Section colors={colors} title="1. Information we collect">
          When you register, we collect your name, university (or personal) email, WhatsApp number, and, for buyers, your delivery location. Sellers may also add bank or mobile money payout details.
        </Section>
        <Section colors={colors} title="2. How we use your information">
          Your information is used to verify your identity, process orders and payments, connect buyers and sellers, and send order-related notifications by app, email, or SMS.
        </Section>
        <Section colors={colors} title="3. Payment information">
          Payments are processed by our third-party provider, Paystack. Tre-X does not store your full card or mobile money credentials on our servers.
        </Section>
        <Section colors={colors} title="4. Sharing of information">
          Your name and contact details are shared with the other party in a transaction (e.g. your WhatsApp number is shared with a buyer or seller) so they can coordinate pickup or delivery. We do not sell your personal data to third parties.
        </Section>
        <Section colors={colors} title="5. Data retention">
          We retain your account and order data for as long as your account is active, or as needed to comply with legal obligations.
        </Section>
        <Section colors={colors} title="6. Your rights">
          You may update your profile information at any time from your account settings, or request deletion of your account, which will remove your listings, orders, and messages.
        </Section>
        <Section colors={colors} title="7. Security">
          Passwords are stored using industry-standard hashing. Access to sensitive account actions requires authentication, and payment processing is handled entirely by our PCI-compliant payment provider.
        </Section>
        <Section colors={colors} title="8. Changes to this policy">
          We may update this privacy policy from time to time. Material changes will be reflected here with an updated date.
        </Section>
        <Section colors={colors} title="9. Contact">
          Questions about this policy can be directed to our support team via the contact options in Settings.
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children, colors }: any) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15, marginBottom: 6 }}>
        {title}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 21 }}>
        {children}
      </Text>
    </View>
  );
}