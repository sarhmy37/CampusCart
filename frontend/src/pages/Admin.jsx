import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import {
    Users, Package, ShoppingBag, DollarSign, ShieldCheck, ShieldAlert,
    Ban, CheckCircle, Trash2, Crown, Flag, XCircle, TrendingUp
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

    // Fetch stats and earnings
    useEffect(() => {
        Promise.all([
            api.get('/admin/stats'),
            api.get('/admin/net-earnings')
        ]).then(([statsRes, earningsRes]) => {
            setStats(statsRes.data);
            setEarnings(earningsRes.data);
        }).catch(() => {});
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
                    
                    {/* Details breakdown for Admin */}
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

function StatCard({ icon: Icon, label, value, highlight }) {
    return (
        <div className={`backdrop-blur border rounded-2xl p-4 ${highlight ? 'bg-white/20 border-white/40' : 'bg-white/10 border-white/20'}`}>
            <Icon size={18} className={`mb-2 ${highlight ? 'text-white' : 'text-white/80'}`} />
            <p className={`text-2xl font-extrabold ${highlight ? 'text-white' : 'text-white'}`}>{value}</p>
            <p className={`text-xs ${highlight ? 'text-white/90' : 'text-white/70'}`}>{label}</p>
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
// ---------- OrdersTab with search + detail view ----------
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