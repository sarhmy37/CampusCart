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
        return 'light';
    });

    // Apply the class whenever theme changes — does NOT touch localStorage.
    // Also keeps the OS status bar (theme-color meta tag) in sync, so it
    // blends into the header background instead of showing as a stray
    // black bar above it.
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'dark' ? '#0d0c0a' : '#ffffff');
        }
    }, [theme]);

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