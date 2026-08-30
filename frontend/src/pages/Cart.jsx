import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useChat } from '../context/ChatContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { openWhatsAppChats } from '../utils/whatsapp';
import { calcDeliveryFee, SCHOOL_COORDS, haversineKm } from '../utils/distance';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Truck, Loader2, Send, X, MessageCircle } from 'lucide-react';
import { CART_VIDEO } from '../data/media';

const SERVICE_FEE_RATE = 0.02;
const FALLBACK_DELIVERY_FEE = 15;

function formatWhatsAppNumber(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '233' + digits.slice(1);
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
    const { items, removeItem, updateQuantity, total, clearCart } = useCart();
    const { user } = useAuth();
    const { openChat, broadcastToSellers, openConversationDirect } = useChat();
    const navigate = useNavigate();
    const [deliveryMethod, setDeliveryMethod] = useState('pickup');
    const [paying, setPaying] = useState(false);
    const [buyerCoords, setBuyerCoords] = useState(null);
    const [locating, setLocating] = useState(false);
    const [locationDenied, setLocationDenied] = useState(false);
    const [onCampusChecked, setOnCampusChecked] = useState(false);
    const [verifyingCampus, setVerifyingCampus] = useState(false);
    const [confirmedOnCampus, setConfirmedOnCampus] = useState(null);

    // Broadcast-to-multiple-sellers compose modal (pickup, cart spans >1 seller)
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    const sellerGroups = items.reduce((groups, item) => {
        const key = item.seller_whatsapp || item.seller_name || 'unknown';
        if (!groups[key]) {
            groups[key] = { sellerName: item.seller_name, whatsapp: item.seller_whatsapp, school: item.seller_school, items: [] };
        }
        groups[key].items.push(item);
        return groups;
    }, {});

    // Normalized seller list for chat purposes — one entry per distinct seller in the cart
    const sellersForChat = Object.values(sellerGroups)
        .map((group) => ({
            sellerId: group.items[0]?.seller_id,
            sellerName: group.sellerName,
            productId: group.items[0]?.product_id,
        }))
        .filter((s) => s.sellerId);

    useEffect(() => {
        if (deliveryMethod !== 'delivery' || buyerCoords || locationDenied) return;
        if (!navigator.geolocation) {
            setLocationDenied(true);
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setBuyerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
            },
            () => {
                setLocationDenied(true);
                setLocating(false);
            }
        );
    }, [deliveryMethod, buyerCoords, locationDenied]);

    const sellerSchoolsInCart = [...new Set(items.map((i) => i.seller_school).filter(Boolean))];

    const handleOnCampusToggle = (checked) => {
        setOnCampusChecked(checked);
        if (!checked) {
            setConfirmedOnCampus(null);
            return;
        }
        if (!navigator.geolocation) {
            toast.error("Your browser doesn't support location access");
            setOnCampusChecked(false);
            return;
        }
        setVerifyingCampus(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const isOnCampus = sellerSchoolsInCart.some((school) => {
                    const coords = SCHOOL_COORDS[school];
                    if (!coords) return false;
                    return haversineKm(latitude, longitude, coords.lat, coords.lng) <= 2;
                });
                setBuyerCoords({ lat: latitude, lng: longitude });
                setConfirmedOnCampus(isOnCampus);
                setVerifyingCampus(false);
                if (!isOnCampus) {
                    toast.error("You don't appear to be on campus right now");
                }
            },
            () => {
                toast.error("Couldn't verify your location");
                setOnCampusChecked(false);
                setVerifyingCampus(false);
            }
        );
    };

    // Opens the broadcast compose modal for a multi-seller cart, and immediately
    // surfaces a toast telling the buyer their message will go to every seller.
    const openBroadcastModal = () => {
        const sellerCount = sellersForChat.length;
        toast(
            `You're purchasing from ${sellerCount} different sellers — this message will be sent to all of them`,
            { icon: '💬', duration: 4500 }
        );
        setShowBroadcastModal(true);
    };

    const handleSendBroadcast = async () => {
        if (!broadcastMessage.trim() || sendingBroadcast) return;
        setSendingBroadcast(true);
        try {
            const conversations = await broadcastToSellers(sellersForChat, broadcastMessage);
            if (conversations.length > 0) {
                toast.success(
                    `Message sent to ${conversations.length} seller${conversations.length > 1 ? 's' : ''}`
                );
                setShowBroadcastModal(false);
                setBroadcastMessage('');
                // Open the first seller's conversation so the buyer can keep chatting —
                // the rest are reachable from the inbox in the Navbar.
                openConversationDirect(conversations[0]);
            }
        } finally {
            setSendingBroadcast(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="dark:bg-ink-900 min-h-screen flex flex-col">
                <CartHeader count={0} />
                <div className="flex-1 flex items-center justify-center px-4 py-20">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 dark:bg-gold-900 flex items-center justify-center mb-5">
                            <ShoppingBag className="text-brand-400 dark:text-gold-400" size={28} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-gold-50">Your cart is empty</h2>
                        <p className="text-sm text-slate-400 dark:text-gold-200/50 mt-1.5">
                            Browse listings from students on your campus and add something you like.
                        </p>
                        <Link
                            to="/browse"
                            className="inline-flex items-center gap-1.5 mt-6 px-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition shadow-sm"
                        >
                            Browse listings →
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = total;

        // Each seller in the cart contributes exactly ONE delivery fee for the whole
    // trip (not one per item), using the highest per-tier price among that
    // seller's items in the cart (mirrors backend order-creation logic).
    let deliveryFee = 0;
    if (deliveryMethod === 'delivery') {
        Object.values(sellerGroups).forEach((group) => {
            const sellerPrices = {
                delivery_fee_on_campus: Math.max(...group.items.map((i) => i.delivery_fee_on_campus || 0)),
                delivery_fee_near_campus: Math.max(...group.items.map((i) => i.delivery_fee_near_campus || 0)),
                delivery_fee_far_campus: Math.max(...group.items.map((i) => i.delivery_fee_far_campus || 0)),
            };

            if (confirmedOnCampus === true) {
                deliveryFee += sellerPrices.delivery_fee_on_campus;
            } else if (buyerCoords) {
                const { fee } = calcDeliveryFee(buyerCoords.lat, buyerCoords.lng, group.school, sellerPrices);
                deliveryFee += fee;
            } else {
                // No location yet — fall back to the seller's "far" price as the safe default
                deliveryFee += sellerPrices.delivery_fee_far_campus || FALLBACK_DELIVERY_FEE;
            }
        });
    }

    const serviceFee = subtotal * SERVICE_FEE_RATE;
    const grandTotal = subtotal + deliveryFee + serviceFee;

    const handleAction = async () => {
        if (!user) return navigate('/login');

        if (deliveryMethod === 'pickup') {
            if (sellersForChat.length === 0) return;

            if (sellersForChat.length === 1) {
                openChat(sellersForChat[0]);
            } else {
                openBroadcastModal();
            }
            return;
        }

        setPaying(true);
        try {
            const res = await api.post('/orders', {
                items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
                delivery_method: deliveryMethod,
                buyer_lat: buyerCoords?.lat ?? null,
                buyer_lng: buyerCoords?.lng ?? null,
            });
            clearCart();
            window.location.href = res.data.authorization_url;
        } catch (err) {
            if (err.response?.data?.needs_verification) {
                toast.error('Please verify your email before placing an order');
                navigate('/', { state: { openProfile: true } });
            } else {
                toast.error(err.response?.data?.error || 'Checkout failed');
            }
            setPaying(false);
        }
    };

    return (
        <div className="dark:bg-ink-900 min-h-screen flex flex-col overflow-x-hidden">
            <CartHeader count={itemCount} />

            {/* Main content with scrolling */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 grid lg:grid-cols-3 gap-6 pb-24 lg:pb-8">
                    {/* ITEMS */}
                    <div className="lg:col-span-2 space-y-3 overflow-x-hidden">
                        {items.map((item) => (
                            <div
                                key={item.product_id}
                                className="flex items-center gap-2 sm:gap-4 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-2 sm:p-3 shadow-sm hover:shadow-md dark:hover:shadow-gold-900/20 transition w-full"
                            >
                                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl bg-slate-100 dark:bg-ink-700 overflow-hidden shrink-0">
                                    {item.image && <img src={item.image} className="w-full h-full object-cover" alt={item.title} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 dark:text-gold-50 text-xs sm:text-sm truncate">{item.title}</p>
                                    <p className="text-brand-700 dark:text-gold-400 font-bold text-xs sm:text-sm mt-0.5">GHS {parseFloat(item.price).toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-3 bg-slate-50 dark:bg-ink-700 rounded-full px-1.5 sm:px-3 py-1 sm:py-1.5 shrink-0">
                                    <button
                                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                        className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-ink-600 text-slate-600 dark:text-gold-200 transition"
                                    >
                                        <Minus size={12} className="sm:size-[13px]" />
                                    </button>
                                    <span className="text-xs sm:text-sm font-semibold w-4 text-center text-slate-800 dark:text-gold-50">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                        className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-ink-600 text-slate-600 dark:text-gold-200 transition"
                                    >
                                        <Plus size={12} className="sm:size-[13px]" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => removeItem(item.product_id)}
                                    className="text-slate-300 dark:text-gold-200/40 hover:text-red-500 transition p-1 shrink-0"
                                    title="Remove"
                                >
                                    <Trash2 size={16} className="sm:size-[18px]" />
                                </button>
                            </div>
                        ))}

                        {/* SELLER CONTACT — grouped by seller (only shown for pickup) */}
                        {deliveryMethod === 'pickup' && (
                            <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 mt-2">
                                <p className="text-xs font-semibold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-3">
                                    Chat with sellers
                                </p>
                                <div className="space-y-2">
                                    {Object.values(sellerGroups).map((group) => {
                                        const number = formatWhatsAppNumber(group.whatsapp);
                                        const message = buildWhatsAppMessage(group.sellerName, group.items);
                                        const href = number
                                            ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
                                            : null;
                                        const sellerId = group.items[0]?.seller_id;

                                        return (
                                            <div key={group.sellerName + (group.whatsapp || '')} className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (!user) return navigate('/login');
                                                        if (!sellerId) return toast.error('Could not identify this seller');
                                                        openChat({
                                                            sellerId,
                                                            sellerName: group.sellerName,
                                                            productId: group.items[0]?.product_id,
                                                        });
                                                    }}
                                                    className="flex-1 flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-brand-200 dark:border-gold-800 bg-brand-50 dark:bg-gold-900/30 hover:bg-brand-100 dark:hover:bg-gold-900/50 text-brand-800 dark:text-gold-300 text-xs sm:text-sm font-semibold transition"
                                                >
                                                    <span className="truncate">Message {group.sellerName} in-app</span>
                                                </button>

                                                <a
                                                    href={href || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => {
                                                        if (!user) {
                                                            e.preventDefault();
                                                            navigate('/login');
                                                            return;
                                                        }
                                                        if (!href) {
                                                            e.preventDefault();
                                                            alert(`${group.sellerName} hasn't added a WhatsApp number yet.`);
                                                        }
                                                    }}
                                                    className={`flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition shrink-0 ${
                                                        href
                                                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                                            : 'border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-700 cursor-not-allowed'
                                                    }`}
                                                    title="Chat on WhatsApp"
                                                >
                                                    <WhatsAppIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${href ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-gold-200/30'}`} />
                                                </a>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SUMMARY - Sticky on desktop, normal on mobile */}
                    <div className="lg:col-span-1">
                        <div className="lg:sticky lg:top-24 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4 sm:p-6 shadow-sm">
                            <h3 className="font-bold text-slate-900 dark:text-gold-50 mb-4">Order summary</h3>

                            <div className="space-y-2 mb-5">
                                <button
                                    onClick={() => setDeliveryMethod('pickup')}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                                        deliveryMethod === 'pickup'
                                            ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/40'
                                            : 'border-slate-200 dark:border-ink-600 hover:border-slate-300 dark:hover:border-ink-500'
                                    }`}
                                >
                                    <MapPin size={16} className={deliveryMethod === 'pickup' ? 'text-brand-600 dark:text-gold-400' : 'text-slate-400 dark:text-gold-200/40'} />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-gold-50">Meet on campus</p>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/50">Free — arrange with the seller</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setDeliveryMethod('delivery')}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                                        deliveryMethod === 'delivery'
                                            ? 'border-brand-500 dark:border-gold-500 bg-brand-50 dark:bg-gold-900/40'
                                            : 'border-slate-200 dark:border-ink-600 hover:border-slate-300 dark:hover:border-ink-500'
                                    }`}
                                >
                                    <Truck size={16} className={deliveryMethod === 'delivery' ? 'text-brand-600 dark:text-gold-400' : 'text-slate-400 dark:text-gold-200/40'} />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-gold-50">Delivery</p>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/50">Fee based on distance</p>
                                    </div>
                                </button>

                                {deliveryMethod === 'delivery' && (
                                    <div className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-700">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={onCampusChecked}
                                                onChange={(e) => handleOnCampusToggle(e.target.checked)}
                                                disabled={verifyingCampus}
                                                className="w-4 h-4 rounded accent-brand-600 dark:accent-gold-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-gold-100">
                                                Are you on campus?
                                            </span>
                                        </label>

                                        {verifyingCampus && (
                                            <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-2 flex items-center gap-1.5">
                                                <Loader2 size={12} className="animate-spin" /> Checking your location…
                                            </p>
                                        )}
                                                                {!verifyingCampus && confirmedOnCampus === true && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                                ✓ You're on campus — delivery fee applied.
                            </p>
                        )}
                                        {!verifyingCampus && confirmedOnCampus === false && (
                                            <p className="text-xs text-red-500 mt-2">
                                                You are not on campus. Standard delivery rates apply based on your distance.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {deliveryMethod === 'delivery' && confirmedOnCampus !== true && (
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-3 mb-1">Delivered within 1–3 working days.</p>
                            )}

                            <div className="border-t border-slate-100 dark:border-ink-600 pt-4 space-y-2.5">
                                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-gold-200/60">
                                    <span>Subtotal ({itemCount} item{itemCount > 1 ? 's' : ''})</span>
                                    <span>GHS {subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-gold-200/60">
                                    <span>Delivery</span>
                                    <span>{deliveryFee > 0 ? `GHS ${deliveryFee.toFixed(2)}` : 'Free'}</span>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-ink-600 mt-4 pt-4 flex items-center justify-between mb-6">
                                <span className="font-semibold text-slate-900 dark:text-gold-50">Total</span>
                                <span className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">GHS {grandTotal.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={handleAction}
                                disabled={paying || (deliveryMethod === 'delivery' && locating)}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 dark:from-gold-600 dark:to-gold-400 hover:opacity-90 text-white dark:text-ink-900 font-semibold text-sm transition shadow-sm disabled:opacity-60"
                            >
                                {paying ? 'Redirecting to payment…' : (deliveryMethod === 'pickup' ? 'Chat with Seller(s)' : `Pay · GHS ${grandTotal.toFixed(2)}`)}
                            </button>
                            {!user && (
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 text-center mt-3">
                                    You'll need to log in first
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* BROADCAST COMPOSE MODAL — one message, sent to every seller in the cart */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => !sendingBroadcast && setShowBroadcastModal(false)}
                    />
                    <div className="relative w-full sm:max-w-md bg-white dark:bg-ink-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-gold-900/40 flex items-center justify-center">
                                    <MessageCircle size={17} className="text-brand-600 dark:text-gold-400" />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-gold-50 text-base">
                                    Message all sellers
                                </h3>
                            </div>
                            <button
                                onClick={() => !sendingBroadcast && setShowBroadcastModal(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-4">
                            This will start (or continue) a chat with each of the {sellersForChat.length} sellers below and send them the same message.
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {sellersForChat.map((s) => (
                                <span
                                    key={s.sellerId}
                                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-ink-700 text-slate-600 dark:text-gold-200"
                                >
                                    {s.sellerName}
                                </span>
                            ))}
                        </div>

                        <textarea
                            value={broadcastMessage}
                            onChange={(e) => setBroadcastMessage(e.target.value)}
                            placeholder="Hi, I'd like to arrange pickup for my order..."
                            rows={4}
                            autoFocus
                            disabled={sendingBroadcast}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition resize-none disabled:opacity-60"
                        />

                        <button
                            onClick={handleSendBroadcast}
                            disabled={!broadcastMessage.trim() || sendingBroadcast}
                            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                        >
                            {sendingBroadcast ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Sending…
                                </>
                            ) : (
                                <>
                                    <Send size={16} /> Send to {sellersForChat.length} sellers
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function CartHeader({ count }) {
    return (
        <section className="relative overflow-hidden shrink-0">
            <video 
                autoPlay 
                loop 
                muted 
                playsInline 
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: '50% 40%' }}
            >
                <source src={CART_VIDEO} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900/50 via-brand-800/35 to-accent-600/25 dark:from-ink-900/80 dark:via-ink-900/60 dark:to-gold-900/35" />
            <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <Link
    to="/browse"
    className="inline-flex items-center gap-1 sm:gap-2 bg-white/10 text-white font-semibold px-2.5 py-1 sm:px-4 sm:py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-sm"
>
    <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" /> Continue browsing
</Link>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-5">Your Cart</h1>
                <p className="text-white/70 text-sm mt-1">
                    {count > 0 ? `${count} item${count > 1 ? 's' : ''} ready for checkout` : 'Nothing here yet'}
                </p>
            </div>
        </section>
    );
}