import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
    ArrowLeft, Landmark, Smartphone, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';

// Ghana banks (name only — backend resolves the Paystack bank code on save)
const BANKS = [
    'GCB Bank', 'Ecobank Ghana', 'Absa Bank Ghana', 'Stanbic Bank Ghana',
    'Standard Chartered Bank Ghana', 'Fidelity Bank Ghana', 'CalBank',
    'Access Bank Ghana', 'Zenith Bank Ghana', 'Republic Bank Ghana',
    'Consolidated Bank Ghana', 'Agricultural Development Bank',
    'Universal Merchant Bank', 'First National Bank Ghana', 'Prudential Bank',
];

const MOMO_PROVIDERS = [
    { value: 'mtn', label: 'MTN Mobile Money' },
    { value: 'vodafone', label: 'Telecel Cash (Vodafone)' },
    { value: 'airteltigo', label: 'AirtelTigo Money' },
];

const emptyBank = { bank_name: '', account_number: '', account_name: '' };
const emptyMomo = { provider: '', momo_number: '', momo_name: '' };

export default function PayoutSetup() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const [bankEnabled, setBankEnabled] = useState(false);
    const [momoEnabled, setMomoEnabled] = useState(false);
    const [bank, setBank] = useState(emptyBank);
    const [momo, setMomo] = useState(emptyMomo);
    const [primary, setPrimary] = useState(''); // 'bank' | 'momo'

    useEffect(() => {
        api.get('/payouts/me')
            .then((res) => {
                const data = res.data || {};
                if (data.bank) {
                    setBankEnabled(true);
                    setBank({
                        bank_name: data.bank.bank_name || '',
                        account_number: data.bank.account_number || '',
                        account_name: data.bank.account_name || '',
                    });
                }
                if (data.momo) {
                    setMomoEnabled(true);
                    setMomo({
                        provider: data.momo.provider || '',
                        momo_number: data.momo.momo_number || '',
                        momo_name: data.momo.momo_name || '',
                    });
                }
                if (data.primary_method) setPrimary(data.primary_method);
            })
            .catch(() => {
                // No payout details yet — that's fine, form starts empty
            })
            .finally(() => setLoading(false));
    }, []);

    // Keep `primary` valid as methods are toggled on/off
    useEffect(() => {
        if (bankEnabled && !momoEnabled) setPrimary('bank');
        else if (momoEnabled && !bankEnabled) setPrimary('momo');
        else if (!bankEnabled && !momoEnabled) setPrimary('');
    }, [bankEnabled, momoEnabled]);

    const validate = () => {
        if (!bankEnabled && !momoEnabled) {
            return 'Add at least one payout method.';
        }
        if (bankEnabled) {
            if (!bank.bank_name) return 'Select your bank.';
            if (!/^\d{10,13}$/.test(bank.account_number)) return 'Enter a valid bank account number.';
            if (!bank.account_name.trim()) return 'Enter the name on the bank account.';
        }
        if (momoEnabled) {
            if (!momo.provider) return 'Select your Mobile Money network.';
            if (!/^0\d{9}$/.test(momo.momo_number)) return 'Enter a valid Mobile Money number (e.g. 0551234567).';
            if (!momo.momo_name.trim()) return 'Enter the name registered on the Mobile Money account.';
        }
        if (bankEnabled && momoEnabled && !primary) {
            return 'Choose which method should receive payouts.';
        }
        return '';
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaved(false);
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        setSaving(true);
        try {
            await api.put('/payouts/me', {
                bank: bankEnabled ? bank : null,
                momo: momoEnabled ? momo : null,
                primary_method: bankEnabled && momoEnabled ? primary : (bankEnabled ? 'bank' : 'momo'),
            });
            setSaved(true);
        } catch (err) {
            setError(err?.response?.data?.error || 'Something went wrong saving your payout details.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex justify-center">
                <Loader2 className="animate-spin text-brand-600" size={28} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 mb-6"
            >
                <ArrowLeft size={16} /> Back
            </button>

            <h1 className="text-2xl font-extrabold text-slate-900">Payout setup</h1>
            <p className="text-sm text-slate-500 mt-1.5">
                Add a bank account and/or Mobile Money number so we know where to send your earnings.
            </p>

            <form onSubmit={handleSave} className="mt-8 space-y-5">
                {/* BANK ACCOUNT CARD */}
                <div className={`rounded-2xl border p-5 transition ${bankEnabled ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={bankEnabled}
                            onChange={(e) => setBankEnabled(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                            <Landmark size={17} />
                        </span>
                        <span className="font-bold text-slate-900">Bank account</span>
                    </label>

                    {bankEnabled && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
                            <select
                                value={bank.bank_name}
                                onChange={(e) => setBank({ ...bank, bank_name: e.target.value })}
                                className="col-span-2 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="">Select bank…</option>
                                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Account number"
                                value={bank.account_number}
                                onChange={(e) => setBank({ ...bank, account_number: e.target.value.replace(/\D/g, '') })}
                                className="border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <input
                                type="text"
                                placeholder="Name on account"
                                value={bank.account_name}
                                onChange={(e) => setBank({ ...bank, account_name: e.target.value })}
                                className="border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    )}
                </div>

                {/* MOBILE MONEY CARD */}
                <div className={`rounded-2xl border p-5 transition ${momoEnabled ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={momoEnabled}
                            onChange={(e) => setMomoEnabled(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                            <Smartphone size={17} />
                        </span>
                        <span className="font-bold text-slate-900">Mobile Money</span>
                    </label>

                    {momoEnabled && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
                            <select
                                value={momo.provider}
                                onChange={(e) => setMomo({ ...momo, provider: e.target.value })}
                                className="col-span-2 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="">Select network…</option>
                                {MOMO_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="MoMo number (e.g. 0551234567)"
                                value={momo.momo_number}
                                onChange={(e) => setMomo({ ...momo, momo_number: e.target.value.replace(/\D/g, '') })}
                                className="border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <input
                                type="text"
                                placeholder="Name on MoMo account"
                                value={momo.momo_name}
                                onChange={(e) => setMomo({ ...momo, momo_name: e.target.value })}
                                className="border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    )}
                </div>

                {/* PRIMARY METHOD — only shown when both are enabled */}
                {bankEnabled && momoEnabled && (
                    <div className="rounded-2xl border border-slate-200 p-5">
                        <p className="font-bold text-slate-900 text-sm mb-3">Which should receive your payouts?</p>
                        <div className="flex gap-3">
                            <label className={`flex-1 flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer transition ${primary === 'bank' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                                <input type="radio" name="primary" className="hidden" checked={primary === 'bank'} onChange={() => setPrimary('bank')} />
                                Bank account
                            </label>
                            <label className={`flex-1 flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer transition ${primary === 'momo' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                                <input type="radio" name="primary" className="hidden" checked={primary === 'momo'} onChange={() => setPrimary('momo')} />
                                Mobile Money
                            </label>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <AlertCircle size={16} className="shrink-0" /> {error}
                    </div>
                )}
                {saved && !error && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        <CheckCircle2 size={16} className="shrink-0" /> Payout details saved.
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold transition inline-flex items-center justify-center gap-2"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {saving ? 'Saving…' : 'Save payout details'}
                </button>
            </form>
        </div>
    );
}