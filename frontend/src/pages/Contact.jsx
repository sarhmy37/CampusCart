import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle, Clock, Send, Loader2, CheckCircle2, Inbox, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function WhatsAppIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2zm0 18.09h-.003a8.077 8.077 0 0 1-4.116-1.128l-.295-.176-3.056.912.918-2.98-.192-.306a8.062 8.062 0 0 1-1.246-4.408c0-4.463 3.632-8.095 8.098-8.095 2.163 0 4.195.843 5.724 2.373a8.037 8.037 0 0 1 2.372 5.727c0 4.463-3.633 8.095-8.204 8.081z"/>
        </svg>
    );
}

const CONTACT_METHODS = [
    {
        icon: WhatsAppIcon,
        iconClass: 'text-emerald-500',
        label: 'WhatsApp',
        value: '@Trex_Support1',
        href: 'https://wa.me/Trex_Support1',
        note: 'Fastest response, usually within a few hours',
    },
    {
        icon: Mail,
        iconClass: 'text-brand-600 dark:text-gold-400',
        label: 'Email',
        value: 'support@trex.app',
        href: 'mailto:support@trex.app',
        note: 'We reply within 1 business day',
    },
];

const CONTACT_TABS = ['overview', 'sent', 'attended'];
const CONTACT_TAB_LABELS = { overview: 'Overview', sent: 'Sent', attended: 'Attended' };

export default function Contact() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const cameFromProfileDrawer = location.state?.fromProfileDrawer;
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [tab, setTab] = useState('overview');
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    useEffect(() => {
        if (tab === 'overview' || !user) return;
        setLoadingRequests(true);
        api.get('/support/mine')
            .then((res) => setRequests(res.data))
            .catch(() => setRequests([]))
            .finally(() => setLoadingRequests(false));
    }, [tab, user]);

    const sentRequests = requests.filter((r) => r.status === 'pending');
    const attendedRequests = requests.filter((r) => r.status !== 'pending');

    const handleBack = () => {
        if (cameFromProfileDrawer) {
            navigate('/', { state: { openProfile: true, openSupport: true } });
        } else {
            navigate(-1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        if (!user) {
            navigate('/login');
            return;
        }
        if (user.account_type !== 'buyer' && !user.personal_email) {
            toast.error('Please add a personal email in your profile before contacting support');
            navigate('/', { state: { openProfile: true } });
            return;
        }
        setSending(true);
        try {
            await api.post('/support', { message: message.trim() });
            setSent(true);
            setMessage('');
            const isPlanActive = user.plan && user.plan !== 'free' &&
                user.plan_expires_at && new Date(user.plan_expires_at) > new Date();
            const slaText = isPlanActive && user.plan === 'premium'
                ? "Message sent — check your email within 24 hours."
                : isPlanActive && user.plan === 'pro'
                    ? "Message sent — check your email within 2 days."
                    : "Message sent — check your email within a few days.";
            toast.success(slaText);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-8">
                <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-gold-200/60 hover:text-slate-700 dark:hover:text-gold-100 transition"
                >
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="flex items-center gap-3 mt-5 mb-6">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900 flex items-center justify-center">
                        <MessageCircle className="text-brand-600 dark:text-gold-400" size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-gold-50">Contact Us</h1>
                        <p className="text-slate-500 dark:text-gold-200/50 text-sm mt-0.5">We're here to help</p>
                    </div>
                </div>
                <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-ink-800 p-1 rounded-xl w-fit mx-auto">
                    {CONTACT_TABS.map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                                tab === t
                                    ? 'bg-white dark:bg-ink-700 shadow-sm text-brand-700 dark:text-gold-400'
                                    : 'text-slate-500 dark:text-gold-200/50'
                            }`}
                        >
                            {CONTACT_TAB_LABELS[t]}
                        </button>
                    ))}
                </div>

                {tab === 'overview' && (
                <div className="space-y-3">
                {CONTACT_METHODS.map((method) => (
                    <a
                        key={method.label}
                        href={method.href}
                        target={method.href.startsWith('http') ? '_blank' : undefined}
                        rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="flex items-center gap-4 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 hover:shadow-sm hover:border-brand-300 dark:hover:border-gold-500/40 transition"
                    >
                        <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-ink-700 flex items-center justify-center shrink-0">
                            <method.icon className={`w-5 h-5 ${method.iconClass}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 dark:text-gold-50">{method.label}</p>
                            <p className="text-sm text-brand-600 dark:text-gold-400 font-semibold mt-0.5">{method.value}</p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1">{method.note}</p>
                        </div>
                    </a>
                ))}

                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5" data-support-form>
                    <p className="font-bold text-slate-900 dark:text-gold-50 mb-3">Send us a message</p>
                    {sent ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-semibold py-3">
                            <CheckCircle2 size={18} /> Message sent — we'll get back to you soon.
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Tell us what's going on..."
                                rows={4}
                                disabled={sending}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition resize-none disabled:opacity-60"
                            />
                            <button
                                type="submit"
                                disabled={sending || !message.trim()}
                                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                            >
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {sending ? 'Sending…' : 'Send message'}
                            </button>
                        </form>
                    )}
                </div>

                <div className="flex items-start gap-3 bg-slate-100 dark:bg-ink-800/60 rounded-2xl p-4 mt-2">
                    <Clock size={16} className="text-slate-400 dark:text-gold-300/50 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 dark:text-gold-200/60">
                        Premium members get a reply within 24 hours, Pro within 2 days, and free members within a few days.
                    </p>
                </div>
                </div>
                )}

                {tab === 'sent' && (
                    <RequestList
                        loading={loadingRequests}
                        items={sentRequests}
                        emptyIcon={Inbox}
                        emptyText="No pending requests. Anything you send shows up here until we reply."
                    />
                )}

                {tab === 'attended' && (
                    <RequestList
                        loading={loadingRequests}
                        items={attendedRequests}
                        emptyIcon={CheckCheck}
                        emptyText="Nothing attended to yet."
                        attended
                    />
                )}
            </div>
        </div>
    );
}

function RequestList({ loading, items, emptyIcon: Icon, emptyText, attended }) {
    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />
                ))}
            </div>
        );
    }
    if (items.length === 0) {
        return (
            <div className="text-center py-16">
                <Icon className="mx-auto text-slate-300 dark:text-gold-300/30 mb-3" size={28} />
                <p className="text-sm text-slate-400 dark:text-gold-200/50">{emptyText}</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {items.map((r) => (
                <div key={r.id} className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                    <p className="text-sm text-slate-700 dark:text-gold-100 line-clamp-2">{r.message}</p>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-slate-400 dark:text-gold-200/50">
                            {new Date(r.created_at).toLocaleDateString()}
                        </p>
                        {attended ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={13} /> Attended to
                            </span>
                        ) : (
                            <span className="text-xs font-semibold text-amber-600 dark:text-gold-400">Pending</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}