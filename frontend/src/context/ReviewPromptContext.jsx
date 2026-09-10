import { createContext, useContext, useState, useRef, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const ReviewPromptContext = createContext();

const TRIGGER_DELAY_MS = 5000;

export function ReviewPromptProvider({ children }) {
    const { user } = useAuth();
    // [{ seller_id, seller_name, seller_avatar, products: [{ product_id, title }, ...] }, ...]
    const [groups, setGroups] = useState([]);
    const timerRef = useRef(null);

    // Called right after a buyer confirms receipt of an item. Schedules a
    // fetch of all pending products (grouped by seller) 5s later, so the
    // prompt appears whichever page the buyer has navigated to by then.
    const scheduleReviewCheck = useCallback(() => {
        if (!user) return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            try {
                const res = await api.get('/reviews/pending-items');
                if (res.data?.length > 0) {
                    setGroups(res.data);
                }
            } catch { /* ignore */ }
        }, TRIGGER_DELAY_MS);
    }, [user]);

    const hasPending = groups.length > 0;

    // The backend has no bulk-review endpoint — it reviews one product at a
    // time (POST /reviews/product) — so submit every entry in parallel and
    // let the modal's own try/catch show a single toast if any of them fail.
    const submitReviews = async (payload) => {
        await Promise.all(
            payload.map(({ product_id, rating, comment }) =>
                api.post('/reviews/product', { product_id, rating, comment: comment || null })
            )
        );
        setGroups([]);
    };

    // Likewise, skipping is per-seller (POST /reviews/:sellerId/skip) — skip
    // every seller currently shown in the modal.
    const skipAll = async () => {
        await Promise.allSettled(
            groups.map((g) => api.post(`/reviews/${g.seller_id}/skip`))
        );
        setGroups([]);
    };

    return (
        <ReviewPromptContext.Provider
            value={{ groups, hasPending, submitReviews, skipAll, scheduleReviewCheck }}
        >
            {children}
        </ReviewPromptContext.Provider>
    );
}

export function useReviewPrompt() {
    return useContext(ReviewPromptContext);
}