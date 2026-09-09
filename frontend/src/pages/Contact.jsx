import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle, Phone, Clock } from 'lucide-react';

function WhatsAppIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2zm0 18.09h-.003a8.077 8.077 0 0 1-4.116-1.128l-.295-.176-3.056.912.918-2.98-.192-.306a8.062 8.062 0 0 1-1.246-4.408c0-4.463 3.632-8.095 8.098-8.095 2.163 0 4.195.843 5.724 2.373a8.037 8.037 0 0 1 2.372 5.727c0 4.463-3.633 8.095-8.204 8.081z"/>
        </svg>
    );
}

const CONTACT_METHODS = [
    {
        icon: WhatsAppIcon,
        iconClass: 'text-emerald-500',
        label: 'WhatsApp',
        value: '@Trex_Support1',
        href: 'https://wa.me/Trex_Support1',
        note: 'Fastest response, usually within a few hours',
    },
    {
        icon: Mail,
        iconClass: 'text-brand-600 dark:text-gold-400',
        label: 'Email',
        value: 'support@trex.app',
        href: 'mailto:support@trex.app',
        note: 'We reply within 1 business day',
    },
    {
        icon: Phone,
        iconClass: 'text-brand-600 dark:text-gold-400',
        label: 'Phone',
        value: '+233 24 123 4567',
        href: 'tel:+233241234567',
        note: 'Mon–Fri, 9am–5pm GMT',
    },
];

export default function Contact() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
            <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="flex items-center gap-3 mt-5">
                        <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                            <MessageCircle className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Contact Us</h1>
                            <p className="text-white/70 text-sm mt-0.5">We're here to help</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-3">
                {CONTACT_METHODS.map((method) => (
                    <a
                        key={method.label}
                        href={method.href}
                        target={method.href.startsWith('http') ? '_blank' : undefined}
                        rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="flex items-center gap-4 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 hover:shadow-sm hover:border-brand-300 dark:hover:border-gold-500/40 transition"
                    >
                        <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-ink-700 flex items-center justify-center shrink-0">
                            <method.icon className={`w-5 h-5 ${method.iconClass}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 dark:text-gold-50">{method.label}</p>
                            <p className="text-sm text-brand-600 dark:text-gold-400 font-semibold mt-0.5">{method.value}</p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-1">{method.note}</p>
                        </div>
                    </a>
                ))}

                <div className="flex items-start gap-3 bg-slate-100 dark:bg-ink-800/60 rounded-2xl p-4 mt-2">
                    <Clock size={16} className="text-slate-400 dark:text-gold-300/50 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 dark:text-gold-200/60">
                        Pro and Premium members get priority support — your messages are answered first.
                    </p>
                </div>
            </div>
        </div>
    );
}