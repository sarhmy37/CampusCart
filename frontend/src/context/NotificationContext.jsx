// frontend/src/context/NotificationContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

const NotificationContext = createContext();
const SEEN_KEY = 'cc_seen_product_ids';
const POLL_MS = 5 * 60 * 1000; // 5 minutes

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const initialized = useRef(false);

    const getSeenIds = () => {
        try {
            return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
        } catch {
            return new Set();
        }
    };

    const saveSeenIds = (idsSet) => {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...idsSet]));
    };

    const checkForNewListings = async () => {
        try {
            const res = await api.get('/products');
            const products = res.data || [];
            const seenIds = getSeenIds();

            if (!initialized.current) {
                // First load ever: just record what's already there, don't notify.
                saveSeenIds(new Set(products.map((p) => p.id)));
                initialized.current = true;
                return;
            }

            const newOnes = products.filter((p) => !seenIds.has(p.id));

            if (newOnes.length > 0) {
                setNotifications((prev) => [
                    ...newOnes.map((p) => ({
                        id: p.id,
                        title: p.title,
                        category: p.category || p.category_name,
                        seller_name: p.seller_name,
                        primary_image: p.primary_image,
                        read: false,
                    })),
                    ...prev,
                ]);
                setUnreadCount((c) => c + newOnes.length);

                if (newOnes.length === 1) {
                    toast(`New listing: ${newOnes[0].title}`, { icon: '🛍️' });
                } else {
                    toast(`${newOnes.length} new listings just posted`, { icon: '🛍️' });
                }

                newOnes.forEach((p) => seenIds.add(p.id));
                saveSeenIds(seenIds);
            }
        } catch {
            // fail silently, try again next interval
        }
    };

    useEffect(() => {
        checkForNewListings(); // initial run
        const interval = setInterval(checkForNewListings, POLL_MS);
        return () => clearInterval(interval);
    }, []);

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    return useContext(NotificationContext);
}