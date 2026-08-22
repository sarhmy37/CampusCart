import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 bg-white dark:bg-ink-900 min-h-screen">
            <Link
                to="/settings"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-gold-200/60 hover:text-slate-700 dark:hover:text-gold-100 transition mb-6"
            >
                <ArrowLeft size={16} /> Back to Settings
            </Link>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-gold-50">Privacy Policy</h1>
            <p className="text-sm text-slate-400 dark:text-gold-200/50 mt-1">Last updated: 2026</p>

            <div className="mt-8 space-y-6 text-sm text-slate-600 dark:text-gold-200/70 leading-relaxed">
                <Section title="1. Information we collect">
                    When you register, we collect your name, university (or personal) email, WhatsApp number, and, for buyers, your delivery location. Sellers may also add bank or mobile money payout details.
                </Section>
                <Section title="2. How we use your information">
                    Your information is used to verify your identity, process orders and payments, connect buyers and sellers, and send order-related notifications by app, email, or SMS.
                </Section>
                <Section title="3. Payment information">
                    Payments are processed by our third-party provider, Paystack. Tre-X does not store your full card or mobile money credentials on our servers.
                </Section>
                <Section title="4. Sharing of information">
                    Your name and contact details are shared with the other party in a transaction (e.g. your WhatsApp number is shared with a buyer or seller) so they can coordinate pickup or delivery. We do not sell your personal data to third parties.
                </Section>
                <Section title="5. Data retention">
                    We retain your account and order data for as long as your account is active, or as needed to comply with legal obligations.
                </Section>
                <Section title="6. Your rights">
                    You may update your profile information at any time from your account settings, or request deletion of your account, which will remove your listings, orders, and messages.
                </Section>
                <Section title="7. Security">
                    Passwords are stored using industry-standard hashing. Access to sensitive account actions requires authentication, and payment processing is handled entirely by our PCI-compliant payment provider.
                </Section>
                <Section title="8. Changes to this policy">
                    We may update this privacy policy from time to time. Material changes will be reflected here with an updated date.
                </Section>
                <Section title="9. Contact">
                    Questions about this policy can be directed to our support team via the contact options in Settings.
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <h2 className="font-bold text-slate-800 dark:text-gold-100 mb-1.5">{title}</h2>
            <p>{children}</p>
        </div>
    );
}