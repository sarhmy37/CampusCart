import { createContext, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useWishlist } from './WishlistContext';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();
const SEEN_KEY = 'cc_seen_product_ids';
const PRICE_KEY = 'cc_wishlist_prices';
const LOW_STOCK_KEY = 'cc_wishlist_low_stock_notified';
const LOW_STOCK_THRESHOLD = 2;
const POLL_MS = 60 * 1000; // 1 minute

const getSellerStockKey = (userId) => `cc_seller_stock_${userId}`;

export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const { items: wishlistItems } = useWishlist();
    // Local product-based notifications (price drops, low stock, new listings, out of stock)
    const [productNotifs, setProductNotifs] = useState([]);
    // Backend notifications (order completed, etc.)
    const [backendNotifs, setBackendNotifs] = useState([]);
    const initialized = useRef(false);

    // ---- localStorage helpers (same as before) ----
    const getSeenIds = () => {
        try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
        catch { return new Set(); }
    };
    const saveSeenIds = (idsSet) => {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...idsSet]));
    };
    const getStoredPrices = () => {
        try { return JSON.parse(localStorage.getItem(PRICE_KEY) || '{}'); }
        catch { return {}; }
    };
    const getLowStockNotified = () => {
        try { return new Set(JSON.parse(localStorage.getItem(LOW_STOCK_KEY) || '[]')); }
        catch { return new Set(); }
    };
    const getStoredSellerStock = () => {
        if (!user) return {};
        const key = getSellerStockKey(user.id);
        try { return JSON.parse(localStorage.getItem(key) || '{}'); }
        catch { return {}; }
    };
    const saveSellerStock = (stockMap) => {
        if (!user) return;
        const key = getSellerStockKey(user.id);
        localStorage.setItem(key, JSON.stringify(stockMap));
    };

    // ---- Product-based notifications (same as before) ----
    const checkWishlistChanges = (products) => {
        if (!wishlistItems?.length) return;
        const wishlistIds = new Set(wishlistItems.map((w) => w.id));
        const storedPrices = getStoredPrices();
        const lowStockNotified = getLowStockNotified();
        const newNotifs = [];

        products
            .filter((p) => wishlistIds.has(p.id))
            .forEach((p) => {
                const prevPrice = storedPrices[p.id];
                const currentPrice = parseFloat(p.price);
                if (prevPrice !== undefined && currentPrice < prevPrice) {
                    newNotifs.push({
                        id: `price-${p.id}-${Date.now()}`,
                        productId: p.id,
                        type: 'price_drop',
                        title: p.title,
                        message: `Price dropped: GHS ${prevPrice.toFixed(2)} → GHS ${currentPrice.toFixed(2)}`,
                        primary_image: p.primary_image,
                        read: false,
                        created_at: new Date().toISOString(),
                    });
                    toast.success(`💰 ${p.title} dropped to GHS ${currentPrice.toFixed(2)}`);
                }
                storedPrices[p.id] = currentPrice;

                if (p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD && !lowStockNotified.has(p.id)) {
                    newNotifs.push({
                        id: `stock-${p.id}-${Date.now()}`,
                        productId: p.id,
                        type: 'low_stock',
                        title: p.title,
                        message: `Only ${p.stock} left — almost sold out!`,
                        primary_image: p.primary_image,
                        read: false,
                        created_at: new Date().toISOString(),
                    });
                    toast(`⚡ ${p.title} is almost sold out`, { icon: '⚡' });
                    lowStockNotified.add(p.id);
                } else if (p.stock > LOW_STOCK_THRESHOLD) {
                    lowStockNotified.delete(p.id);
                }
            });

        if (newNotifs.length > 0) {
            setProductNotifs((prev) => [...newNotifs, ...prev]);
        }
        localStorage.setItem(PRICE_KEY, JSON.stringify(storedPrices));
        localStorage.setItem(LOW_STOCK_KEY, JSON.stringify([...lowStockNotified]));
    };

    const checkSellerStock = (products) => {
        if (!user || user.account_type !== 'seller') return;
        const sellerProducts = products.filter(p => p.seller_id === user.id);
        if (sellerProducts.length === 0) return;

        const previousStock = getStoredSellerStock();
        const updatedStock = {};
        const newNotifs = [];

        sellerProducts.forEach(p => {
            const current = p.stock ?? 0;
            updatedStock[p.id] = current;
            const prev = previousStock[p.id];
            if (prev !== undefined && prev > 0 && current === 0) {
                newNotifs.push({
                    id: `outofstock-${p.id}-${Date.now()}`,
                    productId: p.id,
                    type: 'out_of_stock',
                    title: p.title,
                    message: `Your listing "${p.title}" is now out of stock.`,
                    primary_image: p.primary_image,
                    read: false,
                    created_at: new Date().toISOString(),
                });
                toast(`📦 ${p.title} is now out of stock`, { icon: '📦' });
            }
        });

        if (newNotifs.length > 0) {
            setProductNotifs((prev) => [...newNotifs, ...prev]);
        }
        saveSellerStock(updatedStock);
    };

    const checkForNewListings = async () => {
        try {
            const res = await api.get('/products');
            const products = res.data || [];
            const seenIds = getSeenIds();

            checkWishlistChanges(products);
            checkSellerStock(products);

            if (!initialized.current) {
                saveSeenIds(new Set(products.map((p) => p.id)));
                initialized.current = true;
                return;
            }

            const newOnes = products.filter((p) => !seenIds.has(p.id));
            if (newOnes.length > 0) {
                const newNotifs = newOnes.map((p) => ({
                    id: p.id,
                    type: 'new_listing',
                    title: p.title,
                    category: p.category || p.category_name,
                    seller_name: p.seller_name,
                    primary_image: p.primary_image,
                    read: false,
                    created_at: new Date().toISOString(),
                }));
                setProductNotifs((prev) => [...newNotifs, ...prev]);

                if (newOnes.length === 1) {
                    toast(`New listing: ${newOnes[0].title}`, { icon: '🛍️' });
                } else {
                    toast(`${newOnes.length} new listings just posted`, { icon: '🛍️' });
                }
                newOnes.forEach((p) => seenIds.add(p.id));
                saveSeenIds(seenIds);
            }
        } catch { /* ignore */ }
    };

    // ---- Backend notifications ----
    const fetchBackendNotifications = async () => {
        if (!user) return;
        try {
            const res = await api.get('/notifications');
            setBackendNotifs(res.data);
        } catch { /* ignore */ }
    };

    // ---- Combined state ----
    const allNotifs = [...productNotifs, ...backendNotifs].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
    });

    const unreadCount = allNotifs.filter(n => !n.read).length;

    // ---- Mark all read ----
    const markAllRead = async () => {
        // Mark backend as read
        try {
            await api.post('/notifications/read');
            setBackendNotifs(prev => prev.map(n => ({ ...n, read: true })));
        } catch { /* ignore */ }
        // Mark product notifications as read
        setProductNotifs(prev => prev.map(n => ({ ...n, read: true })));
    };

    // ---- Clear all ----
    const clearAllNotifications = async () => {
        try {
            await api.delete('/notifications');
            setBackendNotifs([]);
            setProductNotifs([]);
        } catch {
            // fallback: clear locally
            setBackendNotifs([]);
            setProductNotifs([]);
        }
    };

    // ---- Polling ----
    useEffect(() => {
        checkForNewListings();
        const interval = setInterval(checkForNewListings, POLL_MS);
        return () => clearInterval(interval);
    }, [user]);

    // ---- Fetch backend notifications when user changes ----
    useEffect(() => {
        if (user) {
            fetchBackendNotifications();
        } else {
            setBackendNotifs([]);
        }
    }, [user]);

    // Also refresh backend notifications every minute (optional)
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(fetchBackendNotifications, 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <NotificationContext.Provider
            value={{
                notifications: allNotifs,
                unreadCount,
                markAllRead,
                clearAllNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    return useContext(NotificationContext);
}