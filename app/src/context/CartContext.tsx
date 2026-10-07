import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import api from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext<any>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('cc_cart');
      if (stored) setItems(JSON.parse(stored));
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return; // don't overwrite storage before we've loaded it
    AsyncStorage.setItem('cc_cart', JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      api.post('/orders/cart-sync', {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [items, user]);

  const addItem = (product: any) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      const newQuantity = existing ? existing.quantity + 1 : 1;

      if (product.stock !== undefined && newQuantity > product.stock) {
        Toast.show({ type: 'error', text1: `Only ${product.stock} available in stock.` });
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        title: product.title,
        price: product.price,
        image: product.primary_image,
        quantity: 1,
        seller_id: product.seller_id ?? product.user_id ?? null,
        seller_name: product.seller_name || 'Seller',
        seller_whatsapp: product.seller_whatsapp || product.whatsapp || null,
        seller_school: product.seller_school || null,
        stock: product.stock || 0,
        delivery_fee_on_campus: product.delivery_fee_on_campus || 0,
        delivery_fee_near_campus: product.delivery_fee_near_campus || 0,
        delivery_fee_far_campus: product.delivery_fee_far_campus || 0,
      }];
    });
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return removeItem(productId);
    setItems((prev) => {
      const item = prev.find((i) => i.product_id === productId);
      if (!item) return prev;

      if (item.stock !== undefined && quantity > item.stock) {
        Toast.show({ type: 'error', text1: `Only ${item.stock} available in stock.` });
        return prev;
      }

      return prev.map((i) => (i.product_id === productId ? { ...i, quantity } : i));
    });
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);