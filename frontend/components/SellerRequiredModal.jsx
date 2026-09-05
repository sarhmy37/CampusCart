import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, X } from 'lucide-react';

export default function SellerRequiredModal({ open, onClose }) {
    const navigate = useNavigate();

    // Lock body scroll while open. Self-aware — only takes/releases the
    // lock if nothing already owns it, so it's safe whether opened
    // standalone or from within an already-locked parent.
    const didLockRef = useRef(false);

    useEffect(() => {
        if (open) {
            if (document.body.style.position !== 'fixed') {
                const scrollY = window.scrollY;
                document.body.style.position = 'fixed';
                document.body.style.top = `-${scrollY}px`;
                document.body.style.left = '0';
                document.body.style.right = '0';
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
                document.documentElement.style.overscrollBehavior = 'none';
                didLockRef.current = true;
            }
        } else if (didLockRef.current) {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
            didLockRef.current = false;
        }
        return () => {
            if (didLockRef.current) {
                const scrollY = document.body.style.top;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.documentElement.style.overscrollBehavior = '';
                if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
                didLockRef.current = false;
            }
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 border border-transparent dark:border-ink-600 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition"
                >
                    <X size={18} />
                </button>
                <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-4">
                    <Store size={20} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Seller account required</h3>
                <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1.5">
                    Your account is set up for buying. To list and sell items, you'll need a seller account.
                </p>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 hover:bg-slate-50 dark:hover:bg-ink-700 text-sm font-semibold transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onClose(); navigate('/register?role=seller'); }}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition"
                    >
                        Sign up as Seller
                    </button>
                </div>
            </div>
        </div>
    );
}