import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DASHBOARD_VIDEO } from '../data/media';
import Reveal from '../components/Reveal';
import {
    ArrowLeft, Sparkles, Star, ShieldCheck, Zap, Eye, Tag,
    TrendingUp, Wallet, Store, Bookmark, Award, ChevronDown,
    ArrowRight, Clock, Gauge, MessageCircle, Percent, Layers,
    Rocket, Gift,
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
        a: 'You can switch once your current plan\'s duration ends. While a paid plan is active, you\'re locked into it until it expires — this keeps billing simple and predictable.',
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

    const feeSaved = grossSales * 0.015;
    const listingLimit = planTier ? LISTING_LIMITS[planTier] : LISTING_LIMITS.free;
    const listingUsagePct = listingLimit === Infinity ? 0 : Math.min(100, (listingCount / listingLimit) * 100);

    // ─── FREE PLAN — upsell teaser instead of the members' page ───
    if (!planTier) {
        return (
            <div>
                <section className="relative overflow-hidden">
                    <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                        <source src={DASHBOARD_VIDEO} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-br from-ink-900/80 via-ink-800/55 to-brand-600/35 dark:from-ink-900/90 dark:via-ink-900/75 dark:to-gold-900/50" />
                    <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />

                    <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-14 text-center">
                        <button
                            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                            className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-3.5 py-1.5 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm mb-8"
                        >
                            <ArrowLeft size={15} /> Back
                        </button>
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-5">
                            <Sparkles size={24} className="text-white" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">You're on the Free plan</h1>
                        <p className="text-white/70 text-sm mt-2 max-w-md mx-auto">
                            Upgrade to Pro or Premium to unlock 0% platform fees, priority placement, more listings, and dedicated support.
                        </p>
                        <button
                            onClick={() => navigate('/', { state: { scrollToPricing: true } })}
                            className="inline-flex items-center gap-2 mt-7 bg-white dark:bg-gold-500 text-brand-700 dark:text-ink-900 font-bold px-5 py-2.5 rounded-full hover:bg-brand-50 dark:hover:bg-gold-400 transition"
                        >
                            View plans <ArrowRight size={16} />
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    const Icon = meta.icon;

    return (
        <div>
            {/* HEADER — same video pattern as Dashboard */}
            <section className="relative overflow-hidden">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src={DASHBOARD_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-ink-900/80 via-ink-800/55 to-brand-600/35 dark:from-ink-900/90 dark:via-ink-900/75 dark:to-gold-900/50" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4 sm:gap-5">
                            <button
                                onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                                className="w-6 h-12 sm:w-8 sm:h-16 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg hover:bg-white/30 transition z-10"
                            >
                                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>

                            <div>
                                <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
                                    <Icon size={13} />
                                    {meta.label} Member
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
                                    {user?.name}
                                </h1>
                                <p className="text-white/70 text-sm mt-1">{user?.school}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-8">
                        <StatCard icon={Clock} label="Days left" value={daysLeft} />
                        <StatCard icon={Tag} label="Listings" value={loading ? '···' : listingCount} />
                        <StatCard icon={Wallet} label="Fees saved" value={loading ? '···' : `GHS ${feeSaved.toFixed(0)}`} />
                    </div>
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8 bg-white dark:bg-ink-900 space-y-5">

                {/* ─── MEMBERSHIP STATEMENT — same style as SellerOverview earnings statement ─── */}
                <Reveal>
                    <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 sm:p-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-500 dark:text-gold-200/60">Membership</p>
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400">
                                <Icon size={12} /> {meta.label}
                            </span>
                        </div>

                        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-gold-50">
                                Renews {new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1">
                            {new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>

                        {isSeller && listingLimit !== Infinity && (
                            <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-ink-600">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="text-slate-500 dark:text-gold-200/60 font-semibold">Listing usage</span>
                                    <span className="text-slate-700 dark:text-gold-100 font-bold">{listingCount} of {listingLimit}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-ink-700 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-brand-600 dark:bg-gold-500 transition-all duration-700"
                                        style={{ width: `${listingUsagePct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {isSeller && (
                            <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-ink-600 space-y-0.5">
                                <StatementRow label="Total views across listings" value={loading ? '···' : totalViews} />
                                <StatementRow label="Gross sales while on this plan" value={loading ? '···' : `GHS ${grossSales.toFixed(2)}`} />
                                <StatementRow label="Platform fee saved (1.5%)" value={loading ? '···' : `GHS ${feeSaved.toFixed(2)}`} highlight />
                            </div>
                        )}
                    </div>
                </Reveal>

                {/* ─── QUICK ACTIONS ─── */}
                <Reveal delay={80}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {isSeller && (
                            <QuickAction
                                icon={Store}
                                title="View my store"
                                desc="See your public storefront"
                                onClick={() => navigate(`/store/${user.id}`)}
                            />
                        )}
                        <QuickAction
                            icon={MessageCircle}
                            title="Priority support"
                            desc={planTier === 'premium' ? 'Same-day dedicated line' : '24-hour priority response'}
                            onClick={() => navigate('/contact')}
                        />
                        <QuickAction
                            icon={Gauge}
                            title="Manage subscription"
                            desc="Renew, view billing, or change plan"
                            onClick={() => navigate('/settings')}
                        />
                    </div>
                </Reveal>

                {/* ─── FULL BENEFITS BREAKDOWN ─── */}
                <div className="pt-2">
                    <Reveal>
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                <ShieldCheck size={16} />
                            </div>
                            <h2 className="font-bold text-slate-900 dark:text-gold-50">
                                Everything included in your plan
                            </h2>
                        </div>
                    </Reveal>

                    <div className="space-y-6">
                        {SELLER_BENEFITS.map((group, gi) => {
                            const groupItems = group.items.filter((item) => item.tiers.includes(planTier));
                            if (groupItems.length === 0) return null;
                            return (
                                <Reveal key={group.category} delay={gi * 80}>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gold-200/50 mb-2.5">
                                        {group.category}
                                    </p>
                                    <div className="grid sm:grid-cols-2 gap-2.5">
                                        {groupItems.map((item) => (
                                            <BenefitCard key={item.title} item={item} />
                                        ))}
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>

                {/* ─── PRO → PREMIUM UPSELL ─── */}
                {planTier === 'pro' && (
                    <Reveal delay={100}>
                        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                    <Sparkles size={16} />
                                </div>
                                <h2 className="font-bold text-slate-900 dark:text-gold-50">Go further with Premium</h2>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-2 max-w-lg">
                                Everything you have on Pro, plus no listing cap at all and your store shown first, every time.
                            </p>
                            <button
                                onClick={() => navigate('/', { state: { scrollToPricing: true } })}
                                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-bold text-sm transition"
                            >
                                Upgrade to Premium <ArrowRight size={15} />
                            </button>
                        </div>
                    </Reveal>
                )}

                {/* ─── FAQ ─── */}
                <div className="pt-2 pb-4">
                    <Reveal>
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                <Gift size={16} />
                            </div>
                            <h2 className="font-bold text-slate-900 dark:text-gold-50">Good to know</h2>
                        </div>
                    </Reveal>
                    <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl px-5 shadow-sm">
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
        </div>
    );
}

// ─── STAT CARD — matches Dashboard.jsx's StatCard exactly ─────────────────
function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl sm:rounded-2xl p-2.5 sm:p-4">
            <Icon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] text-white/80 mb-1 sm:mb-2" />
            <p className="text-lg sm:text-2xl font-extrabold text-white">{value}</p>
            <p className="text-[10px] sm:text-xs text-white/70">{label}</p>
        </div>
    );
}

// ─── RECEIPT-STYLE ROW — matches SellerOverview's StatementRow exactly ────
function StatementRow({ label, value, highlight }) {
    return (
        <div className="flex items-baseline gap-2 py-1.5">
            <span className="text-sm text-slate-500 dark:text-gold-200/60 shrink-0">{label}</span>
            <span className="flex-1 border-b border-dotted border-slate-300 dark:border-ink-600 translate-y-[-3px]" aria-hidden="true" />
            <span className={`text-sm font-semibold tabular-nums shrink-0 ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-gold-100'}`}>
                {value}
            </span>
        </div>
    );
}

function QuickAction({ icon: Icon, title, desc, onClick }) {
    return (
        <button
            onClick={onClick}
            className="text-left bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 hover:border-slate-300 dark:hover:border-ink-500 hover:shadow-sm rounded-2xl p-4 transition group"
        >
            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-3">
                <Icon size={16} />
            </div>
            <p className="font-bold text-sm text-slate-900 dark:text-gold-50 flex items-center gap-1.5">
                {title}
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </p>
            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1">{desc}</p>
        </button>
    );
}

function BenefitCard({ item }) {
    const Icon = item.icon;
    return (
        <div className="flex items-start gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 hover:shadow-sm transition">
            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center shrink-0">
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-gold-50">{item.title}</p>
                <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
        </div>
    );
}

function FaqItem({ faq, open, onToggle }) {
    return (
        <div className="border-b border-slate-100 dark:border-ink-600 last:border-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-3 py-4 text-left"
            >
                <span className="font-semibold text-sm text-slate-800 dark:text-gold-100">{faq.q}</span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 dark:text-gold-300/50 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <p className="text-sm text-slate-500 dark:text-gold-200/60 leading-relaxed pb-4 pr-6">
                    {faq.a}
                </p>
            )}
        </div>
    );
}