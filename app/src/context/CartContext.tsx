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

  // Refresh price/stock/fees from the server once the saved cart loads.
  // Items whose listing was deleted are removed.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    (async () => {
      const results: any[] = await Promise.all(
        items.map((i) =>
          api.get(`/products/${i.product_id}`)
            .then((res) => ({ id: i.product_id, data: res.data }))
            .catch((err) => ({ id: i.product_id, gone: err?.response?.status === 404 }))
        )
      );
      setItems((prev) =>
        prev
          .filter((i) => !results.find((r) => r.id === i.product_id && r.gone))
          .map((i) => {
            const r = results.find((x) => x.id === i.product_id);
            if (!r?.data) return i;
            const d = r.data;
            return {
              ...i,
              title: d.title ?? i.title,
              price: d.price ?? i.price,
              stock: d.stock ?? i.stock,
              delivery_fee_on_campus: d.delivery_fee_on_campus ?? i.delivery_fee_on_campus,
              delivery_fee_near_campus: d.delivery_fee_near_campus ?? i.delivery_fee_near_campus,
              delivery_fee_far_campus: d.delivery_fee_far_campus ?? i.delivery_fee_far_campus,
            };
          })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const addItem = (product: any, qty: number = 1) => {
    const existing = items.find((i) => i.product_id === product.id);
    const newQuantity = (existing ? existing.quantity : 0) + qty;
    const stockLimit = product.stock ?? existing?.stock;

    if (stockLimit !== undefined && stockLimit !== null && newQuantity > stockLimit) {
      Toast.show({ type: 'error', text1: `Only ${stockLimit} available in stock.` });
      return false;
    }

    const u: any = user;

    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: i.quantity + qty,
                buyer_location: product.buyer_location ?? u?.location ?? i.buyer_location,
                buyer_lat: product.buyer_lat ?? u?.location_lat ?? i.buyer_lat,
                buyer_lng: product.buyer_lng ?? u?.location_lng ?? i.buyer_lng,
              }
            : i
        )
      );
    } else {
      setItems((prev) => [...prev, {
        product_id: product.id,
        title: product.title,
        price: product.price,
        image: product.primary_image,
        quantity: qty,
        seller_id: product.seller_id ?? product.user_id ?? null,
        seller_name: product.seller_name || 'Seller',
        seller_whatsapp: product.seller_whatsapp || product.whatsapp || null,
        seller_school: product.seller_school || null,
        stock: product.stock || 0,
        delivery_fee_on_campus: product.delivery_fee_on_campus || 0,
        delivery_fee_near_campus: product.delivery_fee_near_campus || 0,
        delivery_fee_far_campus: product.delivery_fee_far_campus || 0,
        buyer_location: product.buyer_location ?? u?.location ?? null,
        buyer_lat: product.buyer_lat ?? u?.location_lat ?? null,
        buyer_lng: product.buyer_lng ?? u?.location_lng ?? null,
      }]);
    }

    Toast.show({ type: 'success', text1: qty > 1 ? `Added ${qty} to cart` : 'Added to cart', text2: product.title });
    return true;
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