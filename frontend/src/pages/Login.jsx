import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { LOGIN_IMAGE, LOGO_LIGHT, LOGO_DARK } from '../data/media';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ university_email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const loggedInUser = await login(form.university_email, form.password);
            toast.success(`Welcome back, ${loggedInUser.name}!`);
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Autofill styles */}
            <style>{`
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus,
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #f0eee8 inset !important;
                    -webkit-text-fill-color: #2d2a24 !important;
                    background-color: #f0eee8 !important;
                }
                .dark input:-webkit-autofill,
                .dark input:-webkit-autofill:hover,
                .dark input:-webkit-autofill:focus,
                .dark input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #4a4540 inset !important;
                    -webkit-text-fill-color: #f0edea !important;
                    background-color: #4a4540 !important;
                }
                input:autofill,
                input:autofill:hover,
                input:autofill:focus,
                input:autofill:active {
                    background-color: #f0eee8 !important;
                    color: #2d2a24 !important;
                }
                .dark input:autofill,
                .dark input:autofill:hover,
                .dark input:autofill:focus,
                .dark input:autofill:active {
                    background-color: #4a4540 !important;
                    color: #f0edea !important;
                }

                @keyframes logoPulse {
                    0%, 100% { transform: scale(1); opacity: 0.55; }
                    50% { transform: scale(1.35); opacity: 1; }
                }
                .logo-pulse {
                    animation: logoPulse 3.5s ease-in-out infinite;
                }
            `}</style>

            <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2 relative overflow-hidden">
                {/* MOBILE-ONLY background treatment */}
                <div className="absolute inset-0 lg:hidden">
                    <img src={LOGIN_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.14] dark:opacity-[0.10]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-50/95 to-slate-50 dark:from-ink-900 dark:via-ink-900/95 dark:to-ink-900" />
                    <div className="absolute -right-20 -top-24 w-72 h-72 bg-brand-300/25 dark:bg-gold-500/10 rounded-full blur-3xl" />
                    <div className="absolute -left-16 bottom-0 w-64 h-64 bg-accent-400/15 dark:bg-gold-700/10 rounded-full blur-3xl" />
                </div>

                {/* LEFT — visual panel (desktop only) */}
                <div className="relative hidden lg:block overflow-hidden">
                    <img src={LOGIN_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-accent-600/60 dark:from-ink-900/85 dark:via-ink-900/60 dark:to-gold-900/45" />
                    <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute left-1/4 -bottom-24 w-64 h-64 bg-accent-500/20 dark:bg-gold-500/15 rounded-full blur-3xl" />

                    <div className="relative z-10 h-full flex flex-col justify-center px-12 xl:px-16">
                        <img src={LOGO_DARK} alt="Tre-X" className="h-8 w-auto dark:hidden logo-pulse" />
                        <img src={LOGO_LIGHT} alt="Tre-X" className="h-8 w-auto hidden dark:block logo-pulse" />
                        <h1 className="mt-6 text-3xl xl:text-4xl font-extrabold text-white leading-tight max-w-md">
                            Welcome back to your campus marketplace.
                        </h1>
                        <p className="mt-4 text-white/80 text-sm max-w-sm">
                            Log in to message sellers, track your orders, and list what you no longer need.
                        </p>
                    </div>
                </div>

                {/* RIGHT — form */}
                <div className="relative z-10 flex items-center justify-center px-4 py-14 sm:py-16 lg:bg-slate-50 lg:dark:bg-ink-900">
                    <div className="w-full max-w-sm">
                        {/* Logo — mobile only */}
                        <div className="flex justify-center mb-8 lg:hidden">
                            <img src={LOGO_DARK} alt="Tre-X" className="h-11 w-auto dark:hidden logo-pulse" />
                            <img src={LOGO_LIGHT} alt="Tre-X" className="h-11 w-auto hidden dark:block logo-pulse" />
                        </div>

                        <div className="bg-white/90 dark:bg-ink-800/90 backdrop-blur-sm lg:bg-transparent lg:dark:bg-transparent border border-slate-200/70 dark:border-ink-600/70 lg:border-0 rounded-3xl lg:rounded-none p-6 sm:p-7 lg:p-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] lg:shadow-none">
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50 text-center lg:text-left">Welcome back</h1>
                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1 text-center lg:text-left">Log in with your university email.</p>

                            <form onSubmit={onSubmit} className="mt-6 space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">University Email</label>
                                    <div className="relative mt-1">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type="email"
                                            required
                                            value={form.university_email}
                                            onChange={(e) => setForm({ ...form, university_email: e.target.value })}
                                            placeholder="you@st.knust.edu.gh"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">Password</label>
                                    <div className="relative mt-1">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 transition"
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

                                <div className="flex justify-end">
                                    <Link to="/forgot-password" className="text-sm text-brand-600 dark:text-gold-400 font-semibold">
                                        Forgot password?
                                    </Link>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                                >
                                    {loading ? 'Logging in…' : 'Log in'}
                                </button>
                            </form>

                            <div className="mt-6 flex items-center justify-center">
                                <p className="text-sm text-slate-500 dark:text-gold-200/50">
                                    Don't have an account? <Link to="/register" className="text-brand-600 dark:text-gold-400 font-semibold">Sign up</Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}