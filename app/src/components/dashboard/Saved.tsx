import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Bookmark, Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';

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
    <View style={{ gap: 10 }}>
      {searches.map((s: any) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {s.keyword && (
                <View style={{ backgroundColor: colors.chipBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>"{s.keyword}"</Text>
                </View>
              )}
              {s.category && (
                <View style={{ backgroundColor: colors.chipBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{s.category}</Text>
                </View>
              )}
              {s.school && (
                <View style={{ backgroundColor: colors.chipBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>📍 {s.school}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 8 }}>
              Saved {new Date(s.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Pressable
            onPress={() => handleDelete(s.id)}
            disabled={deletingId === s.id}
            style={{ padding: 6 }}
          >
            <Trash2 size={18} color={colors.textFaint} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}