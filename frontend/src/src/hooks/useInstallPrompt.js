import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(isStandaloneMode);

        // Check if iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(isIOSDevice);

        // Listen for the beforeinstallprompt event (Android/Chrome)
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if already installed on iOS via standalone mode
        if (isIOSDevice && isStandaloneMode) {
            setIsInstallable(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const install = async () => {
        if (deferredPrompt) {
            // Android/Chrome flow
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            setDeferredPrompt(null);
            setIsInstallable(false);

            if (result.outcome === 'accepted') {
                toast.success('App installed successfully! 🎉');
            } else {
                toast('Installation dismissed.');
            }
            return true;
        }

        if (isIOS && !isStandalone) {
            // iOS fallback – show instructions
            toast('To install on iOS: Tap the Share button → "Add to Home Screen"', {
                duration: 6000,
                icon: '📱',
            });
            return false;
        }

        toast.error('This browser does not support app installation.');
        return false;
    };

    return {
        install,
        isInstallable,
        isIOS,
        isStandalone,
        canInstall: isInstallable || (isIOS && !isStandalone),
    };
}