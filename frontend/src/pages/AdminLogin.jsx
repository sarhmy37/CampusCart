import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
    const { setUser } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/admin/auth/login', { email, password });
            localStorage.setItem('cc_token', res.data.token);
            localStorage.setItem('cc_user', JSON.stringify(res.data.user));
            setUser(res.data.user);
            toast.success('Welcome, Admin');
            navigate('/admin');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 dark:bg-ink-900 px-4">
            <div className="w-full max-w-sm bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-gold-500 text-white dark:text-ink-900 flex items-center justify-center mb-4">
                    <ShieldCheck size={20} />
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-gold-50">Admin Login</h1>
                <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">Restricted access.</p>

                <form onSubmit={onSubmit} className="mt-5 space-y-3">
                    <input
                        type="email"
                        required
                        placeholder="Admin email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                    />
                    <input
                        type="password"
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-gold-500 hover:bg-slate-800 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                    >
                        {loading ? 'Logging in…' : 'Log in'}
                    </button>
                </form>
            </div>
        </div>
    );
}