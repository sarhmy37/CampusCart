import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

export default function Terms() {
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
          Terms of Service
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 20 }}>
          Last updated: 2026
        </Text>

        <Section colors={colors} title="1. About Tre-X">
          Tre-X is a campus-based marketplace platform that connects verified university students to buy and sell items within their own campus community.
        </Section>
        <Section colors={colors} title="2. Eligibility">
          Tre-X is intended for use by university students. Sellers are required to verify their account using a valid university email address.
        </Section>
        <Section colors={colors} title="3. Listings">
          Sellers must accurately describe the items they list, including condition, price, and availability. Misleading or fraudulent listings may be removed, and repeat violations may result in account suspension.
        </Section>
        <Section colors={colors} title="4. Payments">
          Payments are processed securely through our third-party payment provider, Paystack. Tre-X does not store your card or mobile money details directly.
        </Section>
        <Section colors={colors} title="5. Fees">
          Sellers are charged a 1.5% platform fee on the sale price of every completed transaction, deducted automatically from their payout. Fees accrued across a calendar month are totaled and must be settled before new listings can be created the following month. Buyers are never charged this fee.{'\n\n'}
          Buyers pay a separate 2% service fee at checkout, covering payment processing costs charged by our payment provider, Paystack.{'\n\n'}
          Sellers can track fees owed and payment history from their Dashboard.
        </Section>
        <Section colors={colors} title="6. Order confirmation">
          Buyers should only confirm "Order Received" once the item has been received in the agreed condition. Confirming an order releases payment to the seller.
        </Section>
        <Section colors={colors} title="7. Prohibited conduct">
          Users may not list prohibited or illegal items, harass other users, or attempt to circumvent Tre-X's payment system. Violations may result in account suspension or termination.
        </Section>
        <Section colors={colors} title="8. Changes to these terms">
          Tre-X may update these terms from time to time. Continued use of the platform after changes are posted constitutes acceptance of the revised terms.
        </Section>
        <Section colors={colors} title="9. Contact">
          Questions about these terms can be directed to our support team via the contact options in Settings.
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