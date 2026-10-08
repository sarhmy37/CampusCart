import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Bookmark, Trash2, Search, Tag, MapPin } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';

function Chip({ icon, label, colors }: { icon: React.ReactNode; label: string; colors: any }) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.brandSoft,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
      }}
    >
      {icon}
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.brand }}>{label}</Text>
    </View>
  );
}

export default function Saved() {
  const colors = useColors();
  const [deletingId, setDeletingId] = useState<any>(null);

  const { status, data: searches, retry: load } = usePageReady({
    load: () => api.get('/saved-searches/mine').then((res) => res.data),
  });

  const handleDelete = async (id: any) => {
    setDeletingId(id);
    try {
      await api.delete(`/saved-searches/${id}`);
      Toast.show({ type: 'success', text1: 'Saved search removed' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to remove this search' });
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error') return <ErrorState icon={Bookmark} text="Couldn't load your saved searches right now." onRetry={load} />;
  if (!searches || searches.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        text="No saved searches yet. Save a search from the Browse page to get notified when new matching listings appear."
        cta="Browse listings"
        ctaLink="/browse"
      />
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {searches.map((s: any) => (
        <View
          key={s.id}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
            borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {s.keyword && (
                <Chip colors={colors} label={`"${s.keyword}"`} icon={<Search size={11} color={colors.brand} />} />
              )}
              {s.category && (
                <Chip colors={colors} label={s.category} icon={<Tag size={11} color={colors.brand} />} />
              )}
              {s.school && (
                <Chip colors={colors} label={s.school} icon={<MapPin size={11} color={colors.brand} />} />
              )}
            </View>
            <Text style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 8 }}>
              Saved {new Date(s.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Pressable
            onPress={() => handleDelete(s.id)}
            disabled={deletingId === s.id}
            hitSlop={8}
            style={{ padding: 4, opacity: deletingId === s.id ? 0.4 : 1 }}
          >
            <Trash2 size={16} color={colors.textFaint} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}