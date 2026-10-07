import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import api from '../api/client';
import { useWishlist } from './WishlistContext';
import { useAuth } from './AuthContext';

const NotificationContext = createContext<any>(null);
const SEEN_KEY = 'cc_seen_product_ids';
const PRICE_KEY = 'cc_wishlist_prices';
const LOW_STOCK_KEY = 'cc_wishlist_low_stock_notified';
const LOW_STOCK_THRESHOLD = 2;
const POLL_MS = 60 * 1000;

const getSellerStockKey = (userId: number) => `cc_seller_stock_${userId}`;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const [productNotifs, setProductNotifs] = useState<any[]>([]);
  const [backendNotifs, setBackendNotifs] = useState<any[]>([]);
  const initialized = useRef(false);

  const getSeenIds = async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY);
      return new Set(JSON.parse(raw || '[]'));
    } catch { return new Set(); }
  };
  const saveSeenIds = async (idsSet: Set<any>) => {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...idsSet]));
  };
  const getStoredPrices = async () => {
    try {
      const raw = await AsyncStorage.getItem(PRICE_KEY);
      return JSON.parse(raw || '{}');
    } catch { return {}; }
  };
  const getLowStockNotified = async () => {
    try {
      const raw = await AsyncStorage.getItem(LOW_STOCK_KEY);
      return new Set(JSON.parse(raw || '[]'));
    } catch { return new Set(); }
  };
  const getStoredSellerStock = async () => {
    if (!user) return {};
    try {
      const raw = await AsyncStorage.getItem(getSellerStockKey(user.id));
      return JSON.parse(raw || '{}');
    } catch { return {}; }
  };
  const saveSellerStock = async (stockMap: any) => {
    if (!user) return;
    await AsyncStorage.setItem(getSellerStockKey(user.id), JSON.stringify(stockMap));
  };

  const checkWishlistChanges = async (products: any[]) => {
    if (!wishlistItems?.length) return;
    const wishlistIds = new Set(wishlistItems.map((w: any) => w.id));
    const storedPrices = await getStoredPrices();
    const lowStockNotified = await getLowStockNotified();
    const newNotifs: any[] = [];

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
          Toast.show({ type: 'success', text1: `💰 ${p.title} dropped to GHS ${currentPrice.toFixed(2)}` });
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
          Toast.show({ type: 'info', text1: `⚡ ${p.title} is almost sold out` });
          lowStockNotified.add(p.id);
        } else if (p.stock > LOW_STOCK_THRESHOLD) {
          lowStockNotified.delete(p.id);
        }
      });

    if (newNotifs.length > 0) setProductNotifs((prev) => [...newNotifs, ...prev].slice(0, 50));
    await AsyncStorage.setItem(PRICE_KEY, JSON.stringify(storedPrices));
    await AsyncStorage.setItem(LOW_STOCK_KEY, JSON.stringify([...lowStockNotified]));
  };

  const checkSellerStock = async (products: any[]) => {
    if (!user || user.account_type !== 'seller') return;
    const sellerProducts = products.filter((p) => p.seller_id === user.id);
    if (sellerProducts.length === 0) return;

    const previousStock = await getStoredSellerStock();
    const updatedStock: any = {};
    const newNotifs: any[] = [];

    sellerProducts.forEach((p) => {
      const current = p.stock ?? 0;
      updatedStock[p.id] = current;
      const prev = previousStock[p.id];
      if (prev !== undefined && prev > 0 && current === 0) {
        const isService = (p.category || p.category_name) === 'Services';
        newNotifs.push({
          id: `outofstock-${p.id}-${Date.now()}`,
          productId: p.id,
          type: 'out_of_stock',
          title: p.title,
          message: `Your listing "${p.title}" is now out of stock.`,
          primary_image: p.primary_image,
          link: isService ? `/service/${p.id}` : `/product/${p.id}`,
          read: false,
          created_at: new Date().toISOString(),
        });
        Toast.show({ type: 'info', text1: `📦 ${p.title} is now out of stock` });
      }
    });

    if (newNotifs.length > 0) setProductNotifs((prev) => [...newNotifs, ...prev].slice(0, 50));
    await saveSellerStock(updatedStock);
  };

  const checkForNewListings = async () => {
    try {
      const res = await api.get('/products');
      const products = res.data || [];
      const seenIds = await getSeenIds();

      await checkWishlistChanges(products);
      await checkSellerStock(products);

      if (!initialized.current) {
        await saveSeenIds(new Set(products.map((p: any) => p.id)));
        initialized.current = true;
        return;
      }

      const newOnes = products.filter((p: any) => !seenIds.has(p.id));
      const notifyListingsFlag = await AsyncStorage.getItem('cc_notify_listings');
      const notifyListingsEnabled = notifyListingsFlag !== 'false';

      if (newOnes.length > 0 && notifyListingsEnabled) {
        const newNotifs = newOnes.map((p: any) => {
          const isService = (p.category || p.category_name) === 'Services';
          return {
            id: p.id,
            type: 'new_listing',
            title: isService ? 'New service listed' : 'New product listed',
            message: p.seller_name ? `${p.title} — by ${p.seller_name}` : p.title,
            category: p.category || p.category_name,
            seller_name: p.seller_name,
            primary_image: p.primary_image,
            link: isService ? `/service/${p.id}` : `/product/${p.id}`,
            read: false,
            created_at: new Date().toISOString(),
          };
        });
        setProductNotifs((prev) => [...newNotifs, ...prev].slice(0, 50));

        if (newOnes.length === 1) {
          const isService = newOnes[0].category === 'Services';
          Toast.show({ type: 'info', text1: `New ${isService ? 'service' : 'listing'}: ${newOnes[0].title}` });
        } else {
          const allServices = newOnes.every((p: any) => p.category === 'Services');
          const noServices = newOnes.every((p: any) => p.category !== 'Services');
          const word = allServices ? 'services' : noServices ? 'listings' : 'listings and services';
          Toast.show({ type: 'info', text1: `${newOnes.length} new ${word} just posted` });
        }
        newOnes.forEach((p: any) => seenIds.add(p.id));
        await saveSeenIds(seenIds);
      } else if (newOnes.length > 0) {
        newOnes.forEach((p: any) => seenIds.add(p.id));
        await saveSeenIds(seenIds);
      }
    } catch {}
  };

  const fetchBackendNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setBackendNotifs(res.data);
    } catch {}
  };

  const allNotifs = [...productNotifs, ...backendNotifs].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  const unreadCount = allNotifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read');
      setBackendNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
    setProductNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('/notifications');
    } catch {}
    setBackendNotifs([]);
    setProductNotifs([]);
  };

  const removeNotification = async (id: any) => {
    const isBackendNotif = backendNotifs.some((n) => n.id === id);
    if (isBackendNotif) {
      try {
        await api.delete(`/notifications/${id}`);
      } catch {}
      setBackendNotifs((prev) => prev.filter((n) => n.id !== id));
    } else {
      setProductNotifs((prev) => prev.filter((n) => n.id !== id));
    }
  };

  useEffect(() => {
    checkForNewListings();
    let interval: any = setInterval(checkForNewListings, POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearInterval(interval);
        checkForNewListings();
        interval = setInterval(checkForNewListings, POLL_MS);
      } else {
        clearInterval(interval);
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user]);

  useEffect(() => {
    if (user) fetchBackendNotifications();
    else setBackendNotifs([]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let interval: any = setInterval(fetchBackendNotifications, 60 * 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearInterval(interval);
        fetchBackendNotifications();
        interval = setInterval(fetchBackendNotifications, 60 * 1000);
      } else {
        clearInterval(interval);
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{ notifications: allNotifs, unreadCount, markAllRead, clearAllNotifications, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
