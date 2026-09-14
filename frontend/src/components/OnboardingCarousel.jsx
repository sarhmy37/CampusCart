import { useState } from 'react';
import { ShieldCheck, MessageCircle, Handshake, ArrowRight } from 'lucide-react';

export const ONBOARDING_STORAGE_KEY = 'trex_onboarded';

const SLIDES = [
    {
        icon: ShieldCheck,
        title: 'Buy and sell within your campus, safely',
        desc: 'Every account is verified with a university email — no strangers, no spam.',
    },
    {
        icon: MessageCircle,
        title: 'Chat, ask, agree',
        desc: 'Message sellers directly, ask questions, and agree on a spot to meet up.',
    },
    {
        icon: Handshake,
        title: 'Meet up and swap',
        desc: 'Pay however you\u2019ve agreed, hand it over, and leave a review. Simple as that.',
    },
];

export default function OnboardingCarousel({ onFinish }) {
    const [index, setIndex] = useState(0);
    const isLast = index === SLIDES.length - 1;
    const slide = SLIDES[index];

    const handleNext = () => {
        if (isLast) {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
            onFinish();
            return;
        }
        setIndex((i) => i + 1);
    };

    const handleSkip = () => {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        onFinish();
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-ink-900">
            <div className="flex justify-end p-4">
                {!isLast && (
                    <button
                        onClick={handleSkip}
                        className="text-sm font-semibold text-slate-400 dark:text-gold-200/50 hover:text-slate-600 dark:hover:text-gold-200 transition"
                    >
                        Skip
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-6">
                    <slide.icon size={34} />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-gold-50 max-w-xs">
                    {slide.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-3 max-w-xs leading-relaxed">
                    {slide.desc}
                </p>
            </div>

            <div className="px-8 pb-10">
                <div className="flex items-center justify-center gap-1.5 mb-6">
                    {SLIDES.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === index ? 'w-6 bg-brand-600 dark:bg-gold-500' : 'w-1.5 bg-slate-200 dark:bg-ink-600'
                            }`}
                        />
                    ))}
                </div>
                <button
                    onClick={handleNext}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-bold text-sm transition"
                >
                    {isLast ? 'Get started' : 'Next'}
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}