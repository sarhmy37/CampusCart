import { createContext, useContext, useState, useRef, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const ReviewPromptContext = createContext<any>(null);

const TRIGGER_DELAY_MS = 5000;

export function ReviewPromptProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const timerRef = useRef<any>(null);

  const scheduleReviewCheck = useCallback(() => {
    if (!user) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/reviews/pending-items');
        const cleaned = (res.data || []).map((g: any) => ({
          ...g,
          products: g.products.filter(
            (p: any, i: number, arr: any[]) => arr.findIndex((x) => x.product_id === p.product_id) === i
          ),
        }));
        if (cleaned.length > 0) {
          setGroups(cleaned);
        }
      } catch {}
    }, TRIGGER_DELAY_MS);
  }, [user]);

  const hasPending = groups.length > 0;

  // NOTE: imageFile here will come from expo-image-picker ({ uri, name, type })
  // instead of a browser File — still works fine with FormData.append.
  const submitReviews = async (payload: any[]) => {
    await Promise.all(
      payload.map(({ product_id, rating, comment, imageFile }) => {
        const form = new FormData();
        form.append('product_id', product_id);
        form.append('rating', rating);
        if (comment) form.append('comment', comment);
        if (imageFile) form.append('image', imageFile as any);
        return api.post('/reviews/product', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      })
    );
    setGroups([]);
  };

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