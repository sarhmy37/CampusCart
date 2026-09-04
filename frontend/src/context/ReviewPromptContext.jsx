import { createContext, useContext, useState, useRef, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const ReviewPromptContext = createContext();

const TRIGGER_DELAY_MS = 5000;

export function ReviewPromptProvider({ children }) {
    const { user } = useAuth();
    const [queue, setQueue] = useState([]); // [{ seller_id, seller_name, seller_avatar }, ...]
    const timerRef = useRef(null);

    // Called right after a buyer confirms receipt of an item. Schedules a
    // fetch of all pending sellers 5s later, so the prompt appears whichever
    // page the buyer has navigated to by then.
    const scheduleReviewCheck = useCallback(() => {
        if (!user) return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            try {
                const res = await api.get('/reviews/pending-sellers');
                if (res.data?.length > 0) {
                    setQueue(res.data);
                }
            } catch { /* ignore */ }
        }, TRIGGER_DELAY_MS);
    }, [user]);

    const currentPrompt = queue[0] || null;

    const advanceQueue = () => setQueue((prev) => prev.slice(1));

    const submitReview = async (rating, comment) => {
        if (!currentPrompt) return;
        await api.post('/reviews', { seller_id: currentPrompt.seller_id, rating, comment: comment || null });
        advanceQueue();
    };

    const skipReview = async () => {
        if (!currentPrompt) return;
        try {
            await api.post(`/reviews/${currentPrompt.seller_id}/skip`);
        } catch { /* ignore */ }
        advanceQueue();
    };

    return (
        <ReviewPromptContext.Provider
            value={{ currentPrompt, submitReview, skipReview, scheduleReviewCheck }}
        >
            {children}
        </ReviewPromptContext.Provider>
    );
}

export function useReviewPrompt() {
    return useContext(ReviewPromptContext);
}