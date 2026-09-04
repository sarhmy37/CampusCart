import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { X } from 'lucide-react';

const CONDITIONS = ['new', 'good', 'fair'];

// Converts whole-number prices to charm pricing: 46 → 45.99.
// Leaves prices that already have cents (e.g. 46.50) untouched.
const toCharmPrice = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (Number.isInteger(num)) {
        return (num - 1 + 0.99).toFixed(2);
    }
    return num.toFixed(2);
};

export default function EditListingModal({ product, open, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        price: '',
        condition: 'good',
        stock: 1,
        category: '',
    });
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

    // The "old price" shown here is the item's CURRENT saved price — the
    // number that will become old_price once the seller saves a lower price.
    // This is purely a preview; the backend decides what actually gets saved.
    const currentSavedPrice = product ? parseFloat(product.price) : null;

    const calculateDiscount = () => {
        // Use the charmed price here too, so the preview matches what
        // actually gets saved (e.g. typing 46 previews against 45.99).
        const newPrice = parseFloat(toCharmPrice(form.price));
        if (!currentSavedPrice || !newPrice || currentSavedPrice <= newPrice || currentSavedPrice <= 0 || newPrice <= 0) {
            return null;
        }
        return Math.round(((currentSavedPrice - newPrice) / currentSavedPrice) * 100);
    };

    const discount = calculateDiscount();

    // Lock body scroll while open. Self-aware like ConfirmModal — only
    // locks/unlocks if nothing already has the body locked, so it plays
    // nicely if ever opened from within an already-locked parent.
    const didLockRef = useRef(false);

    useEffect(() => {
        if (open) {
            if (document.body.style.position !== 'fixed') {
                const scrollY = window.scrollY;
                document.body.style.position = 'fixed';
                document.body.style.top = `-${scrollY}px`;
                document.body.style.left = '0';
                document.body.style.right = '0';
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
                document.documentElement.style.overscrollBehavior = 'none';
                didLockRef.current = true;
            }
        } else if (didLockRef.current) {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
            didLockRef.current = false;
        }
        return () => {
            if (didLockRef.current) {
                const scrollY = document.body.style.top;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.documentElement.style.overscrollBehavior = '';
                if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
                didLockRef.current = false;
            }
        };
    }, [open]);

    if (!open || !product) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // old_price is never sent from the client — the backend works out
            // whether this counts as a discount by comparing to what's already
            // saved, and manages old_price entirely on its own.
            const payload = { ...form, price: toCharmPrice(form.price) };
            await api.patch(`/products/${product.id}`, payload);
            toast.success('Listing updated');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update listing');
        } finally {
            setSaving(false);
        }
    };

        return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-brand-50 text-lg">Edit listing</h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-brand-200/50 hover:text-slate-600 dark:hover:text-brand-100">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-brand-300/60">Title</label>
                        <input
                            required
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-brand-300/60">Description</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:outline-none text-sm resize-none"
                        />
                    </div>

                    {/* ─── PRICE SECTION ─── */}
                    <div className="bg-slate-50 dark:bg-ink-700/50 rounded-xl p-3 border border-slate-200/50 dark:border-ink-600/50">
                        <p className="text-xs font-semibold text-slate-500 dark:text-brand-300/60 mb-2">Price</p>

                        {/* Old Price (read-only) — shows the CURRENT saved price, since
                            that's what becomes "old" the moment a lower price is saved. */}
                        <div className="mb-2">
                            <label className="text-[10px] font-medium text-slate-400 dark:text-brand-200/50">Current Price (read-only)</label>
                            <div className="relative mt-0.5">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={currentSavedPrice ?? ''}
                                    readOnly
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-100 dark:bg-ink-700/50 text-slate-400 dark:text-brand-200/40 cursor-not-allowed text-sm"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-brand-200/40">
                                    GHS
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-brand-200/40 mt-0.5">
                                This is the item's price right now. Lowering it below this will show as a sale to buyers.
                            </p>
                        </div>

                        {/* New Price (editable) */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-400 dark:text-brand-200/50">New Price</label>
                            <div className="relative mt-0.5">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:outline-none text-sm"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-brand-200/40">
                                    GHS
                                </span>
                            </div>
                        </div>

                        {/* Discount Preview — only shown if the new price is actually lower.
                            A price increase never shows anything here, matching the backend. */}
                        {discount !== null && (
                            <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                    🎉 This will show as -{discount}% off
                                </p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400/70">
                                    Old price: GHS {currentSavedPrice.toFixed(2)} → New price: GHS {toCharmPrice(form.price)}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-brand-300/60">Stock</label>
                            <input
                                type="number"
                                min="0"
                                required
                                value={form.stock}
                                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-brand-300/60">Condition</label>
                            <select
                                value={form.condition}
                                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:outline-none text-sm capitalize"
                            >
                                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-brand-300/60">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:outline-none text-sm"
                        >
                            <option value="">—</option>
                            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-brand-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                                </form>
            </div>
        </div>,
        document.body
    );
}