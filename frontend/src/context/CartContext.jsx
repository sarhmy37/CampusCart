import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        const stored = localStorage.getItem('cc_cart');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem('cc_cart', JSON.stringify(items));
    }, [items]);

    const addItem = (product) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.product_id === product.id);
            const newQuantity = existing ? existing.quantity + 1 : 1;

            // 👇 Check against stock
            if (product.stock !== undefined && newQuantity > product.stock) {
                toast.error(`Only ${product.stock} available in stock.`);
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
            }];
        });
    };

    const removeItem = (productId) => {
        setItems((prev) => prev.filter((i) => i.product_id !== productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity < 1) return removeItem(productId);
        setItems((prev) => {
            const item = prev.find((i) => i.product_id === productId);
            if (!item) return prev;

            // 👇 Check against stock
            if (item.stock !== undefined && quantity > item.stock) {
                toast.error(`Only ${item.stock} available in stock.`);
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