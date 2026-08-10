import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { CheckCircle2, Clock, XCircle, MapPin, Truck, ChevronLeft } from 'lucide-react';

const STATUS_CONFIG = {
    completed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Payment confirmed' },
    pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Payment pending' },
    cancelled: { icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Order cancelled' },
    refunded: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Order refunded' },
};

export default function OrderConfirmation() {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        api.get(`/orders/${id}`)
            .then((res) => setOrder(res.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="max-w-lg mx-auto px-4 py-24 text-center text-slate-400">
                Loading your order…
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="max-w-lg mx-auto px-4 py-24 text-center">
                <p className="text-slate-500">We couldn't find that order.</p>
                <Link to="/dashboard" className="inline-block mt-4 text-brand-600 font-semibold text-sm">
                    Go to your dashboard →
                </Link>
            </div>
        );
    }

    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const StatusIcon = config.icon;

    return (
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 mb-6">
                <ChevronLeft size={16} /> Back to dashboard
            </Link>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <div className={`w-16 h-16 mx-auto rounded-2xl ${config.bg} flex items-center justify-center mb-4`}>
                    <StatusIcon className={config.color} size={32} />
                </div>
                <h1 className="text-xl font-extrabold text-slate-900">{config.label}</h1>
                <p className="text-sm text-slate-400 mt-1">Order #{order.id.slice(0, 8)}</p>

                <div className="mt-6 text-left space-y-3">
                    {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.title} × {item.quantity}</span>
                            <span className="font-semibold text-slate-800">
                                GHS {(parseFloat(item.price_at_purchase) * item.quantity).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="border-t border-slate-100 mt-5 pt-5 space-y-2 text-left">
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>GHS {parseFloat(order.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Delivery</span>
                        <span>{parseFloat(order.delivery_fee) > 0 ? `GHS ${parseFloat(order.delivery_fee).toFixed(2)}` : 'Free'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-base pt-2">
                        <span>Total</span>
                        <span>GHS {parseFloat(order.total_amount).toFixed(2)}</span>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                    {order.delivery_method === 'delivery' ? <Truck size={14} /> : <MapPin size={14} />}
                    {order.delivery_method === 'delivery' ? 'Delivery within 1–3 working days' : 'Arrange pickup with the seller on campus'}
                </div>
            </div>

            <Link
                to="/browse"
                className="block text-center mt-6 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
                Continue browsing →
            </Link>
        </div>
    );
}