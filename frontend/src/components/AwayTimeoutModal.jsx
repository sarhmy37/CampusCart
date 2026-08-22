import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock } from 'lucide-react';

const AWAY_TIMEOUT_MS = 300 * 1000; // 300 seconds

export default function AwayTimeoutModal() {
    const { user, logout } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [remaining, setRemaining] = useState(AWAY_TIMEOUT_MS);
    const leftAtRef = useRef(null);
    const tickRef = useRef(null);

    useEffect(() => {
        if (!user) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                leftAtRef.current = Date.now();
            } else if (leftAtRef.current) {
                const elapsed = Date.now() - leftAtRef.current;
                leftAtRef.current = null;

                if (elapsed >= AWAY_TIMEOUT_MS) {
                    logout();
                    return;
                }
                setRemaining(AWAY_TIMEOUT_MS - elapsed);
                setShowModal(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user, logout]);

    useEffect(() => {
        if (!showModal) return;

        tickRef.current = setInterval(() => {
            setRemaining((r) => {
                if (r <= 1000) {
                    clearInterval(tickRef.current);
                    logout();
                    return 0;
                }
                return r - 1000;
            });
        }, 1000);

        return () => clearInterval(tickRef.current);
    }, [showModal, logout]);

    const handleContinue = () => {
        clearInterval(tickRef.current);
        setShowModal(false);
        setRemaining(AWAY_TIMEOUT_MS);
    };

    if (!showModal) return null;

    const seconds = Math.ceil(remaining / 1000);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md" />
            <div className="relative bg-white dark:bg-ink-800 border border-transparent dark:border-ink-600 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-4">
                    <Clock size={24} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Welcome back ,{user.name}!</h3>
                <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1.5">
                    You were away. Your session will end in
                </p>
                <p className="text-3xl font-extrabold text-brand-600 dark:text-gold-400 mt-2">{seconds}s</p>

                <button
                    onClick={handleContinue}
                    className="w-full mt-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition"
                >
                    Continue working
                </button>
            </div>
        </div>
    );
}