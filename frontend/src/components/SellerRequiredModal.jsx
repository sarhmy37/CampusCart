import { useNavigate } from 'react-router-dom';
import { Store, X } from 'lucide-react';

export default function SellerRequiredModal({ open, onClose }) {
    const navigate = useNavigate();
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                </button>
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                    <Store size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Seller account required</h3>
                <p className="text-sm text-slate-500 mt-1.5">
                    Your account is set up for buying. To list and sell items, you'll need a seller account.
                </p>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onClose(); navigate('/register?role=seller'); }}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition"
                    >
                        Sign up as Seller
                    </button>
                </div>
            </div>
        </div>
    );
}