import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, Lock, Bell, Eye, EyeOff, MapPin, Truck, Info,
    FileText, Shield, Mail, ChevronRight, ChevronDown, Percent
} from 'lucide-react';

const APP_VERSION = '1.0.0';
const PLATFORM_FEE_RATE = 5; // %

export default function Settings() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isSeller = user?.account_type === 'seller';

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [termsOpen, setTermsOpen] = useState(isSeller);
    const [fullTermsOpen, setFullTermsOpen] = useState(false);

    const [notifyListings, setNotifyListings] = useState(
        localStorage.getItem('cc_notify_listings') !== 'false'
    );
    const [notifyMessages, setNotifyMessages] = useState(
        localStorage.getItem('cc_notify_messages') !== 'false'
    );
    const [defaultDelivery, setDefaultDelivery] = useState(
        localStorage.getItem('cc_default_delivery') || 'pickup'
    );

    const toggleNotify = (key, value, setter) => {
        setter(value);
        localStorage.setItem(key, String(value));
    };

    const setDelivery = (value) => {
        setDefaultDelivery(value);
        localStorage.setItem('cc_default_delivery', value);
        toast.success(`Default set to ${value === 'pickup' ? 'campus meet-up' : 'delivery'}`);
    };

    const onChangePassword = async (e) => {
        e.preventDefault();
        if (next !== confirm) {
            toast.error("New passwords don't match");
            return;
        }
        setSaving(true);
        try {
            await api.patch('/auth/me/password', { current_password: current, new_password: next });
            toast.success('Password updated');
            setCurrent('');
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
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-600">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 rounded-full blur-3xl" />
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

                {/* PLATFORM FEES & TERMS */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setTermsOpen((o) => !o)}
                        className="w-full flex items-center justify-between p-6"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-accent-500 text-white flex items-center justify-center">
                                <Percent size={16} />
                            </div>
                            <div className="text-left">
                                <h2 className="font-bold text-slate-900">Fees & Terms</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Platform commission for sellers</p>
                            </div>
                        </div>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform ${termsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {termsOpen && (
                        <div className="px-6 pb-6 -mt-1">
                            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                                <p className="text-sm text-brand-900 leading-relaxed">
                                    <span className="font-bold">{PLATFORM_FEE_RATE}% platform fee</span> is
                                    charged on every product you sell as a seller. This fee is calculated on
                                    the item's sale price at the moment a purchase is completed.
                                </p>
                            </div>

                            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                                <li className="flex gap-2">
                                    <span className="text-brand-600 font-bold">•</span>
                                    Fees from all your sales are totaled up over the calendar month.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-brand-600 font-bold">•</span>
                                    At the end of each month, the total amount owed must be paid to
                                    continue creating new listings and selling on CampusCart.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-brand-600 font-bold">•</span>
                                    Buyers are never charged this fee — it only applies to seller payouts.
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-brand-600 font-bold">•</span>
                                    You can track fees owed and payment history from your Dashboard.
                                </li>
                            </ul>

                           <button
                                onClick={() => setFullTermsOpen((o) => !o)}
                                className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700"
                            >
                                {fullTermsOpen ? 'Hide' : 'Read'} full Terms of Service
                                <ChevronDown size={14} className={`transition-transform ${fullTermsOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {fullTermsOpen && (
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 text-sm text-slate-600 leading-relaxed">
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
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Lock size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900">Change password</h2>
                    </div>

                    <form onSubmit={onChangePassword} className="space-y-3">
                        <input
                            type={show ? 'text' : 'password'}
                            required
                            placeholder="Current password"
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm transition"
                        />
                        <input
                            type={show ? 'text' : 'password'}
                            required
                            minLength={6}
                            placeholder="New password"
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm transition"
                        />
                        <input
                            type={show ? 'text' : 'password'}
                            required
                            placeholder="Confirm new password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm transition"
                        />

                        <button
                            type="button"
                            onClick={() => setShow((s) => !s)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                        >
                            {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Hide' : 'Show'} passwords
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                        >
                            {saving ? 'Updating…' : 'Update password'}
                        </button>
                    </form>
                </div>

                {/* DEFAULT DELIVERY PREFERENCE */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Truck size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900">Default delivery preference</h2>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                        This will be pre-selected whenever you check out — you can still change it per order.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setDelivery('pickup')}
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition ${
                                defaultDelivery === 'pickup' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                        >
                            <MapPin size={18} />
                            Meet on campus
                        </button>
                        <button
                            onClick={() => setDelivery('delivery')}
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition ${
                                defaultDelivery === 'delivery' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                        >
                            <Truck size={18} />
                            Delivery
                        </button>
                    </div>
                </div>

                {/* NOTIFICATIONS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Bell size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900">Notifications</h2>
                    </div>

                    <ToggleRow
                        label="New listings"
                        desc="Get notified when new items match your interests"
                        checked={notifyListings}
                        onChange={(v) => toggleNotify('cc_notify_listings', v, setNotifyListings)}
                    />
                    <ToggleRow
                        label="Messages"
                        desc="Get notified when a buyer or seller messages you"
                        checked={notifyMessages}
                        onChange={(v) => toggleNotify('cc_notify_messages', v, setNotifyMessages)}
                    />
                </div>

                {/* ABOUT */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Info size={16} />
                        </div>
                        <h2 className="font-bold text-slate-900">About</h2>
                    </div>

                    <AboutRow icon={FileText} label="Terms of Service" to="/terms" />
                    <AboutRow icon={Shield} label="Privacy Policy" to="/privacy" />
                    <AboutRow icon={Mail} label="Contact support" href="mailto:support@campuscart.app" />

                    <div className="flex items-center justify-between py-3 border-t border-slate-100 mt-1">
                        <span className="text-sm text-slate-400">App version</span>
                        <span className="text-sm font-semibold text-slate-600">v{APP_VERSION}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToggleRow({ label, desc, checked, onChange }) {
    return (
        <div className="flex items-center justify-between py-3 border-t border-slate-100 first:border-0 first:pt-0">
            <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-11 h-6 rounded-full relative transition ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}
            >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );
}

function AboutRow({ icon: Icon, label, to, href }) {
    const content = (
        <div className="flex items-center justify-between py-3 border-t border-slate-100 first:border-0 first:pt-0 group">
            <div className="flex items-center gap-2.5">
                <Icon size={16} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{label}</span>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition" />
        </div>
    );
    return to ? <Link to={to}>{content}</Link> : <a href={href}>{content}</a>;
}

function TermsBlock({ title, children }) {
    return (
        <div>
            <p className="font-bold text-slate-800">{title}</p>
            <p className="mt-1">{children}</p>
        </div>
    );
}