import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { REGISTER_IMAGE, LOGO_LIGHT, LOGO_DARK } from '../data/media';
import { Mail, Lock, Eye, EyeOff, User, School, ShoppingBag, Store, Phone, ChevronDown, Landmark, Loader2, CheckCircle, XCircle } from 'lucide-react';
import AutoLocationInput from '../components/AutoLocationInput';

const SCHOOLS = ['KNUST', 'ATU', 'UCC', 'UHAS', 'UG', 'UDS', 'UMaT', 'UEW', 'UPSA', 'PentUni', 'KsTU', 'CU'];

const COUNTRY_CODES = [
    { code: '+233', label: '+233 (Ghana)' },
    { code: '+234', label: '+234 (Nigeria)' },
    { code: '+254', label: '+254 (Kenya)' },
    { code: '+256', label: '+256 (Uganda)' },
    { code: '+27', label: '+27 (South Africa)' },
    { code: '+250', label: '+250 (Rwanda)' },
    { code: '+251', label: '+251 (Ethiopia)' },
    { code: '+1', label: '+1 (USA/Canada)' },
    { code: '+44', label: '+44 (UK)' },
    { code: '+91', label: '+91 (India)' },
    { code: '+92', label: '+92 (Pakistan)' },
    { code: '+61', label: '+61 (Australia)' },
];

// Mobile money is a fixed, known set of 3 networks in Ghana — it has nothing
// to do with banks and should never be sourced from the banks API or filtered
// by a `type` field. Vodafone Cash was rebranded to Telecel Cash (same network,
// same prefixes). AirtelTigo Money is a separate, distinct network.
const MOBILE_MONEY_NETWORKS = [
    { code: 'MTN', name: 'MTN Mobile Money' },
    { code: 'VOD', name: 'Vodafone Cash / Telecel Cash' },
    { code: 'AT', name: 'AirtelTigo Money' },
];

const NETWORK_PATTERNS = {
    'MTN': /^(024|054|055|059|023|053|057)\d{7}$/,
    'VOD': /^(020|050)\d{7}$/,
    'AT': /^(026|027|056)\d{7}$/,
};

// Bank validation rules (minimum length 10 for all)
const BANK_PATTERNS = {
    '001': { minLength: 10, label: 'GCB' },
    '002': { minLength: 10, label: 'Stanbic' },
    '003': { minLength: 10, label: 'Ecobank' },
    '004': { minLength: 10, label: 'ABSA' },
    '005': { minLength: 10, label: 'Access Bank' },
    '006': { minLength: 10, label: 'UBA' },
    '007': { minLength: 10, label: 'Fidelity' },
    '008': { minLength: 10, label: 'First National' },
    '009': { minLength: 10, label: 'Republic Bank' },
    '010': { minLength: 10, label: 'CalBank' },
    '011': { minLength: 10, label: 'Prudential Bank' },
    '012': { minLength: 10, label: 'GT Bank' },
    '013': { minLength: 10, label: 'Bank of Africa' },
    '014': { minLength: 10, label: 'First Atlantic' },
    '015': { minLength: 10, label: 'Zenith Bank' },
    '016': { minLength: 10, label: 'FBN Bank' },
    '017': { minLength: 10, label: 'Societe Generale' },
    '018': { minLength: 10, label: 'UMB' },
    '019': { minLength: 10, label: 'NIB' },
    '020': { minLength: 10, label: 'ADB' },
    '021': { minLength: 10, label: 'OmniBSIC' },
};

const DEFAULT_BANK_RULE = { minLength: 10, label: 'Bank' };

export default function Register() {
    const { register, user } = useAuth();
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
    const [whatsappCode, setWhatsappCode] = useState('+233');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [payoutMethod, setPayoutMethod] = useState('bank');
    const [bankCode, setBankCode] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [banks, setBanks] = useState([]);
    const [loadingBanks, setLoadingBanks] = useState(false);

    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState({ isValid: false, message: '', type: '' });

    const fetchBanks = async () => {
        setLoadingBanks(true);
        try {
            const res = await api.get('/payouts/banks');
            setBanks(res.data || []);
        } catch { /* ignore */ }
        setLoadingBanks(false);
    };

    // Only ever fetches real banks now — mobile money networks are a fixed
    // local list (MOBILE_MONEY_NETWORKS) and never come from this endpoint.
    useEffect(() => {
        if (accountType === 'seller') {
            fetchBanks();
        }
    }, [accountType]);

    const updateWhatsapp = (code, number) => {
        const cleaned = number.replace(/\D/g, '');
        setWhatsappNumber(cleaned);
        setForm({ ...form, whatsapp: code + cleaned });
    };

    const getBankName = (code) => {
        const bank = banks.find(b => b.code === code);
        return bank ? bank.name : code;
    };

    const validateAccountNumber = (number, method, bankCode) => {
        if (!number || number.length === 0) {
            setValidationResult({ isValid: false, message: '', type: 'info' });
            return;
        }

        setValidating(true);
        const timer = setTimeout(() => {
            let isValid = false;
            let message = '';
            let type = 'error';

            if (method === 'bank') {
                if (!bankCode) {
                    message = 'Please select a bank first';
                } else {
                    const rule = BANK_PATTERNS[bankCode] || DEFAULT_BANK_RULE;
                    const bankName = getBankName(bankCode) || rule.label;
                    if (number.length >= rule.minLength) {
                        isValid = true;
                        message = `✓ Valid ${bankName} account number (${number.length} digits)`;
                        type = 'success';
                    } else {
                        message = `Invalid ${bankName} account number. Must be at least ${rule.minLength} digits.`;
                    }
                }
            } else if (method === 'mobile_money') {
                if (!bankCode) {
                    message = 'Please select a network first';
                } else {
                    const pattern = NETWORK_PATTERNS[bankCode];
                    const networkName = MOBILE_MONEY_NETWORKS.find((n) => n.code === bankCode)?.name || bankCode;
                    if (pattern && pattern.test(number)) {
                        isValid = true;
                        message = `✓ Valid ${networkName} number`;
                        type = 'success';
                    } else {
                        message = `Invalid ${networkName} number.`;
                    }
                }
            }

            setValidationResult({ isValid, message, type });
            setValidating(false);
        }, 400);

        return () => clearTimeout(timer);
    };

    useEffect(() => {
        if (accountType === 'seller' && accountNumber.length > 0) {
            validateAccountNumber(accountNumber, payoutMethod, bankCode);
        } else {
            setValidationResult({ isValid: false, message: '', type: 'info' });
        }
    }, [accountNumber, payoutMethod, bankCode, accountType]);

    const onSubmit = async (e) => {
        e.preventDefault();

        const digits = whatsappNumber.replace(/\D/g, '');
        if (digits.length !== 9) {
            toast.error('WhatsApp number must be exactly 9 digits after the country code.');
            return;
        }

        if (form.password !== form.confirm_password) {
            toast.error("Passwords don't match");
            return;
        }
        if (form.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (accountType === 'buyer' && !form.location.trim()) {
            toast.error('Delivery location is required');
            return;
        }

        if (accountType === 'seller') {
            if (!bankCode || !accountNumber || !accountName) {
                toast.error('Please fill in all payout account details.');
                return;
            }
            if (!validationResult.isValid) {
                toast.error(validationResult.message || 'Invalid account number. Please check the format.');
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                name: form.name,
                university_email: form.university_email,
                password: form.password,
                school: accountType === 'seller' ? form.school : null,
                account_type: accountType,
                whatsapp: form.whatsapp,
                location: accountType === 'buyer' ? form.location : null,
                referral_code: searchParams.get('ref') || null,
            };

            if (accountType === 'seller') {
                payload.bank_code = bankCode;
                payload.account_number = accountNumber;
                payload.account_name = accountName;
                payload.payout_method = payoutMethod;
            }

            await register(payload);
            toast.success(`Account created! Welcome to Tre-X, ${user.name}`);
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    // Banks and mobile money are separate, unrelated lists — no shared
    // filtering logic between them.
    const networkOptions = payoutMethod === 'bank' ? banks : MOBILE_MONEY_NETWORKS;

    return (
        <>
            {/* Autofill styles – ash/gray-gold */}
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
                {/* MOBILE-ONLY background treatment — replaces the flat bg-slate-50 that
                    showed on phones once the lg:block visual panel disappeared. */}
                <div className="absolute inset-0 lg:hidden">
                    <img src={REGISTER_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.14] dark:opacity-[0.10]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-50/95 to-slate-50 dark:from-ink-900 dark:via-ink-900/95 dark:to-ink-900" />
                    <div className="absolute -right-20 -top-24 w-72 h-72 bg-brand-300/25 dark:bg-gold-500/10 rounded-full blur-3xl" />
                    <div className="absolute -left-16 bottom-0 w-64 h-64 bg-accent-400/15 dark:bg-gold-700/10 rounded-full blur-3xl" />
                </div>

                {/* LEFT — visual panel (desktop only) */}
                <div className="relative hidden lg:block overflow-hidden">
                    <img src={REGISTER_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-accent-600/60 dark:from-ink-900/85 dark:via-ink-900/60 dark:to-gold-900/45" />
                    <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute left-1/4 -bottom-24 w-64 h-64 bg-accent-500/20 dark:bg-gold-500/15 rounded-full blur-3xl" />

                    <div className="relative z-10 h-full flex flex-col justify-center px-12 xl:px-16">
                        <img src={LOGO_DARK} alt="Tre-X" className="h-8 w-auto dark:hidden logo-pulse" />
                        <img src={LOGO_LIGHT} alt="Tre-X" className="h-8 w-auto hidden dark:block logo-pulse" />
                        <h1 className="mt-6 text-3xl xl:text-4xl font-extrabold text-white leading-tight max-w-md">
                            Buy and sell with students who actually get it.
                        </h1>
                        <p className="mt-4 text-white/80 text-sm max-w-sm">
                            Create a free account with your university email to start listing and messaging sellers on your campus.
                        </p>
                    </div>
                </div>

                {/* RIGHT — form */}
                <div className="relative z-10 flex items-center justify-center px-4 py-14 sm:py-16 lg:bg-slate-50 lg:dark:bg-ink-900">
                    <div className="w-full max-w-sm">
                        {/* Logo — mobile only, since the desktop panel already carries it */}
                        <div className="flex justify-center mb-8 lg:hidden">
                            <img src={LOGO_DARK} alt="Tre-X" className="h-15 w-auto dark:hidden logo-pulse" />
                            <img src={LOGO_LIGHT} alt="Tre-X" className="h-15 w-auto hidden dark:block logo-pulse" />
                        </div>

                        <div className="bg-white/90 dark:bg-ink-800/90 backdrop-blur-sm lg:bg-transparent lg:dark:bg-transparent border border-slate-200/70 dark:border-ink-600/70 lg:border-0 rounded-3xl lg:rounded-none p-6 sm:p-7 lg:p-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] lg:shadow-none">
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50 text-center lg:text-left">Become a Member</h1>
                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1 text-center lg:text-left">It only takes a minute.</p>

                            {/* ACCOUNT TYPE TOGGLE */}
                            <div className="mt-5 grid grid-cols-2 gap-2 bg-slate-100 dark:bg-ink-700 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setAccountType('buyer')}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                                        accountType === 'buyer'
                                            ? 'bg-white dark:bg-ink-600 text-brand-700 dark:text-gold-400 shadow-sm'
                                            : 'text-slate-500 dark:text-gold-200/50 hover:text-slate-700 dark:hover:text-gold-100'
                                    }`}
                                >
                                    <ShoppingBag size={15} /> I'm a Buyer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('seller')}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                                        accountType === 'seller'
                                            ? 'bg-white dark:bg-ink-600 text-brand-700 dark:text-gold-400 shadow-sm'
                                            : 'text-slate-500 dark:text-gold-200/50 hover:text-slate-700 dark:hover:text-gold-100'
                                    }`}
                                >
                                    <Store size={15} /> I'm a Seller
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-2">
                                {accountType === 'buyer'
                                    ? "You'll be able to browse, buy, and message sellers."
                                    : "You'll be able to list items, sell, and manage orders. A small platform fee applies per sale."}
                            </p>

                            <form onSubmit={onSubmit} className="mt-5 space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">Full Name</label>
                                    <div className="relative mt-1">
                                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="Kwame Asante"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">
                                        {accountType === 'seller' ? 'University Email' : 'Email'}
                                    </label>
                                    <div className="relative mt-1">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type="email"
                                            required
                                            value={form.university_email}
                                            onChange={(e) => setForm({ ...form, university_email: e.target.value })}
                                            placeholder={accountType === 'seller' ? 'you@st.knust.edu.gh' : 'you@gmail.com'}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition"
                                        />
                                    </div>
                                </div>

                                {/* WHATSAPP */}
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">WhatsApp Number</label>
                                    <div className="flex mt-1 gap-1.5">
                                        <div className="relative w-32">
                                            <select
                                                value={whatsappCode}
                                                onChange={(e) => {
                                                    const newCode = e.target.value;
                                                    setWhatsappCode(newCode);
                                                    updateWhatsapp(newCode, whatsappNumber);
                                                }}
                                                className="w-full pl-2 pr-6 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 appearance-none transition"
                                            >
                                                {COUNTRY_CODES.map((c) => (
                                                    <option key={c.code} value={c.code}>{c.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40 pointer-events-none" />
                                        </div>
                                        <div className="relative flex-1">
                                            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                required
                                                value={whatsappNumber}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, '');
                                                    if (digits.length <= 9) {
                                                        setWhatsappNumber(digits);
                                                        updateWhatsapp(whatsappCode, digits);
                                                    }
                                                }}
                                                placeholder="e.g. 24 123 4567"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1">
                                        Enter exactly 9 digits after the country code (no spaces).
                                    </p>
                                </div>

                                {accountType === 'seller' && (
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">School</label>
                                        <div className="relative mt-1">
                                            <School size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                            <select
                                                value={form.school}
                                                onChange={(e) => setForm({ ...form, school: e.target.value })}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 transition appearance-none"
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
                                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">Delivery Location</label>
                                        <div className="mt-1">
                                            <AutoLocationInput
                                                value={form.location}
                                                onChange={(newLocation) => setForm({ ...form, location: newLocation })}
                                                placeholder="Tap here to auto-detect your location..."
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1">Tap the bar above to automatically detect your Region, City, and Landmark.</p>
                                    </div>
                                )}

                                {/* PAYOUT ACCOUNT – only for sellers */}
                                {accountType === 'seller' && (
                                    <div className="border-t border-slate-200 dark:border-ink-600 pt-3 mt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Landmark size={16} className="text-brand-600 dark:text-gold-400" />
                                            <label className="text-sm font-bold text-slate-700 dark:text-gold-100">Payout Account</label>
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/40 mb-3">
                                            This is where your earnings will be sent automatically after each sale.
                                        </p>

                                        <div className="flex gap-1 mb-3 bg-slate-100 dark:bg-ink-700 p-1 rounded-xl w-fit">
                                            <button
                                                type="button"
                                                onClick={() => { setPayoutMethod('bank'); setBankCode(''); }}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                                    payoutMethod === 'bank'
                                                        ? 'bg-white dark:bg-ink-600 shadow-sm text-brand-700 dark:text-gold-400'
                                                        : 'text-slate-500 dark:text-gold-200/50'
                                                }`}
                                            >
                                                Bank
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setPayoutMethod('mobile_money'); setBankCode(''); }}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                                    payoutMethod === 'mobile_money'
                                                        ? 'bg-white dark:bg-ink-600 shadow-sm text-brand-700 dark:text-gold-400'
                                                        : 'text-slate-500 dark:text-gold-200/50'
                                                }`}
                                            >
                                                Mobile Money
                                            </button>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">
                                                {payoutMethod === 'bank' ? 'Bank' : 'Network'}
                                            </label>
                                            <select
                                                value={bankCode}
                                                onChange={(e) => setBankCode(e.target.value)}
                                                disabled={payoutMethod === 'bank' && loadingBanks}
                                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm disabled:opacity-60"
                                            >
                                                <option value="">Select {payoutMethod === 'bank' ? 'bank' : 'network'}</option>
                                                {networkOptions.map((b) => (
                                                    <option key={b.code} value={b.code}>{b.name}</option>
                                                ))}
                                            </select>
                                            {payoutMethod === 'bank' && loadingBanks && (
                                                <p className="text-xs text-slate-400 mt-1">Loading banks...</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">
                                                {payoutMethod === 'bank' ? 'Account number' : 'Mobile Money number'}
                                            </label>
                                            <div className="relative mt-1">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={accountNumber}
                                                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                                                    placeholder={payoutMethod === 'bank' ? '0123456789' : '0551234567'}
                                                    className={`w-full px-3 py-2.5 rounded-xl border focus:outline-none text-sm bg-white dark:bg-ink-700 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 transition ${
                                                        validating
                                                            ? 'border-slate-300 dark:border-ink-500'
                                                            : validationResult.type === 'success'
                                                            ? 'border-emerald-500 dark:border-emerald-400'
                                                            : validationResult.type === 'error' && validationResult.message
                                                            ? 'border-red-500 dark:border-red-400'
                                                            : 'border-slate-200 dark:border-ink-600'
                                                    }`}
                                                />
                                                {validating && (
                                                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                                                )}
                                                {!validating && validationResult.type === 'success' && (
                                                    <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                                )}
                                                {!validating && validationResult.type === 'error' && validationResult.message && (
                                                    <XCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                                                )}
                                            </div>
                                            {validationResult.message && (
                                                <p className={`text-xs mt-1.5 flex items-center gap-1 ${
                                                    validationResult.type === 'success'
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : validationResult.type === 'error'
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-slate-400 dark:text-gold-200/50'
                                                }`}>
                                                    {validationResult.type === 'success' && <CheckCircle size={12} />}
                                                    {validationResult.type === 'error' && <XCircle size={12} />}
                                                    {validationResult.message}
                                                </p>
                                            )}
                                            {!validationResult.message && accountNumber.length > 0 && !bankCode && (
                                                <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1.5">
                                                    Please select a {payoutMethod === 'bank' ? 'bank' : 'network'} first.
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">
                                                {payoutMethod === 'bank' ? 'Account name (as on bank statement)' : 'Account holder name'}
                                            </label>
                                            <input
                                                type="text"
                                                value={accountName}
                                                onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                                                placeholder={payoutMethod === 'bank' ? 'KWAME ASANTE' : 'KWAME ASANTE'}
                                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm uppercase"
                                            />
                                        </div>

                                        <p className="text-[10px] text-slate-400 dark:text-gold-200/40 mt-2">
                                            Your payout account will be saved as the default. You can change it later in your dashboard.
                                        </p>
                                    </div>
                                )}

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

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-100">Confirm Password</label>
                                    <div className="relative mt-1">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-200/40" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={form.confirm_password}
                                            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 transition"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                                >
                                    {loading ? 'Creating account…' : 'Create account'}
                                </button>
                            </form>

                            <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-6 text-center">
                                Already have an account? <Link to="/login" className="text-brand-600 dark:text-gold-400 font-semibold">Log in</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}