import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import {
    Users, Package, ShoppingBag, DollarSign, ShieldCheck, ShieldAlert,
    Ban, CheckCircle, Trash2, Crown, Flag, XCircle
} from 'lucide-react';

export default function Admin() {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const [tab, setTab] = useState('users');
    const [stats, setStats] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [allListings, setAllListings] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingListings, setLoadingListings] = useState(false);

    // Fetch stats
    useEffect(() => {
        api.get('/admin/stats').then((res) => setStats(res.data)).catch(() => {});
    }, []);

    // Fetch users and listings when search query exists
    useEffect(() => {
        if (!searchQuery) {
            // If no search, we don't need to preload everything
            setAllUsers([]);
            setAllListings([]);
            return;
        }
        // Load both users and listings to decide which tab to show
        setLoadingUsers(true);
        setLoadingListings(true);
        Promise.all([
            api.get('/admin/users').then(res => res.data),
            api.get('/admin/listings').then(res => res.data),
        ]).then(([users, listings]) => {
            setAllUsers(users);
            setAllListings(listings);
            // Decide tab: if any user matches (name or email includes query), switch to users tab
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
            // else keep current tab (default users)
        }).catch(() => {}).finally(() => {
            setLoadingUsers(false);
            setLoadingListings(false);
        });
    }, [searchQuery]);

    // When search is cleared, reset tab to default 'users'
    useEffect(() => {
        if (!searchQuery) {
            setTab('users');
        }
    }, [searchQuery]);

    const handleTabChange = (t) => {
        setTab(t);
        // Clear search param when switching tabs manually
        // We'll just let the search persist but the tab change overrides.
        // We'll rely on the tab's own filter.
    };

    return (
        <div className="bg-white dark:bg-ink-900 min-h-screen">
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Admin Dashboard</h1>
                    <p className="text-white/70 text-sm mt-1">Manage users, listings, and orders</p>

                    {stats && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                            <StatCard icon={Users} label="Users" value={stats.total_users} />
                            <StatCard icon={Package} label="Listings" value={stats.total_products} />
                            <StatCard icon={ShoppingBag} label="Orders" value={stats.total_orders} />
                            <StatCard icon={DollarSign} label="Revenue" value={`GHS ${stats.total_revenue.toFixed(2)}`} />
                        </div>
                    )}
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-ink-800 p-1 rounded-xl w-fit mx-auto">
                    {['users', 'listings', 'orders', 'reports'].map((t) => (
                        <button
                            key={t}
                            onClick={() => handleTabChange(t)}
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
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4">
            <Icon size={18} className="text-white/80 mb-2" />
            <p className="text-2xl font-extrabold text-white">{value}</p>
            <p className="text-xs text-white/70">{label}</p>
        </div>
    );
}

// ---------- UsersTab with filter ----------
function UsersTab({ filter, initialUsers, loading }) {
    const [users, setUsers] = useState(initialUsers || []);
    const [localLoading, setLocalLoading] = useState(loading);

    useEffect(() => {
        if (initialUsers && initialUsers.length > 0) {
            setUsers(initialUsers);
            setLocalLoading(false);
        } else if (!filter) {
            // only fetch if no initial data and no filter (to avoid double fetch)
            setLocalLoading(true);
            api.get('/admin/users').then((res) => {
                setUsers(res.data);
            }).finally(() => setLocalLoading(false));
        }
    }, [initialUsers, filter]);

    // Filter users based on search query
    const filteredUsers = filter
        ? users.filter(u =>
            u.name.toLowerCase().includes(filter.toLowerCase()) ||
            u.university_email.toLowerCase().includes(filter.toLowerCase())
          )
        : users;

    const updateUser = async (id, payload) => {
        try {
            await api.patch(`/admin/users/${id}`, payload);
            toast.success('Updated');
            // refresh
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update user');
        }
    };

    if (localLoading) return <SkeletonList />;

    return (
        <div className="max-w-3xl mx-auto space-y-2">
            {filter && <p className="text-sm text-slate-400 dark:text-gold-200/50">Showing results for "{filter}"</p>}
            {filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-gold-200/40">No users found.</div>
            ) : (
                filteredUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">{u.name}</p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">{u.university_email}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <Tag color={u.role === 'admin' ? 'gold' : 'slate'}>{u.role}</Tag>
                                <Tag color={u.account_type === 'seller' ? 'red' : 'blue'}>{u.account_type}</Tag>
                                <Tag color={u.verified ? 'emerald' : 'amber'}>{u.verified ? 'Verified' : 'Unverified'}</Tag>
                                {u.banned && <Tag color="red">Banned</Tag>}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
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
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

// ---------- ListingsTab with filter ----------
function ListingsTab({ filter, initialListings, loading }) {
    const [listings, setListings] = useState(initialListings || []);
    const [localLoading, setLocalLoading] = useState(loading);

    useEffect(() => {
        if (initialListings && initialListings.length > 0) {
            setListings(initialListings);
            setLocalLoading(false);
        } else if (!filter) {
            setLocalLoading(true);
            api.get('/admin/listings').then((res) => {
                setListings(res.data);
            }).finally(() => setLocalLoading(false));
        }
    }, [initialListings, filter]);

    const filteredListings = filter
        ? listings.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()))
        : listings;

    const remove = async (id) => {
        try {
            await api.delete(`/admin/listings/${id}`);
            toast.success('Listing removed');
            const res = await api.get('/admin/listings');
            setListings(res.data);
        } catch {
            toast.error('Failed to remove listing');
        }
    };

    if (localLoading) return <SkeletonList />;

    return (
        <div className="max-w-3xl mx-auto space-y-2">
            {filter && <p className="text-sm text-slate-400 dark:text-gold-200/50">Showing results for "{filter}"</p>}
            {filteredListings.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-gold-200/40">No listings found.</div>
            ) : (
                filteredListings.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-ink-700 overflow-hidden shrink-0">
                            {p.primary_image && <img src={p.primary_image} className="w-full h-full object-cover" alt={p.title} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-gold-100 text-sm truncate">{p.title}</p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">
                                {p.seller_name} · GHS {parseFloat(p.price).toFixed(2)} · Stock {p.stock}
                            </p>
                        </div>
                        <button onClick={() => remove(p.id)} className="text-slate-300 dark:text-gold-300/40 hover:text-red-500 p-1.5 transition shrink-0">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))
            )}
        </div>
    );
}

// ---------- OrdersTab (unchanged) ----------
function OrdersTab() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/orders').then((res) => setOrders(res.data)).finally(() => setLoading(false));
    }, []);

    if (loading) return <SkeletonList />;

    return (
        <div className="max-w-3xl mx-auto space-y-2">
            {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">Order #{o.id}</p>
                        <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">
                            {o.buyer_name} · {o.delivery_method} · {new Date(o.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-gold-50">GHS {parseFloat(o.total_amount).toFixed(2)}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300 capitalize">{o.status}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---------- ReportsTab (unchanged) ----------
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

function IconButton({ children, onClick, title, active, danger }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded-lg transition ${
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