import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, MessageCircle, Handshake, Sparkles, Star, Heart, CheckCircle2, ArrowRight } from 'lucide-react';
import { LOGO_LIGHT } from '../data/media';

export const ONBOARDING_STORAGE_KEY = 'trex_onboarded';

const SLIDES = [
    {
        key: 'welcome',
        gradient: 'from-gold-500 via-ink-900 to-ink-900',
        kind: 'hero',
        title: 'Welcome to',
        brand: 'Tre-X',
        subtitle: 'Your campus marketplace',
    },
    {
        key: 'safety',
        gradient: 'from-gold-500 via-teal-700 to-ink-900',
        kind: 'card',
        title: 'Buy & Sell With Confidence',
        subtitle: 'Verified university students only \u2014 no strangers, no scams.',
        icon: ShieldCheck,
    },
    {
        key: 'chat',
        gradient: 'from-ink-900 via-ink-800 to-slate-700',
        kind: 'card',
        title: 'Chat, Meet, Swap',
        subtitle: 'Message sellers directly and meet up safely, right on campus.',
        icon: MessageCircle,
    },
    {
        key: 'done',
        gradient: 'from-gold-500 via-purple-500 to-purple-700',
        kind: 'final',
        title: "You're All Set!",
        highlight: 'Set!',
        subtitle: 'Ready to see what\u2019s on campus?',
        features: [
            { icon: Star, title: 'Verified students', desc: 'Every account confirmed with a university email' },
            { icon: Heart, title: 'Zero listing fees', desc: 'Sell what you don\u2019t need, keep what you earn' },
        ],
    },
];

export default function OnboardingCarousel({ onFinish }) {
    const [index, setIndex] = useState(0);
    const [animKey, setAnimKey] = useState(0);
    const slide = SLIDES[index];
    const isFirst = index === 0;
    const isLast = index === SLIDES.length - 1;

    useEffect(() => {
        setAnimKey((k) => k + 1);
    }, [index]);

    const finish = () => {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        onFinish();
    };

    const goNext = () => {
        if (isLast) {
            finish();
            return;
        }
        setIndex((i) => i + 1);
    };

    const goBack = () => {
        if (!isFirst) setIndex((i) => i - 1);
    };

    return (
        <div className={`fixed inset-0 z-[200] flex flex-col bg-gradient-to-br ${slide.gradient} overflow-hidden`}>
            <style>{`
                @keyframes obFadeSlideUp {
                    0% { opacity: 0; transform: translateY(40px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .ob-anim { animation: obFadeSlideUp 700ms cubic-bezier(0.22,1,0.36,1) forwards; }
                .ob-anim-delay { animation: obFadeSlideUp 700ms cubic-bezier(0.22,1,0.36,1) 250ms forwards; opacity: 0; }

                @keyframes obPulseScale {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08); }
                }
                .ob-pulse { animation: obPulseScale 2200ms ease-in-out infinite; }

                @keyframes obConfettiFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-14px); }
                }
                .ob-confetti { animation: obConfettiFloat 2600ms ease-in-out infinite; }
            `}</style>

            {/* Skip */}
            {!isLast && (
                <div className="flex justify-end px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] relative z-10">
                    <button
                        onClick={finish}
                        className="text-sm font-semibold text-white/80 hover:text-white transition"
                    >
                        Skip
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
                {slide.kind === 'hero' && (
                    <div key={animKey} className="ob-anim flex flex-col items-center text-center">
                        <img src={LOGO_LIGHT} alt="Tre-X" className="ob-pulse h-20 w-auto mb-5 drop-shadow-lg" />
                        <p className="text-2xl font-bold text-white">{slide.title}</p>
                        <p className="text-5xl font-black italic text-white drop-shadow-md mt-1">{slide.brand}</p>
                        <p className="text-sm text-white/80 font-medium mt-4">{slide.subtitle}</p>
                    </div>
                )}

                {slide.kind === 'card' && (
                    <div
                        key={animKey}
                        className="ob-anim w-full max-w-sm rounded-3xl bg-white/15 border border-white/20 backdrop-blur-md shadow-xl p-8 text-center"
                    >
                        <div className="w-9 h-9 mx-auto rounded-full bg-white flex items-center justify-center mb-5" />
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                            <slide.icon size={28} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white drop-shadow-sm">{slide.title}</h2>
                        <p className="text-sm text-white/90 font-medium mt-3 leading-relaxed">{slide.subtitle}</p>
                    </div>
                )}

                {slide.kind === 'final' && (
                    <div key={animKey} className="ob-anim w-full max-w-sm relative">
                        <span className="ob-confetti absolute -top-6 -left-4">
                            <Sparkles size={18} className="text-amber-300" />
                        </span>
                        <span className="ob-confetti absolute -top-4 -right-4" style={{ animationDelay: '400ms' }}>
                            <Sparkles size={14} className="text-red-300" />
                        </span>

                        <div className="rounded-3xl bg-white/15 border border-white/20 backdrop-blur-md shadow-xl p-7 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-purple-600/20 flex items-center justify-center mb-4">
                                <CheckCircle2 size={32} className="text-purple-700" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-purple-800 drop-shadow-sm">
                                {slide.title.replace(slide.highlight, '')}
                                <span className="text-gold-500">{slide.highlight}</span>
                            </h2>
                            <p className="text-sm text-slate-900/80 font-semibold mt-2 mb-5">{slide.subtitle}</p>

                            <div className="space-y-2.5 text-left">
                                {slide.features.map((f) => (
                                    <div
                                        key={f.title}
                                        className="flex items-center gap-3 bg-white/60 rounded-2xl p-3 border border-white/40"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                                            <f.icon size={18} className="text-brand-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900">{f.title}</p>
                                            <p className="text-xs text-slate-600 mt-0.5">{f.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

              <div className="px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] relative z-10">
                <div className="flex items-center justify-center gap-1.5 mb-5">
                    {SLIDES.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                            }`}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-3 max-w-sm mx-auto">
                    {!isFirst && !isLast && (
                        <button
                            onClick={goBack}
                            className="flex-1 py-3 rounded-full bg-white/15 border border-white/25 text-white font-bold text-sm hover:bg-white/25 transition"
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={goNext}
                        className={`flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm transition ${
                            isLast
                                ? 'w-full bg-purple-700 hover:bg-purple-800 text-white'
                                : 'flex-1 bg-gold-500 hover:bg-gold-400 text-ink-900'
                        }`}
                    >
                        {isLast ? 'Get Started' : isFirst ? 'Continue' : 'Next'}
                        {!isLast && <ArrowRight size={15} />}
                    </button>
                </div>
            </div>
        </div>
    );
}