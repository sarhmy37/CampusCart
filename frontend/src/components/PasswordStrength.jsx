import { Check, X } from 'lucide-react';

export function getPasswordRules(pw) {
    return {
        length: pw.length >= 8,
        letter: /[A-Za-z]/.test(pw),
        number: /[0-9]/.test(pw),
        special: /[^A-Za-z0-9]/.test(pw),
    };
}

export function getPasswordScore(pw) {
    const rules = getPasswordRules(pw);
    return Object.values(rules).filter(Boolean).length; // 0–4
}

export function isPasswordValid(pw) {
    return getPasswordScore(pw) === 4;
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = [
    'bg-slate-200 dark:bg-ink-700',
    'bg-red-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-emerald-500',
];
const TEXT = [
    'text-slate-400 dark:text-gold-200/40',
    'text-red-600 dark:text-red-400',
    'text-amber-600 dark:text-amber-400',
    'text-yellow-600 dark:text-yellow-400',
    'text-emerald-600 dark:text-emerald-400',
];

export default function PasswordStrength({ password }) {
    const score = getPasswordScore(password);
    const rules = getPasswordRules(password);
    const show = password.length > 0;

    return (
        <div className={`overflow-hidden transition-all duration-200 ${show ? 'max-h-40 mt-2' : 'max-h-0'}`}>
            <div className="flex gap-1 mb-1.5">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                            i < score ? COLORS[score] : 'bg-slate-200 dark:bg-ink-700'
                        }`}
                    />
                ))}
            </div>
            <p className={`text-[11px] font-semibold mb-2 ${TEXT[score]}`}>{LABELS[score]}</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                <Rule ok={rules.length} text="8+ characters" />
                <Rule ok={rules.letter} text="Letter" />
                <Rule ok={rules.number} text="Number" />
                <Rule ok={rules.special} text="Symbol (@, #, $)" />
            </ul>
        </div>
    );
}

function Rule({ ok, text }) {
    return (
        <li className={`flex items-center gap-1 text-[11px] ${
            ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-gold-200/40'
        }`}>
            {ok ? <Check size={11} /> : <X size={11} />}
            {text}
        </li>
    );
}