import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { Mail, Lock, KeyRound, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { LOGIN_IMAGE } from '../data/media';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState('request'); // 'request' | 'reset'
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleRequestCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { university_email: email });
            toast.success('If that account exists, a reset code has been sent to your email.');
            setStep('reset');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/reset-password', {
                university_email: email,
                code,
                new_password: newPassword,
            });
            toast.success('Password reset successfully! Please log in.');
            navigate('/login');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2">
            {/* LEFT — visual panel */}
            <div className="relative hidden lg:block overflow-hidden">
                <img src={LOGIN_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-br from-ink-900/80 via-ink-800/55 to-brand-600/35 dark:from-ink-900/85 dark:via-ink-900/60 dark:to-gold-900/45" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/4 -bottom-24 w-64 h-64 bg-accent-500/20 dark:bg-gold-500/15 rounded-full blur-3xl" />

                <div className="relative z-10 h-full flex flex-col justify-center px-12 xl:px-16">
                    <span className="inline-flex items-center gap-1.5 w-fit bg-white/15 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                        <GraduationCap size={13} /> Tre-X
                    </span>
                    <h1 className="mt-6 text-3xl xl:text-4xl font-extrabold text-white leading-tight max-w-md">
                        Forgot your password? No worries.
                    </h1>
                    <p className="mt-4 text-white/80 text-sm max-w-sm">
                        We'll send a reset code to your university email so you can get back into your account.
                    </p>
                </div>
            </div>

            {/* RIGHT — form */}
            <div className="flex items-center justify-center px-4 py-16 bg-slate-50 dark:bg-ink-900">
                <div className="w-full max-w-sm">
                    {step === 'request' ? (
                        <>
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">Reset your password</h1>
                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">
                                Enter your university email and we'll send you a reset code.
                            </p>

                            <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">University Email</label>
                                    <div className="relative mt-1">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@st.knust.edu.gh"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-800 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                                >
                                    {loading ? 'Sending code…' : 'Send reset code'}
                                </button>
                            </form>

                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-4 text-center">
                                Already have your code?{' '}
                                <button
                                    type="button"
                                    onClick={() => setStep('reset')}
                                    className="text-brand-600 dark:text-gold-400 font-semibold"
                                >
                                    Enter it here
                                </button>
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">Enter your code</h1>
                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">
                                Check your email for the 6-digit reset code, then set a new password.
                            </p>

                            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">University Email</label>
                                    <div className="relative mt-1">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@st.knust.edu.gh"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-800 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">Reset Code</label>
                                    <div className="relative mt-1">
                                        <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type="text"
                                            required
                                            maxLength={6}
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                            placeholder="123456"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-800 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition tracking-widest"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">New Password</label>
                                    <div className="relative mt-1">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-800 text-slate-900 dark:text-gold-50 transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((s) => !s)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40 hover:text-slate-600 dark:hover:text-gold-200"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">Confirm New Password</label>
                                    <div className="relative mt-1">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-800 text-slate-900 dark:text-gold-50 transition"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                                >
                                    {loading ? 'Resetting…' : 'Reset password'}
                                </button>
                            </form>

                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-4 text-center">
                                Didn't get a code?{' '}
                                <button
                                    type="button"
                                    onClick={() => setStep('request')}
                                    className="text-brand-600 dark:text-gold-400 font-semibold"
                                >
                                    Send again
                                </button>
                            </p>
                        </>
                    )}

                    <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-6 text-center">
                        Remembered your password?{' '}
                        <Link to="/login" className="text-brand-600 dark:text-gold-400 font-semibold">Log in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}