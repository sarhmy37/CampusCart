import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-150">
                <div className="w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
                    <AlertTriangle size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
                <p className="text-sm text-slate-500 mt-1.5">{message}</p>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}