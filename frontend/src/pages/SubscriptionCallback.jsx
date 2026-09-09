import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // ~30 seconds

export default function SubscriptionCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setUser } = useAuth();

    // Paystack appends ?reference=... and/or ?trxref=... to the callback URL
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    const [status, setStatus] = useState('checking'); // 'checking' | 'active' | 'failed' | 'timeout'

    useEffect(() => {
        if (!reference) {
            setStatus('failed');
            return;
        }

        let cancelled = false;
        const MAX_RETRIES = 3; // only for transient network errors, not for waiting on a webhook

        const verify = async (attempt = 0) => {
            try {
                const res = await api.post(`/subscriptions/verify/${reference}`);
                const subStatus = res.data.status;

                if (subStatus === 'active') {
                    const meRes = await api.get('/auth/me');
                    localStorage.setItem('cc_user', JSON.stringify(meRes.data));
                    if (!cancelled) {
                        setUser(meRes.data);
                        setStatus('active');
                    }
                    return;
                }

                if (subStatus === 'failed' || subStatus === 'amount_mismatch') {
                    if (!cancelled) setStatus('failed');
                    return;
                }

                // Paystack itself says the transaction is still pending (rare —
                // e.g. a bank/mobile-money confirmation still in flight).
                if (!cancelled) setStatus('timeout');
            } catch (err) {
                if (attempt < MAX_RETRIES) {
                    setTimeout(() => verify(attempt + 1), 1500);
                } else if (!cancelled) {
                    setStatus('timeout');
                }
            }
        };

        verify();
        return () => { cancelled = true; };
    }, [reference, setUser]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="max-w-sm w-full text-center">
                {status === 'checking' && (
                    <>
                        <Loader2 className="w-10 h-10 mx-auto text-brand-500 dark:text-gold-400 animate-spin" />
                        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                            Confirming your payment…
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                            This usually only takes a few seconds.
                        </p>
                    </>
                )}

                {status === 'active' && (
                    <>
                        <CheckCircle className="w-10 h-10 mx-auto text-green-500" />
                        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                            Subscription activated!
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                            You're all set. Enjoy your new plan.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="mt-6 inline-flex items-center gap-2 bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 font-bold px-6 py-3 rounded-full hover:bg-brand-700 dark:hover:bg-gold-400 transition"
                        >
                            Go to dashboard
                        </button>
                    </>
                )}

                {status === 'failed' && (
                    <>
                        <XCircle className="w-10 h-10 mx-auto text-red-500" />
                        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                            Payment didn't go through
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                            No charge was completed. You can try again from the pricing section.
                        </p>
                        <Link
                            to="/"
                            className="mt-6 inline-flex items-center gap-2 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold px-6 py-3 rounded-full hover:bg-slate-200 dark:hover:bg-white/20 transition"
                        >
                            Back to home
                        </Link>
                    </>
                )}

                {status === 'timeout' && (
                    <>
                        <Loader2 className="w-10 h-10 mx-auto text-slate-400" />
                        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                            Still processing
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
                            Your payment is taking longer than usual to confirm. Check back in your dashboard shortly — you'll be upgraded automatically once it clears.
                        </p>
                        <Link
                            to="/dashboard"
                            className="mt-6 inline-flex items-center gap-2 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold px-6 py-3 rounded-full hover:bg-slate-200 dark:hover:bg-white/20 transition"
                        >
                            Go to dashboard
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}