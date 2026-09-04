import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X, Smartphone, CheckCircle, Share } from 'lucide-react';
import useInstallPrompt from '../hooks/useInstallPrompt';

export default function InstallButton() {
    const location = useLocation();
    const { install, isInstallable, isIOS, isStandalone, canInstall } = useInstallPrompt();
    const [showModal, setShowModal] = useState(false);
    const [installing, setInstalling] = useState(false);
    const didLockRef = useRef(false);

    // Lock body scroll while open. Self-aware like EditListingModal — only
    // locks/unlocks if nothing already has the body locked.
    useEffect(() => {
        if (showModal) {
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
    }, [showModal]);

    // Only show on Home page
    const isHome = location.pathname === '/';

    // Don't show if not on Home page
    if (!isHome) return null;

    // Don't show anything if already installed
    if (isStandalone) return null;

    // Don't show anything if not installable and not on iOS
    if (!canInstall) return null;

    const handleInstall = async () => {
        setInstalling(true);
        const success = await install();
        setInstalling(false);
        if (success) {
            setShowModal(false);
        }
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 dark:bg-gold-500 dark:hover:bg-gold-400 text-white dark:text-ink-900 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
                aria-label="Install app"
            >
                <Download size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold hidden sm:inline">Install App</span>
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    />

                    {/* Modal content */}
                    <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-ink-600">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-300/50 transition"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-gold-900 flex items-center justify-center shrink-0">
                                <Smartphone className="text-brand-600 dark:text-gold-400" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">
                                    Install Tre-X
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-gold-200/50">
                                    Get the app for a better experience
                                </p>
                            </div>
                        </div>

                        <ul className="space-y-2.5 text-sm text-slate-600 dark:text-gold-200/70 mb-6">
                            <li className="flex items-start gap-2.5">
                                <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                <span>Open instantly from your home screen</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                <span>Works offline — browse listings anytime</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                <span>Faster loading and smoother experience</span>
                            </li>
                        </ul>

                        {isIOS && !isStandalone ? (
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 mb-4">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex flex-wrap items-center justify-center gap-1 text-center">
                                    <span>📱 Tap the Share button</span>
                                    <Share className="w-4 h-4 shrink-0" />
                                    <span>and select <span className="font-bold">"Add to Home Screen"</span></span>
                                </p>
                            </div>
                        ) : null}

                        <button
                            onClick={handleInstall}
                            disabled={installing || (!isInstallable && !isIOS)}
                            className="w-full py-3 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {installing ? (
                                <>
                                    <span className="animate-spin">⏳</span> Installing…
                                </>
                            ) : isIOS && !isStandalone ? (
                                'Show instructions'
                            ) : (
                                <>
                                    <Download size={16} /> Install now
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => setShowModal(false)}
                            className="w-full mt-2 py-2 text-xs text-slate-400 dark:text-gold-200/40 hover:text-slate-600 dark:hover:text-gold-100 transition"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}