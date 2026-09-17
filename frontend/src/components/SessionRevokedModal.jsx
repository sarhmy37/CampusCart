import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import ReportModal from './ReportModal';
import { useAuth } from '../context/AuthContext';

export const SESSION_REVOKED_EVENT = 'cc-session-revoked';

export default function SessionRevokedModal() {
    const { user } = useAuth();
    const [show, setShow] = useState(false);
    const [showReport, setShowReport] = useState(false);

    useEffect(() => {
        const handler = () => setShow(true);
        window.addEventListener(SESSION_REVOKED_EVENT, handler);
        return () => window.removeEventListener(SESSION_REVOKED_EVENT, handler);
    }, []);

    useEffect(() => {
        if (!show) return;
        if (document.body.style.position === 'fixed') return; // already locked elsewhere
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
        return () => {
            const y = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            if (y) window.scrollTo(0, parseInt(y || '0') * -1);
        };
    }, [show]);

    if (!show) return null;

    if (showReport) {
        return (
            <ReportModal
                open={showReport}
                onClose={() => {
                    setShowReport(false);
                    localStorage.removeItem('cc_token');
                    localStorage.removeItem('cc_user');
                }}
                productId={null}
                reportedUserId={user?.id || null}
                publicReporterId={user?.id || null}
                initialReason="account_security"
                initialDetails="My account was accessed from another device without my knowledge."
            />
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4">
                    <ShieldAlert size={26} className="text-red-500" />
                </div>
                <h3 className="font-extrabold text-slate-900 dark:text-gold-50 text-lg">
                    Signed out — new login detected
                </h3>
                <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-2 leading-relaxed">
                    Your account was accessed on another device, so this session was signed out.
                    If this wasn't you, report it immediately.
                </p>
                <div className="flex flex-col gap-2 mt-5">
                    <button
                        onClick={() => setShowReport(true)}
                        className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
                    >
                        Report this — it wasn't me
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem('cc_token');
                            localStorage.removeItem('cc_user');
                            window.location.href = '/';
                        }}
                        className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                    >
                        Okay, take me to login
                    </button>
                </div>
            </div>
        </div>
    );
}