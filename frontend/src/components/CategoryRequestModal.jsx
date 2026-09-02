import { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

export default function CategoryRequestModal({ open, onClose }) {
    const [categoryName, setCategoryName] = useState('');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Lock body scroll while the modal is up — same pattern as ProfileDrawer,
    // so PullToRefresh's isScrollLocked() check also respects this modal.
    useEffect(() => {
        if (open) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            document.documentElement.style.overscrollBehavior = 'none';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
        return () => {
            // Safety net if this unmounts while still open
            if (document.body.style.position === 'fixed') {
                const scrollY = document.body.style.top;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.documentElement.style.overscrollBehavior = '';
                if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        };
    }, [open]);

    if (!open) return null;

    const reset = () => {
        setCategoryName('');
        setDetails('');
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = async () => {
        if (!categoryName.trim()) {
            toast.error('Enter the category you\'d like to see');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/reports', {
                product_id: null,
                reported_user_id: null,
                reason: 'category_request',
                details: `Requested category: "${categoryName.trim()}"${details.trim() ? ` — ${details.trim()}` : ''}`,
            });
            toast.success('Request sent! Our team will review it.');
            handleClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white dark:bg-ink-800 border border-transparent dark:border-ink-600 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 dark:text-gold-200/50 hover:text-slate-600 dark:hover:text-gold-100">
                    <X size={18} />
                </button>

                <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900/40 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-4">
                    <HelpCircle size={20} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Request a category</h3>
                <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1.5">
                    Can't find the right category for your listing? Let us know and we'll consider adding it.
                </p>

                <div className="mt-5 space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-200/60">Category name</label>
                        <input
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder="e.g. Furniture"
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-200/60">Details (optional)</label>
                        <textarea
                            rows={3}
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="What kind of items would go here?"
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white dark:bg-ink-700 text-slate-900 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-200/30 resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200/70 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 disabled:opacity-60 text-white dark:text-ink-900 text-sm font-semibold transition"
                    >
                        {submitting ? 'Sending…' : 'Send request'}
                    </button>
                </div>
            </div>
        </div>
    );
}