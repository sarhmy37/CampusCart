import { useState } from 'react';
import toast from 'react-hot-toast';
import { X, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function VerifyModal({ open, onClose }) {
    const { user, setUser } = useAuth();
    const [step, setStep] = useState('start'); // 'start' | 'code'
    const [inputCode, setInputCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);

    if (!open) return null;

    const handleSendCode = async () => {
        setSending(true);
        try {
            await api.post('/auth/me/send-verification');
            setStep('code');
            toast.success('Verification code sent to your email');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send code');
        } finally {
            setSending(false);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        try {
            const res = await api.post('/auth/me/verify', { code: inputCode });
            localStorage.setItem('cc_user', JSON.stringify(res.data));
            setUser(res.data);
            toast.success("You're verified!");
            handleClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Incorrect code');
        } finally {
            setVerifying(false);
        }
    };

    const handleClose = () => {
        setStep('start');
        setInputCode('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white dark:bg-ink-800 border border-transparent dark:border-ink-600 rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition"
                >
                    <X size={18} />
                </button>

                <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900 flex items-center justify-center mb-4">
                    <ShieldCheck className="text-brand-600 dark:text-gold-400" size={22} />
                </div>

                {step === 'start' ? (
                    <>
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">Verify your account</h2>
                        <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1.5">
                            We'll email a 6-digit code to confirm this is really you.
                        </p>

                        <div className="mt-4 flex items-center gap-2.5 bg-slate-50 dark:bg-ink-700 rounded-xl px-3.5 py-3">
                            <Mail size={16} className="text-slate-400 dark:text-gold-200/50 shrink-0" />
                            <span className="text-sm font-medium text-slate-700 dark:text-gold-100 truncate">
                                {user?.university_email}
                            </span>
                        </div>

                        <button
                            onClick={handleSendCode}
                            disabled={sending}
                            className="w-full mt-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                        >
                            {sending ? 'Sending…' : 'Send verification code'}
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">Enter your code</h2>
                        <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1.5">
                            Check your inbox — the code expires in 10 minutes.
                        </p>

                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="6-digit code"
                            className="w-full mt-4 px-4 py-3 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-center text-lg font-bold tracking-[0.3em] transition"
                        />

                        <button
                            onClick={handleVerify}
                            disabled={verifying || inputCode.length !== 6}
                            className="w-full mt-4 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                        >
                            {verifying ? 'Verifying…' : 'Verify'}
                        </button>
                        <button
                            onClick={handleSendCode}
                            className="w-full mt-2 py-2 text-xs font-semibold text-slate-400 dark:text-gold-300/50 hover:text-slate-600 dark:hover:text-gold-100 transition"
                        >
                            Didn't get it? Send again
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}