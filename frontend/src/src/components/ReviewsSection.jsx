import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Star, ThumbsUp, MessageSquare, X, Send } from 'lucide-react';

export default function ReviewsSection({ reviewsData, productId }) {
    const { user } = useAuth();
    const [data, setData] = useState(reviewsData || null);
    const [loading, setLoading] = useState(!reviewsData);
    const [showReviewModal, setShowReviewModal] = useState(false);

    const load = () => {
        if (!productId) return;
        setLoading(true);
        api.get(`/reviews/product/${productId}`)
            .then((res) => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    // If reviewsData is passed from parent, use it; otherwise fetch on mount or when productId changes.
    useEffect(() => {
        if (reviewsData) {
            setData(reviewsData);
            setLoading(false);
        } else if (productId) {
            load();
        }
    }, [reviewsData, productId]);

    // Reload when review is submitted/updated.
    const refresh = () => {
        if (reviewsData) {
            // If parent passed data, we can't refetch – parent should update its state.
            // We'll reload from server anyway.
            load();
        } else {
            load();
        }
    };

    if (loading) {
        return (
            <div className="mt-6 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
                <div className="h-20 rounded-xl bg-slate-100 dark:bg-ink-700 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="mt-6 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 dark:text-brand-50">Reviews</h2>
                    {data?.avg_rating && (
                        <span className="flex items-center gap-1 text-sm">
                            <Star size={14} className="fill-amber-400 text-amber-400" />
                            <span className="font-semibold text-slate-800 dark:text-brand-100">{data.avg_rating}</span>
                            <span className="text-slate-400 dark:text-brand-200/50">({data.total})</span>
                        </span>
                    )}
                </div>
                {user && (
                    <button
                        onClick={() => setShowReviewModal(true)}
                        className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                    >
                        + Add review
                    </button>
                )}
            </div>

            {!data?.reviews?.length ? (
                <p className="text-sm text-slate-400 dark:text-brand-200/50">No reviews yet for this product.</p>
            ) : (
                <div className="space-y-4">
                    {data.reviews.map((r) => (
                        <ReviewCard key={r.id} review={r} onChanged={refresh} />
                    ))}
                </div>
            )}

            <ReviewModal
                open={showReviewModal}
                productId={productId}
                onClose={() => setShowReviewModal(false)}
                onSubmitted={() => {
                    setShowReviewModal(false);
                    refresh();
                }}
            />
        </div>
    );
}

function ReviewCard({ review, onChanged }) {
    const { user } = useAuth();
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [liking, setLiking] = useState(false);

    const handleLike = async () => {
        if (!user) return toast.error('Log in to like reviews');
        setLiking(true);
        try {
            await api.post(`/reviews/${review.id}/like`);
            onChanged();
        } catch {
            toast.error('Something went wrong');
        } finally {
            setLiking(false);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user) return toast.error('Log in to comment');
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            await api.post(`/reviews/${review.id}/comments`, { content: commentText.trim() });
            setCommentText('');
            onChanged();
        } catch {
            toast.error('Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="border-t border-slate-100 dark:border-ink-600 pt-4 first:border-0 first:pt-0">
            <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800 dark:text-brand-100 text-sm">{review.reviewer_name || 'Anonymous'}</p>
                <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} size={12} className={s < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-ink-600'} />
                    ))}
                </div>
            </div>
            {review.comment && (
                <p className="text-slate-500 dark:text-brand-200/60 text-sm mt-1">{review.comment}</p>
            )}

            <div className="flex items-center gap-4 mt-2">
                <button
                    onClick={handleLike}
                    disabled={liking}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${
                        review.liked_by_me
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-slate-400 dark:text-brand-200/40 hover:text-slate-600 dark:hover:text-brand-200'
                    }`}
                >
                    <ThumbsUp size={13} className={review.liked_by_me ? 'fill-brand-600 dark:fill-brand-400' : ''} />
                    {review.like_count > 0 ? review.like_count : 'Like'}
                </button>
                <button
                    onClick={() => setShowComments((s) => !s)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-brand-200/40 hover:text-slate-600 dark:hover:text-brand-200 transition"
                >
                    <MessageSquare size={13} />
                    {review.comments && review.comments.length > 0 ? review.comments.length : 'Comment'}
                </button>
            </div>

            {showComments && (
                <div className="mt-3 pl-3 border-l-2 border-slate-100 dark:border-ink-600 space-y-2.5">
                    {review.comments?.map((c) => (
                        <div key={c.id}>
                            <p className="text-xs font-semibold text-slate-700 dark:text-brand-200">{c.commenter_name}</p>
                            <p className="text-xs text-slate-500 dark:text-brand-200/60">{c.content}</p>
                        </div>
                    ))}
                    {user && (
                        <form onSubmit={handleComment} className="flex items-center gap-2 pt-1">
                            <input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Write a comment…"
                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 focus:border-brand-500 dark:focus:border-brand-500 focus:outline-none text-xs transition"
                            />
                            <button
                                type="submit"
                                disabled={submitting || !commentText.trim()}
                                className="text-brand-600 dark:text-brand-400 disabled:opacity-40 transition"
                            >
                                <Send size={15} />
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

function ReviewModal({ open, productId, onClose, onSubmitted }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Lock body scroll while open. Self-aware — only takes/releases the
    // lock if nothing already owns it, so it's safe whether opened
    // standalone or from within an already-locked parent.
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

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await api.post('/reviews/product', { product_id: productId, rating, comment: comment.trim() || null });
            toast.success('Review submitted!');
            setComment('');
            setRating(5);
            onSubmitted();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-brand-300/50 transition"
                >
                    <X size={18} />
                </button>

                <h2 className="text-lg font-extrabold text-slate-900 dark:text-brand-50">Rate this product</h2>
                <p className="text-sm text-slate-500 dark:text-brand-200/50 mt-1">Based on your completed purchase.</p>

                <div className="flex items-center gap-1.5 mt-4">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setRating(n)}>
                            <Star size={26} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-ink-600'} />
                        </button>
                    ))}
                </div>

                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional — share your experience with the product."
                    rows={3}
                    className="w-full mt-4 px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-brand-50 dark:placeholder-brand-300/30 focus:border-brand-500 dark:focus:border-brand-500 focus:outline-none text-sm transition resize-none"
                />

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full mt-4 py-2.5 rounded-xl bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                >
                    {submitting ? 'Submitting…' : 'Submit review'}
                </button>
            </div>
        </div>
    );
}