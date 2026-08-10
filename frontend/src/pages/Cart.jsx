import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Truck } from 'lucide-react';

const SERVICE_FEE_RATE = 0.02;
const DELIVERY_FEE = 15;

function formatWhatsAppNumber(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '233' + digits.slice(1); // Ghana local -> intl
    return digits;
}

function buildWhatsAppMessage(sellerName, sellerItems) {
    const lines = [
        `Hi ${sellerName || ''}, I'd like to order the following from CampusCart:`,
        '',
        ...sellerItems.map(
            (i) => `• ${i.title} — Qty: ${i.quantity} — GHS ${(parseFloat(i.price) * i.quantity).toFixed(2)}`
        ),
        '',
        `Subtotal: GHS ${sellerItems.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2)}`,
        '',
        'Is this still available?',
    ];
    return lines.join('\n');
}

function WhatsAppIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2zm0 18.09h-.003a8.077 8.077 0 0 1-4.116-1.128l-.295-.176-3.056.912.918-2.98-.192-.306a8.062 8.062 0 0 1-1.246-4.408c0-4.463 3.632-8.095 8.098-8.095 2.163 0 4.195.843 5.724 2.373a8.037 8.037 0 0 1 2.372 5.727c0 4.463-3.633 8.095-8.204 8.081z"/>
        </svg>
    );
}

export default function Cart() {
    const { items, removeItem, updateQuantity, total } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [deliveryMethod, setDeliveryMethod] = useState('pickup');

    if (items.length === 0) {
        return (
            <div>
                <CartHeader count={0} />
                <div className="max-w-2xl mx-auto px-4 py-20 text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center mb-5">
                        <ShoppingBag className="text-brand-400" size={28} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Your cart is empty</h2>
                    <p className="text-sm text-slate-400 mt-1.5">
                        Browse listings from students on your campus and add something you like.
                    </p>
                    <Link
                        to="/browse"
                        className="inline-flex items-center gap-1.5 mt-6 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition shadow-sm"
                    >
                        Browse listings →
                    </Link>
                </div>
            </div>
        );
    }

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = total;
    const deliveryFee = deliveryMethod === 'delivery' ? DELIVERY_FEE : 0;
    const serviceFee = subtotal * SERVICE_FEE_RATE;
    const grandTotal = subtotal + deliveryFee + serviceFee;

    // Group cart items by seller so each gets its own WhatsApp message
    const sellerGroups = items.reduce((groups, item) => {
        const key = item.seller_whatsapp || item.seller_name || 'unknown';
        if (!groups[key]) {
            groups[key] = { sellerName: item.seller_name, whatsapp: item.seller_whatsapp, items: [] };
        }
        groups[key].items.push(item);
        return groups;
    }, {});

    return (
        <div>
            <CartHeader count={itemCount} />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-3 gap-6">
                {/* ITEMS */}
                <div className="lg:col-span-2 space-y-3">
                    {items.map((item) => (
                        <div
                            key={item.product_id}
                            className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md transition"
                        >
                            <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                                {item.image && <img src={item.image} className="w-full h-full object-cover" alt={item.title} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 text-sm truncate">{item.title}</p>
                                <p className="text-brand-700 font-bold text-sm mt-1">GHS {parseFloat(item.price).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-full px-3 py-1.5">
                                <button
                                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white text-slate-600 transition"
                                >
                                    <Minus size={13} />
                                </button>
                                <span className="text-sm font-semibold w-4 text-center text-slate-800">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white text-slate-600 transition"
                                >
                                    <Plus size={13} />
                                </button>
                            </div>
                            <button
                                onClick={() => removeItem(item.product_id)}
                                className="text-slate-300 hover:text-red-500 transition p-1"
                                title="Remove"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}

                    {/* WHATSAPP — grouped by seller */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 mt-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                            Chat with sellers
                        </p>
                        <div className="space-y-2">
                            {Object.values(sellerGroups).map((group) => {
                                const number = formatWhatsAppNumber(group.whatsapp);
                                const message = buildWhatsAppMessage(group.sellerName, group.items);
                                const href = number
                                    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
                                    : null;

                                return (
                                    <a
                                        key={group.sellerName + (group.whatsapp || '')}
                                        href={href || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                            if (!href) {
                                                e.preventDefault();
                                                alert(`${group.sellerName} hasn't added a WhatsApp number yet.`);
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                                            href
                                                ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                                                : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <WhatsAppIcon className={`w-5 h-5 ${href ? 'text-emerald-600' : 'text-slate-300'}`} />
                                            Chat with {group.sellerName} about {group.items.length} item{group.items.length > 1 ? 's' : ''}
                                        </span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* SUMMARY */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4">Order summary</h3>

                        <div className="space-y-2 mb-5">
                            <button
                                onClick={() => setDeliveryMethod('pickup')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                                    deliveryMethod === 'pickup'
                                        ? 'border-brand-500 bg-brand-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <MapPin size={16} className={deliveryMethod === 'pickup' ? 'text-brand-600' : 'text-slate-400'} />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Meet on campus</p>
                                    <p className="text-xs text-slate-400">Free — arrange with the seller</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setDeliveryMethod('delivery')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                                    deliveryMethod === 'delivery'
                                        ? 'border-brand-500 bg-brand-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <Truck size={16} className={deliveryMethod === 'delivery' ? 'text-brand-600' : 'text-slate-400'} />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Delivery</p>
                                    <p className="text-xs text-slate-400">GHS {DELIVERY_FEE.toFixed(2)} — delivered to you</p>
                                </div>
                            </button>
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-2.5">
                            <div className="flex items-center justify-between text-sm text-slate-500">
                                <span>Subtotal ({itemCount} item{itemCount > 1 ? 's' : ''})</span>
                                <span>GHS {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-500">
                                <span>Delivery</span>
                                <span>{deliveryFee > 0 ? `GHS ${deliveryFee.toFixed(2)}` : 'Free'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-500">
                                <span>Service fee</span>
                                <span>GHS {serviceFee.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 mt-4 pt-4 flex items-center justify-between mb-6">
                            <span className="font-semibold text-slate-900">Total</span>
                            <span className="text-2xl font-extrabold text-slate-900">GHS {grandTotal.toFixed(2)}</span>
                        </div>

                        <button
                            onClick={() => navigate(user ? '/checkout' : '/login')}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 text-white font-semibold text-sm transition shadow-sm"
                        >
                            Checkout
                        </button>
                        {!user && (
                            <p className="text-xs text-slate-400 text-center mt-3">
                                You'll need to log in first
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CartHeader({ count }) {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-600">
            <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <Link
                    to="/browse"
                    className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                >
                    <ArrowLeft size={16} /> Continue browsing
                </Link>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-5">Your Cart</h1>
                <p className="text-white/70 text-sm mt-1">
                    {count > 0 ? `${count} item${count > 1 ? 's' : ''} ready for checkout` : 'Nothing here yet'}
                </p>
            </div>
        </section>
    );
}