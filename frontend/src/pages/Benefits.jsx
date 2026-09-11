import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DASHBOARD_VIDEO } from '../data/media';
import Reveal from '../components/Reveal';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Sparkles, Star, ShieldCheck, Zap, Eye, Tag,
    TrendingUp, Wallet, Store, Bookmark, Award, ChevronDown,
    ArrowRight, Clock, Gauge, MessageCircle, Percent, Layers,
    Rocket, Gift, Check, Trash2, X,
} from 'lucide-react';

const LISTING_LIMITS = { free: 10, pro: 30, premium: Infinity };

const TIER_META = {
    pro: { label: 'Pro', icon: Star },
    premium: { label: 'Premium', icon: Sparkles },
};

const SELLER_BENEFITS = [
    {
        category: 'Selling',
        items: [
            { icon: Percent, title: '0% platform fee', desc: 'Keep 100% of every sale — Free plan sellers pay 1.5% per sale, you pay nothing.', tiers: ['pro', 'premium'] },
            { icon: Layers, title: 'Higher listing limit', desc: 'List up to 30 items at once instead of the Free plan\'s 10.', tiers: ['pro'] },
            { icon: Layers, title: 'Unlimited listings', desc: 'List as many items as you want, with no cap at all.', tiers: ['premium'] },
            { icon: TrendingUp, title: 'Priority placement', desc: 'Your listings are shown first in Browse and search, ahead of Free plan sellers.', tiers: ['pro', 'premium'] },
            { icon: Award, title: 'Seller badge', desc: 'A visible badge on your listings and store page that signals a trusted, active seller.', tiers: ['pro', 'premium'] },
            { icon: Eye, title: 'Views & sales stats', desc: 'See exactly how many people viewed and bought each of your listings.', tiers: ['pro', 'premium'] },
        ],
    },
    {
        category: 'Your store',
        items: [
            { icon: Store, title: 'Upgraded store page', desc: 'A richer storefront with social sharing built in — share your store link anywhere.', tiers: ['pro'] },
            { icon: Rocket, title: 'Top store placement', desc: 'Your store page is shown at the very top when buyers browse sellers.', tiers: ['premium'] },
        ],
    },
    {
        category: 'Support & visibility',
        items: [
            { icon: MessageCircle, title: '24-hour priority support', desc: 'Jump the queue — your questions get answered within 24 hours.', tiers: ['pro'] },
            { icon: Zap, title: 'Same-day dedicated support', desc: 'A dedicated line that responds the same day, every day.', tiers: ['premium'] },
            { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified the moment a matching listing appears.', tiers: ['pro', 'premium'] },
            { icon: Gauge, title: 'See new listings first', desc: 'New listings matching your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
        ],
    },
];

const FAQ_ITEMS = [
    {
        q: 'What happens when my plan expires?',
        a: 'Your account automatically reverts to the Free plan — no charge happens without you actively resubscribing. Listings beyond the Free plan\'s limit stay live, but you won\'t be able to add new ones until you\'re back under the cap or you renew.',
    },
    {
        q: 'Can I switch between Pro and Premium?',
        a: 'Yes, anytime. Upgrading to Premium applies immediately. Downgrading to Pro keeps your Premium benefits until your current period ends, then switches you to Pro at renewal — you never lose what you\'ve already paid for.',
    },
    {
        q: 'What if I cancel?',
        a: 'You keep full access until your current period ends, then your account reverts to Free. No refunds for time already paid, but nothing is cut off early.',
    },
    {
        q: 'Is the 0% fee automatic?',
        a: 'Yes — as soon as your plan is active, every new sale is calculated with a 0% platform fee instead of the standard 1.5%. No action needed on your end.',
    },
    {
        q: 'What counts toward "fees saved"?',
        a: 'It\'s calculated as 1.5% of your total confirmed sales while your plan has been active — the amount you would have paid on the Free plan.',
    },
];

export default function Benefits() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [listingCount, setListingCount] = useState(0);
    const [totalViews, setTotalViews] = useState(0);
    const [grossSales, setGrossSales] = useState(0);
    const [openFaq, setOpenFaq] = useState(null);
    const [collapsedCategories, setCollapsedCategories] = useState({});
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const isPendingCancel = user?.pending_plan === 'free';

    const handleConfirmCancel = async () => {
        setCancelling(true);
        try {
            await api.post('/subscriptions/cancel');
            toast.success('Subscription cancelled — you keep access until it expires.');
            setShowCancelModal(false);
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not cancel subscription');
        } finally {
            setCancelling(false);
        }
    };

    const handleUndoCancel = async () => {
        try {
            await api.post('/subscriptions/undo-cancel');
            toast.success('Cancellation undone');
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not undo cancellation');
        }
    };
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const isPendingCancel = user?.pending_plan === 'free';

    const handleConfirmCancel = async () => {
        setCancelling(true);
        try {
            await api.post('/subscriptions/cancel');
            toast.success('Subscription cancelled — you keep access until it expires.');
            setShowCancelModal(false);
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not cancel subscription');
        } finally {
            setCancelling(false);
        }
    };

    const handleUndoCancel = async () => {
        try {
            await api.post('/subscriptions/undo-cancel');
            toast.success('Cancellation undone');
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not undo cancellation');
        }
    };

    // ─── SAVED SEARCHES ───
    const [savedSearches, setSavedSearches] = useState([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedExpanded, setSavedExpanded] = useState(false);
    const [deletingSearchId, setDeletingSearchId] = useState(null);

    const isSeller = user?.account_type === 'seller';

    const isPlanActive = user?.plan && user.plan !== 'free' &&
        user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
    const planTier = isPlanActive ? user.plan.toLowerCase() : null;
    const meta = planTier ? TIER_META[planTier] : null;

    const daysLeft = user?.plan_expires_at
        ? Math.max(0, Math.ceil((new Date(user.plan_expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;

    useEffect(() => {
        if (!isSeller || !planTier) {
            setLoading(false);
            return;
        }
        setLoading(true);
        Promise.all([
            api.get('/products/mine').catch(() => ({ data: [] })),
            api.get('/sellers/overview', { params: { period: 'all' } }).catch(() => ({ data: {} })),
        ]).then(([productsRes, overviewRes]) => {
            const products = productsRes.data || [];
            setListingCount(products.length);
            setTotalViews(products.reduce((sum, p) => sum + (p.views_count || 0), 0));
            setGrossSales(parseFloat(overviewRes.data?.gross_sales) || 0);
        }).finally(() => setLoading(false));
    }, [isSeller, planTier]);

    // Fetch saved searches when the user expands the section (lazy)
    const loadSavedSearches = () => {
        setSavedLoading(true);
        api.get('/saved-searches/mine')
            .then((res) => setSavedSearches(res.data || []))
            .catch(() => setSavedSearches([]))
            .finally(() => setSavedLoading(false));
    };

    const handleToggleSaved = () => {
        const next = !savedExpanded;
        setSavedExpanded(next);
        if (next && savedSearches.length === 0) loadSavedSearches();
    };

    const handleDeleteSearch = async (id) => {
        setDeletingSearchId(id);
        try {
            await api.delete(`/saved-searches/${id}`);
            toast.success('Saved search removed');
            setSavedSearches((prev) => prev.filter((s) => s.id !== id));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove this search');
        } finally {
            setDeletingSearchId(null);
        }
    };

    const feeSaved = grossSales * 0.015;
    const listingLimit = planTier ? LISTING_LIMITS[planTier] : LISTING_LIMITS.free;
    const listingUsagePct = listingLimit === Infinity ? 0 : Math.min(100, (listingCount / listingLimit) * 100);

    // ─── FREE PLAN — upsell teaser ───
    if (!planTier) {
        return (
            <div className="min-h-screen bg-white dark:bg-ink-900">
                <section className="relative overflow-hidden">
                    <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                        <source src={DASHBOARD_VIDEO} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-br from-ink-900/85 via-ink-800/60 to-brand-600/40 dark:from-ink-900/95 dark:via-ink-900/80 dark:to-gold-900/50" />

                    <div className="relative z-10 max-w-xl mx-auto px-5 py-16 text-center">
                        <button
                            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold mb-10 transition"
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                        <div className="w-12 h-12 mx-auto rounded-full bg-white/15 backdrop-blur flex items-center justify-center mb-5 ring-1 ring-white/20">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
                            You're on the Free plan
                        </h1>
                        <p className="text-white/60 text-sm mt-3 max-w-sm mx-auto leading-relaxed">
                            Upgrade to unlock 0% platform fees, priority placement, more listings, and dedicated support.
                        </p>
                        <button
                            onClick={() => navigate('/', { state: { scrollToPricing: true } })}
                            className="inline-flex items-center gap-2 mt-8 bg-white dark:bg-gold-500 text-brand-700 dark:text-ink-900 font-bold px-5 py-2.5 rounded-full hover:bg-brand-50 dark:hover:bg-gold-400 transition text-sm"
                        >
                            View plans <ArrowRight size={15} />
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    const Icon = meta.icon;

    return (
        <div className="bg-white dark:bg-ink-900 min-h-screen">
            {/* ─── HEADER ─── */}
            <section className="relative overflow-hidden">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src={DASHBOARD_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-ink-900/85 via-ink-800/60 to-brand-600/40 dark:from-ink-900/95 dark:via-ink-900/80 dark:to-gold-900/50" />
                <div className="absolute -right-20 -top-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-3xl mx-auto px-5 pt-8 pb-10">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition"
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                        <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full ring-1 ring-white/20">
                            <Icon size={12} />
                            {meta.label}
                        </div>
                    </div>

                    <div className="mt-8">
                        <h1 className="text-2xl font-bold text-white tracking-tight">{user?.name}</h1>
                        <p className="text-white/50 text-xs mt-1">{user?.school}</p>
                    </div>

                    <div className="mt-8 flex items-end gap-3">
                        <span className="text-6xl font-black text-white tabular-nums leading-none tracking-tighter">
                            {daysLeft}
                        </span>
                        <div className="pb-1.5">
                            <p className="text-white/60 text-xs font-medium uppercase tracking-widest">
                                {daysLeft === 1 ? 'day' : 'days'} left
                            </p>
                            <p className="text-white/40 text-[11px] mt-0.5">
                                Renews {new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </p>
                        </div>
                    </div>

                    {isSeller && (
                        <div className="mt-8 grid grid-cols-3 gap-px bg-white/15 rounded-xl overflow-hidden ring-1 ring-white/15">
                            <HeaderStat label="Listings" value={loading ? '···' : listingCount} />
                            <HeaderStat label="Total views" value={loading ? '···' : totalViews} />
                            <HeaderStat label="Fees saved" value={loading ? '···' : `GHS ${feeSaved.toFixed(0)}`} />
                        </div>
                    )}
                </div>
            </section>

            {/* ─── BODY ─── */}
            <div className="max-w-3xl mx-auto px-5 pb-12">

                {/* Listing usage bar */}
                {isSeller && listingLimit !== Infinity && (
                    <Reveal>
                        <div className="pt-8">
                            <div className="flex items-center justify-between text-xs mb-2">
                                <span className="font-semibold text-slate-500 dark:text-gold-200/60 uppercase tracking-wide text-[11px]">
                                    Listing usage
                                </span>
                                <span className="text-slate-700 dark:text-gold-100 font-bold tabular-nums">
                                    {listingCount} / {listingLimit}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 dark:from-gold-400 dark:to-gold-500 transition-all duration-700"
                                    style={{ width: `${listingUsagePct}%` }}
                                />
                            </div>
                        </div>
                    </Reveal>
                )}

                {/* Statement */}
                {isSeller && (
                    <Reveal>
                        <div className="pt-8">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gold-200/50 mb-3">
                                Since joining {meta.label}
                            </p>
                            <div className="divide-y divide-dashed divide-slate-200 dark:divide-ink-700">
                                <StatementLine label="Gross sales" value={loading ? '···' : `GHS ${grossSales.toFixed(2)}`} />
                                <StatementLine
                                    label="Platform fee saved (1.5%)"
                                    value={loading ? '···' : `GHS ${feeSaved.toFixed(2)}`}
                                    highlight
                                />
                                <StatementLine label="Total views across listings" value={loading ? '···' : totalViews} />
                            </div>
                        </div>
                    </Reveal>
                )}

                {/* ─── MANAGE (moved to top) ─── */}
                <Reveal delay={60}>
                    <div className="pt-10">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gold-200/50 mb-3">
                            Manage
                        </p>
                        <div className="divide-y divide-slate-100 dark:divide-ink-700">

                            {isSeller && (
                                <ActionRow
                                    icon={Store}
                                    title="View my store"
                                    desc="See your public storefront"
                                    onClick={() => navigate(`/store/${user.id}`)}
                                />
                            )}

                            {/* ─── SAVED SEARCHES (expandable) ─── */}
                            <div>
                                <button
                                    onClick={handleToggleSaved}
                                    className="w-full flex items-center gap-3.5 py-3.5 text-left group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-ink-700 text-slate-600 dark:text-gold-300/70 flex items-center justify-center shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-gold-900/60 group-hover:text-brand-600 dark:group-hover:text-gold-400 transition-colors">
                                        <Bookmark size={15} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-gold-50">
                                            Saved searches
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">
                                            {savedSearches.length > 0
                                                ? `${savedSearches.length} saved`
                                                : 'Get notified when new listings match'}
                                        </p>
                                    </div>
                                    <ChevronDown
                                        size={15}
                                        className={`shrink-0 text-slate-300 dark:text-gold-300/40 transition-transform duration-200 ${
                                            savedExpanded ? 'rotate-180 text-brand-600 dark:text-gold-400' : 'group-hover:text-brand-600 dark:group-hover:text-gold-400'
                                        }`}
                                    />
                                </button>

                                {/* Expandable content */}
                                <div
                                    className={`grid transition-all duration-200 ease-out ${
                                        savedExpanded ? 'grid-rows-[1fr] opacity-100 pb-3' : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        {savedLoading ? (
                                            <div className="space-y-2 pl-11">
                                                {Array.from({ length: 2 }).map((_, i) => (
                                                    <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-ink-800 animate-pulse" />
                                                ))}
                                            </div>
                                        ) : savedSearches.length === 0 ? (
                                            <div className="pl-11 pr-2">
                                                <p className="text-xs text-slate-400 dark:text-gold-200/50 py-2 leading-relaxed">
                                                    No saved searches yet. Save a search from the Browse page to get notified the moment a matching listing appears.
                                                </p>
                                                <Link
                                                    to="/browse"
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-gold-400 hover:gap-2 transition-all"
                                                >
                                                    Browse listings <ArrowRight size={12} />
                                                </Link>
                                            </div>
                                        ) : (
                                            <ul className="pl-11 pr-2 space-y-2">
                                                {savedSearches.map((s) => {
                                                    const hasPrice = s.price_min != null || s.price_max != null;
                                                    const priceLabel = hasPrice
                                                        ? `GHS ${s.price_min != null ? Number(s.price_min).toFixed(0) : '0'}${
                                                              s.price_max != null
                                                                  ? ` – ${Number(s.price_max).toFixed(0)}`
                                                                  : '+'
                                                          }`
                                                        : null;
                                                    const hasAny = s.keyword || s.category || s.school || hasPrice || s.verified_only || s.service_type;

                                                    return (
                                                        <li
                                                            key={s.id}
                                                            className="flex items-start gap-2 bg-slate-50 dark:bg-ink-800/60 rounded-lg px-3 py-2"
                                                        >
                                                            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap pt-0.5">
                                                                {s.keyword && (
                                                                    <span className="text-[11px] font-semibold bg-white dark:bg-ink-700 text-slate-700 dark:text-gold-200 px-2 py-0.5 rounded-full ring-1 ring-slate-100 dark:ring-ink-600">
                                                                        "{s.keyword}"
                                                                    </span>
                                                                )}
                                                                {s.category && (
                                                                    <span className="text-[11px] font-semibold bg-white dark:bg-ink-700 text-slate-700 dark:text-gold-200 px-2 py-0.5 rounded-full ring-1 ring-slate-100 dark:ring-ink-600">
                                                                        {s.category}
                                                                    </span>
                                                                )}
                                                                {s.service_type && (
                                                                    <span className="text-[11px] font-semibold bg-white dark:bg-ink-700 text-slate-700 dark:text-gold-200 px-2 py-0.5 rounded-full ring-1 ring-slate-100 dark:ring-ink-600">
                                                                        {s.service_type}
                                                                    </span>
                                                                )}
                                                                {s.school && (
                                                                    <span className="text-[11px] font-semibold bg-white dark:bg-ink-700 text-slate-700 dark:text-gold-200 px-2 py-0.5 rounded-full ring-1 ring-slate-100 dark:ring-ink-600">
                                                                        📍 {s.school}
                                                                    </span>
                                                                )}
                                                                {priceLabel && (
                                                                    <span className="text-[11px] font-semibold bg-white dark:bg-ink-700 text-slate-700 dark:text-gold-200 px-2 py-0.5 rounded-full ring-1 ring-slate-100 dark:ring-ink-600">
                                                                        {priceLabel}
                                                                    </span>
                                                                )}
                                                                {s.verified_only && (
                                                                    <span className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full ring-1 ring-emerald-100 dark:ring-emerald-900/40">
                                                                        ✓ Verified
                                                                    </span>
                                                                )}
                                                                {!hasAny && (
                                                                    <span className="text-[11px] text-slate-400 dark:text-gold-200/50 italic">
                                                                        Empty search
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteSearch(s.id)}
                                                                disabled={deletingSearchId === s.id}
                                                                className="shrink-0 text-slate-300 dark:text-gold-300/40 hover:text-red-500 p-1 transition disabled:opacity-50"
                                                                aria-label="Remove saved search"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <ActionRow
                                icon={MessageCircle}
                                title="Priority support"
                                desc={planTier === 'premium' ? 'Same-day dedicated line' : '24-hour priority response'}
                                onClick={() => navigate('/contact')}
                            />
                            <ActionRow
                                icon={Gauge}
                                title="Manage subscription"
                                desc="Renew, view billing, or change plan"
                                onClick={() => navigate('/settings')}
                            />

                            {isPendingCancel ? (
                                <ActionRow
                                    icon={X}
                                    title="Undo cancellation"
                                    desc={`Ends ${new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — keep your plan instead`}
                                    onClick={handleUndoCancel}
                                />
                            ) : (
                                <ActionRow
                                    icon={X}
                                    title="Cancel subscription"
                                    desc="Keep access until your current period ends"
                                    onClick={() => setShowCancelModal(true)}
                                    danger
                                />
                            )}
                        </div>
                    </div>
                </Reveal>

                {/* ─── WHAT'S INCLUDED ─── */}
                <div className="pt-10">
                    <Reveal>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gold-200/50 mb-1">
                            What's included
                        </p>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50 text-lg">
                            Everything in your plan
                        </h2>
                    </Reveal>

                    <div className="mt-6 space-y-8">
                        {SELLER_BENEFITS.map((group, gi) => {
                            const groupItems = group.items.filter((item) => item.tiers.includes(planTier));
                            if (groupItems.length === 0) return null;
                            const isOpen = !collapsedCategories[group.category];
                            return (
                                <Reveal key={group.category} delay={gi * 60}>
                                    <div>
                                        <button
                                            onClick={() => setCollapsedCategories((prev) => ({ ...prev, [group.category]: isOpen }))}
                                            className="w-full flex items-center gap-2 mb-2 group"
                                        >
                                            <span className="text-xs font-bold text-slate-900 dark:text-gold-100">
                                                {group.category}
                                            </span>
                                            <div className="flex-1 h-px bg-slate-100 dark:bg-ink-700" />
                                            <ChevronDown
                                                size={15}
                                                className={`shrink-0 text-slate-300 dark:text-gold-300/40 transition-transform duration-200 ${
                                                    isOpen ? 'rotate-180 text-brand-600 dark:text-gold-400' : 'group-hover:text-brand-600 dark:group-hover:text-gold-400'
                                                }`}
                                            />
                                        </button>
                                        <div
                                            className={`grid transition-all duration-200 ease-out ${
                                                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                        >
                                            <div className="overflow-hidden">
                                                <ul className="divide-y divide-slate-100 dark:divide-ink-700">
                                                    {groupItems.map((item) => (
                                                        <BenefitRow key={item.title} item={item} />
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>

                {/* ─── PRO → PREMIUM UPSELL ─── */}
                {planTier === 'pro' && (
                    <Reveal delay={100}>
                        <div className="pt-10">
                            <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-white dark:from-ink-800 dark:to-ink-900 ring-1 ring-brand-100 dark:ring-ink-700 p-5">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 flex items-center justify-center shrink-0">
                                        <Sparkles size={15} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-slate-900 dark:text-gold-50 text-sm">
                                            Go further with Premium
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-1 leading-relaxed">
                                            Everything you have on Pro, plus no listing cap at all and your store shown first, every time.
                                        </p>
                                        <button
                                            onClick={() => navigate('/', { state: { scrollToPricing: true } })}
                                            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-brand-700 dark:text-gold-400 hover:gap-2 transition-all"
                                        >
                                            Upgrade to Premium <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                )}

                {/* ─── GOOD TO KNOW ─── */}
                <div className="pt-12">
                    <Reveal>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gold-200/50 mb-3">
                            FAQ(Frequently Asked Questions)
                        </p>
                    </Reveal>
                    <div className="border-t border-slate-100 dark:border-ink-700">
                        {FAQ_ITEMS.map((faq, i) => (
                            <FaqItem
                                key={faq.q}
                                faq={faq}
                                open={openFaq === i}
                                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {showCancelModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
                    <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-ink-600">
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
                                <X size={24} className="text-red-500 dark:text-red-400" />
                            </div>
                            <h3 className="font-extrabold text-slate-900 dark:text-gold-50 text-lg">Cancel subscription?</h3>
                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1.5">
                                You'll keep {meta?.label} access until {user?.plan_expires_at && new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, then your account moves to Free. No refund for time already paid.
                            </p>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                            >
                                Keep plan
                            </button>
                            <button
                                onClick={handleConfirmCancel}
                                disabled={cancelling}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
                            >
                                {cancelling ? 'Cancelling…' : 'Cancel plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── HEADER STAT ────────────────────────────────────────────────
function HeaderStat({ label, value }) {
    return (
        <div className="bg-white/5 backdrop-blur px-3 py-3 text-center">
            <p className="text-base sm:text-lg font-bold text-white tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-white/50 mt-1.5 uppercase tracking-wider font-medium">{label}</p>
        </div>
    );
}

// ─── STATEMENT LINE ──────────────────────────────────────────────
function StatementLine({ label, value, highlight }) {
    return (
        <div className="flex items-baseline justify-between py-3">
            <span className="text-xs text-slate-500 dark:text-gold-200/60">{label}</span>
            <span className={`text-sm font-bold tabular-nums ${
                highlight
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-gold-50'
            }`}>
                {value}
            </span>
        </div>
    );
}

// ─── BENEFIT ROW ───────────────────────────────────────────────
function BenefitRow({ item }) {
    const Icon = item.icon;
    return (
        <li className="flex items-start gap-3.5 py-3.5">
            <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-gold-900/60 text-brand-600 dark:text-gold-400 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={14} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-gold-50 leading-snug">
                    {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-gold-200/50 mt-1 leading-relaxed">
                    {item.desc}
                </p>
            </div>
        </li>
    );
}

// ─── ACTION ROW ────────────────────────────────────────────────
function ActionRow({ icon: Icon, title, desc, onClick, danger }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3.5 py-3.5 text-left group"
        >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                danger
                    ? 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-950/50'
                    : 'bg-slate-100 dark:bg-ink-700 text-slate-600 dark:text-gold-300/70 group-hover:bg-brand-50 dark:group-hover:bg-gold-900/60 group-hover:text-brand-600 dark:group-hover:text-gold-400'
            }`}>
                <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${danger ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-gold-50'}`}>{title}</p>
                <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">{desc}</p>
            </div>
            <ArrowRight
                size={15}
                className={`shrink-0 transition-all ${
                    danger
                        ? 'text-red-300 dark:text-red-400/40 group-hover:text-red-500 dark:group-hover:text-red-400 group-hover:translate-x-0.5'
                        : 'text-slate-300 dark:text-gold-300/30 group-hover:text-brand-600 dark:group-hover:text-gold-400 group-hover:translate-x-0.5'
                }`}
            />
        </button>
    );
}

// ─── FAQ ITEM ─────────────────────────────────────────────────
function FaqItem({ faq, open, onToggle }) {
    return (
        <div className="border-b border-slate-100 dark:border-ink-700 last:border-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-4 py-4 text-left group"
            >
                <span className={`text-sm transition-colors ${
                    open
                        ? 'font-bold text-slate-900 dark:text-gold-50'
                        : 'font-medium text-slate-700 dark:text-gold-100/90 group-hover:text-slate-900 dark:group-hover:text-gold-50'
                }`}>
                    {faq.q}
                </span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-200 ${
                        open
                            ? 'rotate-180 text-brand-600 dark:text-gold-400'
                            : 'text-slate-300 dark:text-gold-300/40'
                    }`}
                />
            </button>
            <div
                className={`grid transition-all duration-200 ease-out ${
                    open ? 'grid-rows-[1fr] opacity-100 pb-4' : 'grid-rows-[0fr] opacity-0'
                }`}
            >
                <div className="overflow-hidden">
                    <p className="text-xs text-slate-500 dark:text-gold-200/60 leading-relaxed pr-6">
                        {faq.a}
                    </p>
                </div>
            </div>
        </div>
    );
}