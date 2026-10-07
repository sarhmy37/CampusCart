import { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import {
  ShieldCheck, ShieldAlert, Ban, CheckCircle, Crown, Trash2, Wifi, Star, Sparkles, Eye, X, Search,
} from 'lucide-react-native';
import api from '@/api/client';
import { useColors } from '@/hooks/useColors';
import {
  Tag, IconButton, SkeletonList, EmptyState, confirmAsync, inputStyle, cardStyle,
} from './shared';

export default function UsersTab() {
  const colors = useColors();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/users')
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const schools = useMemo(
    () => Array.from(new Set(users.map((u) => u.school).filter(Boolean))) as string[],
    [users]
  );

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((u) =>
        u.name?.toLowerCase().includes(q) ||
        u.university_email?.toLowerCase().includes(q) ||
        (u.school || '').toLowerCase().includes(q)
      );
    }
    if (accountTypeFilter !== 'all') result = result.filter((u) => u.account_type === accountTypeFilter);
    if (statusFilter === 'verified') result = result.filter((u) => u.verified);
    else if (statusFilter === 'unverified') result = result.filter((u) => !u.verified);
    else if (statusFilter === 'banned') result = result.filter((u) => u.banned);
    else if (statusFilter === 'active') result = result.filter((u) => !u.banned && u.verified);

    if (schoolFilter) result = result.filter((u) => (u.school || '') === schoolFilter);

    if (sortBy === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'oldest') result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === 'name') result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return result;
  }, [users, searchQuery, accountTypeFilter, statusFilter, schoolFilter, sortBy]);

  const updateUser = async (id: string, payload: any) => {
    try {
      await api.patch(`/admin/users/${id}`, payload);
      Toast.show({ type: 'success', text1: 'Updated' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to update user' });
    }
  };

  const setPlan = async (id: string, plan: string) => {
    try {
      await api.post(`/admin/users/${id}/set-plan`, { plan });
      Toast.show({ type: 'success', text1: plan === 'free' ? 'Reverted to free' : `Granted ${plan}` });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed' });
    }
  };

  const setDataSeller = async (id: string, enabled: boolean) => {
    if (enabled) {
      const ok = await confirmAsync(
        'Assign Mobile Data seller?',
        'This removes access (and bundles) from whoever currently has it. Continue?'
      );
      if (!ok) return;
    }
    try {
      await api.post(`/admin/users/${id}/set-data-seller`, { enabled });
      Toast.show({ type: 'success', text1: enabled ? 'Assigned' : 'Removed' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed' });
    }
  };

  const deleteUser = async (id: string) => {
    const ok = await confirmAsync('Delete user?', 'This permanently deletes the user and all related data. Cannot be undone.', 'Delete');
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${id}`);
      Toast.show({ type: 'success', text1: 'User deleted' });
      load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to delete' });
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setAccountTypeFilter('all');
    setStatusFilter('all');
    setSchoolFilter('');
    setSortBy('newest');
  };

  const activeFilterCount = [
    accountTypeFilter !== 'all',
    statusFilter !== 'all',
    !!schoolFilter,
    sortBy !== 'newest',
  ].filter(Boolean).length;

  if (loading) return <SkeletonList />;

  return (
    <View>
      {/* Search */}
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
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, email, school…"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, color: colors.text, fontSize: 15 }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
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
          <Text style={{ fontSize: 13, fontWeight: '700', color: showFilters || activeFilterCount > 0 ? colors.brand : colors.textMuted }}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={{ ...cardStyle(colors), marginBottom: 12, gap: 10 }}>
          <FilterRow label="Account type" colors={colors}>
            <ChipRow
              colors={colors}
              value={accountTypeFilter}
              onChange={setAccountTypeFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'buyer', label: 'Buyers' },
                { value: 'seller', label: 'Sellers' },
              ]}
            />
          </FilterRow>
          <FilterRow label="Status" colors={colors}>
            <ChipRow
              colors={colors}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'verified', label: 'Verified' },
                { value: 'unverified', label: 'Unverified' },
                { value: 'active', label: 'Active' },
                { value: 'banned', label: 'Banned' },
              ]}
            />
          </FilterRow>
          {schools.length > 0 && (
            <FilterRow label="School" colors={colors}>
              <ChipRow
                colors={colors}
                value={schoolFilter}
                onChange={setSchoolFilter}
                options={[{ value: '', label: 'All' }, ...schools.map((s) => ({ value: s, label: s }))]}
              />
            </FilterRow>
          )}
          <FilterRow label="Sort by" colors={colors}>
            <ChipRow
              colors={colors}
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'name', label: 'Name A-Z' },
              ]}
            />
          </FilterRow>
          {activeFilterCount > 0 && (
            <Pressable onPress={clearFilters} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600' }}>Clear all filters</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={{ fontSize: 13, color: colors.textFaint, marginBottom: 8 }}>
        {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
      </Text>

      {/* Users list */}
      {filteredUsers.length === 0 ? (
        <EmptyState icon={ShieldCheck} text="No users match your filters." />
      ) : (
        <View style={{ gap: 8 }}>
          {filteredUsers.map((u) => {
            const planActive = u.plan && u.plan !== 'free' && u.plan_expires_at && new Date(u.plan_expires_at) > new Date();
            return (
              <View key={u.id} style={cardStyle(colors)}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  {u.avatar_url ? (
                    <Image
                      source={{ uri: u.avatar_url }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: colors.brandSoft,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: colors.brand, fontSize: 15 }}>
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {planActive && u.plan === 'premium' && <Sparkles size={12} color="#a855f7" />}
                      {planActive && u.plan === 'pro' && <Star size={12} color="#3b82f6" />}
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                        {u.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 1 }} numberOfLines={1}>
                      {u.university_email}
                    </Text>
                    {u.school && (
                      <Text style={{ fontSize: 12, color: colors.textFaint }} numberOfLines={1}>
                        🏫 {u.school}
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      <Tag color={u.role === 'admin' ? 'gold' : 'slate'}>{u.role}</Tag>
                      <Tag color={u.account_type === 'seller' ? 'red' : 'blue'}>{u.account_type}</Tag>
                      <Tag color={u.verified ? 'emerald' : 'amber'}>{u.verified ? 'Verified' : 'Unverified'}</Tag>
                      {u.banned && <Tag color="red">Banned</Tag>}
                      {u.is_data_seller && <Tag color="blue">Data Seller</Tag>}
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  <IconButton
                    onPress={() => updateUser(u.id, { verified: !u.verified })}
                    active={u.verified}
                  >
                    {(tint: string) => u.verified
                      ? <ShieldCheck size={15} color={tint} />
                      : <ShieldAlert size={15} color={tint} />}
                  </IconButton>

                  <IconButton
                    onPress={() => updateUser(u.id, { banned: !u.banned })}
                    active={u.banned}
                    danger
                  >
                    {(tint: string) => u.banned
                      ? <CheckCircle size={15} color={tint} />
                      : <Ban size={15} color={tint} />}
                  </IconButton>

                  <IconButton
                    onPress={() => updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                    active={u.role === 'admin'}
                  >
                    {(tint: string) => <Crown size={15} color={tint} />}
                  </IconButton>

                  <IconButton
                    onPress={() => setDataSeller(u.id, !u.is_data_seller)}
                    active={u.is_data_seller}
                  >
                    {(tint: string) => <Wifi size={15} color={tint} />}
                  </IconButton>

                  <IconButton
                    onPress={() => setPlan(u.id, planActive && u.plan === 'pro' ? 'free' : 'pro')}
                    active={planActive && u.plan === 'pro'}
                  >
                    {(tint: string) => <Star size={15} color={tint} />}
                  </IconButton>

                  <IconButton
                    onPress={() => setPlan(u.id, planActive && u.plan === 'premium' ? 'free' : 'premium')}
                    active={planActive && u.plan === 'premium'}
                  >
                    {(tint: string) => <Sparkles size={15} color={tint} />}
                  </IconButton>

                  <IconButton onPress={() => setSelectedUser(u)}>
                    {(tint: string) => <Eye size={15} color={tint} />}
                  </IconButton>

                  <IconButton onPress={() => deleteUser(u.id)} danger>
                    {(tint: string) => <Trash2 size={15} color={tint} />}
                  </IconButton>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Investigate modal */}
      {selectedUser && (
        <InvestigateModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </View>
  );
}

function FilterRow({ label, children, colors }: { label: string; children: any; colors: any }) {
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function ChipRow({
  colors, value, onChange, options,
}: { colors: any; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.border,
              backgroundColor: active ? colors.brandSoft : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? '700' : '500',
                color: active ? colors.brand : colors.textMuted,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

// ─── INVESTIGATE MODAL ───────────────────────────────────────────────
function InvestigateModal({ user, onClose }: { user: any; onClose: () => void }) {
  const colors = useColors();
  const [orders, setOrders] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/users/${user.id}/orders`).then((res) => res.data).catch(() => []),
      api.get(`/admin/users/${user.id}/listings`).then((res) => res.data).catch(() => []),
    ]).then(([o, l]) => {
      setOrders(o);
      setListings(l);
    }).finally(() => setLoading(false));
  }, [user.id]);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        marginHorizontal: -16,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          position: 'fixed' as any,
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          zIndex: 99,
        }}
      />
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 100,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>Investigate account</Text>
            <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 2 }}>{user.university_email}</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <X size={18} color={colors.textFaint} />
          </Pressable>
        </View>

        <View style={{ backgroundColor: colors.chipBg, borderRadius: 14, padding: 12, marginTop: 14, gap: 6 }}>
          <InfoRow label="Name" value={user.name} colors={colors} />
          <InfoRow label="Account type" value={user.account_type} colors={colors} />
          <InfoRow label="Role" value={user.role} colors={colors} />
          <InfoRow label="Verified" value={user.verified ? '✅ Yes' : '❌ No'} colors={colors} />
          <InfoRow label="Banned" value={user.banned ? '🚫 Yes' : '✅ No'} colors={colors} />
          <InfoRow label="Joined" value={new Date(user.created_at).toLocaleDateString()} colors={colors} />
        </View>

        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 16 }}>
          Listings ({listings.length})
        </Text>
        {loading ? (
          <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>Loading…</Text>
        ) : listings.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>No listings.</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 6 }}>
            {listings.slice(0, 10).map((p: any) => (
              <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.chipBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>{p.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textFaint }}>GHS {parseFloat(p.price).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 16 }}>
          Orders ({orders.length})
        </Text>
        {loading ? (
          <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>Loading…</Text>
        ) : orders.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 6 }}>No orders.</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 6 }}>
            {orders.slice(0, 10).map((o: any) => (
              <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.chipBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontFamily: 'monospace' }} numberOfLines={1}>
                  #{String(o.id).slice(0, 8)}
                </Text>
                <Tag color={o.status === 'completed' ? 'emerald' : o.status === 'pending' ? 'amber' : 'slate'}>
                  {o.status}
                </Tag>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: any; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: colors.textFaint }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
        {value}
      </Text>
    </View>
  );
}