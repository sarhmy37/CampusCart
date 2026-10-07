import { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { Trash2, X, Search, Filter } from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import {
  Tag, IconButton, SkeletonList, EmptyState, confirmAsync, inputStyle, cardStyle,
} from './shared';

export default function ListingsTab() {
  const colors = useColors();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/listings').then((res) => res.data).catch(() => []),
      api.get('/categories').then((res) => res.data.map((c: any) => c.name)).catch(() => []),
    ]).then(([rows, cats]) => {
      setListings(rows);
      setCategories(cats);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    let result = [...listings];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.title?.toLowerCase().includes(q) ||
        p.seller_name?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((p) => p.category === categoryFilter);
    }
    if (sortBy === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'oldest') result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === 'stock_high') result.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    else if (sortBy === 'stock_low') result.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    return result;
  }, [listings, search, categoryFilter, sortBy]);

  const remove = async (id: string, title: string) => {
    const ok = await confirmAsync('Remove listing?', `"${title}" will be permanently deleted.`, 'Remove');
    if (!ok) return;
    try {
      await api.delete(`/admin/listings/${id}`);
      Toast.show({ type: 'success', text1: 'Listing removed' });
      load();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to remove listing' });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setSortBy('newest');
  };

  const activeFilterCount = [!!categoryFilter, sortBy !== 'newest'].filter(Boolean).length;

  if (loading) return <SkeletonList />;

  return (
    <View>
      {/* Search + filter toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <Search size={16} color={colors.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title or seller…"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, color: colors.text, fontSize: 15 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={{ padding: 4 }}>
              <X size={14} color={colors.textFaint} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: showFilters || activeFilterCount > 0 ? colors.brandSoft : colors.chipBg,
          }}
        >
          <Filter size={16} color={showFilters || activeFilterCount > 0 ? colors.brand : colors.textMuted} />
        </Pressable>
      </View>

      {showFilters && (
        <View style={{ ...cardStyle(colors), marginBottom: 12, gap: 10 }}>
          {categories.length > 0 && (
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))].map((opt) => {
                  const active = categoryFilter === opt.value;
                  return (
                    <Pressable
                      key={opt.value || 'all'}
                      onPress={() => setCategoryFilter(opt.value)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandSoft : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? colors.brand : colors.textMuted }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Sort by
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'stock_high', label: 'Stock: high' },
                { value: 'stock_low', label: 'Stock: low' },
              ].map((opt) => {
                const active = sortBy === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSortBy(opt.value)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandSoft : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? colors.brand : colors.textMuted }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {activeFilterCount > 0 && (
            <Pressable onPress={clearFilters} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600' }}>Clear filters</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={{ fontSize: 13, color: colors.textFaint, marginBottom: 8 }}>
        {filtered.length} listing{filtered.length === 1 ? '' : 's'}
      </Text>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} text="No listings match your filters." />
      ) : (
        <View style={{ gap: 8 }}>
          {filtered.map((p) => (
            <View key={p.id} style={{ ...cardStyle(colors), flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 52, height: 52, borderRadius: 12,
                  backgroundColor: colors.chipBg,
                  overflow: 'hidden',
                }}
              >
                {p.primary_image ? (
                  <Image
                    source={{ uri: p.primary_image }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : null}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {p.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 1 }} numberOfLines={1}>
                  {p.seller_name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                    GHS {parseFloat(p.price).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textFaint }}>· Stock: {p.stock}</Text>
                  {p.category && <Tag color="slate">{p.category}</Tag>}
                </View>
                <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 3 }}>
                  {new Date(p.created_at).toLocaleDateString()}
                </Text>
              </View>

              <IconButton onPress={() => remove(p.id, p.title)} danger>
                {(tint: string) => <Trash2 size={15} color={tint} />}
              </IconButton>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}