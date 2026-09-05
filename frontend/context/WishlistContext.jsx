import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(() => {
        if (!user) {
            setItems([]);
            return;
        }
        setLoading(true);
        api.get('/wishlist')
            .then((res) => setItems(res.data))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [user]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const isWishlisted = (productId) => items.some((i) => i.id === productId);

    const addItem = async (product) => {
        // Optimistic update so the heart fills instantly
        setItems((prev) => [{ ...product, wishlisted_at: new Date().toISOString() }, ...prev]);
        try {
            await api.post('/wishlist', { product_id: product.id });
        } catch {
            setItems((prev) => prev.filter((i) => i.id !== product.id));
        }
    };

    const removeItem = async (productId) => {
        const prevItems = items;
        setItems((prev) => prev.filter((i) => i.id !== productId));
        try {
            await api.delete(`/wishlist/${productId}`);
        } catch {
            setItems(prevItems);
        }
    };

    const toggleItem = (product) => {
        if (isWishlisted(product.id)) {
            removeItem(product.id);
        } else {
            addItem(product);
        }
    };

    const count = items.length;

    return (
        <WishlistContext.Provider value={{ items, loading, isWishlisted, addItem, removeItem, toggleItem, count, refresh }}>
            {children}
        </WishlistContext.Provider>
    );
}

export const useWishlist = () => useContext(WishlistContext);