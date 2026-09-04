import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Star, X } from 'lucide-react';
import { useReviewPrompt } from '../context/ReviewPromptContext';

export default function PostPurchaseReviewModal() {
    const { currentPrompt, submitReview, skipReview } = useReviewPrompt();
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const didLockRef = useRef(false);

    const open = !!currentPrompt;

    // Reset the form whenever a new seller comes to the front of the queue
    useEffect(() => {
        setRating(5);
        setComment('');
    }, [currentPrompt?.seller_id]);

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

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await submitReview(rating, comment.trim());
            toast.success('Review submitted!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSkip = async () => {
        setSubmitting(true);
        try {
            await skipReview();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <button
                    onClick={handleSkip}
                    disabled={submitting}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-brand-300/50 transition disabled:opacity-50"
                    title="Skip — you won't be asked about this seller again"
                >
                    <X size={18} />
                </button>

                <div className="flex items-center gap-3">
                    {currentPrompt.seller_avatar ? (
                        <img
                            src={currentPrompt.seller_avatar}
                            alt={currentPrompt.seller_name}
                            className="w-11 h-11 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-11 h-11 rounded-full bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                            {currentPrompt.seller_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                    )}
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-brand-50">How was it?</h2>
                        <p className="text-sm text-slate-500 dark:text-brand-200/50">Rate your purchase from {currentPrompt.seller_name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 mt-5">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setRating(n)} disabled={submitting}>
                            <Star size={28} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-ink-600'} />
                        </button>
                    ))}
                </div>

                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional — share how it went."
                    rows={3}
                    disabled={submitting}
                    className="w-full mt-4 px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 dark:placeholder-brand-300/30 focus:border-brand-500 dark:focus:border-brand-500 focus:outline-none text-sm transition resize-none disabled:opacity-60"
                />

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={handleSkip}
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-brand-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition disabled:opacity-60"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                    >
                        {submitting ? 'Submitting…' : 'Submit review'}
                    </button>
                </div>
            </div>
        </div>
    );
}