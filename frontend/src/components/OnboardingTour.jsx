import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, MessageCircle, MapPin, ShieldCheck, Gift, Package, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/*
 * SCREENSHOTS
 * Put your app screenshots in  public/tour/  (full phone screenshots, PNG or JPG).
 * The phone frame is drawn for you, so do NOT add a frame to the image.
 *
 * Each step's `shot` controls the crop, so you never have to edit the image itself:
 *   src:  path to the image, e.g. '/tour/browse.png'
 *   pos:  which part of the screenshot to show, 'x% y%'. '50% 0%' = top, '50% 100%' = bottom.
 *   zoom: 1 = whole width visible, 1.5 = zoomed in 50%, 2 = zoomed in 2x.
 * If an image is missing or fails to load, the step falls back to the big stamp.
 */

const SHOTS = {
    browse:   { src: '/tour/browse.png',   pos: '50% 20%', zoom: 1 },
    services: { src: '/tour/services.png', pos: '50% 30%', zoom: 1 },
    pay:      { src: '/tour/pay.png',      pos: '50% 60%', zoom: 1 },
    refer:    { src: '/tour/refer.png',    pos: '50% 30%', zoom: 1 },
    list:     { src: '/tour/list.png',     pos: '50% 30%', zoom: 1 },
    payout:   { src: '/tour/payout.png',   pos: '50% 30%', zoom: 1 },
};

const BUYER_STEPS = [
    {
        icon: Sparkles,
        stamp: 'Arrival',
        title: (n) => `Welcome to Tre-X, ${n}`,
        body: 'Tre-X is where students on your campus buy, sell and book services. This short tour collects five stamps in your passport.',
    },
    {
        icon: MessageCircle,
        stamp: 'Browse',
        shot: SHOTS.browse,
        title: () => 'Find it, then ask about it',
        body: 'Browse listings from verified students, save the ones you like, and message the seller before you meet.',
    },
    {
        icon: MapPin,
        stamp: 'Services',
        shot: SHOTS.services,
        title: () => 'Book a service, then follow the map',
        body: 'Need a tutor, a haircut or a print job? Book a fellow student and track your way to the service point.',
    },
    {
        icon: ShieldCheck,
        stamp: 'Pay',
        shot: SHOTS.pay,
        title: () => 'Pay safely, confirm on delivery',
        body: 'Pay through Paystack. Confirm the order once you have your item, and that is when the seller gets paid.',
    },
    {
        icon: Gift,
        stamp: 'Refer',
        shot: SHOTS.refer,
        title: () => 'Bring a friend, save on a plan',
        body: 'Share your referral code. Each friend who signs up gives you 25% off Pro or Premium for 24 hours, plus 12 more hours for every extra friend.',
    },
];

const SELLER_STEPS = [
    BUYER_STEPS[0],
    {
        icon: Package,
        stamp: 'List',
        shot: SHOTS.list,
        title: () => 'List an item in a minute',
        body: 'Add photos and a price, then set your delivery fee for on, near and far campus.',
    },
    {
        icon: MapPin,
        stamp: 'Services',
        shot: SHOTS.services,
        title: () => 'Offer a service too',
        body: 'Students can book you and follow the map to your service point.',
    },
    {
        icon: Wallet,
        stamp: 'Payout',
        shot: SHOTS.payout,
        title: () => 'Get paid when buyers confirm',
        body: 'Earnings show in your Payouts tab. Request a withdrawal any time, and report it there if it does not arrive.',
    },
    BUYER_STEPS[4],
];

const ROTATIONS = [-8, 6, -4, 9, -6];

// Dev switch: true = shows on every visit. Set to false when you finish, to show once per user.
const ALWAYS_SHOW = true;
const doneKey = (id) => `trex_tour_done_${id}`;

const CSS = `
@keyframes txStampThump {
    0%   { transform: scale(2.4) rotate(calc(var(--rot) - 18deg)); opacity: 0; }
    55%  { transform: scale(0.9) rotate(var(--rot)); opacity: 1; }
    75%  { transform: scale(1.05) rotate(var(--rot)); }
    100% { transform: scale(1) rotate(var(--rot)); opacity: 1; }
}
@keyframes txStampRing {
    0%, 55% { transform: scale(1); opacity: 0; }
    56%     { transform: scale(1); opacity: 0.5; }
    100%    { transform: scale(1.7); opacity: 0; }
}
.tx-stamp { animation: txStampThump 520ms cubic-bezier(.2,.9,.3,1) both; }
.tx-stamp::after {
    content: ''; position: absolute; inset: 0; border-radius: 9999px;
    border: 2px solid currentColor; pointer-events: none;
    animation: txStampRing 800ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
    .tx-stamp, .tx-stamp::after { animation: none; }
}
`;

// Phone frame showing a cropped part of an app screenshot.
function PhoneShot({ shot, apple, onError }) {
    const pos = shot.pos || '50% 0%';
    const frame = apple
        ? 'linear-gradient(145deg, #e6e6e9 0%, #8d8d93 28%, #f1f1f3 52%, #7a7a80 78%, #d4d4d8 100%)'
        : 'linear-gradient(145deg, #4b4f55 0%, #15171a 30%, #5a5e64 55%, #101113 80%, #3c4046 100%)';
    const btnLeft = apple
        ? 'linear-gradient(90deg, #7a7a80, #d4d4d8)'
        : 'linear-gradient(90deg, #1d1f22, #55595f)';
    const btnRight = apple
        ? 'linear-gradient(270deg, #7a7a80, #d4d4d8)'
        : 'linear-gradient(270deg, #1d1f22, #55595f)';

    return (
        <div
    className="relative w-[190px] h-[236px]"
    style={{
        WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)',
    }}
>
            <span className="absolute -left-[3px] top-[58px] w-[3px] h-6 rounded-l" style={{ background: btnLeft }} />
            <span className="absolute -left-[3px] top-[92px] w-[3px] h-10 rounded-l" style={{ background: btnLeft }} />
            <span className="absolute -right-[3px] top-[78px] w-[3px] h-14 rounded-r" style={{ background: btnRight }} />

            <div
                className="h-full rounded-t-[44px] p-[3px]"
                style={{ background: frame, boxShadow: '0 0 0 1px rgba(0,0,0,0.25), 0 10px 24px -10px rgba(0,0,0,0.5)' }}
            >
                <div className="h-full rounded-t-[41px] bg-black p-[6px]">
                    <div className="relative h-full rounded-t-[35px] overflow-hidden bg-black">
                        <img
                            src={shot.src}
                            alt=""
                            draggable={false}
                            onError={onError}
                            className="w-full h-full object-cover select-none"
                            style={{
                                objectPosition: pos,
                                transform: `scale(${shot.zoom || 1})`,
                                transformOrigin: pos,
                            }}
                        />

                        {apple ? (
                            <span className="absolute top-2 left-1/2 -translate-x-1/2 w-[58px] h-[17px] rounded-full bg-black">
                                <span
                                    className="absolute right-[7px] top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full"
                                    style={{ background: 'radial-gradient(circle at 35% 35%, #2b3a55, #05070c 70%)' }}
                                />
                            </span>
                        ) : (
                            <span className="absolute top-2 left-1/2 -translate-x-1/2 w-[9px] h-[9px] rounded-full bg-black ring-[1.5px] ring-neutral-800" />
                        )}

                        <span
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 38%)' }}
                        />
                        <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white dark:from-ink-800 to-transparent pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Old frame, no longer used. You can delete this whole function.
function OldPhoneShot({ shot, apple, onError }) {
    const pos = shot.pos || '50% 0%';
    return (
        <div className="relative w-[190px] h-[230px] overflow-hidden rounded-t-[34px] border-[7px] border-b-0 border-slate-900 dark:border-slate-600 bg-slate-900 shadow-xl">
            <img
                src={shot.src}
                alt=""
                draggable={false}
                onError={onError}
                className="w-full h-full object-cover select-none"
                style={{
                    objectPosition: pos,
                    transform: `scale(${shot.zoom || 1})`,
                    transformOrigin: pos,
                }}
            />
            {apple ? (
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-4 rounded-full bg-black" />
            ) : (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-black" />
            )}
            <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white dark:from-ink-800 to-transparent pointer-events-none" />
        </div>
    );
}

export default function OnboardingTour() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [failed, setFailed] = useState({});
    const nextRef = useRef(null);

    const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const steps = user?.account_type === 'seller' ? SELLER_STEPS : BUYER_STEPS;
    const isLast = step === steps.length - 1;

    // Show once per user
    useEffect(() => {
        if (!user) {
            setOpen(false);
            return;
        }
        let done = false;
        try { done = localStorage.getItem(doneKey(user.id)) === '1'; } catch { /* ignore */ }
        if (ALWAYS_SHOW || !done) {
            setStep(0);
            setOpen(true);
        }
    }, [user?.id]);

    // Replay from anywhere: window.dispatchEvent(new Event('trex-replay-tour'))
    useEffect(() => {
        const replay = () => { setStep(0); setOpen(true); };
        window.addEventListener('trex-replay-tour', replay);
        return () => window.removeEventListener('trex-replay-tour', replay);
    }, []);

    const finish = (goTo) => {
        try { if (user) localStorage.setItem(doneKey(user.id), '1'); } catch { /* ignore */ }
        setOpen(false);
        if (goTo) navigate(goTo);
    };

    const next = () => {
        if (isLast) {
            finish(user?.account_type === 'seller' ? '/sell/new' : '/browse');
        } else {
            setStep((s) => s + 1);
        }
    };
    const back = () => setStep((s) => Math.max(0, s - 1));

    // Lock page scroll while open
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    // Keyboard: arrows to move, Escape to skip
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') finish();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') back();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    useEffect(() => {
        if (open) nextRef.current?.focus();
    }, [open, step]);

    if (!open || !user) return null;

    const current = steps[step];
    const Icon = current.icon;
    const name = user.username || user.name || 'friend';
    const showShot = !!current.shot && !failed[current.shot.src];
    const rot = `${ROTATIONS[step % ROTATIONS.length]}deg`;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
        >
            <style>{CSS}</style>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            <div className="relative w-full sm:max-w-md max-h-[100dvh] overflow-y-auto bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-3xl shadow-2xl">
                {/* Passport header */}
                <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
                    <p className="text-xs font-semibold text-slate-500 dark:text-gold-200/60 truncate pr-3">
                        Campus passport of {name}
                    </p>
                    <button
                        onClick={() => finish()}
                        className="text-xs font-semibold text-slate-500 dark:text-gold-200/60 hover:text-slate-900 dark:hover:text-gold-50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-gold-400"
                    >
                        Skip tour
                    </button>
                </div>

                {/* Stamp slots */}
                <div className="flex justify-center gap-3 mt-4" aria-hidden="true">
                    {steps.map((s, i) => {
                        const SlotIcon = s.icon;
                        const stamped = i < step;
                        const active = i === step;
                        return (
                            <div
                                key={s.stamp + i}
                                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                                    stamped
                                        ? 'border-brand-600 text-brand-600 dark:border-gold-400 dark:text-gold-400 bg-brand-50 dark:bg-gold-900/40'
                                        : active
                                            ? 'border-dashed border-brand-600 dark:border-gold-400 text-transparent'
                                            : 'border-dashed border-slate-300 dark:border-ink-600 text-transparent'
                                }`}
                            >
                                {stamped && <SlotIcon size={15} />}
                            </div>
                        );
                    })}
                </div>
                <p className="sr-only">Stamp {step + 1} of {steps.length}</p>

                {/* Visual area */}
                {showShot ? (
                    <div className="flex items-end justify-center h-[240px] mt-4">
                        <div className="relative">
                            <PhoneShot
                                key={step}
                                shot={current.shot}
                                apple={apple}
                                onError={() => setFailed((f) => ({ ...f, [current.shot.src]: true }))}
                            />
                            {/* The stamp lands on the corner of the phone */}
                            <div
                                key={`stamp-${step}`}
                                className="tx-stamp absolute -right-9 bottom-3 w-16 h-16 rounded-full border-[3px] border-current text-brand-600 dark:text-gold-400 bg-white dark:bg-ink-800 flex flex-col items-center justify-center"
                                style={{ '--rot': rot }}
                            >
                                <Icon size={20} strokeWidth={2.2} />
                                <span className="text-[9px] font-bold mt-0.5">{current.stamp}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-40 mt-2">
                        <div
                            key={step}
                            className="tx-stamp relative w-28 h-28 rounded-full border-[3px] border-current text-brand-600 dark:text-gold-400 flex flex-col items-center justify-center"
                            style={{ '--rot': rot }}
                        >
                            <span className="absolute inset-2 rounded-full border border-dashed border-current opacity-60" />
                            <Icon size={34} strokeWidth={2.2} />
                            <span className="text-[11px] font-bold mt-1 tracking-wide">{current.stamp}</span>
                        </div>
                    </div>
                )}

                {/* Copy */}
                <div className="px-6 pt-2 pb-5 text-center">
                    <h2
                        id="tour-title"
                        className="font-serif text-2xl font-bold text-slate-900 dark:text-gold-50 leading-tight"
                    >
                        {current.title(name)}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-gold-200/70 leading-relaxed max-w-[34ch] mx-auto">
                        {current.body}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                    {step > 0 && (
                        <button
                            onClick={back}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-700 dark:text-gold-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-ink-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-gold-400"
                        >
                            Back
                        </button>
                    )}
                    <button
                        ref={nextRef}
                        onClick={next}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 font-semibold text-sm hover:bg-brand-700 dark:hover:bg-gold-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 dark:focus-visible:ring-gold-400 dark:ring-offset-ink-800"
                    >
                        {step === 0
                            ? 'Start the tour'
                            : isLast
                                ? (user.account_type === 'seller' ? 'List my first item' : 'Start exploring')
                                : 'Next stamp'}
                    </button>
                </div>
            </div>
        </div>
    );
}