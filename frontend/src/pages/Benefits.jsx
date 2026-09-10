import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import {
    ArrowLeft, Sparkles, Star, Crown, ShieldCheck, Zap, Eye, Tag,
    TrendingUp, Wallet, Headset, Store, Bookmark, Award, ChevronDown,
    ArrowRight, Check, Clock, Gauge, MessageCircle, Percent, Layers,
    Rocket, Gift,
} from 'lucide-react';

const LISTING_LIMITS = { free: 10, pro: 30, premium: Infinity };

const TIER_META = {
    pro: {
        label: 'Pro',
        icon: Star,
        accent: 'blue',
        gradientFrom: 'from-blue-600',
        gradientVia: 'via-sky-500',
        gradientTo: 'to-indigo-600',
        glow: 'shadow-blue-500/30',
        textAccent: 'text-blue-400',
        bgSoft: 'bg-blue-500/10',
        borderSoft: 'border-blue-500/30',
        ring: 'ring-blue-500/40',
    },
    premium: {
        label: 'Premium',
        icon: Sparkles,
        accent: 'violet',
        gradientFrom: 'from-violet-600',
        gradientVia: 'via-purple-500',
        gradientTo: 'to-fuchsia-600',
        glow: 'shadow-violet-500/30',
        textAccent: 'text-violet-400',
        bgSoft: 'bg-violet-500/10',
        borderSoft: 'border-violet-500/30',
        ring: 'ring-violet-500/40',
    },
};

const SELLER_BENEFITS = [
    {
        category: 'Selling',
        items: [
            { icon: Percent, title: '0% platform fee', desc: 'Keep 100% of every sale — Free plan sellers pay 1.5% per sale, you pay nothing.', tiers: ['pro', 'premium'] },
            { icon: Layers, title: 'Higher listing limit', desc: 'List up to 30 items at once instead of the Free plan\'s 10.', tiers: ['pro'] },
            { icon: Layers, title: 'Unlimited listings', desc: 'List as many items as you want, with no cap at all.', tiers: ['premium'] },
            { icon: TrendingUp, title: 'Priority placement', desc: 'Your listings are shown first in Browse and search results, ahead of Free plan sellers.', tiers: ['pro', 'premium'] },
            { icon: Award, title: 'Seller badge', desc: 'A visible badge on your listings and store page that signals you\'re a trusted, active seller.', tiers: ['pro', 'premium'] },
            { icon: Eye, title: 'Views & sales stats', desc: 'See exactly how many people viewed and bought each of your listings.', tiers: ['pro', 'premium'] },
        ],
    },
    {
        category: 'Your Store',
        items: [
            { icon: Store, title: 'Upgraded store page', desc: 'A richer storefront with social sharing built in — share your store link anywhere.', tiers: ['pro'] },
            { icon: Rocket, title: 'Top store placement', desc: 'Your store page is shown at the very top when buyers browse sellers.', tiers: ['premium'] },
        ],
    },
    {
        category: 'Support & Visibility',
        items: [
            { icon: Headset, title: '24-hour priority support', desc: 'Jump the queue — your questions get answered within 24 hours.', tiers: ['pro'] },
            { icon: Zap, title: 'Same-day dedicated support', desc: 'A dedicated line that responds the same day, every day.', tiers: ['premium'] },
            { icon: Bookmark, title: 'Saved searches', desc: 'Save a search and get notified the moment a matching listing appears.', tiers: ['pro', 'premium'] },
            { icon: Gauge, title: 'See new listings first', desc: 'New listings matching your interests reach you before anyone else.', tiers: ['pro', 'premium'] },
        ],
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

    const totalDurationDays = planTier === 'premium' ? 365 : 30;
    const elapsedPct = Math.min(100, Math.max(0, 100 - (daysLeft / totalDurationDays) * 100));

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

    // ─── FREE PLAN — show an upsell teaser instead of the members' page ───
    if (!planTier) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-ink-900 via-ink-950 to-ink-900 text-white">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
                    <button
                        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white transition mb-10"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>

                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Sparkles size={26} className="text-white/40" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold">You're on the Free plan</h1>
                    <p className="text-white/50 text-sm mt-2 max-w-md mx-auto">
                        Upgrade to Pro or Premium to unlock 0% platform fees, priority placement, more listings, and dedicated support.
                    </p>
                    <button
                        onClick={() => navigate('/', { state: { scrollToPricing: true } })}
                        className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-white text-ink-900 font-bold text-sm hover:bg-white/90 transition"
                    >
                        View plans <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    const Icon = meta.icon;

    return (
        <div className="min-h-screen bg-gradient-to-b from-ink-900 via-ink-950 to-ink-900 text-white relative overflow-hidden">
            {/* Ambient decorative glow — tier-colored */}
            <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] opacity-30 bg-gradient-to-br ${meta.gradientFrom} ${meta.gradientTo}`} />
            <div className={`absolute top-1/2 -left-40 w-96 h-96 rounded-full blur-[120px] opacity-20 bg-gradient-to-br ${meta.gradientFrom} ${meta.gradientTo}`} />
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: `
                        repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 48px),
                        repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 48px)
                    `,
                }}
            />

            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* BACK */}
                <button
                    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white transition mb-8"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                {/* ─── MEMBERSHIP CARD ─── */}
                <Reveal>
                    <div
                        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br ${meta.gradientFrom} ${meta.gradientVia} ${meta.gradientTo} shadow-2xl ${meta.glow}`}
                    >
                        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
                        <div className="absolute -left-10 -bottom-10 w-56 h-56 rounded-full bg-black/10 blur-2xl" />
                        <div
                            className="absolute inset-0 opacity-20"
                            style={{
                                backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 40%)',
                            }}
                        />

                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Icon size={22} className="text-white" />
                                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                                        {meta.label} Member
                                    </span>
                                </div>
                                <h1 className="text-2xl sm:text-4xl font-black text-white mt-3">
                                    {user?.name}
                                </h1>
                                <p className="text-white/70 text-sm mt-1">{user?.school}</p>
                            </div>
                            <Crown size={32} className="text-white/40 shrink-0" />
                        </div>

                        <div className="relative z-10 mt-8 flex items-end justify-between flex-wrap gap-4">
                            <div>
                                <p className="text-white/60 text-[11px] uppercase tracking-wide font-semibold">Renews or ends</p>
                                <p className="text-white font-bold mt-0.5">
                                    {new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-white/60 text-[11px] uppercase tracking-wide font-semibold">Days remaining</p>
                                <p className="text-white font-black text-2xl tabular-nums" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    {daysLeft}
                                </p>
                            </div>
                        </div>

                        {/* Progress bar — time elapsed in the billing cycle */}
                        <div className="relative z-10 mt-4 h-1.5 rounded-full bg-white/20 overflow-hidden">
                            <div
                                className="h-full bg-white/90 rounded-full transition-all duration-700"
                                style={{ width: `${elapsedPct}%` }}
                            />
                        </div>
                    </div>
                </Reveal>

                {/* ─── STATS GRID ─── */}
                {isSeller && (
                    <Reveal delay={80}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                            <StatCard
                                icon={Wallet}
                                label="Fees saved"
                                value={loading ? '···' : `GHS ${feeSaved.toFixed(2)}`}
                                accent={meta.textAccent}
                            />
                            <StatCard
                                icon={Tag}
                                label="Active listings"
                                value={loading ? '···' : listingLimit === Infinity ? `${listingCount}` : `${listingCount}/${listingLimit}`}
                                accent={meta.textAccent}
                            />
                            <StatCard
                                icon={Eye}
                                label="Total views"
                                value={loading ? '···' : totalViews}
                                accent={meta.textAccent}
                            />
                            <StatCard
                                icon={Clock}
                                label="Days left"
                                value={daysLeft}
                                accent={meta.textAccent}
                            />
                        </div>

                        {listingLimit !== Infinity && (
                            <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="text-white/60 font-semibold">Listing usage</span>
                                    <span className="text-white/80 font-bold">{listingCount} of {listingLimit}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${meta.gradientFrom} ${meta.gradientTo} transition-all duration-700`}
                                        style={{ width: `${listingUsagePct}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </Reveal>
                )}

                {/* ─── QUICK ACTIONS ─── */}
                <Reveal delay={120}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                        {isSeller && (
                            <QuickAction
                                icon={Store}
                                title="View my store"
                                desc="See how buyers see your storefront"
                                onClick={() => navigate(`/store/${user.id}`)}
                                accent={meta}
                            />
                        )}
                        <QuickAction
                            icon={MessageCircle}
                            title="Priority support"
                            desc={planTier === 'premium' ? 'Same-day dedicated line' : '24-hour priority response'}
                            onClick={() => navigate('/contact')}
                            accent={meta}
                        />
                        <QuickAction
                            icon={Gauge}
                            title="Manage subscription"
                            desc="Renew, view billing, or change plan"
                            onClick={() => navigate('/settings')}
                            accent={meta}
                        />
                    </div>
                </Reveal>

                {/* ─── FULL BENEFITS BREAKDOWN ─── */}
                <div className="mt-12">
                    <Reveal>
                        <h2 className="text-lg font-bold text-white/90 flex items-center gap-2">
                            <ShieldCheck size={18} className={meta.textAccent} />
                            Everything included in your plan
                        </h2>
                    </Reveal>

                    <div className="mt-5 space-y-8">
                        {SELLER_BENEFITS.map((group, gi) => {
                            const groupItems = group.items.filter((item) => item.tiers.includes(planTier));
                            if (groupItems.length === 0) return null;
                            return (
                                <Reveal key={group.category} delay={gi * 80}>
                                    <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-3">
                                        {group.category}
                                    </p>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {groupItems.map((item) => (
                                            <BenefitCard key={item.title} item={item} meta={meta} />
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
                        <div className="mt-12 relative overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-purple-950/40 p-6 sm:p-8">
                            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-violet-500/20 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={18} className="text-violet-400" />
                                    <span className="text-xs font-bold uppercase tracking-wide text-violet-300">
                                        Go further with Premium
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-2">
                                    Unlimited listings. Top store placement. Same-day support.
                                </h3>
                                <p className="text-white/50 text-sm mt-2 max-w-lg">
                                    Everything you have on Pro, plus no listing cap at all and your store shown first, every time.
                                </p>
                                <button
                                    onClick={() => navigate('/', { state: { scrollToPricing: true } })}
                                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-violet-500 hover:bg-violet-400 text-white font-bold text-sm transition"
                                >
                                    Upgrade to Premium <ArrowRight size={15} />
                                </button>
                            </div>
                        </div>
                    </Reveal>
                )}

                {/* ─── FAQ ─── */}
                <div className="mt-12 mb-16">
                    <Reveal>
                        <h2 className="text-lg font-bold text-white/90 flex items-center gap-2 mb-4">
                            <Gift size={18} className={meta.textAccent} />
                            Good to know
                        </h2>
                    </Reveal>
                    <div className="space-y-2">
                        {FAQ_ITEMS.map((faq, i) => (
                            <Reveal key={faq.q} delay={i * 60}>
                                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
                                    >
                                        <span className="font-semibold text-sm text-white/90">{faq.q}</span>
                                        <ChevronDown
                                            size={16}
                                            className={`shrink-0 text-white/40 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {openFaq === i && (
                                        <p className="text-sm text-white/50 leading-relaxed px-4 sm:px-5 pb-4 pr-8">
                                            {faq.a}
                                        </p>
                                    )}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const FAQ_ITEMS = [
    {
        q: 'What happens when my plan expires?',
        a: 'Your account automatically reverts to the Free plan — no charge happens without you actively resubscribing. Any active listings beyond the Free plan\'s limit stay live but you won\'t be able to add new ones until you\'re back under the cap or renew.',
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

function StatCard({ icon: Icon, label, value, accent }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <Icon size={16} className={`${accent} mb-2`} />
            <p className="text-lg font-extrabold text-white tabular-nums">{value}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
        </div>
    );
}

function QuickAction({ icon: Icon, title, desc, onClick, accent }) {
    return (
        <button
            onClick={onClick}
            className={`text-left bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:${accent.borderSoft} rounded-2xl p-4 transition group`}
        >
            <div className={`w-9 h-9 rounded-lg ${accent.bgSoft} flex items-center justify-center mb-3`}>
                <Icon size={16} className={accent.textAccent} />
            </div>
            <p className="font-bold text-sm text-white flex items-center gap-1.5">
                {title}
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </p>
            <p className="text-xs text-white/40 mt-1">{desc}</p>
        </button>
    );
}

function BenefitCard({ item, meta }) {
    const Icon = item.icon;
    return (
        <div className={`flex items-start gap-3 bg-white/5 border border-white/10 hover:${meta.borderSoft} rounded-2xl p-4 transition`}>
            <div className={`w-9 h-9 rounded-lg ${meta.bgSoft} flex items-center justify-center shrink-0`}>
                <Icon size={16} className={meta.textAccent} />
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-white">{item.title}</p>
                    <Check size={13} className="text-emerald-400 shrink-0" />
                </div>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">{item.desc}</p>
            </div>
        </div>
    );
}