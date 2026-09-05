import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { HERO_IMAGES, GALLERY } from '../data/media';
import HeroSlideshow from '../components/HeroSlideshow';
import SellerRequiredModal from '../components/SellerRequiredModal';
import { UserGroupIcon, StarIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import {
    ShieldCheck,
    MessageCircle,
    Handshake,
    Sparkles,
    ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HERO_TEXTS = [
    'Buy and Sell within your campus, Safely.',
    'Buy and Discover great deals around campus.',
    'Buy and Connect with students on your campus.',
];
const HERO_TYPE_SPEED_MS = 45;
const HERO_DELETE_SPEED_MS = 18;
const HERO_HOLD_MS = 7000;

function GalleryImage({ images, label }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((current) => (current + 1) % images.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [images.length]);

    return (
        <div className="absolute inset-0">
            {images.map((src, index) => {
                const isVideo = src.toLowerCase().endsWith('.mp4');
                const isActive = index === currentIndex;

                return isVideo ? (
                    <video
                        key={`${src}-${index}`}
                        src={src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover
                            transition-opacity duration-1000
                            ${isActive ? 'opacity-100' : 'opacity-0'}
                        `}
                    />
                ) : (
                    <img
                        key={`${src}-${index}`}
                        src={src}
                        alt={label}
                        className={`absolute inset-0 w-full h-full object-cover
                            transition-opacity duration-1000
                            ${isActive ? 'opacity-100' : 'opacity-0'}
                        `}
                    />
                );
            })}
        </div>
    );
}

const STEPS = [
    {
        icon: ShieldCheck,
        title: 'Verify with your university email',
        desc: 'Sign up in seconds. Your university email confirms you’re a real student — no strangers, no spam accounts.',
    },
    {
        icon: MessageCircle,
        title: 'Chat, ask, agree',
        desc: 'Message the seller directly. Ask about condition, haggle a little, agree a spot on campus.',
    },
    {
        icon: Handshake,
        title: 'Meet up & swap',
        desc: 'Pay however you’ve agreed, hand it over, leave a review. Simple as that.',
    },
];

const VALUES = [
    {
        icon: UserGroupIcon,
        label: 'Verified university students',
        desc: 'Every account is email-verified',
    },
    {
        icon: StarIcon,
        label: 'Built-in reviews',
        desc: 'Know who you’re dealing with',
    },
    {
        icon: CurrencyDollarIcon,
        label: 'Zero listing fees',
        desc: 'Sell what you don’t need, keep what you earn',
    },
];

export default function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showSellerModal, setShowSellerModal] = useState(false);

    // ── Hero heading typewriter cycle ──
    const [heroPhase, setHeroPhase] = useState('typing'); // 'typing' | 'deleting'
    const [heroTextIndex, setHeroTextIndex] = useState(0);
    const [heroDisplay, setHeroDisplay] = useState('');

    useEffect(() => {
        if (heroPhase !== 'typing') return;
        const fullText = HERO_TEXTS[heroTextIndex];
        if (heroDisplay.length >= fullText.length) {
            const t = setTimeout(() => setHeroPhase('deleting'), HERO_HOLD_MS);
            return () => clearTimeout(t);
        }
        const t = setTimeout(() => {
            setHeroDisplay(fullText.slice(0, heroDisplay.length + 1));
        }, HERO_TYPE_SPEED_MS);
        return () => clearTimeout(t);
    }, [heroPhase, heroDisplay, heroTextIndex]);

    useEffect(() => {
        if (heroPhase !== 'deleting') return;
        if (heroDisplay.length === 0) {
            setHeroTextIndex((i) => (i + 1) % HERO_TEXTS.length);
            setHeroPhase('typing');
            return;
        }
        const t = setTimeout(() => {
            setHeroDisplay((d) => d.slice(0, -1));
        }, HERO_DELETE_SPEED_MS);
        return () => clearTimeout(t);
    }, [heroPhase, heroDisplay]);

    // ── NEW: Navigate with auth check ──
    const handleNavigate = (path, requireSeller = false) => {
        if (!user) {
            // Not logged in → go to register
            navigate(requireSeller ? '/register?tab=seller' : '/register');
            return;
        }

        if (requireSeller && user.account_type === 'buyer') {
            // Logged in as buyer, trying to sell → show seller modal
            setShowSellerModal(true);
            return;
        }

        // Logged in and eligible → go to the target page
        navigate(path);
    };

    const handleBrowseClick = () => {
        if (user) {
            navigate('/browse');
        } else {
            navigate('/register');
        }
    };

    const handleStartSellingClick = () => {
        if (!user) {
            navigate('/register?tab=seller');
            return;
        }

        if (user.account_type === 'buyer') {
            setShowSellerModal(true);
            return;
        }

        navigate('/sell/new');
    };

    return (
        <div>
            <style>{`
                @keyframes heroCursorBlink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
                .hero-cursor-blink {
                    animation: heroCursorBlink 1s step-end infinite;
                }
            `}</style>

            {/* HERO */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0">
                    <HeroSlideshow images={HERO_IMAGES} />

                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/65 via-brand-800/40 to-accent-600/45 dark:from-ink-900/80 dark:via-ink-900/55 dark:to-brand-900/40" />
                </div>

                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl animate-pulse-slow" />

                <div className="absolute right-32 bottom-0 w-48 h-48 bg-accent-500/30 dark:bg-brand-500/20 rounded-full blur-2xl" />

                <div className="absolute left-1/3 -bottom-24 w-64 h-64 bg-brand-300/20 dark:bg-brand-300/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">

                    <Reveal>
                        <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                            <Sparkles size={13} />
                            Exclusively for university students
                        </span>
                    </Reveal>

                    <Reveal delay={100}>
                        <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] text-white max-w-2xl min-h-[2.1em] sm:min-h-[2.1em] lg:min-h-[1.05em]">
                            {heroDisplay}
                            <span className="inline-block w-[3px] sm:w-[4px] h-[0.9em] bg-white ml-1 align-middle hero-cursor-blink" />
                        </h1>
                    </Reveal>

                    <Reveal delay={200}>
                        <p className="mt-5 text-white/85 text-base sm:text-lg max-w-xl">
                            Verified university students only. Textbooks, gadgets, furniture and more —
                            right on campus, no middlemen, no scams.
                        </p>
                    </Reveal>

                    <Reveal delay={300}>
                        <div className="mt-8 flex flex-nowrap gap-2 sm:gap-3">

                            {/* ── START SELLING ── */}
                            <button
                                onClick={handleStartSellingClick}
                                className="inline-flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-brand-500 text-brand-700 dark:text-ink-900 font-bold px-4 py-2 sm:px-6 sm:py-3 rounded-full hover:bg-brand-50 dark:hover:bg-brand-400 transition shadow-lg shadow-black/10 text-xs sm:text-base whitespace-nowrap"
                            >
                                Start selling
                                <ArrowRight className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
                            </button>

                            {/* ── BROWSE LISTINGS ── */}
                            <button
                                onClick={handleBrowseClick}
                                className="inline-flex items-center gap-1.5 sm:gap-2 bg-white/10 text-white font-semibold px-4 py-2 sm:px-6 sm:py-3 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-base whitespace-nowrap"
                            >
                                Browse listings
                            </button>

                        </div>
                    </Reveal>
                </div>
            </section>


            {/* VALUE STRIP */}
            <section className="bg-white dark:bg-ink-800 border-b border-slate-100 dark:border-ink-600">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {VALUES.map((v, i) => (
                        <Reveal
                            key={v.label}
                            delay={i * 100}
                            className="flex items-center gap-3"
                        >
                            <div className="shrink-0 w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                                <v.icon className="w-5 h-5" />
                            </div>

                            <div>
                                <p className="font-bold text-slate-900 dark:text-brand-50 text-sm">
                                    {v.label}
                                </p>

                                <p className="text-xs text-slate-500 dark:text-brand-200/50">
                                    {v.desc}
                                </p>
                            </div>
                        </Reveal>
                    ))}

                </div>
            </section>


            {/* HOW IT WORKS - CLEAN, NO BOXES */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

                <Reveal>
                    <p className="text-accent-600 dark:text-brand-400 font-bold text-sm tracking-wide uppercase">
                        How it works
                    </p>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-brand-50 mt-1">
                        From listing to handshake, in three steps
                    </h2>
                </Reveal>


                                <div className="mt-10 grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-12 relative">
                    
                    {/* Subtle vertical dividing lines on desktop */}
                    <div className="hidden sm:block absolute top-10 left-1/3 w-px h-32 bg-slate-200 dark:bg-ink-700 -translate-x-1/2" />
                    <div className="hidden sm:block absolute top-10 left-2/3 w-px h-32 bg-slate-200 dark:bg-ink-700 -translate-x-1/2" />

                    {STEPS.map((step, i) => (
                        <Reveal
                            key={step.title}
                            delay={i * 120}
                        >
                            <div className="relative flex flex-col items-center text-center sm:items-center sm:text-center">
                                
                                {/* Step Number */}
                                <span className="text-3xl sm:text-6xl font-black text-brand-200 dark:text-ink-700 select-none leading-none mb-1 sm:mb-2">
                                    {i + 1}
                                </span>

                                {/* Title */}
                                <h3 className="font-bold text-xs sm:text-lg text-slate-900 dark:text-brand-50 mt-1">
                                    {step.title}
                                </h3>

                                {/* Description */}
                                <p className="text-[10px] sm:text-sm text-slate-500 dark:text-brand-200/50 mt-1 sm:mt-2 leading-snug sm:leading-relaxed max-w-[110px] sm:max-w-xs">
                                    {step.desc}
                                </p>

                            </div>
                        </Reveal>
                    ))}

                </div>
            </section>


            {/* CAMPUS LIFE GALLERY */}
            <section className="bg-slate-50 dark:bg-ink-900 py-16 overflow-hidden">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    <Reveal>
                        <p className="text-accent-600 dark:text-brand-400 font-bold text-sm tracking-wide uppercase">
                            Campus life
                        </p>

                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-brand-50 mt-1">
                            Made for how students actually trade
                        </h2>
                    </Reveal>


                    <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5">
                        {GALLERY.map((g, i) => {
                            const mixedMedia = [
                                { type: 'image', src: g.images[0] },
                                { type: 'image', src: g.images[1] },
                                { type: 'image', src: g.images[2] },
                                { type: 'image', src: g.images[3] },
                                { type: 'video', src: g.video },
                            ];

                            const shuffled = mixedMedia.sort(() => Math.random() - 0.5);

                            return (
                                <Reveal
                                    key={g.label}
                                    delay={i * 100}
                                    className={i % 2 === 1 ? 'mt-8' : ''}
                                >
                                    <div className="group relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-auto sm:h-64 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/20 cursor-pointer">
                                        
                                        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                                            {shuffled.slice(0, 4).map((item, idx) => (
                                                <div key={idx} className="w-full h-full relative overflow-hidden border border-white/5">
                                                    {item.type === 'image' ? (
                                                        <img 
                                                            src={item.src} 
                                                            alt="" 
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                    ) : (
                                                        <video 
                                                            autoPlay 
                                                            loop 
                                                            muted 
                                                            playsInline 
                                                            className="w-full h-full object-cover"
                                                        >
                                                            <source src={item.src} type="video/mp4" />
                                                        </video>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none" />
                                        <p className="absolute bottom-3 left-4 text-white font-semibold text-sm z-10">
                                            {g.label}
                                        </p>

                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* FINAL CTA - ORIGINAL STYLE RESTORED */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">

                <Reveal>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-brand-50">
                        Ready to see what's on campus?
                    </h2>

                    <p className="text-slate-500 dark:text-brand-200/50 mt-2">
                        Browse live listings from verified students near you.
                    </p>

                    <button
                        onClick={handleBrowseClick}
                        className="inline-flex items-center gap-2 mt-6 bg-brand-600 dark:bg-brand-500 text-white dark:text-ink-900 font-bold px-6 py-3 rounded-full hover:bg-brand-700 dark:hover:bg-brand-400 transition"
                    >
                        Browse listings
                        <ArrowRight size={18} />
                    </button>

                </Reveal>

            </section>


            <SellerRequiredModal
                open={showSellerModal}
                onClose={() => setShowSellerModal(false)}
            />

        </div>
    );
}