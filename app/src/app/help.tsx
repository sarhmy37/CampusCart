import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, LifeBuoy, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

const FAQS = [
  {
    q: 'How do I verify my account?',
    a: 'Go to your profile and tap "Verify your account". We\'ll send a 6-digit code to your university email (or, for buyers, your registered email). Enter it to get verified — this unlocks selling, withdrawals, and the verified badge on your profile.',
  },
  {
    q: 'How do I contact a seller before buying?',
    a: 'Open any listing and tap "Chat with the seller" to message them directly through the app, or use their WhatsApp number shown on the listing if they\'ve added one.',
  },
  {
    q: 'What happens after I pay for an order?',
    a: 'Once payment is confirmed, the seller is notified to prepare your item for pickup or delivery. After you receive it, go to your Orders tab and tap "Confirm Received" — this releases the funds to the seller and unlocks your ability to leave a review.',
  },
  {
    q: 'How do platform fees work?',
    a: 'Free-plan sellers pay a standard 1.5% fee per sale. Pro and Premium sellers keep 100% of every sale — no platform fee at all. Buyers pay a small 2% service fee at checkout to cover payment processing.',
  },
  {
    q: 'What\'s the difference between Free, Pro, and Premium?',
    a: 'Pro and Premium unlock 0% seller fees, higher listing limits, priority placement in search, a seller badge, and more. Premium adds unlimited listings and top placement. Check the pricing section on the home page for the full breakdown.',
  },
  {
    q: 'How do withdrawals work?',
    a: 'Once a buyer confirms they\'ve received an order, the funds become available in your Payouts tab. Add a bank or mobile money account, then request a withdrawal from your available balance.',
  },
  {
    q: 'What if I never receive my order, or it doesn\'t match the listing?',
    a: 'Don\'t confirm the order as received. Instead, use the "Report" option on the listing or order, or reach out to support below — we\'ll step in to help resolve it.',
  },
  {
    q: 'How do I become a seller?',
    a: 'Tap "Start selling" from the home page. If you signed up as a buyer, you\'ll be prompted to switch to a seller account, which requires a valid university email for verification.',
  },
];

export default function Help() {
  const colors = useColors();
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER with gradient */}
      <LinearGradient
        colors={['#0d0c0a', '#161411', 'rgba(184,117,21,0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 16, paddingBottom: 20, paddingHorizontal: 16 }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            alignSelf: 'flex-start',
          }}
        >
          <ArrowLeft size={16} color="white" />
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Back</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <View
            style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <LifeBuoy size={20} color="white" />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: 'white' }}>
              Help Center
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              Answers to common questions
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {/* FAQ list */}
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            paddingHorizontal: 20,
          }}
        >
          {FAQS.map((faq, i) => (
            <View
              key={faq.q}
              style={{
                borderBottomWidth: i === FAQS.length - 1 ? 0 : 1,
                borderBottomColor: colors.borderMuted,
              }}
            >
              <Pressable
                onPress={() => setOpenIndex(openIndex === i ? -1 : i)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 16,
                }}
              >
                <Text style={{ flex: 1, fontWeight: '600', fontSize: 14, color: colors.text }}>
                  {faq.q}
                </Text>
                <ChevronDown
                  size={16}
                  color={colors.textMuted}
                  style={{
                    transform: [{ rotate: openIndex === i ? '180deg' : '0deg' }],
                  }}
                />
              </Pressable>
              {openIndex === i && (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    lineHeight: 20,
                    paddingBottom: 16,
                    paddingRight: 24,
                  }}
                >
                  {faq.a}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Contact CTA */}
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            Still need help?
          </Text>
          <Pressable
            onPress={() => router.push('/contact')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              backgroundColor: colors.brand,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 999,
            }}
          >
            <MessageCircle size={16} color={colors.textOnGold} />
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
              Contact support
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}