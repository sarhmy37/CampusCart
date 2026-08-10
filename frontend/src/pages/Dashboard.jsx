import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
    Trash2, Plus, ShoppingBag, TrendingUp, Tag, Wallet, Percent,
    Award, AlertTriangle, Store, Package, Landmark
} from 'lucide-react';

const PERIODS = [
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: '6months', label: 'Last 6 months' },
    { value: 'year', label: 'This year' },
    { value: 'all', label: 'All time' },
];

export default function Dashboard() {
    const { user } = useAuth();
    const isSeller = user?.account_type === 'seller';
    const [tab, setTab] = useState(isSeller ? 'overview' : 'orders');
    const [period, setPeriod] = useState('month');
    const [stats, setStats] = useState({ listings: 0, orders: 0, sales: 0, completed: 0, pending: 0 });

    useEffect(() => {
        if (isSeller) {
            Promise.all([
                api.get('/products/mine').catch(() => ({ data: [] })),
                api.get('/orders/sales').catch(() => ({ data: [] })),
            ]).then(([listings, sales]) => {
                setStats((s) => ({ ...s, listings: listings.data.length, sales: sales.data.length }));
            });
        } else {
            api.get('/orders/mine').catch(() => ({ data: [] })).then((res) => {
                const orders = res.data;
                setStats({
                    listings: 0,
                    orders: orders.length,
                    sales: 0,
                    completed: orders.filter((o) => o.status === 'completed').length,
                    pending: orders.filter((o) => o.status !== 'completed').length,
                });
            });
        }
    }, [isSeller]);

    const tabs = isSeller
        ? ['overview', 'listings', 'orders', 'sales', 'payouts']
        : ['orders'];

    return (
        <div>
            {/* HEADER */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-600">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 rounded-full blur-3xl" />
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Hi, {user.name.split(' ')[0]} 👋</h1>
                            <p className="text-white/70 text-sm mt-1">{user.university_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                className="bg-white/10 text-white text-sm font-semibold px-4 py-2.5 rounded-full border border-white/30 backdrop-blur focus:outline-none cursor-pointer"
                            >
                                {PERIODS.map((p) => (
                                    <option key={p.value} value={p.value} className="text-slate-900">{p.label}</option>
                                ))}
                            </select>
                            {isSeller && (
                                <Link
                                    to="/sell/new"
                                    className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold px-5 py-2.5 rounded-full hover:bg-brand-50 transition shadow-sm text-sm"
                                >
                                    <Plus size={16} /> New Listing
                                </Link>
                            )}
                        </div>
                    </div>

                   <div className="grid grid-cols-3 gap-3 mt-8">
                        {isSeller ? (
                            <>
                                <StatCard icon={Tag} label="Listings" value={stats.listings} />
                                <StatCard icon={ShoppingBag} label="Orders" value={stats.orders} />
                                <StatCard icon={TrendingUp} label="Sales" value={stats.sales} />
                            </>
                        ) : (
                            <>
                                <StatCard icon={ShoppingBag} label="Total orders" value={stats.orders} />
                                <StatCard icon={Package} label="Completed" value={stats.completed} />
                                <StatCard icon={TrendingUp} label="Pending" value={stats.pending} />
                            </>
                        )}
                    </div>
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {tabs.length > 1 && (
                    <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
                        {tabs.map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition whitespace-nowrap ${tab === t ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'overview' && <SellerOverview period={period} />}
                {tab === 'listings' && <MyListings />}
                {tab === 'orders' && <MyOrders period={period} isSeller={isSeller} />}
                {tab === 'sales' && <MySales />}
                {tab === 'payouts' && <PayoutSettings />}
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

function PayoutSettings() {
    const [method, setMethod] = useState('bank'); // 'bank' | 'mobile_money'
    const [banks, setBanks] = useState([]);
    const [form, setForm] = useState({ bank_code: '', account_number: '', account_name: '' });
    const [resolving, setResolving] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/payouts/banks').catch(() => ({ data: [] })),
            api.get('/payouts/me').catch(() => ({ data: null })),
        ]).then(([b, mine]) => {
            setBanks(b.data);
            setSaved(mine.data);
            if (mine.data?.method) setMethod(mine.data.method);
        }).finally(() => setLoading(false));
    }, []);

    // Auto-resolve account name once both bank/network + full account number are entered
    useEffect(() => {
        if (!form.bank_code || form.account_number.length < 9) return;
        setResolving(true);
        const t = setTimeout(() => {
            api.post('/payouts/resolve-account', { bank_code: form.bank_code, account_number: form.account_number })
                .then((res) => setForm((f) => ({ ...f, account_name: res.data.account_name })))
                .catch(() => setForm((f) => ({ ...f, account_name: '' })))
                .finally(() => setResolving(false));
        }, 500);
        return () => clearTimeout(t);
    }, [form.bank_code, form.account_number]);

    const switchMethod = (m) => {
        setMethod(m);
        setForm({ bank_code: '', account_number: '', account_name: '' });
    };

    const handleSave = async () => {
        if (!form.bank_code || !form.account_number || !form.account_name) {
            toast.error(method === 'bank' ? 'Fill in your bank details first' : 'Fill in your Mobile Money details first');
            return;
        }
        setSaving(true);
        try {
            const res = await api.post('/payouts/me', { ...form, method });
            setSaved(res.data);
            toast.success('Payout details saved');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save payout details');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SkeletonList />;

    const filteredBanks = banks.filter((b) =>
        method === 'bank' ? b.type !== 'mobile_money' : b.type === 'mobile_money'
    );

    return (
        <div className="max-w-md">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                        <Landmark size={16} />
                    </div>
                    <h2 className="font-bold text-slate-900">Payout account</h2>
                </div>
                <p className="text-xs text-slate-400 mb-5">
                    This is where your earnings (95% of each sale) get paid out to.
                </p>

                {/* METHOD SWITCH */}
                <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => switchMethod('bank')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${method === 'bank' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}
                    >
                        Bank
                    </button>
                    <button
                        onClick={() => switchMethod('mobile_money')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${method === 'mobile_money' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}
                    >
                        Mobile Money
                    </button>
                </div>

                {saved?.account_number && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                        <p className="text-sm font-semibold text-emerald-800">{saved.account_name}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                            {saved.bank_name} · •••• {saved.account_number.slice(-4)}
                        </p>
                    </div>
                )}

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500">
                            {method === 'bank' ? 'Bank' : 'Network'}
                        </label>
                        <select
                            value={form.bank_code}
                            onChange={(e) => setForm({ ...form, bank_code: e.target.value, account_name: '' })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm"
                        >
                            <option value="">{method === 'bank' ? 'Select your bank' : 'Select your network'}</option>
                            {filteredBanks.map((b) => (
                                <option key={b.code} value={b.code}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500">
                            {method === 'bank' ? 'Account number' : 'Mobile Money number'}
                        </label>
                        <input
                            value={form.account_number}
                            onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, ''), account_name: '' })}
                            placeholder={method === 'bank' ? '0123456789' : '0551234567'}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm"
                        />
                    </div>

                    {(resolving || form.account_name) && (
                        <div className="text-sm px-1">
                            {resolving ? (
                                <span className="text-slate-400">Resolving account name…</span>
                            ) : (
                                <span className="font-semibold text-slate-800">{form.account_name}</span>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || !form.account_name}
                        className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save payout account'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SellerOverview({ period }) {
    const [overview, setOverview] = useState(null);
    const [rewards, setRewards] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get('/sellers/overview', { params: { period } }),
            api.get('/sellers/rewards'),
        ])
            .then(([o, r]) => { setOverview(o.data); setRewards(r.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [period]);

    if (loading) return <SkeletonList />;
    if (!overview) return <EmptyState icon={Store} text="Couldn't load your overview right now." />;

    const rewardProgress = rewards ? (rewards.progress / rewards.next_milestone) * 100 : 0;

    return (
        <div className="space-y-5">
            {overview.restricted && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-800">Your listings are hidden</p>
                        <p className="text-xs text-red-600 mt-0.5">
                            You have an overdue platform fee balance of GHS {parseFloat(overview.pending_payment_due).toFixed(2)}.
                            Pay it in Settings to restore your listings and start selling again.
                        </p>
                        <Link to="/settings" className="inline-block mt-2 text-xs font-bold text-red-700 underline">
                            Go to Settings
                        </Link>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard icon={Wallet} label="Gross sales" value={`GHS ${parseFloat(overview.gross_sales).toFixed(2)}`} />
                <MetricCard icon={Percent} label="Platform fees" value={`GHS ${parseFloat(overview.platform_fees).toFixed(2)}`} />
                <MetricCard icon={TrendingUp} label="Net earnings" value={`GHS ${parseFloat(overview.net_earnings).toFixed(2)}`} highlight />
                <MetricCard icon={Award} label="Rewards earned" value={`GHS ${parseFloat(overview.total_rewards).toFixed(2)}`} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Successful sales</p>
                    <p className="text-2xl font-extrabold text-slate-900">{overview.successful_sales}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Active listings</p>
                    <p className="text-2xl font-extrabold text-slate-900">{overview.active_listings}</p>
                </div>
            </div>

            {rewards && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Award size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Next reward</h3>
                            <p className="text-xs text-slate-400">0.5% of earnings every 30 successful sales</p>
                        </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${rewardProgress}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{rewards.progress} / {rewards.next_milestone} successful sales</p>

                    {rewards.rewards.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                            {rewards.rewards.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Milestone {r.milestone} sales</span>
                                    <span className="font-semibold text-brand-700">+GHS {parseFloat(r.reward_amount).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, highlight }) {
    return (
        <div className={`rounded-2xl p-4 border ${highlight ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
            <Icon size={16} className={highlight ? 'text-brand-600 mb-2' : 'text-slate-400 mb-2'} />
            <p className={`text-lg font-extrabold ${highlight ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
    );
}

function MyListings() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        api.get('/products/mine').then((res) => setProducts(res.data)).finally(() => setLoading(false));
    };
    useEffect(load, []);

    const remove = async (id) => {
        try {
            await api.delete(`/products/${id}`);
            toast.success('Listing removed');
            load();
        } catch {
            toast.error('Failed to remove listing');
        }
    };

    if (loading) return <SkeletonList />;
    if (products.length === 0) return <EmptyState icon={Tag} text="You haven't listed anything yet." cta="List an item" ctaLink="/sell/new" />;

    return (
        <div className="space-y-2">
            {products.map((p) => (
                <div key={p.id} className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-3 hover:shadow-sm transition">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                        {p.primary_image && <img src={p.primary_image} className="w-full h-full object-cover" alt={p.title} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{p.title}</p>
                        <p className="text-xs text-slate-400 capitalize mt-0.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${p.status === 'available' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {p.status} · GHS {parseFloat(p.price).toFixed(2)}
                        </p>
                    </div>
                    <button onClick={() => remove(p.id)} className="text-slate-300 hover:text-red-500 p-1.5 transition">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function MyOrders({ period, isSeller }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get('/orders/mine', { params: { period } })
            .then((res) => setOrders(res.data))
            .finally(() => setLoading(false));
    }, [period]);

    if (loading) return <SkeletonList />;
    if (orders.length === 0) return <EmptyState icon={ShoppingBag} text="No orders yet." cta="Browse listings" ctaLink="/browse" />;

    return (
        <div className="space-y-3">
            {orders.map((o) => (
                <div key={o.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-sm text-slate-800">Order #{o.id}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 capitalize">{o.status}</span>
                    </div>
                    {o.items?.map((item) => (
                        <p key={item.id} className="text-xs text-slate-500">{item.title} × {item.quantity}</p>
                    ))}
                    <p className="text-sm font-bold text-slate-900 mt-2">GHS {parseFloat(o.total_amount).toFixed(2)}</p>
                </div>
            ))}
        </div>
    );
}

const STATUS_STYLES = {
    completed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-slate-100 text-slate-500',
    refunded: 'bg-red-50 text-red-600',
};

function MySales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/orders/sales').then((res) => setSales(res.data)).finally(() => setLoading(false));
    }, []);

    if (loading) return <SkeletonList />;
    if (sales.length === 0) return <EmptyState icon={TrendingUp} text="No sales yet." />;

    return (
        <div className="space-y-2">
            {sales.map((s) => {
                const saleAmount = parseFloat(s.price_at_purchase) * s.quantity;
                return (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-800 text-sm truncate">{s.title}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Buyer: {s.buyer_name} · Qty {s.quantity} · {new Date(s.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[s.status] || 'bg-slate-100 text-slate-500'}`}>
                                {s.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                            <div>
                                <p className="text-slate-400">Sale amount</p>
                                <p className="font-semibold text-slate-800 mt-0.5">GHS {saleAmount.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-slate-400">Platform fee (5%)</p>
                                <p className="font-semibold text-slate-800 mt-0.5">GHS {parseFloat(s.platform_fee).toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-slate-400">Your earnings</p>
                                <p className="font-semibold text-brand-700 mt-0.5">GHS {parseFloat(s.seller_earnings).toFixed(2)}</p>
                            </div>
                        </div>

                        {s.reward_contributed && (
                            <p className="text-xs text-amber-600 font-semibold mt-2">🏆 Counted toward a reward milestone</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
        </div>
    );
}

function EmptyState({ icon: Icon, text, cta, ctaLink }) {
    return (
        <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
                <Icon className="text-brand-400" size={24} />
            </div>
            <p className="text-sm text-slate-400">{text}</p>
            {cta && (
                <Link to={ctaLink} className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition">
                    {cta} →
                </Link>
            )}
        </div>
    );
}