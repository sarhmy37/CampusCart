import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { LOGO_LIGHT, LOGO_DARK } from '../data/media';

const isIOSDevice = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

const SPLASH_DURATION_MS = 4000;
const FADE_OUT_MS = 300;
const APP_VERSION = '1.0.0';

const SPLASH_SESSION_KEY = 'trex_intro_splash_shown';

export default function IntroSplash({ onFinish }) {
    const { theme } = useTheme();
    const [fadingOut, setFadingOut] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem(SPLASH_SESSION_KEY)) {
            onFinish();
            return;
        }
        sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
        const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION_MS - FADE_OUT_MS);
        const finishTimer = setTimeout(() => onFinish(), SPLASH_DURATION_MS);
        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    return (
        <div
            className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white dark:bg-ink-900 transition-opacity duration-300 ${
                fadingOut ? 'opacity-0' : 'opacity-100'
            }`}
        >
            <style>{`
                @keyframes introLogoPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.06); }
                }
                .intro-logo-pulse {
                    animation: introLogoPulse 1400ms ease-in-out infinite;
                    filter: drop-shadow(0 10px 20px rgba(0,0,0,0.18));
                }
                .intro-wordmark-shadow {
                    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15));
                }
            `}</style>

            <img
                src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK}
                alt="Tre-X"
                className="intro-logo-pulse h-24 sm:h-28 w-auto object-contain"
            />
            <div className={`intro-wordmark-shadow flex items-center font-black tracking-wider mt-4 ${isIOSDevice ? 'font-serif' : 'font-sans'}`}>
                <span className="text-3xl text-slate-900 dark:text-gold-200">Tre</span>
                <span className="text-3xl text-slate-900 dark:text-gold-200 -ml-0.5">-</span>
                <span className="text-4xl italic text-brand-600 dark:text-gold-400 leading-none -ml-1">X</span>
            </div>

            <p className="absolute bottom-8 text-xs text-slate-500 dark:text-gold-200/60">
                App version {APP_VERSION}
            </p>
        </div>
    );
}