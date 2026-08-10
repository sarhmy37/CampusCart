import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import HeroSlideshow from '../components/HeroSlideshow';
import SellerRequiredModal from '../components/SellerRequiredModal';
import {
    ShieldCheck,
    MessageCircle,
    Handshake,
    GraduationCap,
    Sparkles,
    ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HERO_IMAGES = [
    '/knust-hero.jpg',
    '/IMG_8639 2.jpg',
    '/ATU.jpg',
    '/UHAS.jpg',
    '/UCC.jpg',
    '/UDS.jpg',
    '/UMAT.jpg',
    '/UOE.jpg',
    '/UPSA.jpg',
    '/PentUNI.jpg',
    '/KsTU.png',
    '/CU.jpg',
];

/*
=========================================================
CAMPUS LIFE GALLERY IMAGES
=========================================================

THIS IS WHERE YOU ADD YOUR IMAGES.

Each category can have as many images as you want.

Example:

images: [
    '/Shoe.jpg',
    '/Shoe2.jpg',
    '/Shoe3.jpg',
    '/Shoe4.jpg',
]

The images will automatically fade from one to another.
=========================================================
*/

const GALLERY = [
    {
        label: 'Sneakers in all sizes',
        images: [
            '/Shoe.jpg',
            '/Shoe2.jpg',
            '/Shoe3.jpg',
            '/Shoe4.jpg',
        ],
    },

    {
        label: 'Meet up on campus',
        images: [
            '/MeetOnCampus.jpg',
            '/MeetOnCampus2.jpg',
            '/MeetOnCampus3.jpg',
        ],
    },

    {
        label: 'Gadgets, gently used',
        images: [
            '/Gadget.jpg',
            '/Gadget2.jpg',
            '/Gadget3.jpg',
            '/Gadget4.jpg',
        ],
    },

    {
        label: 'Food',
        images: [
            '/Waakye.jpg',
            '/Waakye2.jpg',
            '/Waakye3.jpg',
        ],
    },
];

/*
=========================================================
GALLERY IMAGE COMPONENT
=========================================================
Each card has its own image slideshow.
*/

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
            {images.map((image, index) => (
                <img
                    key={`${image}-${index}`}
                    src={image}
                    alt={label}
                    className={`absolute inset-0 w-full h-full object-cover
                        transition-opacity duration-1000
                        ${index === currentIndex ? 'opacity-100' : 'opacity-0'}
                    `}
                />
            ))}
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
        icon: GraduationCap,
        label: 'Verified university students',
        desc: 'Every account is email-verified',
    },
    {
        icon: ShieldCheck,
        label: 'Built-in reviews',
        desc: 'Know who you’re dealing with',
    },
    {
        icon: Sparkles,
        label: 'Zero listing fees',
        desc: 'Sell what you don’t need, keep what you earn',
    },
];

export default function Home() {
    const { user } = useAuth();
    const [showSellerModal, setShowSellerModal] = useState(false);

    const handleStartSelling = (e) => {
        if (user && user.account_type === 'buyer') {
            e.preventDefault();
            setShowSellerModal(true);
        }
    };

    return (
        <div>

            {/* HERO */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0">
                    <HeroSlideshow images={HERO_IMAGES} />

                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/65 via-brand-800/40 to-accent-600/45" />
                </div>

                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl animate-pulse-slow" />

                <div className="absolute right-32 bottom-0 w-48 h-48 bg-accent-500/30 rounded-full blur-2xl" />

                <div className="absolute left-1/3 -bottom-24 w-64 h-64 bg-brand-300/20 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">

                    <Reveal>
                        <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                            <Sparkles size={13} />
                            Exclusively for university students
                        </span>
                    </Reveal>

                    <Reveal delay={100}>
                        <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] text-white max-w-2xl">
                            Buy & sell within your campus, safely.
                        </h1>
                    </Reveal>

                    <Reveal delay={200}>
                        <p className="mt-5 text-white/85 text-base sm:text-lg max-w-xl">
                            Verified university students only. Textbooks, gadgets, furniture and more —
                            right on campus, no middlemen, no scams.
                        </p>
                    </Reveal>

                    <Reveal delay={300}>
                        <div className="mt-8 flex flex-wrap gap-3">

                            <Link
                                to={user ? '/sell/new' : '/register'}
                                onClick={handleStartSelling}
                                className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold px-6 py-3 rounded-full hover:bg-brand-50 transition shadow-lg shadow-black/10"
                            >
                                Start selling
                                <ArrowRight size={18} />
                            </Link>

                            <Link
                                to="/browse"
                                className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur"
                            >
                                Browse listings
                            </Link>

                        </div>
                    </Reveal>
                </div>
            </section>


            {/* VALUE STRIP */}
            <section className="bg-white border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {VALUES.map((v, i) => (
                        <Reveal
                            key={v.label}
                            delay={i * 100}
                            className="flex items-center gap-3"
                        >
                            <div className="shrink-0 w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                                <v.icon size={20} />
                            </div>

                            <div>
                                <p className="font-bold text-slate-900 text-sm">
                                    {v.label}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {v.desc}
                                </p>
                            </div>
                        </Reveal>
                    ))}

                </div>
            </section>


            {/* HOW IT WORKS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

                <Reveal>
                    <p className="text-accent-600 font-bold text-sm tracking-wide uppercase">
                        How it works
                    </p>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                        From listing to handshake, in three steps
                    </h2>
                </Reveal>


                <div className="mt-10 grid sm:grid-cols-3 gap-6">

                    {STEPS.map((step, i) => (
                        <Reveal
                            key={step.title}
                            delay={i * 120}
                        >
                            <div className="h-full bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-brand-200 hover:shadow-md transition">

                                <div className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center mb-4">
                                    <step.icon size={20} />
                                </div>

                                <h3 className="font-bold text-slate-900">
                                    {step.title}
                                </h3>

                                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                    {step.desc}
                                </p>

                            </div>
                        </Reveal>
                    ))}

                </div>
            </section>


            {/* CAMPUS LIFE GALLERY */}
            <section className="bg-slate-50 py-16 overflow-hidden">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    <Reveal>
                        <p className="text-accent-600 font-bold text-sm tracking-wide uppercase">
                            Campus life
                        </p>

                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                            Made for how students actually trade
                        </h2>
                    </Reveal>


                    <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5">

                        {GALLERY.map((g, i) => (
                            <Reveal
                                key={g.label}
                                delay={i * 100}
                                className={i % 2 === 1 ? 'mt-8' : ''}
                            >

                                <div className="group relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-auto sm:h-64">

                                    {/* MULTI-IMAGE SLIDESHOW */}
                                    <GalleryImage
                                        images={g.images}
                                        label={g.label}
                                    />

                                    {/* DARK GRADIENT */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none" />

                                    {/* LABEL */}
                                    <p className="absolute bottom-3 left-4 text-white font-semibold text-sm z-10">
                                        {g.label}
                                    </p>

                                </div>

                            </Reveal>
                        ))}

                    </div>
                </div>
            </section>


            {/* FINAL CTA */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">

                <Reveal>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        Ready to see what's on campus?
                    </h2>

                    <p className="text-slate-500 mt-2">
                        Browse live listings from verified students near you.
                    </p>

                    <Link
                        to="/browse"
                        className="inline-flex items-center gap-2 mt-6 bg-brand-600 text-white font-bold px-6 py-3 rounded-full hover:bg-brand-700 transition"
                    >
                        Browse listings
                        <ArrowRight size={18} />
                    </Link>

                </Reveal>

            </section>


            <SellerRequiredModal
                open={showSellerModal}
                onClose={() => setShowSellerModal(false)}
            />

        </div>
    );
}
