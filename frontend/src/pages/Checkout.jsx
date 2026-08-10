import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useCart } from '../context/CartContext';

export default function Checkout() {
    const { items, total, clearCart } = useCart();
    const navigate = useNavigate();
    const [method, setMethod] = useState('momo');
    const [loading, setLoading] = useState(false);

    const placeOrder = async () => {
        setLoading(true);
        try {
            await api.post('/orders', {
                items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
                payment_method: method,
            });
            clearCart();
            toast.success('Order placed successfully!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Checkout failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Checkout</h1>

            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
                <p className="font-semibold text-slate-700 mb-3">Order Summary</p>
                {items.map((i) => (
                    <div key={i.product_id} className="flex justify-between text-sm py-1.5">
                        <span className="text-slate-600">{i.title} × {i.quantity}</span>
                        <span className="font-semibold">GHS {(i.price * i.quantity).toFixed(2)}</span>
                    </div>
                ))}
                <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between font-bold text-slate-900">
                    <span>Total</span>
                    <span>GHS {total.toFixed(2)}</span>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
                <p className="font-semibold text-slate-700 mb-3">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                    <PaymentOption label="Mobile Money" value="momo" active={method} onClick={setMethod} />
                    <PaymentOption label="Cash on Pickup" value="cash" active={method} onClick={setMethod} />
                </div>
                <p className="text-xs text-slate-400 mt-3">This is a demo checkout — no real payment is processed.</p>
            </div>

            <button
                onClick={placeOrder}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-60"
            >
                {loading ? 'Placing order...' : `Place order · GHS ${total.toFixed(2)}`}
            </button>
        </div>
    );
}

function PaymentOption({ label, value, active, onClick }) {
    return (
        <button
            onClick={() => onClick(value)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition ${
                active === value ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-slate-200 text-slate-600'
            }`}
        >
            {label}
        </button>
    );
}
