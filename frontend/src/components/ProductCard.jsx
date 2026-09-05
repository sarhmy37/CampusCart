import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Tag, Star, Heart, BadgeCheck, AlertTriangle, PlayCircle, MapPin } from 'lucide-react';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { useWishlist } from '../context/WishlistContext';


export default function ProductCard({ product }) {
    const { isWishlisted, toggleItem } = useWishlist();
    const wishlisted = isWishlisted(product.id);
    const rating = product.rating || 0;
    const reviewCount = product.review_count || 0;
    const stock = product.stock !== undefined ? product.stock : null;

    // ====== VIDEO VIEWPORT LOGIC ======
    const [isVisible, setIsVisible] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const cardRef = useRef(null);

    useEffect(() => {
        if (!product.video_url) {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.3,
            }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => {
            if (cardRef.current) {
                observer.unobserve(cardRef.current);
            }
        };
    }, [product.video_url]);

    // ====== DISCOUNT CALCULATION ======
    const oldPrice = product.old_price ? parseFloat(product.old_price) : null;
    const currentPrice = parseFloat(product.price);
    let discountPercent = null;

    if (oldPrice && oldPrice > currentPrice && oldPrice > 0 && currentPrice > 0) {
        discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
    }

    const handleWishlistClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleItem(product);
    };

    let stockLabel = null;
    let stockColor = 'text-slate-400 dark:text-gold-200/50';
    if (stock !== null) {
        if (stock <= 0) {
            stockLabel = 'Out of stock';
            stockColor = 'text-red-500 dark:text-red-400';
        }
    }

    const renderStockBadge = () => {
        if (stock === null) return null;
        if (stock <= 0) {
            return (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur">
                    Sold out
                </span>
            );
        }
        if (stock <= 5) {
            return (
                <span className="absolute bottom-1.5 left-1.5 bg-white/90 dark:bg-ink-900/80 backdrop-blur px-1.5 py-0.5 rounded-full text-[9px] font-bold text-amber-600 dark:text-amber-400 shadow-sm">
                    {stock} left
                </span>
            );
        }
        return null;
    };

    const CardInner = (
        <div 
            ref={cardRef}
            className="group relative bg-white dark:bg-ink-800 rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden hover:shadow-lg dark:hover:shadow-gold-900/20 hover:-translate-y-0.5 transition-all duration-300"
        >
            <div className="aspect-square bg-slate-100 dark:bg-ink-700 overflow-hidden relative">
                
                {/* STATIC IMAGE */}
                {product.primary_image ? (
                    <img
                        src={product.primary_image}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-ink-500 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-ink-800 dark:to-ink-700">
                        <Tag size={28} />
                    </div>
                )}

                {/* VIDEO */}
                {product.video_url && (
                    <>
                        <video
                            src={product.video_url}
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            autoPlay={isVisible}
                            onCanPlay={() => setVideoReady(true)}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                                isVisible && videoReady ? 'opacity-100' : 'opacity-0'
                            }`}
                        />
                        {videoReady && (
                            <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur flex items-center justify-center pointer-events-none">
                                <PlayCircle size={13} className="text-white" />
                            </span>
                        )}
                    </>
                )}

                <span className="absolute top-1.5 left-1.5 bg-white/90 dark:bg-ink-900/80 backdrop-blur px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-700 dark:text-gold-100 capitalize shadow-sm">
                    {product.condition}
                </span>

                {renderStockBadge()}

                {/* DISCOUNT BADGE */}
                {discountPercent !== null && (
                    <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
                        -{discountPercent}%
                    </span>
                )}

                {/* ─── WISHLIST ICON — NO PADDING, FLUSH AGAINST CORNER ─── */}
                <button
                    type="button"
                    onClick={handleWishlistClick}
                    className={`absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center transition ${
                        wishlisted ? 'text-red-500' : 'text-slate-400 dark:text-gold-200/60 hover:text-red-500'
                    }`}
                >
                    <Heart size={14} className={wishlisted ? 'fill-red-500 drop-shadow-sm' : ''} />
                </button>
            </div>

            <div className="p-2.5">
                {/* ─── TITLE — removed min-height to reduce space ─── */}
                <h3 className="font-semibold text-slate-900 dark:text-gold-50 text-xs line-clamp-2 leading-snug">
                    {product.title}
                </h3>

                {/* ─── RATING — reduced margin from mt-1 to mt-0.5 ─── */}
                <div className="flex items-center gap-1 mt-0.5">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-gold-100">{rating ? Number(rating).toFixed(1) : 'New'}</span>
                    {reviewCount > 0 && (
                        <span className="text-[11px] text-slate-400 dark:text-gold-200/50">({reviewCount})</span>
                    )}
                </div>

                {/* ─── PRICE SECTION ─── */}
                <div className="mt-1.5">
                    {discountPercent !== null ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] text-slate-400 dark:text-gold-200/50 line-through">
                                    GHS {oldPrice.toFixed(2)}
                                </p>
                                <span className="text-[10px] font-bold text-red-500">
                                    -{discountPercent}%
                                </span>
                            </div>
                            <span className="text-brand-700 dark:text-gold-400 font-extrabold text-xs">
                                GHS {currentPrice.toFixed(2)}
                            </span>
                        </>
                    ) : (
                        <span className="text-brand-700 dark:text-gold-400 font-extrabold text-sm">
                            GHS {currentPrice.toFixed(2)}
                        </span>
                    )}
                </div>

                <p className="text-[11px] text-slate-400 dark:text-gold-200/50 mt-0.5 truncate flex items-center gap-1">
                    <MapPin size={10} className="shrink-0" />
                    {product.seller_meeting_place || 'Meeting place not set'}
                    {product.seller_verified && <CheckBadgeIcon className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                </p>

                {stockLabel && (
                    <div className={`text-[11px] font-medium ${stockColor} mt-0.5 flex items-center gap-1`}>
                        {stock <= 5 && stock > 0 && <AlertTriangle size={11} className="text-amber-500" />}
                        {stockLabel}
                    </div>
                )}
            </div>
        </div>
    );

    return <Link to={`/product/${product.id}`}>{CardInner}</Link>;
}