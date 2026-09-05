import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
    const navigate = useNavigate();

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 bg-white dark:bg-ink-900 min-h-screen">
            <button
                onClick={() => navigate('/', { state: { openProfile: true } })}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-gold-200/60 hover:text-slate-700 dark:hover:text-gold-100 transition mb-6"
            >
                <ArrowLeft size={16} /> Back
            </button>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-gold-50">Terms of Service</h1>
            <p className="text-sm text-slate-400 dark:text-gold-200/50 mt-1">Last updated: 2026</p>

            <div className="mt-8 space-y-6 text-sm text-slate-600 dark:text-gold-200/70 leading-relaxed">
                <Section title="1. About Tre-X">
                    Tre-X is a campus-based marketplace platform that connects verified university students to buy and sell items within their own campus community.
                </Section>
                <Section title="2. Eligibility">
                    Tre-X is intended for use by university students. Sellers are required to verify their account using a valid university email address.
                </Section>
                <Section title="3. Listings">
                    Sellers must accurately describe the items they list, including condition, price, and availability. Misleading or fraudulent listings may be removed, and repeat violations may result in account suspension.
                </Section>
                <Section title="4. Payments">
                    Payments are processed securely through our third-party payment provider, Paystack. Tre-X does not store your card or mobile money details directly.
                </Section>
                <Section title="5. Fees">
                    <p>Sellers are charged a 1.5% platform fee on the sale price of every completed transaction, deducted automatically from their payout. Fees accrued across a calendar month are totaled and must be settled before new listings can be created the following month. Buyers are never charged this fee.</p>
                    <p className="mt-2">Buyers pay a separate 2% service fee at checkout, covering payment processing costs charged by our payment provider, Paystack.</p>
                    <p className="mt-2">Sellers can track fees owed and payment history from their Dashboard.</p>
                </Section>
                <Section title="6. Order confirmation">
                    Buyers should only confirm "Order Received" once the item has been received in the agreed condition. Confirming an order releases payment to the seller.
                </Section>
                <Section title="7. Prohibited conduct">
                    Users may not list prohibited or illegal items, harass other users, or attempt to circumvent Tre-X's payment system. Violations may result in account suspension or termination.
                </Section>
                <Section title="8. Changes to these terms">
                    Tre-X may update these terms from time to time. Continued use of the platform after changes are posted constitutes acceptance of the revised terms.
                </Section>
                <Section title="9. Contact">
                    Questions about these terms can be directed to our support team via the contact options in Settings.
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <h2 className="font-bold text-slate-800 dark:text-gold-100 mb-1.5">{title}</h2>
            <div>{children}</div>
        </div>
    );
}