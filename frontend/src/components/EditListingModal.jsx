import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { X } from 'lucide-react';

const CONDITIONS = ['new', 'good', 'fair'];

export default function EditListingModal({ product, open, onClose, onSaved }) {
    const [form, setForm] = useState({ title: '', description: '', price: '', condition: 'good', stock: 1, category: '' });
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (product) {
            setForm({
                title: product.title || '',
                description: product.description || '',
                price: product.price || '',
                condition: product.condition || 'good',
                stock: product.stock ?? 1,
                category: product.category || '',
            });
        }
    }, [product]);

    if (!open || !product) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.patch(`/products/${product.id}`, form);
            toast.success('Listing updated');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update listing');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Edit listing</h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-gold-200/50 hover:text-slate-600 dark:hover:text-gold-100">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Title</label>
                        <input
                            required
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Description</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Price (GHS)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Stock</label>
                            <input
                                type="number"
                                min="0"
                                required
                                value={form.stock}
                                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Condition</label>
                            <select
                                value={form.condition}
                                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm capitalize"
                            >
                                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                            >
                                <option value="">—</option>
                                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}