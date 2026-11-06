import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Animated, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronDown, Check, Heart, Eye } from 'lucide-react-native';
import { TrophyIcon as TrophyOutline } from 'react-native-heroicons/outline';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';

const CARD_W = 128;

const compact = (n?: number) => {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
};

type TabKey = 'sellers' | 'services' | 'users';

const TABS: Record<TabKey, { label: string; desc: string; url: string }> = {
  sellers: {
    label: 'Top selling',
    desc: 'The sellers students trust most, ranked by completed sales.',
    url: '/products/top-sellers',
  },
  services: {
    label: 'Top services',
    desc: 'Service providers with the most completed bookings.',
    url: '/products/top-services',
  },
  users: {
    label: 'Top users',
    desc: 'Students whose Spotlight posts get the most likes and views.',
    url: '/products/top-users',
  },
};

const ORDER: TabKey[] = ['sellers', 'services', 'users'];

export default function TopSellers({ onHasSellers }: { onHasSellers?: (v: boolean) => void }) {
  const colors = useColors();
  const red = colors.brand;
  const router = useRouter();

  const [data, setData] = useState<Record<TabKey, any[]>>({ sellers: [], services: [], users: [] });
  const [tab, setTab] = useState<TabKey>('sellers');
  const [open, setOpen] = useState(false);

  // Swipe-down-to-dismiss for the selector sheet
  const sheetY = useRef(new Animated.Value(0)).current;
  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.8) {
          Animated.timing(sheetY, { toValue: 600, duration: 180, useNativeDriver: true }).start(() => {
            setOpen(false);
            sheetY.setValue(0);
          });
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    Promise.all(
      ORDER.map((k) =>
        api.get(TABS[k].url).then((res) => res.data || []).catch(() => [])
      )
    ).then(([sellers, services, users]) => {
      const next = { sellers, services, users };
      setData(next);
      const firstWithData = ORDER.find((k) => next[k].length > 0);
      if (firstWithData) setTab(firstWithData);
    });
  }, []);

  const available = ORDER.filter((k) => data[k].length > 0);

  useEffect(() => {
    onHasSellers?.(available.length > 0);
  }, [available.length]);

  if (available.length === 0) return null;

  const items = data[tab];
  const canSwitch = available.length > 1;

  const openCard = (s: any) => {
    if (tab === 'users') {
      router.push({ pathname: '/SpotlightProfile', params: { userId: String(s.id) } });
    } else if (tab === 'services') {
      if (s.top_product_id) router.push(`/service/${s.top_product_id}`);
    } else {
      if (s.top_product_id) router.push(`/product/${s.top_product_id}`);
    }
  };

  const bottomLines = (s: any) => {
    if (tab === 'services') return [`${s.sales_count} ${s.sales_count === 1 ? 'booking' : 'bookings'}`];
    return [`${s.sales_count} ${s.sales_count === 1 ? 'sale' : 'sales'}`];
  };

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TrophyOutline size={40} color={red} strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <Pressable
            disabled={!canSwitch}
            onPress={() => setOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: red, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {TABS[tab].label}
            </Text>
            {canSwitch && <ChevronDown size={18} color={red} strokeWidth={2.6} />}
          </Pressable>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
            {TABS[tab].desc}
          </Text>
        </View>
      </View>

      <ScrollView
        key={tab}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {items.map((s, i) => (
          <Pressable
            key={s.id}
            onPress={() => openCard(s)}
            style={{
              width: CARD_W,
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
              {s.avatar_url ? (
                <Image source={{ uri: s.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 36, fontWeight: '900', color: red }}>
                  {String(s.name || '?').charAt(0).toUpperCase()}
                </Text>
              )}
              <View
                style={{
                  position: 'absolute', top: 6, left: 6,
                  backgroundColor: red,
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textOnGold }}>
                  #{i + 1}
                </Text>
              </View>
            </View>
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                {s.name}
              </Text>
              {tab === 'users' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Heart size={12} color={red} strokeWidth={2.2} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: red }}>{compact(s.likes)}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>•</Text>
                  <Eye size={12} color={red} strokeWidth={2.2} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: red }}>{compact(s.views)}</Text>
                </View>
              ) : (
                bottomLines(s).map((line) => (
                  <Text key={line} style={{ fontSize: 12, fontWeight: '800', color: red, marginTop: 3 }}>
                    {line}
                  </Text>
                ))
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Selector sheet */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
          }}
        >
          <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 24,
                paddingTop: 0,
                paddingBottom: 36,
                borderTopWidth: 1,
                borderColor: colors.borderMuted ?? `${colors.border}40`,
              }}
            >
              {/* Drag handle: slide it down to dismiss */}
              <View
                {...sheetPan.panHandlers}
                style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 20 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.borderMuted ?? `${colors.border}60`,
                  }}
                />
              </View>

              <Text style={{ fontSize: 21, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
                Choose a ranking
              </Text>

              {available.map((k, idx) => {
                const selected = k === tab;
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      setTab(k);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 16,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: colors.borderMuted ?? `${colors.border}40`,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: selected ? red : colors.text }}>
                        {TABS[k].label}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 }}>
                        {TABS[k].desc}
                      </Text>
                    </View>
                    {selected && <Check size={20} color={red} strokeWidth={2.8} />}
                  </Pressable>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}