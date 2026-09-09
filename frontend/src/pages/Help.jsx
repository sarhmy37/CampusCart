import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, LifeBuoy, Mail, MessageCircle, Phone } from 'lucide-react';

const FAQS = [
    {
        q: 'How do I verify my account?',
        a: 'Go to your profile and tap "Verify your account". We\'ll send a 6-digit code to your university email (or, for buyers, your registered email). Enter it to get verified — this unlocks selling, withdrawals, and the verified badge on your profile.',
    },
    {
        q: 'How do I contact a seller before buying?',
        a: 'Open any listing and tap "Chat with the seller" to message them directly through the app, or use their WhatsApp number shown on the listing if they\'ve added one.',
    },
    {
        q: 'What happens after I pay for an order?',
        a: 'Once payment is confirmed, the seller is notified to prepare your item for pickup or delivery. After you receive it, go to your Orders tab and tap "Confirm Received" — this releases the funds to the seller and unlocks your ability to leave a review.',
    },
    {
        q: 'How do platform fees work?',
        a: 'Free-plan sellers pay a standard 1.5% fee per sale. Pro and Premium sellers keep 100% of every sale — no platform fee at all. Buyers pay a small 2% service fee at checkout to cover payment processing.',
    },
    {
        q: 'What\'s the difference between Free, Pro, and Premium?',
        a: 'Pro and Premium unlock 0% seller fees, higher listing limits, priority placement in search, a seller badge, and more. Premium adds unlimited listings and top placement. Check the pricing section on the home page for the full breakdown.',
    },
    {
        q: 'How do withdrawals work?',
        a: 'Once a buyer confirms they\'ve received an order, the funds become available in your Payouts tab. Add a bank or mobile money account, then request a withdrawal from your available balance.',
    },
    {
        q: 'What if I never receive my order, or it doesn\'t match the listing?',
        a: 'Don\'t confirm the order as received. Instead, use the "Report" option on the listing or order, or reach out to support below — we\'ll step in to help resolve it.',
    },
    {
        q: 'How do I become a seller?',
        a: 'Tap "Start selling" from the home page. If you signed up as a buyer, you\'ll be prompted to switch to a seller account, which requires a valid university email for verification.',
    },
];

function FAQItem({ faq, open, onToggle }) {
    return (
        <div className="border-b border-slate-100 dark:border-ink-600 last:border-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-3 py-4 text-left"
            >
                <span className="font-semibold text-sm text-slate-800 dark:text-gold-100">{faq.q}</span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 dark:text-gold-300/50 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <p className="text-sm text-slate-500 dark:text-gold-200/60 leading-relaxed pb-4 pr-6">
                    {faq.a}
                </p>
            )}
        </div>
    );
}

export default function Help() {
    const navigate = useNavigate();
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
            <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="flex items-center gap-3 mt-5">
                        <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                            <LifeBuoy className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Help Center</h1>
                            <p className="text-white/70 text-sm mt-0.5">Answers to common questions</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl px-5">
                    {FAQS.map((faq, i) => (
                        <FAQItem
                            key={faq.q}
                            faq={faq}
                            open={openIndex === i}
                            onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
                        />
                    ))}
                </div>

                <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 text-center">
                    <p className="text-sm text-slate-500 dark:text-gold-200/60">
                        Still need help?
                    </p>
                    <Link
                        to="/contact"
                        className="inline-flex items-center gap-2 mt-3 bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 font-bold px-5 py-2.5 rounded-full hover:bg-brand-700 dark:hover:bg-gold-400 transition text-sm"
                    >
                        <MessageCircle size={16} /> Contact support
                    </Link>
                </div>
            </div>
        </div>
    );
}