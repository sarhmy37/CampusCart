import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Star, X, ChevronDown } from 'lucide-react';
import { useReviewPrompt } from '../context/ReviewPromptContext';

export default function PostPurchaseReviewModal() {
    const { groups: rawGroups, hasPending, submitReviews, skipAll } = useReviewPrompt();
    // Guard against `groups` being undefined (e.g. while the pending-reviews
    // request is loading, or if it fails) so this component can never crash
    // the whole app on mount.
    const groups = rawGroups || [];
    // { [product_id]: { rating: number, comment: string } }
    const [entries, setEntries] = useState({});
    const [expandedSellers, setExpandedSellers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const didLockRef = useRef(false);

    const open = hasPending;

    // Reset form state whenever a fresh batch of groups comes in. First
    // seller starts expanded; every product defaults to a 5-star rating.
    useEffect(() => {
        if (!groups.length) return;
        const initialEntries = {};
        groups.forEach((g) => {
            g.products.forEach((p) => {
                initialEntries[p.product_id] = { rating: 5, comment: '' };
            });
        });
        setEntries(initialEntries);
        setExpandedSellers({ [groups[0].seller_id]: true });
    }, [groups]);

    // Same self-aware body-scroll lock pattern used across the app's other modals.
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

    if (!open) return null;

    const toggleSeller = (sellerId) => {
        setExpandedSellers((prev) => ({ ...prev, [sellerId]: !prev[sellerId] }));
    };

    const setProductRating = (productId, rating) => {
        setEntries((prev) => ({ ...prev, [productId]: { ...prev[productId], rating } }));
    };

    const setProductComment = (productId, comment) => {
        setEntries((prev) => ({ ...prev, [productId]: { ...prev[productId], comment } }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = Object.entries(entries).map(([product_id, v]) => ({
                product_id,
                rating: v.rating,
                comment: v.comment.trim(),
            }));
            await submitReviews(payload);
            toast.success('Reviews submitted!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit some reviews');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSkip = async () => {
        setSubmitting(true);
        try {
            await skipAll();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto p-6">
                <button
                    onClick={handleSkip}
                    disabled={submitting}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-300/50 transition disabled:opacity-50"
                    title="Skip — you won't be asked about these sellers again"
                >
                    <X size={18} />
                </button>

                <h2 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">How was it?</h2>
                <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">Rate the items you received.</p>

                <div className="mt-5 space-y-3">
                    {groups.map((group, i) => {
                        const isExpanded = !!expandedSellers[group.seller_id];
                        return (
                            <div
                                key={group.seller_id}
                                className="rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleSeller(group.seller_id)}
                                    disabled={submitting}
                                    className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-slate-50 dark:hover:bg-ink-700 transition disabled:opacity-60"
                                >
                                    {group.seller_avatar ? (
                                        <img
                                            src={group.seller_avatar}
                                            alt={group.seller_name}
                                            className="w-9 h-9 rounded-full object-cover shrink-0"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center font-bold text-sm shrink-0">
                                            {group.seller_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1 text-left">
                                        <p className="text-sm font-bold text-slate-900 dark:text-gold-50 truncate">
                                            {group.seller_name}
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/50">
                                            {group.products.length} item{group.products.length > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        className={`shrink-0 text-slate-400 dark:text-gold-300/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {isExpanded && (
                                    <div className="px-3.5 pb-3.5 space-y-4 border-t border-slate-100 dark:border-ink-600 pt-3.5">
                                        {group.products.map((product) => {
                                            const entry = entries[product.product_id] || { rating: 5, comment: '' };
                                            return (
                                                <div key={product.product_id}>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-gold-100">
                                                        {product.title}
                                                    </p>
                                                    <div className="flex items-center gap-1 mt-1.5">
                                                        {[1, 2, 3, 4, 5].map((n) => (
                                                            <button
                                                                key={n}
                                                                type="button"
                                                                onClick={() => setProductRating(product.product_id, n)}
                                                                disabled={submitting}
                                                            >
                                                                <Star
                                                                    size={22}
                                                                    className={n <= entry.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-ink-600'}
                                                                />
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                        value={entry.comment}
                                                        onChange={(e) => setProductComment(product.product_id, e.target.value)}
                                                        placeholder="Optional — share how it went."
                                                        rows={2}
                                                        disabled={submitting}
                                                        className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none text-xs transition resize-none disabled:opacity-60"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2 mt-5">
                    <button
                        onClick={handleSkip}
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition disabled:opacity-60"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                    >
                        {submitting ? 'Submitting…' : 'Submit reviews'}
                    </button>
                </div>
            </div>
        </div>
    );
}