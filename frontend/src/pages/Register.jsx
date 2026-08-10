import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, User, School, GraduationCap, ShoppingBag, Store, Phone, MapPin } from 'lucide-react';

const SCHOOLS = ['KNUST', 'ATU', 'UCC', 'UHAS', 'UG', 'UDS', 'UMaT' , 'UEW', 'UPSA', 'PentUni' , 'KsTU' , 'CU'];

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [accountType, setAccountType] = useState(searchParams.get('role') === 'seller' ? 'seller' : 'buyer');
    const [form, setForm] = useState({
        name: '',
        university_email: '',
        password: '',
        confirm_password: '',
        school: SCHOOLS[0],
        whatsapp: '',
        location: '',
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();

        if (form.password !== form.confirm_password) {
            toast.error("Passwords don't match");
            return;
        }
        if (form.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (!form.whatsapp.trim()) {
            toast.error('WhatsApp number is required');
            return;
        }
        if (accountType === 'buyer' && !form.location.trim()) {
            toast.error('Delivery location is required');
            return;
        }

        setLoading(true);
        try {
            await register({
                name: form.name,
                university_email: form.university_email,
                password: form.password,
                school: accountType === 'seller' ? form.school : null,
                account_type: accountType,
                whatsapp: form.whatsapp,
                location: accountType === 'buyer' ? form.location : null,
            });
            toast.success('Account created! Welcome to CampusCart.');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2">
            {/* LEFT — visual panel */}
            <div className="relative hidden lg:block overflow-hidden">
                <img src="/register.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-accent-600/60" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/4 -bottom-24 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl" />

                <div className="relative z-10 h-full flex flex-col justify-center px-12 xl:px-16">
                    <span className="inline-flex items-center gap-1.5 w-fit bg-white/15 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                        <GraduationCap size={13} /> CampusCart
                    </span>
                    <h1 className="mt-6 text-3xl xl:text-4xl font-extrabold text-white leading-tight max-w-md">
                        Buy and sell with students who actually get it.
                    </h1>
                    <p className="mt-4 text-white/80 text-sm max-w-sm">
                        Create a free account with your university email to start listing and messaging sellers on your campus.
                    </p>
                </div>
            </div>

            {/* RIGHT — form */}
            <div className="flex items-center justify-center px-4 py-16 bg-slate-50">
                <div className="w-full max-w-sm">
                    <h1 className="text-2xl font-extrabold text-slate-900">Create your account</h1>
                    <p className="text-sm text-slate-500 mt-1">It only takes a minute.</p>

                    {/* ACCOUNT TYPE TOGGLE */}
                    <div className="mt-5 grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setAccountType('buyer')}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                                accountType === 'buyer'
                                    ? 'bg-white text-brand-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <ShoppingBag size={15} /> I'm a Buyer
                        </button>
                        <button
                            type="button"
                            onClick={() => setAccountType('seller')}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                                accountType === 'seller'
                                    ? 'bg-white text-brand-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Store size={15} /> I'm a Seller
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {accountType === 'buyer'
                            ? "You'll be able to browse, buy, and message sellers."
                            : "You'll be able to list items, sell, and manage orders. A small platform fee applies per sale."}
                    </p>

                    <form onSubmit={onSubmit} className="mt-5 space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-700">Full Name</label>
                            <div className="relative mt-1">
                                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Kwame Asante"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700">
                                {accountType === 'seller' ? 'University Email' : 'Email'}
                            </label>
                            <div className="relative mt-1">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    value={form.university_email}
                                    onChange={(e) => setForm({ ...form, university_email: e.target.value })}
                                    placeholder={accountType === 'seller' ? 'you@st.knust.edu.gh' : 'you@gmail.com'}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700">WhatsApp Number</label>
                            <div className="relative mt-1">
                                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    required
                                    value={form.whatsapp}
                                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                                    placeholder="+233 24 123 4567"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {accountType === 'seller'
                                    ? 'Buyers will contact you here about orders.'
                                    : "Sellers will contact you here about your orders."}
                            </p>
                        </div>

                        {accountType === 'seller' && (
                            <div>
                                <label className="text-sm font-semibold text-slate-700">School</label>
                                <div className="relative mt-1">
                                    <School size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={form.school}
                                        onChange={(e) => setForm({ ...form, school: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition appearance-none"
                                    >
                                        {SCHOOLS.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {accountType === 'buyer' && (
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Delivery Location</label>
                                <div className="relative mt-1">
                                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        value={form.location}
                                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        placeholder="Hostel, hall, or area"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Used for delivery orders. You can update this later.</p>
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-semibold text-slate-700">Password</label>
                            <div className="relative mt-1">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700">Confirm Password</label>
                            <div className="relative mt-1">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={form.confirm_password}
                                    onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                        >
                            {loading ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>

                    <p className="text-sm text-slate-500 mt-6 text-center">
                        Already have an account? <Link to="/login" className="text-brand-600 font-semibold">Log in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}