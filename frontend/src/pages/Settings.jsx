import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    ArrowLeft, Lock, Bell, Eye, EyeOff, MapPin, Truck,
    Shield, ChevronRight, ChevronDown, ChevronLeft, Percent, Trash2, AlertTriangle, Moon, Sun, Gift,
    Store, Copy
} from 'lucide-react';
import { SETTINGS_VIDEO } from '../data/media';

const PLATFORM_FEE_RATE = 1.5;
const BUYER_SERVICE_FEE_RATE = 2;

export default function Settings() {
    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const referralLink = `${window.location.origin}/register?ref=${user?.referral_code || ''}`;
    const copyReferralLink = () => {
        navigator.clipboard.writeText(referralLink);
        toast.success('Referral link copied');
    };
    const { theme, toggleTheme } = useTheme();
    const isSeller = user?.account_type === 'seller';

    const API_ORIGIN = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    const businessProfileUrl = user?.id ? `${API_ORIGIN}/store/${user.id}` : '';
    const [storeStats, setStoreStats] = useState(null);
    const [storeStatsLoading, setStoreStatsLoading] = useState(false);
    const [socialsExpanded, setSocialsExpanded] = useState(false);

    const [pwStep, setPwStep] = useState(1);
    const [current, setCurrent] = useState('');
    const [code, setCode] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [fullTermsOpen, setFullTermsOpen] = useState(false);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const { logout } = useAuth();

    useEffect(() => {
        if (!isSeller || !user?.id) return;
        setStoreStatsLoading(true);
        Promise.all([
            api.get('/products/mine').catch(() => ({ data: [] })),
            api.get(`/reviews/seller/${user.id}`).catch(() => ({ data: { avg_rating: null, total: 0 } })),
        ])
            .then(([listingsRes, reviewsRes]) => {
                setStoreStats({
                    listingCount: listingsRes.data.filter((p) => p.status === 'available').length,
                    avgRating: reviewsRes.data.avg_rating,
                    reviewCount: reviewsRes.data.total || 0,
                });
            })
            .finally(() => setStoreStatsLoading(false));
    }, [isSeller, user?.id]);

    const shareOnSocial = (platform) => {
        if (!businessProfileUrl) return;
        const url = encodeURIComponent(businessProfileUrl);
        const text = encodeURIComponent('Check out my store on TreX! 🛍️');
        const shareUrls = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
            twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
            whatsapp: `https://wa.me/?text=${text} ${url}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
            telegram: `https://t.me/share/url?url=${url}&text=${text}`,
            reddit: `https://www.reddit.com/submit?url=${url}&title=${text}`,
        };
        if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank', 'width=600,height=400');
        }
    };

    const copyBusinessLink = () => {
        navigator.clipboard.writeText(businessProfileUrl);
        toast.success('Profile link copied!');
    };

    const shareInstagram = () => {
        if (!businessProfileUrl) return;
        navigator.clipboard.writeText(businessProfileUrl);
        toast.success('Link copied! Paste it in your Instagram bio or story.');
    };

    // ─── Snapchat share ──────────────────────────────────────────────────
    const shareSnapchat = () => {
        if (!businessProfileUrl) return;
        navigator.clipboard.writeText(businessProfileUrl);
        toast.success('Link copied! Open Snapchat and paste it in a chat or story.', { duration: 4000 });
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/auth/me', { data: { password: deletePassword } });
            toast.success('Account deleted');
            logout();
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete account');
        } finally {
            setDeleting(false);
        }
    };

    const [notifyListings, setNotifyListings] = useState(
        localStorage.getItem('cc_notify_listings') !== 'false'
    );
    const [notifyMessages, setNotifyMessages] = useState(
        localStorage.getItem('cc_notify_messages') !== 'false'
    );
    const [defaultDelivery, setDefaultDelivery] = useState(
        localStorage.getItem('cc_default_delivery') || 'pickup'
    );

    const [referrals, setReferrals] = useState([]);

    useEffect(() => {
        api.get('/auth/me').then((res) => {
            setUser(res.data);
            localStorage.setItem('cc_user', JSON.stringify(res.data));
        }).catch(() => {});

        api.get('/auth/me/referrals').then((res) => setReferrals(res.data)).catch(() => {});
    }, []);

    const toggleNotify = (key, value, setter) => {
        setter(value);
        localStorage.setItem(key, String(value));
    };

    const setDelivery = (value) => {
        setDefaultDelivery(value);
        localStorage.setItem('cc_default_delivery', value);
        toast.success(`Default set to ${value === 'pickup' ? 'campus meet-up' : 'delivery'}`);
    };

    const requestPasswordCode = async (e) => {
        e.preventDefault();
        setSaving(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await api.post('/auth/me/password/request-code',
                { current_password: current },
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);
            toast.success('Code sent to your university email');
            setPwStep(2);
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.code === 'ECONNABORTED' || err.message === 'canceled') {
                toast.error('Request timed out. Please try again.');
            } else {
                toast.error(err.response?.data?.error || 'Failed to send code');
            }
        } finally {
            setSaving(false);
        }
    };

    const confirmPasswordChange = async (e) => {
        e.preventDefault();
        if (next !== confirm) {
            toast.error("New passwords don't match");
            return;
        }
        setSaving(true);
        try {
            await api.patch('/auth/me/password', { code, new_password: next });
            toast.success('Password updated');
            setPwStep(1);
            setCurrent('');
            setCode('');
            setNext('');
            setConfirm('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <section className="relative overflow-hidden">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                   <source src={SETTINGS_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-accent-600/60 dark:from-ink-900/90 dark:via-ink-900/75 dark:to-gold-900/50" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-500/10 rounded-full blur-3xl" />
                <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-10">
                    <button
                        onClick={() => navigate('/', { state: { openProfile: true } })}
                        className="inline-flex items-center gap-1 sm:gap-2 bg-white/10 text-white font-semibold px-2.5 py-1 sm:px-4 sm:py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-sm"
                    >
                        <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" /> Back
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-5">Settings</h1>
                    <p className="text-white/70 text-sm mt-1">Manage your account and preferences</p>
                </div>
            </section>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* ─── BUSINESS PROFILE ─── */}
                {isSeller && (
                    <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl overflow-hidden shadow-sm">
                        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900 p-6">
                            {user?.avatar_url && (
                                <div
                                    className="absolute -right-6 top-1/2 -translate-y-1/2 w-56 h-56 pointer-events-none"
                                    style={{
                                        backgroundImage: `url(${user.avatar_url})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        filter: theme === 'dark' ? 'blur(8px)' : 'blur(1px)',
                                        opacity: theme === 'dark' ? 0.6 : 0.35,
                                        borderRadius: '9999px',
                                        maskImage: 'radial-gradient(circle, black 30%, transparent 72%)',
                                        WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 72%)',
                                    }}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900 opacity-0 dark:opacity-40 pointer-events-none" />

                            <div className="relative z-10 flex items-center gap-3.5">
                                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-white/15 border-[3px] border-slate-300 dark:border-white/30 dark:backdrop-blur flex items-center justify-center overflow-hidden shrink-0">
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-slate-700 dark:text-white font-bold text-xl">
                                            {user?.name?.charAt(0)?.toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-extrabold text-slate-900 dark:text-white text-lg truncate">{user?.name}</p>
                                        {user?.verified && (
                                            <span title="Verified seller" className="shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-white/20 flex items-center justify-center text-[11px] text-brand-700 dark:text-white">✓</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-white/75">{user?.school}</p>
                                </div>
                            </div>

                            <div className="relative z-10 flex items-center gap-6 mt-5 pt-4 border-t border-slate-200 dark:border-white/15">
                                <div>
                                    <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                                        {storeStatsLoading ? '···' : (storeStats?.listingCount ?? 0)}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-white/70 uppercase tracking-wide">Listings</p>
                                </div>
                                <div>
                                    <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                                        {storeStatsLoading ? '···' : (storeStats?.avgRating ? `★ ${storeStats.avgRating}` : '— No ratings')}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-white/70 uppercase tracking-wide">
                                        {storeStatsLoading ? 'Rating' : `${storeStats?.reviewCount ?? 0} review${storeStats?.reviewCount === 1 ? '' : 's'}`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                    <Store size={16} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-900 dark:text-gold-50">Business Profile</h2>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">
                                        Your storefront link, live for anyone to view and share.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={businessProfileUrl}
                                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm truncate"
                                />
                                <button
                                    onClick={copyBusinessLink}
                                    className="shrink-0 p-2.5 rounded-xl bg-slate-100 dark:bg-ink-600 text-slate-600 dark:text-gold-200 hover:bg-slate-200 dark:hover:bg-ink-500 transition"
                                    title="Copy link"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>

                            {/* ─── SOCIAL SHARE BUTTONS ───────────────────── */}
                            <div className="flex items-center flex-wrap gap-2 mt-4">
                                <span className="text-xs font-semibold text-slate-500 dark:text-gold-200/60 mr-2">Share on:</span>

                                {/* Always visible buttons */}
                                <button
                                    onClick={() => shareOnSocial('facebook')}
                                    className="p-2 rounded-lg bg-[#1877F2] hover:bg-[#0d65d9] text-white transition"
                                    title="Share on Facebook"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z"/>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => shareOnSocial('twitter')}
                                    className="p-2 rounded-lg bg-black dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-black transition"
                                    title="Share on Twitter / X"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M18.9 2H22l-7.6 8.7L23 22h-7.1l-5.5-7.2L4.1 22H1l8.2-9.3L1.4 2h7.3l5 6.6L18.9 2zm-1.2 18h1.7L7.1 4H5.3l12.4 16z"/>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => shareOnSocial('whatsapp')}
                                    className="p-2 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white transition"
                                    title="Share on WhatsApp"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                        <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2zm0 18.09h-.003a8.077 8.077 0 0 1-4.116-1.128l-.295-.176-3.056.912.918-2.98-.192-.306a8.062 8.062 0 0 1-1.246-4.408c0-4.463 3.632-8.095 8.098-8.095 2.163 0 4.195.843 5.724 2.373a8.037 8.037 0 0 1 2.372 5.727c0 4.463-3.633 8.095-8.204 8.081z"/>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => shareOnSocial('linkedin')}
                                    className="p-2 rounded-lg bg-[#0A66C2] hover:bg-[#0957a8] text-white transition"
                                    title="Share on LinkedIn"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.68H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/>
                                    </svg>
                                </button>

                                {/* ─── EXTRA BUTTONS (collapsible) ───────── */}
                                {socialsExpanded && (
                                    <>
                                        <button
                                            onClick={() => shareOnSocial('telegram')}
                                            className="p-2 rounded-lg bg-[#26A5E4] hover:bg-[#1e8ec4] text-white transition"
                                            title="Share on Telegram"
                                        >
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M21.94 4.68a1.5 1.5 0 0 0-1.53-.26L2.7 11.3a1.4 1.4 0 0 0 .1 2.63l4.62 1.5 1.79 5.71a1.2 1.2 0 0 0 1.98.46l2.65-2.51 4.53 3.34a1.4 1.4 0 0 0 2.2-.85l3.13-14.7a1.5 1.5 0 0 0-.76-1.7ZM9.1 14.24l8.9-7.16-7.44 8.53-.28 3.03-1.18-4.4Z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => shareOnSocial('reddit')}
                                            className="p-2 rounded-lg bg-[#FF4500] hover:bg-[#e03d00] text-white transition"
                                            title="Share on Reddit"
                                        >
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm5.5 9.1a1.5 1.5 0 0 1-1.5 1.5c-.3 0-.58-.09-.81-.24-.83.6-1.98 1-3.24 1.06l.55-2.58 1.8.38a1.06 1.06 0 1 0 .09-.55l-2-.42a.28.28 0 0 0-.33.21l-.6 2.86c-1.27-.05-2.42-.46-3.26-1.06-.23.15-.5.24-.81.24a1.5 1.5 0 1 1 1.14-2.48 3.7 3.7 0 0 1 1.63-.6l.65-3.05a.23.23 0 0 1 .27-.17l2.15.46a1.06 1.06 0 1 1-.09.53l-1.9-.4-.55 2.6a3.72 3.72 0 0 1 1.65.6 1.5 1.5 0 0 1 2.16 2.02Zm-6.7-.5a.63.63 0 1 0 0 1.25.63.63 0 0 0 0-1.25Zm5.9 0a.63.63 0 1 0 0 1.25.63.63 0 0 0 0-1.25Zm-3 2.7c.6 0 1.16-.12 1.66-.33a.19.19 0 0 0-.15-.35c-.44.18-.94.28-1.51.28s-1.07-.1-1.51-.28a.19.19 0 1 0-.15.35c.5.21 1.06.33 1.66.33Z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={shareInstagram}
                                            className="p-2 rounded-lg bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] hover:opacity-90 text-white transition"
                                            title="Share on Instagram"
                                        >
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M12 2c-2.72 0-3.06.01-4.13.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2.01 8.94 2 9.28 2 12s.01 3.06.06 4.13c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.94 21.99 9.28 22 12 22s3.06-.01 4.13-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.07.06-1.41.06-4.13s-.01-3.06-.06-4.13c-.05-1.06-.22-1.79-.47-2.43a4.9 4.9 0 0 0-1.16-1.77 4.9 4.9 0 0 0-1.77-1.16c-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2Zm0 1.8c2.67 0 2.99.01 4.04.06.98.04 1.5.2 1.85.34.47.18.8.4 1.15.75.35.35.57.68.75 1.15.14.35.3.87.34 1.85.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.04.98-.2 1.5-.34 1.85-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.35.14-.87.3-1.85.34-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.04-1.5-.2-1.85-.34a3.1 3.1 0 0 1-1.15-.75 3.1 3.1 0 0 1-.75-1.15c-.14-.35-.3-.87-.34-1.85-.05-1.05-.06-1.37-.06-4.04s.01-2.99.06-4.04c.04-.98.2-1.5.34-1.85.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.35-.14.87-.3 1.85-.34C9.01 3.81 9.33 3.8 12 3.8Zm0 3.06a5.14 5.14 0 1 0 0 10.28 5.14 5.14 0 0 0 0-10.28Zm0 8.48a3.34 3.34 0 1 1 0-6.68 3.34 3.34 0 0 1 0 6.68Zm5.34-8.68a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={shareSnapchat}
                                            className="p-2 rounded-lg bg-[#FFFC00] hover:bg-[#e6e300] text-black transition"
                                            title="Share on Snapchat"
                                        >
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M12.006 2.001C9.875 2.001 8.05 3.254 6.874 5.328c-.858 1.38-1.372 3.053-1.58 4.883-.211 1.86-.042 3.544.458 4.897-.36.082-.744.132-1.142.132-1.63 0-3.114-.709-3.114-2.188 0-.554.286-1.006.601-1.273.225-.19.457-.358.704-.559l.272-.222c.215-.168.4-.367.518-.577.204-.36.314-.796.258-1.209-.087-.637-.43-1.062-.948-1.062-.135 0-.268.029-.39.086-.342.168-.573.494-.69.983-.054.222-.094.457-.12.701-.038.355.013.715.14 1.044.053.136.107.27.147.402l.031.101c-.007.014-.012.029-.018.044-.384.961-.775 1.819-1.157 2.608-.868 1.779-1.613 3.31-1.613 4.548 0 .671.248 1.253.742 1.724.516.49 1.253.764 2.175.808.328.016.695-.009 1.104-.038.348-.025.715-.051 1.092-.051.805 0 1.628.131 2.354.426.78.318 1.486.801 2.124 1.384.512.469 1.028.95 1.517 1.314.431.325.841.494 1.226.494.385 0 .794-.169 1.226-.494.489-.364 1.005-.845 1.517-1.314.638-.583 1.345-1.066 2.124-1.384.726-.295 1.549-.426 2.354-.426.377 0 .744.026 1.092.051.409.029.776.054 1.104.038.922-.044 1.659-.318 2.175-.808.494-.471.742-1.053.742-1.724 0-1.238-.745-2.769-1.613-4.548-.382-.789-.773-1.647-1.157-2.608-.006-.015-.011-.03-.018-.044l.031-.101c.04-.132.094-.266.147-.402.127-.329.178-.689.14-1.044-.026-.244-.066-.479-.12-.701-.117-.489-.348-.815-.69-.983-.122-.057-.255-.086-.39-.086-.518 0-.861.425-.948 1.062-.056.413.054.849.258 1.209.118.21.303.409.518.577l.272.222c.247.201.479.369.704.559.315.267.601.719.601 1.273 0 1.479-1.484 2.188-3.114 2.188-.398 0-.782-.05-1.142-.132.5-1.353.669-3.037.458-4.897-.208-1.83-.722-3.503-1.58-4.883-1.176-2.074-3.001-3.327-5.132-3.327z"/>
                                            </svg>
                                        </button>
                                    </>
                                )}

                                {/* ─── TOGGLE BUTTON ──────────────────────── */}
                                <button
                                    onClick={() => setSocialsExpanded(!socialsExpanded)}
                                    className="p-2 rounded-lg bg-slate-100 dark:bg-ink-600 hover:bg-slate-200 dark:hover:bg-ink-500 text-slate-500 dark:text-gold-200 transition"
                                    title={socialsExpanded ? 'Show less' : 'More platforms'}
                                >
                                    {socialsExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* APPEARANCE */}
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 dark:text-gold-50">Appearance</h2>
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">
                                    {theme === 'dark' ? 'Dark mode is on' : 'Light mode is on'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`w-11 h-6 rounded-full relative transition ${theme === 'dark' ? 'bg-gold-500' : 'bg-slate-200'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform flex items-center justify-center ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* SELLER FEES & TERMS */}
                {isSeller && (
                    <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl overflow-hidden shadow-sm">
                        <button
                            onClick={() => setTermsOpen((o) => !o)}
                            className="w-full flex items-center justify-between p-6"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-accent-500 dark:from-gold-600 dark:to-gold-400 text-white flex items-center justify-center">
                                    <Percent size={16} />
                                </div>
                                <div className="text-left">
                                    <h2 className="font-bold text-slate-900 dark:text-gold-50">Fees & Terms</h2>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">Platform commission for sellers</p>
                                </div>
                            </div>
                            <ChevronDown size={18} className={`text-slate-400 dark:text-gold-300/60 transition-transform ${termsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {termsOpen && (
                            <div className="px-6 pb-6 -mt-1">
                                <div className="bg-brand-50 dark:bg-ink-700 border border-brand-100 dark:border-gold-800 rounded-xl p-4">
                                    <p className="text-sm text-brand-900 dark:text-gold-200 leading-relaxed">
                                        <span className="font-bold">{PLATFORM_FEE_RATE}% platform fee</span> is
                                        charged on every product you sell as a seller. This fee is calculated on
                                        the item's sale price at the moment a purchase is completed.
                                    </p>
                                </div>

                                <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-gold-200/70">
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        Fees from all your sales are totaled up over the calendar month.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        At the end of each month, the total amount owed must be paid to
                                        continue creating new listings and selling on Tre-X.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        Buyers are never charged this fee — it only applies to seller payouts.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        You can track fees owed and payment history from your Dashboard.
                                    </li>
                                </ul>

                                <button
                                    onClick={() => setFullTermsOpen((o) => !o)}
                                    className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-brand-600 dark:text-gold-400 hover:text-brand-700 dark:hover:text-gold-300"
                                >
                                    {fullTermsOpen ? 'Hide' : 'Read'} full Seller Terms of Service
                                    <ChevronDown size={14} className={`transition-transform ${fullTermsOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {fullTermsOpen && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-600 space-y-4 text-sm text-slate-600 dark:text-gold-200/70">
                                        <TermsBlock title="1. Platform fee">
                                            Tre-X charges a {PLATFORM_FEE_RATE}% commission on the sale price of every completed transaction. This fee is deducted automatically from your payout.
                                        </TermsBlock>
                                        <TermsBlock title="2. Monthly settlement">
                                            Fees accrued across a calendar month are totaled and must be settled before new listings can be created in the following month.
                                        </TermsBlock>
                                        <TermsBlock title="3. Listing accuracy">
                                            Sellers must accurately represent the condition, price, and availability of items listed. Misrepresentation may result in listing removal or account suspension.
                                        </TermsBlock>
                                        <TermsBlock title="4. Order fulfillment">
                                            Sellers are expected to honor pickup or delivery arrangements made with buyers within the agreed timeframe.
                                        </TermsBlock>
                                        <TermsBlock title="5. Account standing">
                                            Tre-X reserves the right to suspend or ban seller accounts that repeatedly violate these terms or receive substantiated reports from buyers.
                                        </TermsBlock>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* BUYER TERMS */}
                {!isSeller && (
                    <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl overflow-hidden shadow-sm">
                        <button
                            onClick={() => setTermsOpen((o) => !o)}
                            className="w-full flex items-center justify-between p-6"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                    <Shield size={16} />
                                </div>
                                <div className="text-left">
                                    <h2 className="font-bold text-slate-900 dark:text-gold-50">Buyer Terms of Service</h2>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">Your shopping rights and protections</p>
                                </div>
                            </div>
                            <ChevronDown size={18} className={`text-slate-400 dark:text-gold-300/60 transition-transform ${termsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {termsOpen && (
                            <div className="px-6 pb-6 -mt-1">
                                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-gold-200/70">
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        You are protected by our Buyer Guarantee — if an item doesn't match the listing, contact support for a full refund.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        Only confirm "Order Received" once you have physically received the item in the agreed condition.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        Sellers are responsible for delivering items as described. You will never be charged a platform fee as a buyer.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        Always communicate with sellers through our built-in messaging system for safety and dispute resolution.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-brand-600 dark:text-gold-400 font-bold">•</span>
                                        A small service fee ({BUYER_SERVICE_FEE_RATE}%) is applied to your checkout to cover payment processing charges by our payment provider (Paystack). This fee ensures your payment is secure and the platform remains safe for everyone.
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* CHANGE PASSWORD */}
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                            <Lock size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Change password</h2>
                    </div>

                   {pwStep === 1 ? (
                        <form onSubmit={requestPasswordCode} className="space-y-3">
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 -mt-1">
                                Confirm your current password — we'll email a verification code to your university email.
                            </p>
                            <input
                                type={show ? 'text' : 'password'}
                                required
                                placeholder="Current password"
                                value={current}
                                onChange={(e) => setCurrent(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => !s)}
                                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gold-300/60 hover:text-slate-700 dark:hover:text-gold-200"
                            >
                                {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Hide' : 'Show'} password
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 dark:from-gold-600 dark:to-gold-400 hover:opacity-90 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                            >
                                {saving ? 'Sending code…' : 'Send verification code'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={confirmPasswordChange} className="space-y-3">
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 -mt-1">
                                Enter the code we emailed you, along with your new password.
                            </p>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                placeholder="6-digit code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition tracking-widest text-center font-semibold"
                            />
                            <input
                                type={show ? 'text' : 'password'}
                                required
                                minLength={6}
                                placeholder="New password"
                                value={next}
                                onChange={(e) => setNext(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                            />
                            <input
                                type={show ? 'text' : 'password'}
                                required
                                placeholder="Confirm new password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => !s)}
                                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gold-300/60 hover:text-slate-700 dark:hover:text-gold-200"
                            >
                                {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Hide' : 'Show'} passwords
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 dark:from-gold-600 dark:to-gold-400 hover:opacity-90 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                            >
                                {saving ? 'Updating…' : 'Confirm & update password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPwStep(1)}
                                className="w-full text-xs text-slate-400 dark:text-gold-300/50 hover:text-slate-600 dark:hover:text-gold-200"
                            >
                                ← Start over
                            </button>
                        </form>
                    )}
                </div>

                {/* DEFAULT DELIVERY */}
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                            <Truck size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Default delivery preference</h2>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-4">
                        This will be pre-selected whenever you check out — you can still change it per order.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setDelivery('pickup')}
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition ${(
                                defaultDelivery === 'pickup'
                                    ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300'
                                    : 'border-slate-200 dark:border-ink-600 text-slate-500 dark:text-gold-200/50 hover:border-slate-300 dark:hover:border-ink-500'
                            )}`}
                        >
                            <MapPin size={18} />
                            Meet on campus
                        </button>
                        <button
                            onClick={() => setDelivery('delivery')}
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition ${(
                                defaultDelivery === 'delivery'
                                    ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300'
                                    : 'border-slate-200 dark:border-ink-600 text-slate-500 dark:text-gold-200/50 hover:border-slate-300 dark:hover:border-ink-500'
                            )}`}
                        >
                            <Truck size={18} />
                            Delivery
                        </button>
                    </div>
                </div>

                {/* NOTIFICATIONS */}
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                            <Bell size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Notifications</h2>
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-ink-600 first:border-0 first:pt-0">
                        <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">New listings</p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">Get notified when new items match your interests</p>
                        </div>
                        <button
                            onClick={() => toggleNotify('cc_notify_listings', !notifyListings, setNotifyListings)}
                            className={`w-11 h-6 rounded-full relative transition ${notifyListings ? 'bg-gold-500' : 'bg-slate-200'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform flex items-center justify-center ${notifyListings ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-ink-600 first:border-0 first:pt-0">
                        <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">Messages</p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">Get notified when a buyer or seller messages you</p>
                        </div>
                        <button
                            onClick={() => toggleNotify('cc_notify_messages', !notifyMessages, setNotifyMessages)}
                            className={`w-11 h-6 rounded-full relative transition ${notifyMessages ? 'bg-gold-500' : 'bg-slate-200'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform flex items-center justify-center ${notifyMessages ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* REFER A FRIEND */}
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                            <Gift size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Refer a friend</h2>
                    </div>
                   <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-4">
                        Get GHS 10 credit toward your platform fees for every friend who signs up with your link and completes their first order.
                    </p>

                    {user?.credit_balance > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 mb-4">
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                GHS {parseFloat(user.credit_balance).toFixed(2)} credit available
                            </p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400/70 mt-0.5">
                                Automatically applied to your next platform fee bill.
                            </p>
                        </div>
                    )}

                  <div className="flex items-center gap-2">
                        <input
                            readOnly
                            value={referralLink}
                            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm truncate"
                        />
                        <button
                            onClick={copyReferralLink}
                            className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition"
                        >
                            Copy
                        </button>
                    </div>

                    {referrals.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-600 space-y-2">
                            <p className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 uppercase tracking-wide">
                                Your referrals ({referrals.length})
                            </p>
                            {referrals.map((r, i) => (
    <div key={i} className="flex items-center justify-between text-sm">
        <div>
            <span className="font-medium text-slate-700 dark:text-gold-100">{r.name}</span>
            <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                r.verified
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-50 dark:bg-gold-900/40 text-amber-700 dark:text-gold-400'
            }`}>
                {r.verified ? 'Earned credit' : 'No order yet'}
            </span>
        </div>
        <span className="text-xs font-semibold text-brand-700 dark:text-gold-400">
            {r.verified ? `+GHS ${parseFloat(r.credit_earned).toFixed(2)}` : '—'}
        </span>
    </div>
))}
                        </div>
                    )}
                </div>

                {/* DANGER ZONE */}
                <div className="bg-white dark:bg-ink-800 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center">
                            <AlertTriangle size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Danger zone</h2>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-4">
                        Deleting your account is permanent — your listings, orders, and messages will be removed and cannot be recovered.
                    </p>
                    <button
                        onClick={() => setDeleteOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-semibold transition"
                    >
                        <Trash2 size={15} /> Delete my account
                    </button>
                </div>

            </div>

            {deleteOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteOpen(false)} />
                    <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mb-4">
                            <AlertTriangle size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Delete your account?</h3>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1.5">
                            This can't be undone. Enter your password to confirm.
                        </p>

                        <input
                            type="password"
                            required
                            placeholder="Password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            className="w-full mt-4 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 focus:outline-none text-sm transition"
                        />

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting || !deletePassword}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
                            >
                                {deleting ? 'Deleting…' : 'Delete account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TermsBlock({ title, children }) {
    return (
        <div>
            <p className="font-bold text-slate-800 dark:text-gold-100">{title}</p>
            <p className="mt-1">{children}</p>
        </div>
    );
}