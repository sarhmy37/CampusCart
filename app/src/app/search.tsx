import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, ArrowLeft, MapPin, X } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { SCREEN_PADDING_X } from '@/constants/theme';
import api from '@/api/client';
import { useChat } from '@/context/ChatContext';
import {
  ShoppingBagIcon as BagSolid, WrenchScrewdriverIcon as ToolSolid, UserIcon as UserSolid,
} from 'react-native-heroicons/solid';
import {
  ShoppingBagIcon as BagOutline, WrenchScrewdriverIcon as ToolOutline, UserIcon as UserOutline,
} from 'react-native-heroicons/outline';

const TAB_ICONS = {
  product: { solid: BagSolid, outline: BagOutline },
  service: { solid: ToolSolid, outline: ToolOutline },
  user: { solid: UserSolid, outline: UserOutline },
};

const GREETINGS: { start: number; end: number; options: string[] }[] = [
  { start: 5, end: 8, options: ['Rise and shine', 'Good morning', 'Morning'] },
  { start: 8, end: 12, options: ['Good morning', 'Hope your morning is going well'] },
  { start: 12, end: 14, options: ['Good afternoon', 'Hey there'] },
  { start: 14, end: 17, options: ['Good afternoon', 'Afternoon'] },
  { start: 17, end: 19, options: ['Good evening', 'Evening'] },
  { start: 19, end: 22, options: ['Good evening', 'Hope your day went well'] },
  { start: 22, end: 24, options: ['Burning the midnight oil', 'Late night browsing'] },
  { start: 0, end: 5, options: ['Night owl', 'Up late, huh?', 'Hey, night owl'] },
];

const SUBTITLES = [
  "What are you trying to find? You're just a tap away.",
  "What are we hunting for today?",
  "Search campus — someone's already selling it.",
  "What do you need? Let's go find it.",
  "Type it in — it's probably on campus already.",
  "Looking for something? We've got you.",
  "What's on your mind today?",
  "Let's see what's out there.",
  "Search it up — your next find is close.",
  "What are you after this time?",
  "Tell me what you need — I'll go look.",
  "Find it, message the seller, done.",
];

function getGreeting() {
  const hour = new Date().getHours();
  const bucket = GREETINGS.find((g) => hour >= g.start && hour < g.end);
  const options = bucket?.options || ['Hey'];
  return options[Math.floor(Math.random() * options.length)];
}

function getSubtitle() {
  return SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)];
}

export default function SearchScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { openChat } = useChat();

  const handleUserPress = (item: any) => {
    const openUserChat = () => openChat({ sellerId: item.id, sellerName: item.name });
    if (item.account_type === 'seller' && item.plan) {
      Alert.alert(item.name, undefined, [
        { text: 'View Store page', onPress: () => router.push(`/seller/${item.id}`) },
        { text: 'Chat with Seller', onPress: openUserChat },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      openUserChat();
    }
  };
  const inputRef = useRef<TextInput>(null);

  const [value, setValue] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<any>(null);
  const [typeFilter, setTypeFilter] = useState<'product' | 'service' | 'user' | null>(null);
  const [userResults, setUserResults] = useState<any[]>([]);
  const tabPickedRef = useRef(false);
  const isServiceItem = (p: any) => (p.category || p.category_name) === 'Services';
  const filteredResults = results.filter((p) =>
    typeFilter === null ? true : typeFilter === 'service' ? isServiceItem(p) : !isServiceItem(p)
  );

  const firstName = (user?.name || '').split(' ')[0];
  const greeting = useMemo(() => getGreeting(), []);
  const subtitle = useMemo(() => getSubtitle(), []);
  const isTyping = value.trim().length > 0;

  // Light mode: header strip a touch darker than the white body.
  // Dark mode: mirrored — header strip a touch lighter than the dark body.
  const headerBg = theme === 'dark' ? colors.card : colors.background;
  const bodyBg = theme === 'dark' ? colors.background : colors.card;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const fetchSuggestions = (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setUserResults([]);
      tabPickedRef.current = false;
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get('/products', { params: { search: q.trim() } }).catch(() => ({ data: [] })),
      api.get('/products/search/users', { params: { q: q.trim() } }).catch(() => ({ data: [] })),
    ])
      .then(([p, u]: any[]) => {
        const prods = (p.data || []).slice(0, 20);
        const users = u.data || [];
        setResults(prods);
        setUserResults(users);
        if (!tabPickedRef.current) {
          const counts = {
            product: prods.filter((x: any) => !isServiceItem(x)).length,
            service: prods.filter(isServiceItem).length,
            user: users.length,
          };
          const best = (['product', 'service', 'user'] as const).reduce(
            (a, b) => (counts[b] > counts[a] ? b : a)
          );
          setTypeFilter(counts[best] > 0 ? best : null);
        }
      })
      .finally(() => setLoading(false));
  };

  const handleChange = (text: string) => {
    setValue(text);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const handleSubmit = () => {
    const q = value.trim();
    router.push(q ? `/browse?search=${encodeURIComponent(q)}` : '/browse');
  };

  const handleSelect = (item: any) => {
    router.push(`/product/${item.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bodyBg }} edges={[]}>
      {/* Header strip */}
      <View style={{ backgroundColor: headerBg, paddingBottom: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: isTyping ? 'center' : 'flex-start',
            gap: 12,
            paddingHorizontal: SCREEN_PADDING_X,
            paddingTop: 10,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ padding: 6, marginLeft: -6, marginTop: isTyping ? 0 : 2 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flexShrink: 1 }}>
              {greeting}{firstName ? `, ${firstName}` : ''} 👋
            </Text>
            {!isTyping && (
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Search input */}
        <View style={{ paddingHorizontal: SCREEN_PADDING_X, paddingTop: isTyping ? 10 : 14 }}>
          <View style={{ position: 'relative', justifyContent: 'center' }}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={handleChange}
              onSubmitEditing={handleSubmit}
              placeholder="Search textbooks, electronics..."
              placeholderTextColor={colors.textFaint}
              returnKeyType="search"
              style={{
                paddingHorizontal: 36,
                paddingVertical: 12,
                paddingRight: 36,
                borderRadius: 999,
                color: colors.text,
                fontSize: 14,
              }}
            />
            {value.length > 0 ? (
              <Pressable
                onPress={() => handleChange('')}
                style={{ position: 'absolute', right: 8, padding: 4 }}
              >
                <X size={16} color={colors.textFaint} />
              </Pressable>
            ) : (
              <View style={{ position: 'absolute', right: 12 }}>
                <Search size={16} color={colors.textFaint} />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Results */}
      {!isTyping ? null : loading ? (
        <View style={{ alignItems: 'center', paddingTop: 32 }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : results.length === 0 && userResults.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
            No results for "{value.trim()}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={typeFilter === 'user' ? userResults : filteredResults}
          keyExtractor={(item: any) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {(['product', 'service', 'user'] as const).map((t) => {
                  const active = typeFilter === t;
                  const isFirst = t === 'product';
                  const isLast = t === 'user';
                  return (
                    <Pressable
                      key={t}
                      onPress={() => { tabPickedRef.current = true; setTypeFilter(t); }}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6,
                        borderTopLeftRadius: isFirst ? 999 : 0,
                        borderBottomLeftRadius: isFirst ? 999 : 0,
                        borderTopRightRadius: isLast ? 999 : 0,
                        borderBottomRightRadius: isLast ? 999 : 0,
                        backgroundColor: active ? colors.brand : colors.chipBg,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        {(() => {
                          const Icon = TAB_ICONS[t][active ? 'solid' : 'outline'];
                          return <Icon size={14} color={active ? colors.textOnGold : colors.textMuted} />;
                        })()}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: active ? colors.textOnGold : colors.textMuted }}>
                          {t === 'product' ? 'Product' : t === 'service' ? 'Service' : 'User'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          ListFooterComponent={
            <Pressable onPress={handleSubmit} style={{ paddingTop: 16, alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>
                See all results for "{value.trim()}"
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 24 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                No {typeFilter === 'service' ? 'services' : typeFilter === 'user' ? 'users' : 'products'} found
              </Text>
            </View>
          }
          renderItem={({ item }) => typeFilter === 'user' ? (
            <UserRow item={item} colors={colors} onPress={() => handleUserPress(item)} />
          ) : (
            <Pressable
              onPress={() => handleSelect(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              {item.primary_image ? (
                <Image
                  source={{ uri: item.primary_image }}
                  style={{ width: 48, height: 48, borderRadius: 12 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colors.brandSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.brand }}>
                    {item.title?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {item.title}
                </Text>
                {!!(item.seller_location || item.seller_meeting_place) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <MapPin size={11} color={colors.textFaint} />
                    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted }}>
                      {item.seller_location || item.seller_meeting_place}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function UserRow({ item, colors, onPress }: { item: any; colors: any; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
          backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center',
        }}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.brand }}>
            {item.name?.[0]?.toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
          {[item.username ? `@${item.username}` : null, item.school].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}