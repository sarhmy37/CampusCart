import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DASHBOARD_VIDEO } from '../data/media';
import ConfirmModal from '../components/ConfirmModal';
import {
    Trash2, Plus, ShoppingBag, TrendingUp, Tag, Wallet, Percent,
    Award, AlertTriangle, Store, Package, Landmark, Pencil, Flag,
    Truck, MapPin, MessageCircle, X, Loader2, ChevronLeft, ChevronRight 
} from 'lucide-react';
import EditListingModal from '../components/EditListingModal';
import ProfileDrawer from '../components/ProfileDrawer';

const PERIODS = [
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: '6months', label: 'Last 6 months' },
    { value: 'year', label: 'This year' },
    { value: 'all', label: 'All time' },
];

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isSeller = user?.account_type === 'seller';
    const [tab, setTab] = useState(isSeller ? 'overview' : 'orders');
    const [period, setPeriod] = useState('month');
    const [showProfile, setShowProfile] = useState(false);
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
        ? ['overview', 'listings', 'orders', 'deliveries', 'sales', 'payouts', 'reports']
        : ['orders', 'reports'];

    return (
        <div>
            {/* HEADER — with video background */}
            <section className="relative overflow-hidden">
                {/* VIDEO BACKGROUND */}
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src={DASHBOARD_VIDEO} type="video/mp4" />
                </video>
                {/* OVERLAYS */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-accent-600/60 dark:from-ink-900/90 dark:via-ink-900/75 dark:to-gold-900/50" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />

                {/* CONTENT */}
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        
                        {/* LEFT SIDE: PRODUCT-DETAIL STYLE BUTTON + NAME */}
                        <div className="flex items-center gap-4 sm:gap-5">
                            {/* ✅ EXACT COPY OF PRODUCT DETAIL CHEVRON STYLE */}
                            <button
                                onClick={() => {
                                    navigate('/');
                                    // ✅ INCREASED DELAY TO 150ms SO THE HOME PAGE LOADS FIRST
                                    setTimeout(() => setShowProfile(true), 150); 
                                }}
                                className="w-8 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg hover:bg-white/30 transition z-10"
                            >
                                <ChevronLeft size={20} />
                            </button>

                            <div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                                    Hi, {user.name.split(' ')[0]} 👋
                                </h1>
                                <p className="text-white/70 text-sm mt-1">{user.university_email}</p>
                            </div>
                        </div>

                        {/* RIGHT SIDE: PERIOD SELECTOR & NEW LISTING BUTTON */}
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
                                    className="inline-flex items-center gap-2 bg-white dark:bg-gold-500 text-brand-700 dark:text-ink-900 font-bold px-5 py-2.5 rounded-full hover:bg-brand-50 dark:hover:bg-gold-400 transition shadow-sm text-sm"
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

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 bg-white dark:bg-ink-900">
                {tabs.length > 1 && (
                    <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-ink-800 p-1 rounded-xl w-full sm:w-fit mx-auto overflow-x-auto">
                        {tabs.map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition whitespace-nowrap ${
                                    tab === t
                                        ? 'bg-white dark:bg-ink-700 shadow-sm text-brand-700 dark:text-gold-400'
                                        : 'text-slate-500 dark:text-gold-200/50'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'overview' && <SellerOverview period={period} />}
                {tab === 'listings' && <MyListings />}
                {tab === 'orders' && <MyOrders period={period} isSeller={isSeller} />}
                {tab === 'deliveries' && <Deliveries />}
                {tab === 'sales' && <MySales />}
                {tab === 'payouts' && <PayoutSettings />}
                {tab === 'reports' && <MyReports />}
                
            </div>

            {/* PROFILE DRAWER RENDERED AT THE BOTTOM INSIDE THE MAIN DIV */}
            <ProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />
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

function Deliveries() {
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState(null);
    const [confirmTarget, setConfirmTarget] = useState(null);

    const load = () => {
        setLoading(true);
        api.get('/orders/deliveries')
            .then((res) => setDeliveries(res.data))
            .catch(() => setDeliveries([]))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handleMarkDelivered = async () => {
        if (!confirmTarget) return;
        setMarking(confirmTarget);
        try {
            await api.post(`/orders/${confirmTarget}/mark-delivered`);
            toast.success("Marked as delivered — buyer's been notified to confirm.");
            setConfirmTarget(null);
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to mark as delivered');
        } finally {
            setMarking(null);
        }
    };

    if (loading) return <SkeletonList />;
    if (deliveries.length === 0) return <EmptyState icon={Truck} text="No deliveries pending right now." />;

    return (
        <div className="max-w-2xl mx-auto space-y-3">
            {deliveries.map((d) => {
                const deadline = new Date(d.created_at);
                deadline.setDate(deadline.getDate() + 3);
                const msLeft = deadline - new Date();
                const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

                return (
                    <div key={d.order_id} className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                        <div className="flex justify-between items-start mb-2 gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-800 dark:text-gold-100">Order #{d.order_id}</p>
                                <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-0.5">Buyer: {d.buyer_name}</p>
                            </div>
                            {d.delivered_at ? (
                                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                    Awaiting buyer confirmation
                                </span>
                            ) : (
                                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-gold-900/40 text-amber-700 dark:text-gold-400">
                                    {d.delivery_method === 'delivery'
                                        ? (daysLeft > 0 ? `${daysLeft} working day${daysLeft === 1 ? '' : 's'} left` : 'Due today')
                                        : 'Awaiting pickup'}
                                </span>
                            )}
                        </div>

                        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-gold-200/60 mt-1">
                            <MapPin size={13} className="shrink-0 mt-0.5" />
                            <span>{d.buyer_location || 'No location provided'}</span>
                        </div>

                        {d.buyer_whatsapp && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gold-200/60 mt-1">
                                <MessageCircle size={13} className="shrink-0" />
                                <span>{d.buyer_whatsapp}</span>
                            </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-ink-600 space-y-1">
                            {d.items.map((item, i) => (
                                <p key={i} className="text-xs text-slate-600 dark:text-gold-100/80">{item.title} × {item.quantity}</p>
                            ))}
                        </div>

                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-2 capitalize">
                            Method: {d.delivery_method === 'delivery' ? 'Delivery' : 'Campus pickup'}
                        </p>

                        {!d.delivered_at && (
                            <button
                                onClick={() => setConfirmTarget(d.order_id)}
                                disabled={marking === d.order_id}
                                className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-60"
                            >
                                {marking === d.order_id ? 'Marking…' : '✅ Mark as Delivered'}
                            </button>
                        )}
                    </div>
                );
            })}

            <ConfirmModal
                open={!!confirmTarget}
                title="Confirm delivery"
                message="Only mark this as delivered if the buyer has genuinely received the item. Falsely marking an order as delivered can result in an account ban and loss of your funds. Are you sure you've delivered this order?"
                confirmLabel="Yes, I've delivered it"
                onConfirm={handleMarkDelivered}
                onCancel={() => setConfirmTarget(null)}
            />
        </div>
    );
}

// --- UPDATED PAYOUT SETTINGS COMPONENT ---
function PayoutSettings() {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settingDefault, setSettingDefault] = useState(null);
    const [withdrawing, setWithdrawing] = useState(false);
    const [balance, setBalance] = useState(0);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');

    // Form state for adding new account
    const [method, setMethod] = useState('bank');
    const [banks, setBanks] = useState([]);
    const [form, setForm] = useState({ bank_code: '', account_number: '', account_name: '' });
    const [resolving, setResolving] = useState(false);

    // Fetch accounts and balance
    const loadData = () => {
        setLoading(true);
        Promise.all([
            api.get('/payouts/accounts'),
            api.get('/payouts/balance')
        ])
            .then(([accRes, balRes]) => {
                setAccounts(accRes.data);
                setBalance(balRes.data.availableBalance);
                // Auto-select the default account
                const defaultAcc = accRes.data.find(a => a.is_default);
                if (defaultAcc) setSelectedAccountId(defaultAcc.id);
            })
            .catch(() => setAccounts([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadData();
        api.get('/payouts/banks')
            .then((res) => setBanks(res.data))
            .catch(() => {});
    }, []);

    // Resolve account name
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

    // Set default account
    const setDefault = async (accountId) => {
        setSettingDefault(accountId);
        try {
            await api.patch(`/payouts/default/${accountId}`);
            toast.success('Default payout account updated');
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update default');
        } finally {
            setSettingDefault(null);
        }
    };

    // Add new account
    const handleAddAccount = async () => {
        if (!form.bank_code || !form.account_number || !form.account_name) {
            toast.error('Please fill in all fields');
            return;
        }
        setSaving(true);
        try {
            await api.post('/payouts/accounts', { ...form, method });
            toast.success('Account added successfully');
            setShowAddModal(false);
            setForm({ bank_code: '', account_number: '', account_name: '' });
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add account');
        } finally {
            setSaving(false);
        }
    };

    // Withdraw funds
    const handleWithdraw = async () => {
        if (!selectedAccountId) {
            toast.error('Please select a payout account');
            return;
        }
        const amount = parseFloat(withdrawAmount);
        if (!amount || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }
        if (amount > balance) {
            toast.error('Amount exceeds available balance');
            return;
        }

        setWithdrawing(true);
        try {
            await api.post('/payouts/withdraw', {
                accountId: selectedAccountId,
                amountGHS: amount
            });
            toast.success(`Successfully requested withdrawal of GHS ${amount.toFixed(2)}!`);
            setWithdrawAmount('');
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Withdrawal failed');
        } finally {
            setWithdrawing(false);
        }
    };

    if (loading) return <SkeletonList />;

    return (
        <div className="max-w-xl mx-auto space-y-4">
            {/* BALANCE CARD */}
            <div className="bg-gradient-to-br from-brand-600 to-accent-500 dark:from-gold-600 dark:to-gold-400 rounded-2xl p-6 text-white dark:text-ink-900 shadow-md">
                <p className="text-xs opacity-90 uppercase tracking-wide font-semibold">Available Balance</p>
                <p className="text-3xl font-extrabold mt-1">GHS {balance.toFixed(2)}</p>
                <p className="text-xs opacity-80 mt-0.5">98.5% of your completed sales</p>
            </div>

            {/* WITHDRAW SECTION */}
            <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                        <Wallet size={16} />
                    </div>
                    <h2 className="font-bold text-slate-900 dark:text-gold-50">Withdraw Funds</h2>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Select Payout Account</label>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                        >
                            <option value="">Select an account</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.account_name} ({acc.bank_name || acc.method}) {acc.is_default ? '⭐ Default' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Amount (GHS)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={balance}
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                        />
                    </div>

                    <button
                        onClick={handleWithdraw}
                        disabled={withdrawing || balance <= 0 || !selectedAccountId}
                        className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                    >
                        {withdrawing ? 'Processing...' : `Withdraw Funds`}
                    </button>
                    {!user?.verified && (
                        <p className="text-xs text-red-500 dark:text-red-400 text-center mt-1">
                            ⚠️ Verify your account to enable withdrawals.
                        </p>
                    )}
                </div>
            </div>

            {/* ACCOUNT LIST */}
            <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                        <Landmark size={16} />
                    </div>
                    <h2 className="font-bold text-slate-900 dark:text-gold-50">Saved Payout Accounts</h2>
                </div>
                <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-5">
                    These are the accounts you can withdraw your earnings to.
                </p>

                {accounts.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-sm text-slate-400 dark:text-gold-200/50">No payout account set up yet.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-3 text-sm font-semibold text-brand-600 dark:text-gold-400 hover:underline"
                        >
                            + Add payout account
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((acc) => (
                            <div
                                key={acc.id}
                                className={`flex items-center justify-between p-3 rounded-xl border ${
                                    acc.is_default
                                        ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/20'
                                        : 'border-slate-200 dark:border-ink-600'
                                }`}
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">{acc.account_name}</p>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50">
                                        {acc.bank_name || acc.method} · •••• {acc.account_number.slice(-4)}
                                    </p>
                                    {acc.is_default && (
                                        <span className="text-[10px] font-bold text-brand-600 dark:text-gold-400">Default</span>
                                    )}
                                </div>
                                {!acc.is_default && (
                                    <button
                                        onClick={() => setDefault(acc.id)}
                                        disabled={settingDefault === acc.id}
                                        className="text-xs font-semibold text-brand-600 dark:text-gold-400 hover:underline disabled:opacity-50"
                                    >
                                        {settingDefault === acc.id ? 'Setting…' : 'Set as default'}
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full mt-3 py-2 text-sm font-semibold text-brand-600 dark:text-gold-400 border border-dashed border-slate-300 dark:border-ink-600 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                        >
                            + Add another account
                        </button>
                    </div>
                )}
            </div>

            {/* Add Account Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-300/50 transition"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">Add payout account</h3>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">Your earnings will be sent here.</p>

                        <div className="mt-4 space-y-3">
                            <div className="flex gap-1 bg-slate-100 dark:bg-ink-700 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setMethod('bank')}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${((
                                        method === 'bank'
                                            ? 'bg-white dark:bg-ink-600 shadow-sm text-brand-700 dark:text-gold-400'
                                            : 'text-slate-500 dark:text-gold-200/50'
                                    ))}`}
                                >
                                    Bank
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('mobile_money')}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${((
                                        method === 'mobile_money'
                                            ? 'bg-white dark:bg-ink-600 shadow-sm text-brand-700 dark:text-gold-400'
                                            : 'text-slate-500 dark:text-gold-200/50'
                                    ))}`}
                                >
                                    Mobile Money
                                </button>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">
                                    {method === 'bank' ? 'Bank' : 'Network'}
                                </label>
                                <select
                                    value={form.bank_code}
                                    onChange={(e) => setForm({ ...form, bank_code: e.target.value, account_name: '' })}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                                >
                                    <option value="">Select {method === 'bank' ? 'bank' : 'network'}</option>
                                    {banks
                                        .filter((b) => method === 'bank' ? b.type !== 'mobile_money' : b.type === 'mobile_money')
                                        .map((b) => (
                                            <option key={b.code} value={b.code}>{b.name}</option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">
                                    Account number
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.account_number}
                                    onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, ''), account_name: '' })}
                                    placeholder="0123456789"
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">
                                    Account name (as on statement)
                                </label>
                                <input
                                    type="text"
                                    value={form.account_name}
                                    onChange={(e) => setForm({ ...form, account_name: e.target.value.toUpperCase() })}
                                    placeholder="KWAME ASANTE"
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm uppercase"
                                />
                            </div>

                            {resolving && (
                                <p className="text-xs text-slate-400 dark:text-gold-200/50">Resolving account name…</p>
                            )}

                            <button
                                onClick={handleAddAccount}
                                disabled={saving || !form.account_name || resolving}
                                className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                            >
                                {saving ? 'Adding…' : 'Add account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-800 dark:text-red-300">Your listings are hidden</p>
                        <p className="text-xs text-red-600 dark:text-red-400/70 mt-0.5">
                            You have an overdue platform fee balance of GHS {parseFloat(overview.pending_payment_due).toFixed(2)}.
                            Pay it in Settings to restore your listings and start selling again.
                        </p>
                        <Link to="/settings" className="inline-block mt-2 text-xs font-bold text-red-700 dark:text-red-300 underline">
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
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
                    <p className="text-xs font-semibold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-1">Successful sales</p>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">{overview.successful_sales}</p>
                </div>
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
                    <p className="text-xs font-semibold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-1">Active listings</p>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">{overview.active_listings}</p>
                </div>
            </div>

            {rewards && (
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                            <Award size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-gold-50 text-sm">Next reward</h3>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50">0.5% of earnings every 30 successful sales</p>
                        </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-ink-700 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 dark:bg-gold-500 rounded-full transition-all" style={{ width: `${rewardProgress}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-2">{rewards.progress} / {rewards.next_milestone} successful sales</p>

                    {rewards.rewards.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-600 space-y-2">
                            {rewards.rewards.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 dark:text-gold-200/60">Milestone {r.milestone} sales</span>
                                    <span className="font-semibold text-brand-700 dark:text-gold-400">+GHS {parseFloat(r.reward_amount).toFixed(2)}</span>
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
        <div className={`rounded-2xl p-4 border ${
            highlight
                ? 'bg-brand-50 dark:bg-gold-900/40 border-brand-200 dark:border-gold-700'
                : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600'
        }`}>
            <Icon size={16} className={highlight ? 'text-brand-600 dark:text-gold-400 mb-2' : 'text-slate-400 dark:text-gold-300/50 mb-2'} />
            <p className={`text-lg font-extrabold ${highlight ? 'text-brand-700 dark:text-gold-300' : 'text-slate-900 dark:text-gold-50'}`}>{value}</p>
            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">{label}</p>
        </div>
    );
}

function MyListings() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);

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
        <div className="max-w-2xl mx-auto space-y-2">
            {products.map((p) => (
                <div key={p.id} className="flex items-center gap-4 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-3 hover:shadow-sm transition">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-ink-700 overflow-hidden shrink-0">
                        {p.primary_image && <img src={p.primary_image} className="w-full h-full object-cover" alt={p.title} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-gold-100 text-sm truncate">{p.title}</p>
                        <p className="text-xs text-slate-400 dark:text-gold-200/50 capitalize mt-0.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${p.status === 'available' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-ink-600'}`} />
                            {p.status} · GHS {parseFloat(p.price).toFixed(2)}
                        </p>
                    </div>
                    <button onClick={() => setEditingProduct(p)} className="text-slate-300 dark:text-gold-300/40 hover:text-brand-600 dark:hover:text-gold-400 p-1.5 transition">
                        <Pencil size={17} />
                    </button>
                    <button onClick={() => remove(p.id)} className="text-slate-300 dark:text-gold-300/40 hover:text-red-500 p-1.5 transition">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}

            <EditListingModal
                product={editingProduct}
                open={!!editingProduct}
                onClose={() => setEditingProduct(null)}
                onSaved={() => { setEditingProduct(null); load(); }}
            />
        </div>
    );
}

function MyOrders({ period, isSeller }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmingItem, setConfirmingItem] = useState(null);

    const loadOrders = () => {
        setLoading(true);
        api.get('/orders/mine', { params: { period } })
            .then((res) => setOrders(res.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadOrders();
    }, [period]);

    const handleConfirmReceived = async (orderId, itemId) => {
        if (!window.confirm('⚠️ Are you sure you have received this item? This action cannot be undone.')) {
            return;
        }

        setConfirmingItem(itemId);
        try {
           await api.post(`/orders/order-items/${itemId}/confirm`);
            toast.success('Item confirmed as received! ✅');
            loadOrders();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to confirm');
        } finally {
            setConfirmingItem(null);
        }
    };

    if (loading) return <SkeletonList />;
    if (orders.length === 0) return <EmptyState icon={ShoppingBag} text="No orders yet." cta="Browse listings" ctaLink="/browse" />;

    return (
        <div className="max-w-2xl mx-auto space-y-3">
            {orders.map((o) => (
                <div key={o.id} className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-sm text-slate-800 dark:text-gold-100">Order #{o.id}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[o.status] || 'bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-gold-200/50'}`}>
                            {o.status}
                        </span>
                    </div>

                    <div className="mt-2 space-y-2">
                        {o.items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center border-t border-slate-100 dark:border-ink-600 pt-2 first:border-0 first:pt-0">
                                <div className="flex-1">
                                    <p className="text-sm text-slate-700 dark:text-gold-100">{item.title}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <p className="text-xs text-slate-500 dark:text-gold-200/50">Qty: {item.quantity}</p>
                                        <p className="text-xs font-semibold text-slate-600 dark:text-gold-200">GHS {parseFloat(item.price_at_purchase).toFixed(2)}</p>
                                    </div>
                                </div>
                                
                                {o.status === 'paid' && !item.buyer_confirmed_at && (
                                    <button
                                        onClick={() => handleConfirmReceived(o.id, item.id)}
                                        disabled={confirmingItem === item.id}
                                        className="shrink-0 ml-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-60"
                                    >
                                        {confirmingItem === item.id ? '...' : '✅ Confirm Received'}
                                    </button>
                                )}
                                {o.status === 'paid' && item.buyer_confirmed_at && (
                                    <span className="shrink-0 ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        ✓ Confirmed
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="text-sm font-bold text-slate-900 dark:text-gold-50 mt-3 border-t border-slate-100 dark:border-ink-600 pt-3">
                        Total: GHS {parseFloat(o.total_amount).toFixed(2)}
                    </p>
                </div>
            ))}
        </div>
    );
}

const STATUS_STYLES = {
    completed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
    paid: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    pending: 'bg-amber-50 dark:bg-gold-900/40 text-amber-700 dark:text-gold-400',
    cancelled: 'bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-gold-200/50',
    refunded: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
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
        <div className="max-w-2xl mx-auto space-y-2">
            {sales.map((s) => {
                const saleAmount = parseFloat(s.price_at_purchase) * s.quantity;
                return (
                    <div key={s.id} className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-800 dark:text-gold-100 text-sm truncate">{s.title}</p>
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">
                                    Buyer: {s.buyer_name} · Qty {s.quantity} · {new Date(s.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[s.status] || 'bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-gold-200/50'}`}>
                                {s.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-ink-600 text-xs">
                            <div>
                                <p className="text-slate-400 dark:text-gold-200/50">Sale amount</p>
                                <p className="font-semibold text-slate-800 dark:text-gold-100 mt-0.5">GHS {saleAmount.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 dark:text-gold-200/50">Platform fee (1.5%)</p>
                                <p className="font-semibold text-slate-800 dark:text-gold-100 mt-0.5">GHS {parseFloat(s.platform_fee).toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 dark:text-gold-200/50">Your earnings</p>
                                <p className="font-semibold text-brand-700 dark:text-gold-400 mt-0.5">GHS {parseFloat(s.seller_earnings).toFixed(2)}</p>
                            </div>
                        </div>

                        {s.reward_contributed && (
                            <p className="text-xs text-amber-600 dark:text-gold-400 font-semibold mt-2">🏆 Counted toward a reward milestone</p>
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
                <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />
            ))}
        </div>
    );
}

function EmptyState({ icon: Icon, text, cta, ctaLink }) {
    return (
        <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 dark:bg-gold-900 flex items-center justify-center mb-4">
                <Icon className="text-brand-400 dark:text-gold-400" size={24} />
            </div>
            <p className="text-sm text-slate-400 dark:text-gold-200/50">{text}</p>
            {cta && (
                <Link to={ctaLink} className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition">
                    {cta} →
                </Link>
            )}
        </div>
    );
}

const REASON_LABELS = {
    scam: 'Scam or fraud',
    fake_listing: 'Fake or misleading listing',
    inappropriate: 'Inappropriate content',
    harassment: 'Harassment or unsafe behavior',
    other: 'Something else',
};

const REPORT_STATUS_STYLES = {
    pending: 'bg-amber-50 dark:bg-gold-900/40 text-amber-700 dark:text-gold-400',
    reviewed: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    dismissed: 'bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-gold-200/50',
    actioned: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
};

const REPORT_STATUS_DESC = {
    pending: 'Waiting for review',
    reviewed: 'Reviewed by our team',
    dismissed: 'No action needed',
    actioned: 'Action was taken',
};

function MyReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/reports/mine').then((res) => setReports(res.data)).finally(() => setLoading(false));
    }, []);

    if (loading) return <SkeletonList />;
    if (reports.length === 0) return <EmptyState icon={Flag} text="You haven't reported anything." />;

    return (
        <div className="max-w-2xl mx-auto space-y-2">
            {reports.map((r) => (
                <div key={r.id} className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">
                                {REASON_LABELS[r.reason] || r.reason}
                            </p>
                            {r.product_title && (
                                <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-0.5">
                                    Listing: {r.product_title}
                                </p>
                            )}
                            {r.reported_user_name && (
                                <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-0.5">
                                    User: {r.reported_user_name}
                                </p>
                            )}
                            {r.details && (
                                <p className="text-sm text-slate-600 dark:text-gold-100/80 mt-2 bg-slate-50 dark:bg-ink-700 rounded-lg p-2.5">
                                    {r.details}
                                </p>
                            )}
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-2">
                                Filed {new Date(r.created_at).toLocaleDateString()}
                            </p>
                        </div>

                        <div className="text-right shrink-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${REPORT_STATUS_STYLES[r.status] || REPORT_STATUS_STYLES.pending}`}>
                                {r.status}
                            </span>
                            <p className="text-[11px] text-slate-400 dark:text-gold-200/50 mt-1">
                                {REPORT_STATUS_DESC[r.status]}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}


//,,,