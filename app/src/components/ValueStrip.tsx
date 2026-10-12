import { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';

import { Users, Star, DollarSign } from 'lucide-react-native';
import Reveal from './Reveal';
import { SCREEN_PADDING_X } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';

const VALUES = [
  {
    Icon: Users,
    label: 'Verified university students',
    desc: 'Every account is email-verified',
    title: 'Verified university students',
    details:
      'Everyone on Tre-X signs up with a university email and confirms it before they can sell or provide services. That means you are dealing with real students from your campus, not anonymous strangers.',
  },
  {
    Icon: Star,
    label: 'Built-in reviews',
    desc: 'Know who you\u2019re dealing with',
    title: 'Built-in reviews',
    details:
      'After paying, buyers can rate and review sellers, and add photos to support their review. Before you chat, order or book, you can see what other students say about someone, so you can trust who you are dealing with.',
  },
  {
    Icon: DollarSign,
    label: 'Free to list, low fees',
    desc: 'Post for free, pay only when you sell',
    title: 'Free to list, low fees',
    details:
      'Listing an item or offering a service on Tre-X costs nothing, and you can post as many as you like. A small 1.5% fee applies only when you make a sale, and your earnings go to your Payouts tab once the buyer confirms their order.',
  },
];

export default function ValueStrip() {
  const colors = useColors();
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected !== null ? VALUES[selected] : null;
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
          <Pressable
            onPress={() => setSelected(i)}
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
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>{v.label}</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{v.desc}</Text>
            </View>
          </Pressable>
          {i < VALUES.length - 1 && (
            <View style={{ height: 1, marginLeft: 56, backgroundColor: colors.borderMuted }} />
          )}
          </View>
        </Reveal>
      ))}
      </View>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          onPress={() => setSelected(null)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            backgroundColor: 'rgba(15,23,42,0.55)',
          }}
        >
          {active && (
            <Pressable
              onPress={() => {}}
              style={{
                width: '100%',
                maxWidth: 380,
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <active.Icon size={26} color={colors.brand} />
              </View>
              <Text
                style={{
                  fontSize: 19,
                  fontWeight: '800',
                  color: colors.text,
                  textAlign: 'center',
                }}
              >
                {active.title}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 21,
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: 10,
                }}
              >
                {active.details}
              </Text>
              <Pressable
                onPress={() => setSelected(null)}
                style={{
                  marginTop: 20,
                  alignSelf: 'stretch',
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textOnGold }}>
                  Got it
                </Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}