import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    // UPDATED LOGIC:
    // 1. Check if user manually saved a preference (localStorage).
    // 2. If not, check their phone/computer's system preference (window.matchMedia).
    // Only a value the user explicitly picked (via toggleTheme/setTheme) counts
    // as an override. A theme derived from system preference is never written
    // back to localStorage, so it stays free to keep following the system.
    const [theme, setThemeState] = useState(() => {
        const saved = localStorage.getItem('cc_theme');
        if (saved) return saved;

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    // Apply the class whenever theme changes — does NOT touch localStorage.
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);

    // Live-follow the system setting, but only while the user hasn't set an
    // explicit override. Attaches a real 'change' listener so flipping the
    // phone/OS setting updates the app immediately, without a reload.
    useEffect(() => {
        if (localStorage.getItem('cc_theme')) return; // user has an explicit override — don't fight it

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => setThemeState(e.matches ? 'dark' : 'light');

        mq.addEventListener('change', handleChange);
        return () => mq.removeEventListener('change', handleChange);
    }, []);

    // Explicit user choice — this is what actually writes the override.
    const setTheme = (next) => {
        localStorage.setItem('cc_theme', next);
        setThemeState(next);
    };

    const toggleTheme = () => {
        setThemeState((t) => {
            const next = t === 'dark' ? 'light' : 'dark';
            localStorage.setItem('cc_theme', next);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);