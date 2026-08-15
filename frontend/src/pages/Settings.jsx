import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    ArrowLeft, Lock, Bell, Eye, EyeOff, MapPin, Truck, Info,
    FileText, Shield, Mail, ChevronRight, ChevronDown, Percent, Trash2, AlertTriangle, Moon, Sun, Gift
} from 'lucide-react';
import { SETTINGS_VIDEO } from '../data/media';

const APP_VERSION = '1.0.0';
const PLATFORM_FEE_RATE = 2; // %

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

   const [pwStep, setPwStep] = useState(1);
    const [current, setCurrent] = useState('');
    const [code, setCode] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [termsOpen, setTermsOpen] = useState(isSeller);
    const [fullTermsOpen, setFullTermsOpen] = useState(false);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const { logout } = useAuth();

        const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/auth/me', { 
                data: { password: deletePassword },
                headers: { Authorization: `Bearer ${localStorage.getItem('cc_token')}` } // <--- ADDED THIS LINE
            });
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
        
        // Create an AbortController for a 10-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Add the 'signal' option to your api.post call
            const response = await api.post('/auth/me/password/request-code', 
                { current_password: current },
                { signal: controller.signal } 
            );

            clearTimeout(timeoutId); // Cancel the timeout if it succeeds
            toast.success('Code sent to your university email');
            setPwStep(2);
        } catch (err) {
            clearTimeout(timeoutId); // Cancel the timeout on error

            // Handle the timeout error specifically
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
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-5">Settings</h1>
                    <p className="text-white/70 text-sm mt-1">Manage your account, preferences, and fees</p>
                </div>
            </section>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

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

                {/* PLATFORM FEES & TERMS */}
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
                                    continue creating new listings and selling on CampusCart.
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
                                {fullTermsOpen ? 'Hide' : 'Read'} full Terms of Service
                                <ChevronDown size={14} className={`transition-transform ${fullTermsOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {fullTermsOpen && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-600 space-y-4 text-sm text-slate-600 dark:text-gold-200/70 leading-relaxed">
                                    <TermsBlock title="1. Seller Fee">
                                        A {PLATFORM_FEE_RATE}% platform fee applies to the sale price of every
                                        item sold. This is deducted from your earnings, not added on top for buyers.
                                    </TermsBlock>
                                    <TermsBlock title="2. Monthly Seller Payment">
                                        Platform fees accrued across a calendar month must be settled by the
                                        end of that month. Selling privileges are paused for sellers with an
                                        overdue balance until payment is made.
                                    </TermsBlock>
                                    <TermsBlock title="3. Seller Responsibilities">
                                        Sellers must accurately describe item condition, honor listed prices,
                                        and respond to buyer messages in good faith. Misrepresenting an item
                                        or repeated no-shows to agreed meetups may result in account restrictions.
                                    </TermsBlock>
                                    <TermsBlock title="4. What Counts as a Successful Purchase">
                                        A purchase is successful once the buyer has received the item and the
                                        order is marked complete. Only successful purchases count toward seller
                                        fees, earnings, and reward milestones.
                                    </TermsBlock>
                                    <TermsBlock title="5. Refunds & Cancellations">
                                        Orders can be cancelled before meetup by mutual agreement between
                                        buyer and seller. Refunded or cancelled orders do not incur a platform
                                        fee and are excluded from seller earnings and reward counts.
                                    </TermsBlock>
                                    <TermsBlock title="6. Seller Rewards">
                                        Sellers earn a reward bonus for every 30 successful purchases completed.
                                        Only successful, non-refunded, non-cancelled purchases count toward
                                        this milestone.
                                    </TermsBlock>
                                    <TermsBlock title="7. Platform Rules">
                                        Buying and selling is restricted to verified university students.
                                        Prohibited, unsafe, or illegal items may not be listed. CampusCart may
                                        remove listings or suspend accounts that violate these terms.
                                    </TermsBlock>
                                </div>
                            )}
                        </div>
                    )}
                </div>

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

                {/* DEFAULT DELIVERY PREFERENCE */}
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
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition ${
                                defaultDelivery === 'pickup'
                                    ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300'
                                    : 'border-slate-200 dark:border-ink-600 text-slate-500 dark:text-gold-200/50 hover:border-slate-300 dark:hover:border-ink-500'
                            }`}
                        >
                            <MapPin size={18} />
                            Meet on campus
                        </button>
                        <button
                            onClick={() => setDelivery('delivery')}
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition ${
                                defaultDelivery === 'delivery'
                                    ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/40 text-brand-700 dark:text-gold-300'
                                    : 'border-slate-200 dark:border-ink-600 text-slate-500 dark:text-gold-200/50 hover:border-slate-300 dark:hover:border-ink-500'
                            }`}
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
                                            r.credit_earned > 0
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-amber-50 dark:bg-gold-900/40 text-amber-700 dark:text-gold-400'
                                        }`}>
                                            {r.credit_earned > 0 ? 'Earned credit' : 'No order yet'}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold text-brand-700 dark:text-gold-400">
                                        {r.verified ? `+GHS ${r.credit_earned.toFixed(2)}` : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ABOUT */}
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                            <Info size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">About</h2>
                    </div>

                    <AboutRow icon={FileText} label="Terms of Service" to="/terms" />
                    <AboutRow icon={Shield} label="Privacy Policy" to="/privacy" />
                    <AboutRow icon={Mail} label="Contact support" href="mailto:support@campuscart.app" />

                    <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-ink-600 mt-1">
                        <span className="text-sm text-slate-400 dark:text-gold-200/50">App version</span>
                        <span className="text-sm font-semibold text-slate-600 dark:text-gold-200">v{APP_VERSION}</span>
                    </div>
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

function AboutRow({ icon: Icon, label, to, href }) {
    const content = (
        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-ink-600 first:border-0 first:pt-0 group">
            <div className="flex items-center gap-2.5">
                <Icon size={16} className="text-slate-400 dark:text-gold-300/50" />
                <span className="text-sm font-semibold text-slate-700 dark:text-gold-100">{label}</span>
            </div>
            <ChevronRight size={16} className="text-slate-300 dark:text-gold-300/40 group-hover:text-slate-500 dark:group-hover:text-gold-200 transition" />
        </div>
    );
    return to ? <Link to={to}>{content}</Link> : <a href={href}>{content}</a>;
}

function TermsBlock({ title, children }) {
    return (
        <div>
            <p className="font-bold text-slate-800 dark:text-gold-100">{title}</p>
            <p className="mt-1">{children}</p>
        </div>
    );
}