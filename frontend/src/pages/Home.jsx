import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { HERO_IMAGES, GALLERY } from '../data/media';
import api from '../api/client';
import HeroSlideshow from '../components/HeroSlideshow';
import SellerRequiredModal from '../components/SellerRequiredModal';
import { UserGroupIcon, StarIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import {
    ShieldCheck,
    MessageCircle,
    Handshake,
    Sparkles,
    ArrowRight,
    Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const HERO_TEXTS = [
    'Buy and Sell within your campus,Safely.',
    'Buy and Discover great deals around campus.',
    'Buy and Connect with students on your campus.',
];
const HERO_TYPE_SPEED_MS = 45;
const HERO_DELETE_SPEED_MS = 25;
const HERO_HOLD_MS = 8000;

// ── CTA button label-swap animation timings ──
// "Start selling" ⇄ "Offer Services" (arrow vibrates+grows, snaps back, flips 180°, slides out/in)
// "Browse listings" ⇄ "Browse Services" (fast backspace + retype, no cursor)
const CTA_HOLD_MS = 6000;      // how long each pair of labels sits before the next swap
const CTA_VIBRATE_MS = 700;     // arrow vibrating while growing
const CTA_SHRINK_MS = 100;      // arrow snapping back to normal size (fast)
const CTA_ROTATE_MS = 450;      // arrow flipping 180°
const CTA_SLIDE_MS = 500;       // old label sliding out / new label sliding in
const CTA_DELETE_CHAR_MS = 20;  // per-character backspace speed (fast)
const CTA_TYPE_CHAR_MS = 45;    // per-character type speed

const SELL_LABEL_DEFAULT = 'Start selling';
const SELL_LABEL_ALT = 'Offer Services';
const BROWSE_LABEL_DEFAULT = 'Browse listings';
const BROWSE_LABEL_ALT = 'Browse Services';

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

const PLANS = [
    {
        name: 'Free',
        price: '0',
        period: 'forever',
        highlight: false,
        icon: null,
        buyerBenefits: [
            'Browse and message any seller',
            'Save items you like',
            'Leave and read reviews',
        ],
        sellerBenefits: [
            'Up to 10 active listings',
            'Standard 1.5% fee per sale',
            'Basic store page',
        ],
    },
    {
        name: 'Pro',
        price: '25',
        period: '/month',
        highlight: true,
        icon: 'pro',
        buyerBenefits: [
            '24-hour priority support',
            'See new listings first',
        ],
        sellerBenefits: [
            'Keep 100% of every sale — no platform fee',
            'Up to 30 active listings',
            'Listings shown first in search',
            'Pro Seller badge',
            'Upgraded store page with social sharing',
        ],
    },
    {
        name: 'Premium',
        price: '240',
        period: '/year',
        highlight: false,
        icon: 'premium',
        buyerBenefits: [
            'Everything in Pro',
            'Same-day dedicated support line',
        ],
        sellerBenefits: [
            'Keep 100% of every sale — no platform fee',
            'Unlimited active listings',
            'Listings shown first in search',
            'Premium Seller badge',
            'Store page shown at the very top of search',
        ],
    },
];

export default function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showSellerModal, setShowSellerModal] = useState(false);
    const [subscribingPlan, setSubscribingPlan] = useState(null);
    const pricingRef = useRef(null);

    // Scroll to the pricing section when arriving via a "View/Renew plan" link
    // (e.g. from Settings' PlanCard). Clears the state after scrolling so a
    // manual refresh or back-navigation doesn't re-trigger it.
    useEffect(() => {
        if (location.state?.scrollToPricing && pricingRef.current) {
            pricingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

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

    // ── CTA button label-swap animation ──
    // "Start selling →" morphs into "Offer Services →" (and back), and once that
    // finishes, "Browse listings" backspaces/retypes into "Browse Services" (and back).
    // sellPhase drives the arrow + slide animation:
    //   idle -> vibrate (arrow shakes + grows) -> shrink (snaps back fast)
    //        -> rotate (arrow flips 180°) -> slide (old label slides out, new slides in) -> idle
    const [sellPhase, setSellPhase] = useState('idle');
    const [sellIsAlt, setSellIsAlt] = useState(false); // false: "Start selling", true: "Offer Services"
    // browsePhase drives the typewriter swap: idle -> deleting -> typing -> idle
    const [browsePhase, setBrowsePhase] = useState('idle');
    const [browseDisplay, setBrowseDisplay] = useState(BROWSE_LABEL_DEFAULT);
    const browseIsAltRef = useRef(false); // internal tracker, doesn't need to trigger renders

    useEffect(() => {
        let cancelled = false;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        const deleteText = async (text) => {
            let current = text;
            while (current.length > 0) {
                if (cancelled) return;
                current = current.slice(0, -1);
                setBrowseDisplay(current);
                await sleep(CTA_DELETE_CHAR_MS);
            }
        };

        const typeText = async (text) => {
            let current = '';
            while (current.length < text.length) {
                if (cancelled) return;
                current = text.slice(0, current.length + 1);
                setBrowseDisplay(current);
                await sleep(CTA_TYPE_CHAR_MS);
            }
        };

        const runCycle = async () => {
            while (!cancelled) {
                await sleep(CTA_HOLD_MS);
                if (cancelled) return;

                // "Start selling" ⇄ "Offer Services"
                setSellPhase('vibrate');
                await sleep(CTA_VIBRATE_MS);
                if (cancelled) return;

                setSellPhase('shrink');
                await sleep(CTA_SHRINK_MS);
                if (cancelled) return;

                setSellPhase('rotate');
                await sleep(CTA_ROTATE_MS);
                if (cancelled) return;

                setSellPhase('slide');
                await sleep(CTA_SLIDE_MS);
                if (cancelled) return;

                setSellIsAlt((prev) => !prev);
                setSellPhase('idle');

                // "Browse listings" ⇄ "Browse Services" — only starts once the above settles
                const currentBrowseLabel = browseIsAltRef.current ? BROWSE_LABEL_ALT : BROWSE_LABEL_DEFAULT;
                const nextBrowseLabel = browseIsAltRef.current ? BROWSE_LABEL_DEFAULT : BROWSE_LABEL_ALT;

                setBrowsePhase('deleting');
                await deleteText(currentBrowseLabel);
                if (cancelled) return;

                setBrowsePhase('typing');
                await typeText(nextBrowseLabel);
                if (cancelled) return;

                browseIsAltRef.current = !browseIsAltRef.current;
                setBrowsePhase('idle');
            }
        };

        runCycle();
        return () => { cancelled = true; };
    }, []);

    const sellCurrentLabel = sellIsAlt ? SELL_LABEL_ALT : SELL_LABEL_DEFAULT;
    const sellNextLabel = sellIsAlt ? SELL_LABEL_DEFAULT : SELL_LABEL_ALT;

    const sellArrowStyle = (() => {
        if (sellPhase === 'vibrate') {
            // Held here (matching the keyframe's final frame) so the next phase
            // has something to visibly shrink FROM.
            return { transition: 'none', transform: 'scale(1.75) rotate(0deg)' };
        }
        if (sellPhase === 'shrink') {
            return { transition: `transform ${CTA_SHRINK_MS}ms ease-in`, transform: 'scale(1) rotate(0deg)' };
        }
        if (sellPhase === 'rotate' || sellPhase === 'slide') {
            return { transition: `transform ${CTA_ROTATE_MS}ms ease-in-out`, transform: 'scale(1) rotate(180deg)' };
        }
        return { transition: 'none', transform: 'scale(1) rotate(0deg)' };
    })();

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

const handlePlanClick = async (planName) => {
    const currentPlan = (user?.plan || 'free').toLowerCase();
    const isCurrentPlanActive = user?.plan && user.plan !== 'free' &&
        user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

    // Locked in on an active paid plan — can't switch to anything else
    // (including Free or the other paid plan) until it expires.
    if (isCurrentPlanActive && planName.toLowerCase() !== currentPlan) {
        toast.error(`You're on the ${user.plan} plan until it expires — you can switch once it ends.`);
        return;
    }

    if (planName.toLowerCase() === 'free') {
        handleBrowseClick();
        return;
    }

    if (!user) {
        navigate('/register');
        return;
    }

    try {
        setSubscribingPlan(planName);
        const res = await api.post('/subscriptions/initiate', {
            plan: planName.toLowerCase(),
        });
        window.location.href = res.data.authorization_url;
    } catch (err) {
        toast.error(err.response?.data?.error || 'Could not start payment. Please try again.');
    } finally {
        setSubscribingPlan(null);
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

    // Shuffle each gallery tile's media ONCE per mount. Previously this ran
    // inline during render, so it re-shuffled on every re-render — including
    // every ~25ms while the hero typewriter was animating — which is why the
    // images looked like they were constantly reshuffling/flickering.
    const shuffledGallery = useMemo(
        () =>
            (GALLERY || []).map((g) => {
                const images = g.images || [];
                const mixedMedia = [
                    ...images.slice(0, 4).map((src) => ({ type: 'image', src })),
                    ...(g.video ? [{ type: 'video', src: g.video }] : []),
                ];
                return { ...g, shuffled: [...mixedMedia].sort(() => Math.random() - 0.5) };
            }),
        [] // GALLERY is a static import — shuffle once and keep it stable for the life of the page
    );

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

                @keyframes arrowVibrateGrow {
                    0% { transform: scale(1) rotate(0deg); }
                    10% { transform: scale(1.08) rotate(-8deg); }
                    20% { transform: scale(1.16) rotate(8deg); }
                    30% { transform: scale(1.25) rotate(-8deg); }
                    40% { transform: scale(1.34) rotate(8deg); }
                    50% { transform: scale(1.43) rotate(-6deg); }
                    60% { transform: scale(1.52) rotate(6deg); }
                    70% { transform: scale(1.61) rotate(-4deg); }
                    80% { transform: scale(1.68) rotate(4deg); }
                    90% { transform: scale(1.73) rotate(-2deg); }
                    100% { transform: scale(1.75) rotate(0deg); }
                }
                .arrow-vibrate-grow {
                    animation: arrowVibrateGrow ${CTA_VIBRATE_MS}ms ease-in forwards;
                    transform-origin: center;
                }
            `}</style>

            {/* HERO */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0">
                    <HeroSlideshow images={HERO_IMAGES} />

<div className="absolute inset-0 bg-gradient-to-br from-ink-900/60 via-ink-800/35 to-brand-600/30 dark:from-ink-900/80 dark:via-ink-900/55 dark:to-gold-900/40" />                </div>

                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl animate-pulse-slow" />

                <div className="absolute right-32 bottom-0 w-48 h-48 bg-accent-500/30 dark:bg-gold-500/20 rounded-full blur-2xl" />

                <div className="absolute left-1/3 -bottom-24 w-64 h-64 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">

                    <Reveal>
                        <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/20">
                            <Sparkles size={13} />
                            Exclusively for university students
                        </span>
                    </Reveal>

                    <Reveal delay={100}>
                        {/* MOBILE — static, no typewriter */}
                        <h1 className="sm:hidden mt-5 text-4xl font-extrabold leading-[1.05] text-white max-w-2xl">
                            Buy and Sell within your campus, Safely.
                        </h1>

                        {/* DESKTOP — animated typewriter */}
                        <h1 className="hidden sm:block mt-5 text-5xl lg:text-6xl font-extrabold leading-[1.05] text-white max-w-2xl min-h-[2.1em] lg:min-h-[1.05em]">
                            {heroDisplay}
                            <span className="inline-block w-[4px] h-[0.9em] bg-white ml-1 align-middle hero-cursor-blink" />
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

                            {/* ── START SELLING / OFFER SERVICES ── */}
                            <button
                                onClick={handleStartSellingClick}
                                className="relative overflow-hidden inline-flex items-center justify-center w-[150px] sm:w-[188px] bg-white dark:bg-gold-500 text-brand-700 dark:text-ink-900 font-bold px-4 py-1.5 sm:px-6 sm:py-2 rounded-full hover:bg-brand-50 dark:hover:bg-gold-400 transition shadow-lg shadow-black/10 text-xs sm:text-base whitespace-nowrap"
                            >
                                {/* invisible spacer — gives the button its height; the two labels below are absolutely positioned on top of it */}
                                <span className="invisible flex items-center justify-center gap-1.5 sm:gap-2">
                                    {sellCurrentLabel}
                                    <ArrowRight className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] shrink-0" />
                                </span>

                                {/* current label — slides out to the left */}
                                <span
                                    className="absolute inset-0 flex items-center justify-center gap-1.5 sm:gap-2"
                                    style={{
                                        transition: sellPhase === 'slide' ? `transform ${CTA_SLIDE_MS}ms ease-in-out` : 'none',
                                        transform: sellPhase === 'slide' ? 'translateX(-100%)' : 'translateX(0%)',
                                    }}
                                >
                                    {sellCurrentLabel}
                                    <ArrowRight
                                        className={`w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] shrink-0 ${sellPhase === 'vibrate' ? 'arrow-vibrate-grow' : ''}`}
                                        style={sellArrowStyle}
                                    />
                                </span>

                                {/* next label — starts fully offscreen to the right, slides in */}
                                <span
                                    className="absolute inset-0 flex items-center justify-center gap-1.5 sm:gap-2"
                                    style={{
                                        transition: sellPhase === 'slide' ? `transform ${CTA_SLIDE_MS}ms ease-in-out` : 'none',
                                        transform: sellPhase === 'slide' ? 'translateX(0%)' : 'translateX(100%)',
                                    }}
                                >
                                    {sellNextLabel}
                                    <ArrowRight
                                        className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px] shrink-0"
                                        style={{ transform: 'scale(1) rotate(0deg)' }}
                                    />
                                </span>
                            </button>

                            {/* ── BROWSE LISTINGS / BROWSE SERVICES ── */}
                            <button
                                onClick={handleBrowseClick}
                                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 w-[150px] sm:w-[188px] bg-white/10 text-white font-semibold px-4 py-1.5 sm:px-6 sm:py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-base whitespace-nowrap"
                            >
                                {browseDisplay}
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
                            <div className="shrink-0 w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                <v.icon className="w-5 h-5" />
                            </div>

                            <div>
                                <p className="font-bold text-slate-900 dark:text-gold-50 text-sm">
                                    {v.label}
                                </p>

                                <p className="text-xs text-slate-500 dark:text-gold-200/50">
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
                    <p className="text-accent-600 dark:text-gold-400 font-bold text-sm tracking-wide uppercase">
                        How it works
                    </p>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-gold-50 mt-1">
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
                                <h3 className="font-bold text-xs sm:text-lg text-slate-900 dark:text-gold-50 mt-1">
                                    {step.title}
                                </h3>

                                {/* Description */}
                                <p className="text-[10px] sm:text-sm text-slate-500 dark:text-gold-200/50 mt-1 sm:mt-2 leading-snug sm:leading-relaxed max-w-[110px] sm:max-w-xs">
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
                        <p className="text-accent-600 dark:text-gold-400 font-bold text-sm tracking-wide uppercase">
                            Campus life
                        </p>

                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-gold-50 mt-1">
                            Made for how students actually trade
                        </h2>
                    </Reveal>


                    <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5">
                        {shuffledGallery.map((g, i) => {
                            const { shuffled } = g;

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

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-gold-50">
                        Ready to see what's on campus?
                    </h2>

                    <p className="text-slate-500 dark:text-gold-200/50 mt-2">
                        Browse live listings from verified students near you.
                    </p>

                    <button
                        onClick={handleBrowseClick}
                        className="inline-flex items-center gap-2 mt-6 bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 font-bold px-6 py-3 rounded-full hover:bg-brand-700 dark:hover:bg-gold-400 transition"
                    >
                        Browse listings
                        <ArrowRight size={18} />
                    </button>

                </Reveal>

            </section>

            {/* PRICING / SUBSCRIPTION */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="h-px bg-slate-200 dark:bg-ink-700" />
            </div>

           <section ref={pricingRef} className="relative overflow-hidden bg-slate-50 dark:bg-gradient-to-b dark:from-ink-900 dark:via-ink-800 dark:to-ink-900 py-16 sm:py-20">
                <div className="absolute -right-20 -top-24 w-72 h-72 bg-brand-500/10 dark:bg-gold-500/10 rounded-full blur-3xl" />
                <div className="absolute -left-16 bottom-0 w-64 h-64 bg-accent-500/10 dark:bg-gold-700/10 rounded-full blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Reveal>
                        <p className="text-accent-600 dark:text-gold-400 font-bold text-sm tracking-wide uppercase text-center">
                            Plans
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-center mt-1">
                            Pick the plan that fits how you trade
                        </h2>
                        <p className="text-slate-500 dark:text-white/60 text-sm text-center mt-2 max-w-xl mx-auto">
                            Every plan works for both buyers and sellers — upgrade any time as your activity on campus grows.
                        </p>
                    </Reveal>

                    <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
                        {PLANS.map((plan, i) => (
                            <Reveal
                                key={plan.name}
                                delay={i * 100}
                                className={i === 2 ? 'col-span-2 sm:col-span-1' : ''}
                            >
                                <div
                                    className={`relative h-full rounded-2xl p-3 sm:p-6 border backdrop-blur-sm transition ${
                                        plan.highlight
                                            ? 'bg-white dark:bg-white/[0.06] border-brand-300 dark:border-gold-500/40 shadow-lg shadow-brand-500/10'
                                            : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10'
                                    }`}
                                >
                                    {plan.highlight && (
                                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold px-3 py-1 rounded-full">
                                            Most popular
                                        </span>
                                    )}

                                    <h3 className="flex items-center justify-center gap-1.5 text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white text-center">
                                        {plan.icon === 'premium' && (
                                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 fill-purple-500 shrink-0" />
                                        )}
                                        {plan.icon === 'pro' && (
                                            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 fill-blue-500 shrink-0" />
                                        )}
                                        {plan.name}
                                    </h3>
                                    <div className="flex items-end justify-center gap-1 mt-1 sm:mt-2">
                                        <span className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white">GHS {plan.price}</span>
                                        <span className="text-slate-500 dark:text-white/50 text-[10px] sm:text-sm mb-0.5 sm:mb-1">{plan.period}</span>
                                    </div>

                                    <div className="mt-3 pt-3 sm:mt-6 sm:pt-5 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-2 sm:gap-4">
                                        <div>
                                            <p className="text-[9px] sm:text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wide mb-1 sm:mb-2">Buyers</p>
                                            <ul className="space-y-1 sm:space-y-1.5">
                                                {plan.buyerBenefits.map((b) => (
                                                    <li key={b} className="flex items-start gap-1 sm:gap-1.5 text-[9px] sm:text-sm text-slate-600 dark:text-white/80 leading-tight">
                                                        <span className="text-brand-500 dark:text-gold-400 mt-0.5 shrink-0">✓</span>
                                                        {b}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-[9px] sm:text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wide mb-1 sm:mb-2">Sellers</p>
                                            <ul className="space-y-1 sm:space-y-1.5">
                                                {plan.sellerBenefits.map((b) => (
                                                    <li key={b} className="flex items-start gap-1 sm:gap-1.5 text-[9px] sm:text-sm text-slate-600 dark:text-white/80 leading-tight">
                                                        <span className="text-brand-500 dark:text-gold-400 mt-0.5 shrink-0">✓</span>
                                                        {b}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {(() => {
                                        const currentPlan = (user?.plan || 'free').toLowerCase();
                                        const isCurrent = plan.name.toLowerCase() === currentPlan;

                                        if (isCurrent) {
                                            return (
                                                <button
                                                    disabled
                                                    className="w-full mt-3 sm:mt-6 py-1.5 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-white/50 cursor-not-allowed"
                                                >
                                                    Current plan
                                                </button>
                                            );
                                        }

                                        return (
                                            <button
                                                onClick={() => handlePlanClick(plan.name)}
                                                disabled={subscribingPlan === plan.name}
                                                className={`w-full mt-3 sm:mt-6 py-1.5 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                                    plan.highlight
                                                        ? 'bg-brand-500 dark:bg-gold-500 text-white dark:text-ink-900 hover:bg-brand-600 dark:hover:bg-gold-400'
                                                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
                                                }`}
                                            >
                                                {subscribingPlan === plan.name
                                                    ? 'Redirecting…'
                                                    : plan.price === '0' ? 'Get started free' : `Choose ${plan.name}`}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* SITE FOOTER */}
<footer className="bg-white dark:bg-ink-900 border-t border-slate-200 dark:border-white/10 py-10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-white/50 text-xs">🌍</span>
                <select
                    defaultValue="GH"
                    className="bg-transparent text-slate-600 dark:text-white/70 text-xs font-medium border border-slate-200 dark:border-white/15 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-400 dark:focus:border-white/30"
                >
                    <option value="GH" className="text-slate-900">Ghana (English)</option>
                    <option value="NG" className="text-slate-900">Nigeria (English)</option>
                    <option value="KE" className="text-slate-900">Kenya (English)</option>
                    <option value="ZA" className="text-slate-900">South Africa (English)</option>
                </select>
            </div>

            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-white/60">
                <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition">Terms of Service</Link>
                <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition">Privacy Policy</Link>
                <Link to="/help" className="hover:text-slate-900 dark:hover:text-white transition">Help Center</Link>
                <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white transition">Contact Us</Link>
            </nav>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-slate-400 dark:text-white/40">© {new Date().getFullYear()} Tre-X. Made for students, across Africa.</p>
            <p className="text-xs text-slate-400 dark:text-white/40">Prices shown in GHS.</p>
        </div>
    </div>
</footer>


            <SellerRequiredModal
                open={showSellerModal}
                onClose={() => setShowSellerModal(false)}
            />

        </div>
    );
}