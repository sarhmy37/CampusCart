import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { LOGO_LIGHT, LOGO_DARK } from '../data/media';

const SPLASH_DURATION_MS = 1600;
const FADE_OUT_MS = 300;

export default function IntroSplash({ onFinish }) {
    const { theme } = useTheme();
    const [fadingOut, setFadingOut] = useState(false);

    useEffect(() => {
        const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION_MS - FADE_OUT_MS);
        const finishTimer = setTimeout(() => onFinish(), SPLASH_DURATION_MS);
        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    return (
        <div
            className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900 transition-opacity duration-300 ${
                fadingOut ? 'opacity-0' : 'opacity-100'
            }`}
        >
            <style>{`
                @keyframes introLogoPop {
                    0% { opacity: 0; transform: scale(0.7); }
                    60% { opacity: 1; transform: scale(1.06); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .intro-logo-pop { animation: introLogoPop 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }

                @keyframes introWordmarkRise {
                    0% { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .intro-wordmark-rise { animation: introWordmarkRise 500ms ease-out 300ms forwards; opacity: 0; }
            `}</style>

            <img
                src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK}
                alt="Tre-X"
                className="intro-logo-pop h-16 w-auto object-contain"
            />
            <div className="intro-wordmark-rise flex items-center font-black tracking-wider mt-3">
                <span className="text-2xl text-white">Tre</span>
                <span className="text-2xl text-white -ml-0.5">-</span>
                <span className="text-3xl italic text-gold-400 leading-none -ml-1">X</span>
            </div>
        </div>
    );
}