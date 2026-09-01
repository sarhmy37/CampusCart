import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import {
    Users, Package, ShoppingBag, DollarSign, ShieldCheck, ShieldAlert,
    Ban, CheckCircle, Trash2, Crown, Flag, XCircle, TrendingUp, Eye, X,
    Filter, X as XClose, Calendar, User, Tag as TagIcon, Layers, ArrowUpDown,
    Search, Mail, School, UserCheck, UserX, Users as UsersIcon
} from 'lucide-react';

export default function Admin() {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const [tab, setTab] = useState('users');
    const [stats, setStats] = useState(null);
    const [earnings, setEarnings] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [allListings, setAllListings] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingListings, setLoadingListings] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get('/admin/stats'),
            api.get('/admin/net-earnings')
        ]).then(([statsRes, earningsRes]) => {
            setStats(statsRes.data);
            setEarnings(earningsRes.data);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!searchQuery) {
            setAllUsers([]);
            setAllListings([]);
            return;
        }
        setLoadingUsers(true);
        setLoadingListings(true);
        Promise.all([
            api.get('/admin/users').then(res => res.data),
            api.get('/admin/listings').then(res => res.data),
        ]).then(([users, listings]) => {
            setAllUsers(users);
            setAllListings(listings);
            const userMatch = users.some(u =>
                u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.university_email.toLowerCase().includes(searchQuery.toLowerCase())
            );
            const listingMatch = listings.some(p =>
                p.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (userMatch) {
                setTab('users');
            } else if (listingMatch) {
                setTab('listings');
            }
        }).catch(() => {}).finally(() => {
            setLoadingUsers(false);
            setLoadingListings(false);
        });
    }, [searchQuery]);

    useEffect(() => {
        if (!searchQuery) {
            setTab('users');
        }
    }, [searchQuery]);

    return (
        <div className="bg-white dark:bg-ink-900 min-h-screen">
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Admin Dashboard</h1>
                    <p className="text-white/70 text-sm mt-1">Manage users, listings, and orders</p>

                    {stats && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8">
                            <StatCard icon={Users} label="Users" value={stats.total_users} />
                            <StatCard icon={Package} label="Listings" value={stats.total_products} />
                            <StatCard icon={ShoppingBag} label="Orders" value={stats.total_orders} />
                            <StatCard icon={DollarSign} label="Revenue" value={`GHS ${stats.total_revenue.toFixed(2)}`} />
                            {earnings && (
                                <StatCard 
                                    icon={TrendingUp} 
                                    label="Net Earnings" 
                                    value={`GHS ${earnings.netProfit}`} 
                                    highlight 
                                />
                            )}
                        </div>
                    )}
                    
                    {earnings && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-white/70 text-[10px] sm:text-xs">
                            <div>2% Buyer Fees: <span className="text-white font-semibold">GHS {earnings.totalBuyerFees}</span></div>
                            <div>1.5% Seller Fees: <span className="text-white font-semibold">GHS {earnings.totalSellerFees}</span></div>
                            <div>Paystack Deduction: <span className="text-white font-semibold">-GHS {earnings.paystackDeduction}</span></div>
                            <div>Gross Profit: <span className="text-white font-semibold">GHS {earnings.grossProfit}</span></div>
                        </div>
                    )}
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-ink-800 p-1 rounded-xl w-fit mx-auto">
                    {['users', 'listings', 'orders', 'reports', 'deleted chats'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${
                                tab === t
                                    ? 'bg-white dark:bg-ink-700 shadow-sm text-brand-700 dark:text-gold-400'
                                    : 'text-slate-500 dark:text-gold-200/50'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === 'users' && <UsersTab filter={searchQuery} initialUsers={allUsers} loading={loadingUsers} />}
                {tab === 'listings' && <ListingsTab filter={searchQuery} initialListings={allListings} loading={loadingListings} />}
                {tab === 'orders' && <OrdersTab />}
                {tab === 'reports' && <ReportsTab />}
                {tab === 'deleted chats' && <DeletedChatsTab />}
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, highlight }) {
    return (
        <div className={`backdrop-blur border rounded-2xl p-4 ${highlight ? 'bg-white/20 border-white/40' : 'bg-white/10 border-white/20'}`}>
            <Icon size={18} className={`mb-2 ${highlight ? 'text-white' : 'text-white/80'}`} />
            <p className={`text-2xl font-extrabold ${highlight ? 'text-white' : 'text-white'}`}>{value}</p>
            <p className={`text-xs ${highlight ? 'text-white/90' : 'text-white/70'}`}>{label}</p>
        </div>
    );
}

// ---------- UsersTab (with Advanced Search) ----------
function UsersTab({ filter, initialUsers, loading }) {
    const [users, setUsers] = useState(initialUsers || []);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [localLoading, setLocalLoading] = useState(loading);
    const [selectedUser, setSelectedUser] = useState(null);
    
    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [accountTypeFilter, setAccountTypeFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [schoolFilter, setSchoolFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [showFilters, setShowFilters] = useState(false);

    // Get unique schools from users
    const schools = [...new Set(users.map(u => u.school).filter(Boolean))];

    useEffect(() => {
        if (initialUsers && initialUsers.length > 0) {
            setUsers(initialUsers);
            setLocalLoading(false);
        } else if (!filter) {
            setLocalLoading(true);
            api.get('/admin/users').then((res) => {
                setUsers(res.data);
            }).finally(() => setLocalLoading(false));
        }
    }, [initialUsers, filter]);

    // Apply all filters
    useEffect(() => {
        let result = [...users];

        // Search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(u => {
                if (searchField === 'name') {
                    return u.name.toLowerCase().includes(q);
                } else if (searchField === 'email') {
                    return u.university_email.toLowerCase().includes(q);
                } else if (searchField === 'school') {
                    return (u.school || '').toLowerCase().includes(q);
                } else {
                    return u.name.toLowerCase().includes(q) ||
                           u.university_email.toLowerCase().includes(q) ||
                           (u.school || '').toLowerCase().includes(q);
                }
            });
        }

        // Account type filter
        if (accountTypeFilter !== 'all') {
            result = result.filter(u => u.account_type === accountTypeFilter);
        }

        // Role filter
        if (roleFilter !== 'all') {
            result = result.filter(u => u.role === roleFilter);
        }

        // Status filter
        if (statusFilter === 'verified') {
            result = result.filter(u => u.verified === true);
        } else if (statusFilter === 'unverified') {
            result = result.filter(u => u.verified === false);
        } else if (statusFilter === 'banned') {
            result = result.filter(u => u.banned === true);
        } else if (statusFilter === 'active') {
            result = result.filter(u => u.banned === false && u.verified === true);
        }

        // School filter
        if (schoolFilter) {
            result = result.filter(u => (u.school || '') === schoolFilter);
        }

        // Date range
        if (dateFrom) {
            result = result.filter(u => new Date(u.created_at) >= new Date(dateFrom));
        }
        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(u => new Date(u.created_at) <= endDate);
        }

        // Sort
        if (sortBy === 'newest') {
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sortBy === 'oldest') {
            result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else if (sortBy === 'name') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'email') {
            result.sort((a, b) => a.university_email.localeCompare(b.university_email));
        } else if (sortBy === 'school') {
            result.sort((a, b) => (a.school || '').localeCompare(b.school || ''));
        }

        setFilteredUsers(result);
    }, [users, searchQuery, searchField, accountTypeFilter, roleFilter, statusFilter, schoolFilter, dateFrom, dateTo, sortBy]);

    const updateUser = async (id, payload) => {
        try {
            await api.patch(`/admin/users/${id}`, payload);
            toast.success('Updated');
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update user');
        }
    };

    const deleteUser = async (id) => {
        if (!window.confirm('⚠️ Are you sure you want to permanently delete this user? This cannot be undone.')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            toast.success('User deleted');
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete user');
        }
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setSearchField('all');
        setAccountTypeFilter('all');
        setRoleFilter('all');
        setStatusFilter('all');
        setSchoolFilter('');
        setDateFrom('');
        setDateTo('');
        setSortBy('newest');
    };

    const activeFilterCount = [
        searchQuery, accountTypeFilter !== 'all', roleFilter !== 'all', 
        statusFilter !== 'all', schoolFilter, dateFrom, dateTo
    ].filter(Boolean).length;

    if (localLoading) return <SkeletonList />;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <div className="flex-1 flex items-center bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-xl overflow-hidden focus-within:border-brand-500 dark:focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-brand-100 dark:focus-within:ring-gold-900 transition">
                    <Search size={18} className="ml-3 text-slate-400 dark:text-gold-300/40 shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search users by name, email, or school..."
                        className="w-full px-2 py-2.5 bg-transparent text-sm text-slate-800 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-300/40 focus:outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="px-2 text-slate-400 dark:text-gold-300/40 hover:text-slate-600 dark:hover:text-gold-200"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                        showFilters || activeFilterCount > 0
                            ? 'bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-400 border border-brand-200 dark:border-gold-800'
                            : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-gold-200/60 hover:bg-slate-200 dark:hover:bg-ink-700'
                    }`}
                >
                    <Filter size={16} />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 text-xs">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
                {activeFilterCount > 0 && (
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-slate-400 dark:text-gold-200/50 hover:text-red-500 dark:hover:text-red-400 transition flex items-center gap-1 whitespace-nowrap"
                    >
                        <XClose size={14} /> Clear all
                    </button>
                )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 mb-4 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Search Field */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Search size={14} /> Search In
                            </label>
                            <select
                                value={searchField}
                                onChange={(e) => setSearchField(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="all">All Fields</option>
                                <option value="name">Name</option>
                                <option value="email">Email</option>
                                <option value="school">School</option>
                            </select>
                        </div>

                        {/* Account Type */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <User size={14} /> Account Type
                            </label>
                            <select
                                value={accountTypeFilter}
                                onChange={(e) => setAccountTypeFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="all">All Types</option>
                                <option value="buyer">Buyer</option>
                                <option value="seller">Seller</option>
                            </select>
                        </div>

                        {/* Role */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Crown size={14} /> Role
                            </label>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="all">All Roles</option>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <ShieldCheck size={14} /> Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="all">All Status</option>
                                <option value="verified">Verified</option>
                                <option value="unverified">Unverified</option>
                                <option value="active">Active</option>
                                <option value="banned">Banned</option>
                            </select>
                        </div>

                        {/* School */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <School size={14} /> School
                            </label>
                            <select
                                value={schoolFilter}
                                onChange={(e) => setSchoolFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="">All Schools</option>
                                {schools.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort By */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <ArrowUpDown size={14} /> Sort By
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="name">Name (A-Z)</option>
                                <option value="email">Email (A-Z)</option>
                                <option value="school">School (A-Z)</option>
                            </select>
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Calendar size={14} /> From Date
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Calendar size={14} /> To Date
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Results Count */}
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-400 dark:text-gold-200/50">
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                </p>
            </div>

            {/* Users List */}
            {filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-gold-200/40">No users found matching your filters.</div>
            ) : (
                <div className="space-y-2">
                    {filteredUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 flex-wrap">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">{u.name}</p>
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">{u.university_email}</p>
                                {u.school && (
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">🏫 {u.school}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <Tag color={u.role === 'admin' ? 'gold' : 'slate'}>{u.role}</Tag>
                                    <Tag color={u.account_type === 'seller' ? 'red' : 'blue'}>{u.account_type}</Tag>
                                    <Tag color={u.verified ? 'emerald' : 'amber'}>{u.verified ? 'Verified' : 'Unverified'}</Tag>
                                    {u.banned && <Tag color="red">Banned</Tag>}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                <IconButton
                                    onClick={() => updateUser(u.id, { verified: !u.verified })}
                                    title={u.verified ? 'Unverify' : 'Verify'}
                                    active={u.verified}
                                >
                                    {u.verified ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                                </IconButton>
                                <IconButton
                                    onClick={() => updateUser(u.id, { banned: !u.banned })}
                                    title={u.banned ? 'Unban' : 'Ban'}
                                    active={u.banned}
                                    danger
                                >
                                    {u.banned ? <CheckCircle size={15} /> : <Ban size={15} />}
                                </IconButton>
                                <IconButton
                                    onClick={() => updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                                    title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                                    active={u.role === 'admin'}
                                >
                                    <Crown size={15} />
                                </IconButton>
                                <IconButton
                                    onClick={() => setSelectedUser(u)}
                                    title="Investigate"
                                    className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                    <Eye size={15} />
                                </IconButton>
                                <IconButton
                                    onClick={() => deleteUser(u.id)}
                                    title="Delete account"
                                    danger
                                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                    <Trash2 size={15} />
                                </IconButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <InvestigateModal
                user={selectedUser}
                open={!!selectedUser}
                onClose={() => setSelectedUser(null)}
            />
        </div>
    );
}

// ---------- InvestigateModal (same as before) ----------
function InvestigateModal({ user, open, onClose }) {
    const [orders, setOrders] = useState([]);
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && user) {
            setLoading(true);
            Promise.all([
                api.get(`/admin/users/${user.id}/orders`).then(res => res.data).catch(() => []),
                api.get(`/admin/users/${user.id}/listings`).then(res => res.data).catch(() => []),
            ]).then(([ordersData, listingsData]) => {
                setOrders(ordersData);
                setListings(listingsData);
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [open, user]);

    if (!open || !user) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 border border-slate-200 dark:border-ink-600">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-300/50 transition"
                >
                    <X size={18} />
                </button>

                <h2 className="text-xl font-extrabold text-slate-900 dark:text-gold-50">Investigate Account</h2>
                <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">{user.university_email}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm bg-slate-50 dark:bg-ink-700 rounded-xl p-4">
                    <div><span className="text-slate-400 dark:text-gold-200/50">Name</span><br /><span className="font-semibold text-slate-800 dark:text-gold-100">{user.name}</span></div>
                    <div><span className="text-slate-400 dark:text-gold-200/50">Account Type</span><br /><span className="font-semibold text-slate-800 dark:text-gold-100 capitalize">{user.account_type}</span></div>
                    <div><span className="text-slate-400 dark:text-gold-200/50">Role</span><br /><span className="font-semibold text-slate-800 dark:text-gold-100 capitalize">{user.role}</span></div>
                    <div><span className="text-slate-400 dark:text-gold-200/50">Verified</span><br /><span className={`font-semibold ${user.verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{user.verified ? '✅ Yes' : '❌ No'}</span></div>
                    <div><span className="text-slate-400 dark:text-gold-200/50">Banned</span><br /><span className={`font-semibold ${user.banned ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{user.banned ? '🚫 Yes' : '✅ No'}</span></div>
                    <div><span className="text-slate-400 dark:text-gold-200/50">Joined</span><br /><span className="font-semibold text-slate-800 dark:text-gold-100">{new Date(user.created_at).toLocaleDateString()}</span></div>
                </div>

                <div className="mt-4">
                    <h3 className="font-bold text-slate-800 dark:text-gold-100 mb-2">Listings ({listings.length})</h3>
                    {loading ? (
                        <div className="text-center py-4 text-slate-400 dark:text-gold-200/50">Loading...</div>
                    ) : listings.length === 0 ? (
                        <p className="text-sm text-slate-400 dark:text-gold-200/50">No listings found.</p>
                    ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {listings.map((p) => (
                                <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-ink-700 rounded-lg px-3 py-2">
                                    <span className="text-slate-700 dark:text-gold-100 truncate">{p.title}</span>
                                    <span className="text-slate-400 dark:text-gold-200/50">GHS {parseFloat(p.price).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-4">
                    <h3 className="font-bold text-slate-800 dark:text-gold-100 mb-2">Orders ({orders.length})</h3>
                    {loading ? (
                        <div className="text-center py-4 text-slate-400 dark:text-gold-200/50">Loading...</div>
                    ) : orders.length === 0 ? (
                        <p className="text-sm text-slate-400 dark:text-gold-200/50">No orders found.</p>
                    ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {orders.map((o) => (
                                <div key={o.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-ink-700 rounded-lg px-3 py-2">
                                    <span className="text-slate-700 dark:text-gold-100">Order #{o.id}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                                        o.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                        o.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-gold-900/40 dark:text-gold-400' :
                                        'bg-slate-100 text-slate-500 dark:bg-ink-700 dark:text-gold-200/50'
                                    }`}>{o.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------- ListingsTab (same as before) ----------
function ListingsTab({ filter, initialListings, loading }) {
    const [allListings, setAllListings] = useState([]);
    const [filteredListings, setFilteredListings] = useState([]);
    const [localLoading, setLocalLoading] = useState(loading);
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);

    const [selectedUser, setSelectedUser] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedStockSort, setSelectedStockSort] = useState('');
    const [selectedDateSort, setSelectedDateSort] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (initialListings && initialListings.length > 0) {
            setAllListings(initialListings);
            setFilteredListings(initialListings);
            setLocalLoading(false);
        } else if (!filter) {
            setLocalLoading(true);
            Promise.all([
                api.get('/admin/listings').then(res => res.data),
                api.get('/categories').then(res => res.data).catch(() => []),
                api.get('/admin/users').then(res => res.data).catch(() => []),
            ]).then(([listings, cats, usersData]) => {
                setAllListings(listings);
                setFilteredListings(listings);
                setCategories(cats || []);
                setUsers(usersData || []);
            }).finally(() => setLocalLoading(false));
        }
    }, [initialListings, filter]);

    useEffect(() => {
        let result = [...allListings];

        if (filter) {
            result = result.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()));
        }

        if (selectedUser) {
            result = result.filter(p => p.seller_id === selectedUser || p.seller_name?.toLowerCase().includes(selectedUser.toLowerCase()));
        }

        if (selectedCategory) {
            result = result.filter(p => p.category?.toLowerCase().includes(selectedCategory.toLowerCase()));
        }

        if (dateFrom) {
            result = result.filter(p => new Date(p.created_at) >= new Date(dateFrom));
        }
        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(p => new Date(p.created_at) <= endDate);
        }

        if (selectedStockSort === 'highest') {
            result.sort((a, b) => (b.stock || 0) - (a.stock || 0));
        } else if (selectedStockSort === 'lowest') {
            result.sort((a, b) => (a.stock || 0) - (b.stock || 0));
        }

        if (selectedDateSort === 'newest') {
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (selectedDateSort === 'oldest') {
            result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        setFilteredListings(result);
    }, [allListings, filter, selectedUser, selectedCategory, selectedStockSort, selectedDateSort, dateFrom, dateTo]);

    const remove = async (id) => {
        try {
            await api.delete(`/admin/listings/${id}`);
            toast.success('Listing removed');
            const res = await api.get('/admin/listings');
            setAllListings(res.data);
        } catch {
            toast.error('Failed to remove listing');
        }
    };

    const clearAllFilters = () => {
        setSelectedUser('');
        setSelectedCategory('');
        setSelectedStockSort('');
        setSelectedDateSort('');
        setDateFrom('');
        setDateTo('');
    };

    const activeFilterCount = [selectedUser, selectedCategory, selectedStockSort, selectedDateSort, dateFrom, dateTo].filter(Boolean).length;

    if (localLoading) return <SkeletonList />;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-400 border border-brand-200 dark:border-gold-800'
                                : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-gold-200/60 hover:bg-slate-200 dark:hover:bg-ink-700'
                        }`}
                    >
                        <Filter size={16} />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 text-xs">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-slate-400 dark:text-gold-200/50 hover:text-red-500 dark:hover:text-red-400 transition flex items-center gap-1"
                        >
                            <XClose size={14} /> Clear all
                        </button>
                    )}
                </div>
                <p className="text-sm text-slate-400 dark:text-gold-200/50">
                    {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
                </p>
            </div>

            {showFilters && (
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 mb-4 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <User size={14} /> Seller
                            </label>
                            <select
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="">All Sellers</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.university_email})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <TagIcon size={14} /> Category
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="">All Categories</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Layers size={14} /> Stock
                            </label>
                            <select
                                value={selectedStockSort}
                                onChange={(e) => setSelectedStockSort(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="">Default</option>
                                <option value="highest">Highest Stock</option>
                                <option value="lowest">Lowest Stock</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Calendar size={14} /> From Date
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <Calendar size={14} /> To Date
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                                <ArrowUpDown size={14} /> Date Sort
                            </label>
                            <select
                                value={selectedDateSort}
                                onChange={(e) => setSelectedDateSort(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none transition"
                            >
                                <option value="">Default</option>
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {filteredListings.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-gold-200/40">
                    No listings found matching your filters.
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredListings.map((p) => (
                        <div key={p.id} className="flex items-center gap-4 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-3 hover:border-brand-300 dark:hover:border-gold-500 transition">
                            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-ink-700 overflow-hidden shrink-0">
                                {p.primary_image && <img src={p.primary_image} className="w-full h-full object-cover" alt={p.title} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 dark:text-gold-100 text-sm truncate">{p.title}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-gold-200/50 flex-wrap">
                                    <span>{p.seller_name}</span>
                                    <span>·</span>
                                    <span className="font-medium text-slate-600 dark:text-gold-200/70">GHS {parseFloat(p.price).toFixed(2)}</span>
                                    <span>·</span>
                                    <span className="font-medium text-slate-600 dark:text-gold-200/70">Stock: {p.stock}</span>
                                    {p.category && (
                                        <>
                                            <span>·</span>
                                            <Tag color="slate">{p.category}</Tag>
                                        </>
                                    )}
                                    <span>·</span>
                                    <span className="text-slate-400 dark:text-gold-200/40">
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => remove(p.id)} 
                                className="text-slate-300 dark:text-gold-300/40 hover:text-red-500 p-1.5 transition shrink-0"
                                title="Delete listing"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------- OrdersTab (same as before) ----------
function OrdersTab() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        api.get('/admin/orders').then((res) => setOrders(res.data)).finally(() => setLoading(false));
    }, []);

    const runSearch = async (e) => {
        e.preventDefault();
        if (!search.trim()) {
            setSearching(false);
            api.get('/admin/orders').then((res) => setOrders(res.data));
            return;
        }
        setSearching(true);
        setLoading(true);
        try {
            const res = await api.get('/admin/orders/search', { params: { q: search.trim() } });
            setOrders(res.data);
        } catch {
            toast.error('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const openOrder = async (id) => {
        setLoadingDetail(true);
        try {
            const res = await api.get(`/admin/orders/${id}`);
            setSelectedOrder(res.data);
        } catch {
            toast.error('Failed to load order details');
        } finally {
            setLoadingDetail(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <form onSubmit={runSearch} className="flex gap-2 mb-4">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by order ID, buyer name, email, or item…"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                />
                <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition"
                >
                    Search
                </button>
            </form>

            {loading ? (
                <SkeletonList />
            ) : orders.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-gold-200/40">
                    {searching ? `No orders found for "${search}".` : 'No orders yet.'}
                </div>
            ) : (
                <div className="space-y-2">
                    {orders.map((o) => (
                        <button
                            key={o.id}
                            onClick={() => openOrder(o.id)}
                            className="w-full flex items-center justify-between gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 hover:border-brand-300 dark:hover:border-gold-500 rounded-2xl p-4 text-left transition"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 font-mono truncate">
                                    #{o.id}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">
                                    {o.buyer_name} · {o.delivery_method} · {new Date(o.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-gold-50">GHS {parseFloat(o.total_amount).toFixed(2)}</p>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300 capitalize">{o.status}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {(selectedOrder || loadingDetail) && (
                <OrderDetailModal
                    order={selectedOrder}
                    loading={loadingDetail}
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
}

function OrderDetailModal({ order, loading, onClose }) {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6">
                {loading || !order ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-ink-700 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3 mb-5">
                            <div>
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 font-mono">#{order.id}</p>
                                <h3 className="text-lg font-extrabold text-slate-900 dark:text-gold-50 mt-1">Order details</h3>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300 capitalize shrink-0">
                                {order.status}
                            </span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 mb-5">
                            <DetailBlock title="Buyer">
                                <p className="font-semibold text-slate-800 dark:text-gold-100">{order.buyer_name}</p>
                                <p>{order.buyer_email}</p>
                                {order.buyer_whatsapp && <p>WhatsApp: {order.buyer_whatsapp}</p>}
                                {order.buyer_location && <p>Location: {order.buyer_location}</p>}
                            </DetailBlock>

                            <DetailBlock title="Order timing">
                                <p>Placed: {new Date(order.created_at).toLocaleString()}</p>
                                {order.completed_at && <p>Completed: {new Date(order.completed_at).toLocaleString()}</p>}
                                <p className="mt-1">Delivery method: <span className="capitalize font-semibold text-slate-700 dark:text-gold-100">{order.delivery_method}</span></p>
                                {order.payment_reference && <p className="font-mono text-[11px] mt-1">Ref: {order.payment_reference}</p>}
                            </DetailBlock>
                        </div>

                        <div className="mb-5">
                            <p className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide mb-2">Items ({order.items.length})</p>
                            <div className="space-y-2">
                                {order.items.map((item) => (
                                    <div key={item.id} className="bg-slate-50 dark:bg-ink-700 rounded-xl p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">{item.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-0.5">
                                                    Qty {item.quantity} · GHS {parseFloat(item.price_at_purchase).toFixed(2)} each
                                                </p>
                                            </div>
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-ink-800 text-slate-600 dark:text-gold-200/70 capitalize shrink-0">
                                                {item.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-ink-600 text-xs">
                                            <div>
                                                <p className="text-slate-400 dark:text-gold-200/50">Seller</p>
                                                <p className="font-semibold text-slate-700 dark:text-gold-100 truncate">{item.seller_name}</p>
                                                <p className="text-slate-400 dark:text-gold-200/40 truncate">{item.seller_email}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 dark:text-gold-200/50">Platform fee</p>
                                                <p className="font-semibold text-slate-700 dark:text-gold-100">GHS {parseFloat(item.platform_fee).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 dark:text-gold-200/50">Seller earnings</p>
                                                <p className="font-semibold text-brand-700 dark:text-gold-400">GHS {parseFloat(item.seller_earnings).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-ink-600 pt-4 space-y-1.5 text-sm">
                            <div className="flex justify-between text-slate-500 dark:text-gold-200/60">
                                <span>Subtotal</span>
                                <span>GHS {parseFloat(order.subtotal).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 dark:text-gold-200/60">
                                <span>Delivery fee</span>
                                <span>GHS {parseFloat(order.delivery_fee).toFixed(2)}</span>
                            </div>
                            {parseFloat(order.credit_applied) > 0 && (
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                    <span>Credit applied</span>
                                    <span>−GHS {parseFloat(order.credit_applied).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-slate-900 dark:text-gold-50 text-base pt-1.5 border-t border-slate-100 dark:border-ink-600 mt-1.5">
                                <span>Total paid</span>
                                <span>GHS {parseFloat(order.total_amount).toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full mt-6 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                        >
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function DetailBlock({ title, children }) {
    return (
        <div className="bg-slate-50 dark:bg-ink-700 rounded-xl p-3.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide mb-2">{title}</p>
            <div className="text-sm text-slate-600 dark:text-gold-200/70 space-y-0.5">{children}</div>
        </div>
    );
}

// ---------- ReportsTab (same as before) ----------
const REPORT_STATUS_FILTERS = ['pending', 'reviewed', 'dismissed', 'actioned'];

const REASON_LABELS = {
    scam: 'Scam or fraud',
    fake_listing: 'Fake or misleading listing',
    inappropriate: 'Inappropriate content',
    harassment: 'Harassment or unsafe behavior',
    other: 'Something else',
    ban_review: 'Ban review request',
};

function ReportsTab() {
    const [reports, setReports] = useState([]);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        api.get('/reports', { params: { status: statusFilter } })
            .then((res) => setReports(res.data))
            .finally(() => setLoading(false));
    };
    useEffect(load, [statusFilter]);

    const updateStatus = async (id, status) => {
        try {
            await api.patch(`/reports/${id}`, { status });
            toast.success('Report updated');
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update report');
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-ink-800 p-1 rounded-xl w-fit mx-auto">
                {REPORT_STATUS_FILTERS.map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                            statusFilter === s
                                ? 'bg-white dark:bg-ink-700 shadow-sm text-brand-700 dark:text-gold-400'
                                : 'text-slate-500 dark:text-gold-200/50'
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {loading ? (
                <SkeletonList />
            ) : reports.length === 0 ? (
                <div className="text-center py-16">
                    <Flag className="mx-auto text-slate-300 dark:text-gold-300/30 mb-3" size={28} />
                    <p className="text-sm text-slate-400 dark:text-gold-200/50">No {statusFilter} reports.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {reports.map((r) => (
                        <div key={r.id} className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Tag color="red">{REASON_LABELS[r.reason] || r.reason}</Tag>
                                        <span className="text-xs text-slate-400 dark:text-gold-200/50">
                                            {new Date(r.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {r.product_title && (
                                        <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 mt-1.5">
                                            Listing: {r.product_title}
                                        </p>
                                    )}
                                    {r.reported_user_name && (
                                        <p className="text-sm text-slate-600 dark:text-gold-100/80 mt-0.5">
                                            User: {r.reported_user_name}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1">
                                        Reported by {r.reporter_name} ({r.reporter_email})
                                    </p>
                                    {r.details && (
                                        <p className="text-sm text-slate-600 dark:text-gold-100/80 mt-2 bg-slate-50 dark:bg-ink-700 rounded-lg p-2.5">
                                            {r.details}
                                        </p>
                                    )}
                                </div>

                                {r.status === 'pending' && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <IconButton
                                            onClick={() => updateStatus(r.id, 'dismissed')}
                                            title="Dismiss"
                                        >
                                            <XCircle size={15} />
                                        </IconButton>
                                        <IconButton
                                            onClick={() => updateStatus(r.id, 'actioned')}
                                            title="Mark as actioned"
                                            danger
                                        >
                                            <ShieldAlert size={15} />
                                        </IconButton>
                                    </div>
                                )}
                                {r.status !== 'pending' && (
                                    <Tag color={r.status === 'actioned' ? 'red' : 'slate'}>{r.status}</Tag>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------- DeletedChatsTab ----------
function DeletedChatsTab() {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedChat, setSelectedChat] = useState(null);

    useEffect(() => {
        api.get('/admin/deleted-chats').then((res) => setChats(res.data)).finally(() => setLoading(false));
    }, []);

    if (loading) return <SkeletonList />;

    if (chats.length === 0) {
        return (
            <div className="text-center py-16">
                <Trash2 className="mx-auto text-slate-300 dark:text-gold-300/30 mb-3" size={28} />
                <p className="text-sm text-slate-400 dark:text-gold-200/50">No chats have been deleted for everyone yet.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <p className="text-sm text-slate-400 dark:text-gold-200/50 mb-4">
                {chats.length} conversation{chats.length !== 1 ? 's' : ''} deleted for everyone
            </p>
            <div className="space-y-2">
                {chats.map((c) => (
                    <button
                        key={c.conversation_id}
                        onClick={() => setSelectedChat(c)}
                        className="w-full flex items-center justify-between gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 hover:border-brand-300 dark:hover:border-gold-500 rounded-2xl p-4 text-left transition"
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">
                                {c.buyer_name} ↔ {c.seller_name}
                            </p>
                            {c.product_title && (
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">Re: {c.product_title}</p>
                            )}
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1">
                                Deleted by <span className="font-semibold text-slate-600 dark:text-gold-200/70">{c.deleted_by_name}</span> ({c.deleted_by_email})
                            </p>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-gold-200/50 shrink-0">
                            {new Date(c.deleted_for_everyone_at).toLocaleString()}
                        </span>
                    </button>
                ))}
            </div>

            <DeletedChatDetailModal
                chat={selectedChat}
                open={!!selectedChat}
                onClose={() => setSelectedChat(null)}
            />
        </div>
    );
}

function DeletedChatDetailModal({ chat, open, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && chat) {
            setLoading(true);
            api.get(`/admin/deleted-chats/${chat.conversation_id}/messages`)
                .then((res) => setMessages(res.data))
                .catch(() => setMessages([]))
                .finally(() => setLoading(false));
        }
    }, [open, chat]);

    if (!open || !chat) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 border border-slate-200 dark:border-ink-600">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-300/50 transition"
                >
                    <X size={18} />
                </button>

                <h2 className="text-xl font-extrabold text-slate-900 dark:text-gold-50">Deleted conversation</h2>
                <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">
                    {chat.buyer_name} ({chat.buyer_email}) ↔ {chat.seller_name} ({chat.seller_email})
                </p>

                <div className="mt-4 bg-slate-50 dark:bg-ink-700 rounded-xl p-4 text-sm">
                    <p className="text-slate-500 dark:text-gold-200/60">
                        Deleted by <span className="font-semibold text-slate-800 dark:text-gold-100">{chat.deleted_by_name}</span> on{' '}
                        {new Date(chat.deleted_for_everyone_at).toLocaleString()}
                    </p>
                </div>

                <div className="mt-4">
                    <h3 className="font-bold text-slate-800 dark:text-gold-100 mb-2">
                        Full message history ({messages.length})
                    </h3>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-ink-700 animate-pulse" />
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        <p className="text-sm text-slate-400 dark:text-gold-200/50">No messages found.</p>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {messages.map((m) => {
                                const isBuyer = m.sender_id === chat.buyer_id;
                                return (
                                    <div key={m.id} className="bg-slate-50 dark:bg-ink-700 rounded-xl p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-slate-600 dark:text-gold-200/70">
                                                {isBuyer ? chat.buyer_name : chat.seller_name}
                                            </span>
                                            <span className="text-[11px] text-slate-400 dark:text-gold-200/50">
                                                {new Date(m.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        {m.content && (
                                            <p className="text-sm text-slate-700 dark:text-gold-100 mt-1">{m.content}</p>
                                        )}
                                        {m.media_type === 'image' && m.media_url && (
                                            <img src={m.media_url} alt="" className="mt-2 max-w-[200px] rounded-lg" />
                                        )}
                                        {m.media_type === 'audio' && m.media_url && (
                                            <audio controls src={m.media_url} className="mt-2 max-w-full" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------- Helpers ----------
function Tag({ children, color }) {
    const colors = {
        slate: 'bg-slate-100 dark:bg-ink-700 text-slate-600 dark:text-gold-200/60',
        gold: 'bg-amber-50 dark:bg-gold-900/40 text-amber-700 dark:text-gold-300',
        red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
        blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
        amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
    };
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${colors[color] || colors.slate}`}>
            {children}
        </span>
    );
}

function IconButton({ children, onClick, title, active, danger, className = '' }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded-lg transition ${className} ${
                active
                    ? danger
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        : 'bg-brand-50 dark:bg-gold-900/40 text-brand-600 dark:text-gold-400'
                    : 'text-slate-400 dark:text-gold-300/40 hover:bg-slate-100 dark:hover:bg-ink-700'
            }`}
        >
            {children}
        </button>
    );
}

function SkeletonList() {
    return (
        <div className="max-w-3xl mx-auto space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />
            ))}
        </div>
    );
}