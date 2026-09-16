import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_GOLD = {
    50: '253 248 236', 100: '250 237 196', 200: '245 219 141', 300: '238 194 79',
    400: '230 171 43', 500: '212 148 28', 600: '184 117 21', 700: '147 88 20',
    800: '121 71 24', 900: '102 60 25',
};

const PRO_BLUE = {
    50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
    400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
    800: '30 64 175', 900: '30 58 138',
};

const PREMIUM_PURPLE = {
    50: '250 245 255', 100: '243 232 255', 200: '233 213 255', 300: '216 180 254',
    400: '192 132 252', 500: '168 85 247', 600: '147 51 234', 700: '126 34 206',
    800: '107 33 168', 900: '88 28 135',
};

// Swaps the --gold-* CSS variables to match the user's plan color, but ONLY
// when they've opted in via the toggle in Settings > Appearance. Off by
// default — everyone still sees the standard gold until they turn it on.
export default function PlanThemeSync() {
    const { user } = useAuth();

    useEffect(() => {
        const applyPalette = () => {
            const isPlanActive = user?.plan && user.plan !== 'free' &&
                user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
            const optedIn = localStorage.getItem('cc_plan_theme') === 'on';

            const palette = (!isPlanActive || !optedIn)
                ? DEFAULT_GOLD
                : user.plan.toLowerCase() === 'premium'
                    ? PREMIUM_PURPLE
                    : user.plan.toLowerCase() === 'pro'
                        ? PRO_BLUE
                        : DEFAULT_GOLD;

            const root = document.documentElement;
            Object.entries(palette).forEach(([shade, rgb]) => {
                root.style.setProperty(`--gold-${shade}`, rgb);
            });
        };

        applyPalette();
        window.addEventListener('cc-plan-theme-change', applyPalette);
        return () => window.removeEventListener('cc-plan-theme-change', applyPalette);
    }, [user?.plan, user?.plan_expires_at]);

    return null;
}