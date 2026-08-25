import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatWhatsAppNumber } from '../utils/whatsapp';
import ReportModal from '../components/ReportModal';
import ReviewsSection from '../components/ReviewsSection';
import { getDemoProduct } from '../data/demoProducts';
import ProductCard from '../components/ProductCard';
import {
    ShoppingCart,
    MessageCircle,
    Star,
    Flag,
    ChevronLeft,
    ChevronRight,
    Minus,
    Plus,
    ShieldCheck,
    MapPin,
    Clock,
    Truck,
    Tag,
    PlayCircle,
} from 'lucide-react';

function isRecentlyActive(lastActive) {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 15 * 60 * 1000; // 15 minutes
}

function formatLastActive(lastActive) {
    if (!lastActive) return 'Activity unknown';
    const diffMs = Date.now() - new Date(lastActive).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 15) return 'Active now';
    if (mins < 60) return `Active ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Active ${days}d ago`;
    return `Active ${new Date(lastActive).toLocaleDateString()}`;
}

export default function ProductDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [reviews, setReviews] = useState(null);
    const [activeImg, setActiveImg] = useState(0);
    const [qty, setQty] = useState(1);
    const [similar, setSimilar] = useState([]);
    const [showReport, setShowReport] = useState(false);
    const isDemo = id?.startsWith('demo-');

    useEffect(() => {
        setProduct(null);
        setActiveImg(0);
        setQty(1);
        if (isDemo) {
            setProduct(getDemoProduct(id) || null);
            return;
        }
        api.get(`/products/${id}`)
            .then((res) => setProduct(res.data))
            .catch(() => {
                toast.error('This listing has been removed by the seller.');
                navigate('/browse');
            });
    }, [id]);

    useEffect(() => {
        if (isDemo && product) {
            const ratings = product.reviews.map((r) => r.rating);
            const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
            setReviews({ reviews: product.reviews, avg_rating: avg, total: ratings.length });
            return;
        }
        if (product?.id) {
            api.get(`/reviews/product/${product.id}`)
                .then((res) => setReviews(res.data))
                .catch(() => {});
        }
    }, [product]);

    useEffect(() => {
        if (isDemo || !product?.category) return;
        api.get('/products', { params: { category: product.category } })
            .then((res) => {
                setSimilar(res.data.filter((p) => p.id !== product.id).slice(0, 4));
            })
            .catch(() => {});
    }, [product]);

    const slides = product
        ? (isDemo
            ? [{ image_url: product.primary_image }]
            : [
                ...(product.images?.length ? product.images : [{ image_url: null }]),
                ...(product.video_url ? [{ video_url: product.video_url }] : []),
              ])
        : [];

    useEffect(() => {
        const currentIsVideo = slides[activeImg]?.video_url;
        if (slides.length <= 1 || currentIsVideo) return;
        const timer = setInterval(() => {
            setActiveImg((i) => (i + 1) % slides.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [slides.length, activeImg]);

    if (!product) {
        return <div className="max-w-5xl mx-auto px-4 py-24 text-center text-slate-400 dark:text-gold-200/50 dark:bg-ink-900 min-h-screen">Loading…</div>;
    }

    const stock = product.stock ?? 1;
    const isOutOfStock = stock <= 0;
    const isOwner = user && user.id === product.seller_id;

    const handleAddToCart = () => {
        if (isOutOfStock) {
            toast.error('Sorry, this item is out of stock.');
            return;
        }
        if (isOwner) {
            toast.error('You cannot add your own listing to cart.');
            return;
        }
        if (qty > stock) {
            toast.error(`Only ${stock} available in stock.`);
            return;
        }
        for (let i = 0; i < qty; i++) {
            addItem({
                id: product.id,
                title: product.title,
                price: product.price,
                primary_image: product.images?.[0]?.image_url || product.primary_image,
                seller_id: product.seller_id,
                seller_name: product.seller_name,
                seller_whatsapp: product.seller_whatsapp || product.whatsapp,
                seller_school: product.seller_school,
                stock: product.stock,
            });
        }
        toast.success(`Added ${qty} to cart`);
    };

    const handleBuyNow = () => {
        if (isOutOfStock) {
            toast.error('Sorry, this item is out of stock.');
            return;
        }
        if (isOwner) {
            toast.error('You cannot buy your own listing.');
            return;
        }
        handleAddToCart();
        navigate('/cart');
    };

    const handleMessage = () => {
        if (isDemo) return toast('This is a demo listing — messaging isn\'t connected yet.');
        if (isOwner) {
            toast('You are the seller – no need to message yourself.');
            return;
        }
        const number = formatWhatsAppNumber(product.seller_whatsapp || product.whatsapp);
        if (!number) {
            toast.error(`${sellerName} hasn't added a WhatsApp number yet.`);
            return;
        }
        const message = `Hi ${sellerName || ''}, I'm interested in "${product.title}" (GHS ${parseFloat(product.price).toFixed(2)}) on CampusCart. Is it still available?`;
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const sellerName = product.seller_name;
    const sellerInitial = sellerName ? sellerName.charAt(0).toUpperCase() : '?';
    const posted = isDemo ? product.posted : (product.created_at ? new Date(product.created_at).toLocaleDateString() : null);
    const relatedCategory = product.category || product.category_name;

    // ---- Seller Card Component ----
    const SellerCard = () => (
        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-3">Sold by</p>
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    {product.seller_avatar ? (
                        <img
                            src={product.seller_avatar}
                            alt={sellerName}
                            className="w-11 h-11 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-11 h-11 rounded-full bg-brand-100 dark:bg-gold-900 text-brand-700 dark:text-gold-400 flex items-center justify-center font-bold text-sm">
                            {sellerInitial}
                        </div>
                    )}
                    {isRecentlyActive(product.seller_last_active) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-ink-800" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-900 dark:text-gold-50 truncate">{sellerName}</p>
                        {product.seller_verified && (
                            <ShieldCheck size={14} className="text-brand-600 dark:text-gold-400 shrink-0" />
                        )}
                    </div>
                    {product.seller_verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Verified student
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-gold-400 mt-0.5">
                            Not yet verified
                        </span>
                    )}
                    {!isDemo && (
                        <p className="text-[11px] text-slate-400 dark:text-gold-200/50 mt-0.5">
                            {formatLastActive(product.seller_last_active)}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-600 space-y-2.5">
                {(isDemo ? product.seller_school : product.seller_school) && (
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin size={14} className="text-slate-400 dark:text-gold-300/50 shrink-0" />
                        <span className="text-slate-600 dark:text-gold-100/80">{product.seller_school}</span>
                    </div>
                )}
                {product.seller_location && (
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin size={14} className="text-slate-400 dark:text-gold-300/50 shrink-0" />
                        <span className="text-slate-600 dark:text-gold-100/80">{product.seller_location}</span>
                    </div>
                )}
                {(product.seller_whatsapp || product.whatsapp) && (
                    <a
                        href={isOwner ? '#' : `https://wa.me/${formatWhatsAppNumber(product.seller_whatsapp || product.whatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={isOwner ? (e) => { e.preventDefault(); toast('You are the seller.'); } : undefined}
                        className={`flex items-center gap-2 text-sm transition ${
                            isOwner
                                ? 'text-slate-400 dark:text-gold-200/40 cursor-not-allowed'
                                : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300'
                        }`}
                    >
                        <MessageCircle size={14} className="shrink-0" />
                        {product.seller_whatsapp || product.whatsapp}
                    </a>
                )}
            </div>
        </div>
    );

    // ---- Trust Strip Component ----
    const TrustStrip = () => (
        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-brand-600 dark:text-gold-400 shrink-0" />
                <p className="text-sm text-slate-600 dark:text-gold-100/80">Email-verified student seller</p>
            </div>
            <div className="flex items-center gap-3">
                <Truck size={18} className="text-brand-600 dark:text-gold-400 shrink-0" />
                <p className="text-sm text-slate-600 dark:text-gold-100/80">Meet up on campus, or arrange delivery with the seller</p>
            </div>
            <div className="flex items-center gap-3">
                <Clock size={18} className="text-brand-600 dark:text-gold-400 shrink-0" />
                <p className="text-sm text-slate-600 dark:text-gold-100/80">Usually responds within a few hours</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white dark:bg-ink-900 min-h-screen">
            <Link to="/browse" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-gold-200/60 hover:text-brand-600 dark:hover:text-gold-400 mb-6">
                <ChevronLeft size={16} /> Back to browse
            </Link>

            <div className="grid lg:grid-cols-5 gap-8">
                {/* IMAGES / VIDEO */}
                <div className="lg:col-span-3">
                    <div className="relative aspect-square bg-slate-100 dark:bg-ink-700 rounded-2xl overflow-hidden group">
                        {slides.every((s) => !s.image_url && !s.video_url) ? (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-ink-500">
                                <Tag size={48} />
                            </div>
                        ) : (
                            slides.map((slide, i) => {
                                const isActive = i === activeImg;
                                if (slide.video_url) {
                                    return (
                                        <video
                                            key={slide.video_url + i}
                                            src={slide.video_url}
                                            controls
                                            playsInline
                                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                                                isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                            }`}
                                        />
                                    );
                                }
                                return slide.image_url && (
                                    <img
                                        key={slide.image_url + i}
                                        src={slide.image_url}
                                        alt={product.title}
                                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                                            isActive ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    />
                                );
                            })
                        )}

                        {slides.length > 1 && (
                            <>
                                <button
                                    onClick={() => setActiveImg((i) => (i === 0 ? slides.length - 1 : i - 1))}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg hover:bg-white/30 transition z-10"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={() => setActiveImg((i) => (i === slides.length - 1 ? 0 : i + 1))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg hover:bg-white/30 transition z-10"
                                >
                                    <ChevronRight size={20} />
                                </button>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                    {slides.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActiveImg(i)}
                                            className={`h-1.5 rounded-full transition-all ${activeImg === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    {slides.length > 1 && (
                        <div className="flex gap-2 mt-3">
                            {slides.map((slide, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveImg(i)}
                                    className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 ${activeImg === i ? 'border-brand-500 dark:border-gold-500' : 'border-transparent'}`}
                                >
                                    {slide.video_url ? (
                                        <>
                                            <video src={slide.video_url} className="w-full h-full object-cover" muted />
                                            <span className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                <PlayCircle size={18} className="text-white" />
                                            </span>
                                        </>
                                    ) : (
                                        <img src={slide.image_url} className="w-full h-full object-cover" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* MOBILE: Title, Price, Sold By, Description, Details, Reviews, Trust */}
                    {/* ============================================================ */}

                    {/* Title & Price - Mobile only */}
                    <div className="lg:hidden mt-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-700 dark:text-gold-400 text-xs font-semibold capitalize">
                            {product.condition}
                        </span>
                        <h1 className="text-xl font-extrabold text-slate-900 dark:text-gold-50 mt-2 leading-snug">{product.title}</h1>
                        {reviews?.avg_rating && (
                            <div className="flex items-center gap-1.5 mt-1 text-sm">
                                <Star size={14} className="fill-amber-400 text-amber-400" />
                                <span className="font-semibold text-slate-700 dark:text-gold-100">{reviews.avg_rating}</span>
                                <span className="text-slate-400 dark:text-gold-200/50">({reviews.total} reviews)</span>
                            </div>
                        )}
                        <p className="text-3xl font-extrabold text-brand-700 dark:text-gold-400 mt-2">GHS {parseFloat(product.price).toFixed(2)}</p>

                        {isOwner && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-400">
                                ⚠️ You are the seller of this item. You cannot purchase your own listing.
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-4">
                            <span className="text-sm font-semibold text-slate-700 dark:text-gold-100">Qty</span>
                            <div className="flex items-center gap-3 border border-slate-200 dark:border-ink-600 rounded-lg px-3 py-1.5">
                                <button
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    disabled={qty <= 1 || isOwner}
                                    className="text-slate-500 dark:text-gold-200/60 hover:text-slate-800 dark:hover:text-gold-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="text-sm w-4 text-center font-semibold text-slate-800 dark:text-gold-100">{qty}</span>
                                <button
                                    onClick={() => setQty((q) => Math.min(stock, q + 1))}
                                    disabled={isOutOfStock || qty >= stock || isOwner}
                                    className="text-slate-500 dark:text-gold-200/60 hover:text-slate-800 dark:hover:text-gold-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <span className="text-xs text-slate-400 dark:text-gold-200/50">
                                {isOutOfStock ? 'Out of stock' : `${stock} available`}
                            </span>
                        </div>

                        <div className="mt-4 flex flex-col gap-2.5">
                            <button
                                onClick={handleBuyNow}
                                disabled={isOutOfStock || isOwner}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition ${
                                    isOutOfStock || isOwner
                                        ? 'bg-slate-300 dark:bg-ink-700 text-slate-500 dark:text-gold-200/50 cursor-not-allowed'
                                        : 'bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900'
                                }`}
                            >
                                {isOutOfStock ? 'Out of Stock' : isOwner ? 'Your Own Listing' : 'Buy now'}
                            </button>
                            <button
                                onClick={handleAddToCart}
                                disabled={isOutOfStock || isOwner}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition ${
                                    isOutOfStock || isOwner
                                        ? 'border-slate-200 dark:border-ink-600 text-slate-400 dark:text-gold-200/30 cursor-not-allowed'
                                        : 'border-slate-200 dark:border-ink-600 hover:border-brand-400 dark:hover:border-gold-500 text-slate-700 dark:text-gold-100'
                                }`}
                            >
                                <ShoppingCart size={18} /> {isOwner ? 'Cannot buy' : 'Add to cart'}
                            </button>
                            <button
                                onClick={handleMessage}
                                disabled={isOwner}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition ${
                                    isOwner
                                        ? 'border-slate-200 dark:border-ink-600 text-slate-400 dark:text-gold-200/30 cursor-not-allowed'
                                        : 'border-slate-200 dark:border-ink-600 hover:border-brand-400 dark:hover:border-gold-500 text-slate-700 dark:text-gold-100'
                                }`}
                            >
                                <MessageCircle size={18} /> {isOwner ? 'You are the seller' : 'Message seller'}
                            </button>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* Sold By - Mobile only (moved up before description) */}
                    {/* ============================================================ */}
                    <div className="lg:hidden mt-6">
                        <SellerCard />
                    </div>

                    {/* ============================================================ */}
                    {/* Description */}
                    {/* ============================================================ */}
                    <div className="mt-8 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
                        <h2 className="font-bold text-slate-900 dark:text-gold-50 mb-2">Description</h2>
                        <p className="text-slate-600 dark:text-gold-100/80 text-sm leading-relaxed whitespace-pre-line">
                            {product.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* ============================================================ */}
                    {/* Details */}
                    {/* ============================================================ */}
                    <div className="mt-6 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5">
                        <h2 className="font-bold text-slate-900 dark:text-gold-50 mb-3">Details</h2>
                        <dl className="grid grid-cols-2 gap-y-3 text-sm">
                            <dt className="text-slate-400 dark:text-gold-200/50">Condition</dt>
                            <dd className="text-slate-800 dark:text-gold-100 font-medium capitalize">{product.condition}</dd>
                            {relatedCategory && (
                                <>
                                    <dt className="text-slate-400 dark:text-gold-200/50">Category</dt>
                                    <dd className="text-slate-800 dark:text-gold-100 font-medium">{relatedCategory}</dd>
                                </>
                            )}
                            <dt className="text-slate-400 dark:text-gold-200/50">Available</dt>
                            <dd className="text-slate-800 dark:text-gold-100 font-medium">{stock} in stock</dd>
                            {posted && (
                                <>
                                    <dt className="text-slate-400 dark:text-gold-200/50">Posted</dt>
                                    <dd className="text-slate-800 dark:text-gold-100 font-medium">{posted}</dd>
                                </>
                            )}
                        </dl>
                    </div>

                    {/* ============================================================ */}
                    {/* Reviews */}
                    {/* ============================================================ */}
                    <ReviewsSection reviewsData={reviews} productId={product.id} />

                    {/* ============================================================ */}
                    {/* Trust Strip - Mobile only (moved below reviews) */}
                    {/* ============================================================ */}
                    <div className="lg:hidden mt-6">
                        <TrustStrip />
                    </div>

                    {/* Report button - Mobile only */}
                    {!isDemo && (
                        <div className="lg:hidden mt-4">
                            <button
                                onClick={() => setShowReport(true)}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-gold-200/40 hover:text-red-500 dark:hover:text-red-400 transition py-2"
                            >
                                <Flag size={13} /> Report this listing
                            </button>
                        </div>
                    )}
                </div>

                {/* ============================================================ */}
                {/* DESKTOP SIDEBAR (lg: and up) */}
                {/* ============================================================ */}
                <div className="hidden lg:block lg:col-span-2 space-y-5">
                    <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 sticky top-24">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-700 dark:text-gold-400 text-xs font-semibold capitalize">
                            {product.condition}
                        </span>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-gold-50 mt-3 leading-snug">{product.title}</h1>

                        {reviews?.avg_rating && (
                            <div className="flex items-center gap-1.5 mt-2 text-sm">
                                <Star size={14} className="fill-amber-400 text-amber-400" />
                                <span className="font-semibold text-slate-700 dark:text-gold-100">{reviews.avg_rating}</span>
                                <span className="text-slate-400 dark:text-gold-200/50">({reviews.total} reviews)</span>
                            </div>
                        )}

                        <p className="text-3xl font-extrabold text-brand-700 dark:text-gold-400 mt-3">GHS {parseFloat(product.price).toFixed(2)}</p>

                        {isOwner && (
                            <div className="mt-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-400">
                                ⚠️ You are the seller of this item. You cannot purchase your own listing.
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-5">
                            <span className="text-sm font-semibold text-slate-700 dark:text-gold-100">Qty</span>
                            <div className="flex items-center gap-3 border border-slate-200 dark:border-ink-600 rounded-lg px-3 py-1.5">
                                <button
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    disabled={qty <= 1 || isOwner}
                                    className="text-slate-500 dark:text-gold-200/60 hover:text-slate-800 dark:hover:text-gold-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="text-sm w-4 text-center font-semibold text-slate-800 dark:text-gold-100">{qty}</span>
                                <button
                                    onClick={() => setQty((q) => Math.min(stock, q + 1))}
                                    disabled={isOutOfStock || qty >= stock || isOwner}
                                    className="text-slate-500 dark:text-gold-200/60 hover:text-slate-800 dark:hover:text-gold-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <span className="text-xs text-slate-400 dark:text-gold-200/50">
                                {isOutOfStock ? 'Out of stock' : `${stock} available`}
                            </span>
                        </div>

                        <div className="mt-5 flex flex-col gap-2.5">
                            <button
                                onClick={handleBuyNow}
                                disabled={isOutOfStock || isOwner}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition ${
                                    isOutOfStock || isOwner
                                        ? 'bg-slate-300 dark:bg-ink-700 text-slate-500 dark:text-gold-200/50 cursor-not-allowed'
                                        : 'bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900'
                                }`}
                            >
                                {isOutOfStock ? 'Out of Stock' : isOwner ? 'Your Own Listing' : 'Buy now'}
                            </button>
                            <button
                                onClick={handleAddToCart}
                                disabled={isOutOfStock || isOwner}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition ${
                                    isOutOfStock || isOwner
                                        ? 'border-slate-200 dark:border-ink-600 text-slate-400 dark:text-gold-200/30 cursor-not-allowed'
                                        : 'border-slate-200 dark:border-ink-600 hover:border-brand-400 dark:hover:border-gold-500 text-slate-700 dark:text-gold-100'
                                }`}
                            >
                                <ShoppingCart size={18} /> {isOwner ? 'Cannot buy' : 'Add to cart'}
                            </button>
                            <button
                                onClick={handleMessage}
                                disabled={isOwner}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition ${
                                    isOwner
                                        ? 'border-slate-200 dark:border-ink-600 text-slate-400 dark:text-gold-200/30 cursor-not-allowed'
                                        : 'border-slate-200 dark:border-ink-600 hover:border-brand-400 dark:hover:border-gold-500 text-slate-700 dark:text-gold-100'
                                }`}
                            >
                                <MessageCircle size={18} /> {isOwner ? 'You are the seller' : 'Message seller'}
                            </button>
                        </div>
                    </div>

                    {/* Desktop: Seller Card */}
                    <SellerCard />

                    {/* Desktop: Trust Strip */}
                    <TrustStrip />

                    {!isDemo && (
                        <button
                            onClick={() => setShowReport(true)}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-gold-200/40 hover:text-red-500 dark:hover:text-red-400 transition py-2"
                        >
                            <Flag size={13} /> Report this listing
                        </button>
                    )}
                </div>
            </div>

            {similar.length > 0 && (
                <div className="mt-12">
                    <h2 className="font-bold text-slate-900 dark:text-gold-50 text-lg mb-4">Similar listings</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {similar.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                </div>
            )}

            <ReportModal
                open={showReport}
                onClose={() => setShowReport(false)}
                productId={product.id}
                reportedUserId={product.seller_id}
            />
        </div>
    );
}