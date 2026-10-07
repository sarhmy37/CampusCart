import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import api from '../api/client';
import { useAuth } from './AuthContext';

const WishlistContext = createContext<any>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
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

  const isWishlisted = (productId: number) => items.some((i) => i.id === productId);

  const addItem = async (product: any) => {
    setItems((prev) => [{ ...product, wishlisted_at: new Date().toISOString() }, ...prev]);
    Toast.show({ type: 'success', text1: 'Added to wishlist' });
    try {
      await api.post('/wishlist', { product_id: product.id });
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== product.id));
      Toast.show({ type: 'error', text1: 'Failed to add to wishlist' });
    }
  };

  const removeItem = async (productId: number) => {
    const prevItems = items;
    setItems((prev) => prev.filter((i) => i.id !== productId));
    try {
      await api.delete(`/wishlist/${productId}`);
    } catch {
      setItems(prevItems);
    }
  };

  const toggleItem = (product: any) => {
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