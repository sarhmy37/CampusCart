import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Tag, Trash2, Pencil, Rocket, Eye } from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { usePageReady } from '@/hooks/usePageReady';
import { SkeletonList, ErrorState, EmptyState } from './shared';
import { useColors } from '@/hooks/useColors';
import EditListingModal from '@/components/EditListingModal';
import EditServiceModal from '@/components/EditServiceModal';

export default function Listings() {
  const colors = useColors();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  const { status, data: products, retry: load } = usePageReady({
    load: () => api.get('/products/mine').then((res) => res.data),
    images: [],
  });

  const handleRemove = async (id: any) => {
    try {
      await api.delete(`/products/${id}`);
      Toast.show({ type: 'success', text1: 'Listing removed' });
      load();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to remove listing' });
    }
  };

  if (status === 'loading') return <SkeletonList />;
  if (status === 'error') return <ErrorState icon={Tag} text="Couldn't load your listings right now." onRetry={load} />;
  if (!products || products.length === 0) {
    return <EmptyState icon={Tag} text="You haven't listed anything yet." cta="List an item" ctaLink="/sell" />;
  }

  const regularProducts = products.filter((p: any) => p.category !== 'Services');
  const services = products.filter((p: any) => p.category === 'Services');

  const filterProducts = (list: any[]) => {
    if (!search.trim()) return list;
    return list.filter((p: any) => p.title.toLowerCase().includes(search.trim().toLowerCase()));
  };

  const filteredRegular = filterProducts(regularProducts);
  const filteredServices = filterProducts(services);

  if (filteredRegular.length === 0 && filteredServices.length === 0 && search.trim()) {
    return (
      <View style={{ maxWidth: 640, alignSelf: 'center', width: '100%' }}>
        <SearchBar value={search} onChange={setSearch} colors={colors} />
        <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center', paddingVertical: 24 }}>
          No listings match "{search}"
        </Text>
      </View>
    );
  }

  const isService = editingProduct?.category === 'Services';

  return (
    <View style={{ gap: 8 }}>
      {products.length > 10 && (
        <View style={{ marginBottom: 4 }}>
          <SearchBar value={search} onChange={setSearch} colors={colors} />
        </View>
      )}

      {filteredRegular.length > 0 && (
        <>
          <SectionDivider label="Products" colors={colors} />
          {filteredRegular.map((p: any) => (
            <ListingItem
              key={p.id}
              product={p}
              isPlanActive={!!isPlanActive}
              onRemove={handleRemove}
              onEdit={setEditingProduct}
              colors={colors}
            />
          ))}
        </>
      )}

      {filteredServices.length > 0 && (
        <>
          <SectionDivider label="Services" color={colors.success} colors={colors} />
          {filteredServices.map((p: any) => (
            <ListingItem
              key={p.id}
              product={p}
              isPlanActive={!!isPlanActive}
              onRemove={handleRemove}
              onEdit={setEditingProduct}
              isService
              colors={colors}
            />
          ))}
        </>
      )}

      {/* Product edit modal */}
      <EditListingModal
        product={editingProduct && !isService ? editingProduct : null}
        open={!!editingProduct && !isService}
        onClose={() => setEditingProduct(null)}
        onSaved={() => { setEditingProduct(null); load(); }}
      />

      {/* Service edit modal */}
      <EditServiceModal
        product={editingProduct && isService ? editingProduct : null}
        open={!!editingProduct && isService}
        onClose={() => setEditingProduct(null)}
        onSaved={() => { setEditingProduct(null); load(); }}
      />
    </View>
  );
}

function SearchBar({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Search your listings…"
      placeholderTextColor={colors.textFaint}
      style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: 12, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.inputBg, fontSize: 14, color: colors.text,
      }}
    />
  );
}

function SectionDivider({ label, color, colors }: { label: string; color?: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: color || colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

function ListingItem({
  product, isPlanActive, onRemove, onEdit, isService, colors,
}: {
  product: any; isPlanActive: boolean; onRemove: (id: any) => void;
  onEdit: (p: any) => void; isService?: boolean; colors: any;
}) {
  const router = useRouter();
  const isBoosted = product.boosted_until && new Date(product.boosted_until) > new Date();

  const [boostCountdown, setBoostCountdown] = useState('');
  useEffect(() => {
    if (!isBoosted) return;
    const update = () => {
      const diffMs = new Date(product.boosted_until).getTime() - Date.now();
      if (diffMs <= 0) { setBoostCountdown(''); return; }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setBoostCountdown(hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [isBoosted, product.boosted_until]);

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 16, padding: 12,
        borderWidth: 1, borderColor: isBoosted ? colors.brand : colors.border,
      }}
    >
      <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
        {product.primary_image && (
          <Image source={{ uri: product.primary_image }} style={{ width: '100%', height: '100%' }} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 }}>
            {product.title}
          </Text>
          {isBoosted && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brand, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
              <Rocket size={9} color={colors.textOnGold} />
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textOnGold }}>Boosted</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: product.status === 'available' ? colors.success : colors.textFaint }} />
          <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'capitalize' }}>
            {product.status} · GHS {parseFloat(product.price).toFixed(2)}
          </Text>
          {isService && (
            <View style={{ backgroundColor: colors.successSoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: '600', color: colors.success }}>Service</Text>
            </View>
          )}
        </View>

        {isBoosted && boostCountdown ? (
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.brand, marginTop: 2 }}>
            🚀 {boostCountdown}
          </Text>
        ) : isPlanActive ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Eye size={11} color={colors.textFaint} />
            <Text style={{ fontSize: 11, color: colors.textFaint }}>
              {product.views_count ?? 0} views · {product.sold_count ?? 0} sold
            </Text>
          </View>
        ) : (
          <Text onPress={() => router.push('/')} style={{ fontSize: 11, color: colors.brandDark, marginTop: 4, textDecorationLine: 'underline' }}>
            Upgrade to Pro to see views & sales stats
          </Text>
        )}
      </View>

      {!isBoosted && (
        <>
          <Pressable onPress={() => onEdit(product)} style={{ padding: 6 }}>
            <Pencil size={17} color={colors.textFaint} />
          </Pressable>
             <Pressable
            onPress={() =>
              Alert.alert(
                'Delete listing?',
                `"${product.title}" will be removed permanently.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onRemove(product.id) },
                ]
              )
            }
            style={{ padding: 6 }}
          >
            <Trash2 size={18} color={colors.textFaint} />
          </Pressable>
        </>
      )}
    </View>
  );
}