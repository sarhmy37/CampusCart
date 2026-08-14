import { Link } from 'react-router-dom';
import { Tag, Star, Heart, BadgeCheck, AlertTriangle } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({ product }) {
    const { isWishlisted, toggleItem } = useWishlist();
    const wishlisted = isWishlisted(product.id);
    const rating = product.rating || 0;
    const reviewCount = product.review_count || 0;
    const stock = product.stock !== undefined ? product.stock : null;

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
        } else if (stock <= 5) {
            stockLabel = `Low stock: ${stock}`;
            stockColor = 'text-amber-600 dark:text-amber-400';
        } else {
            stockLabel = `In stock: ${stock}`;
            stockColor = 'text-emerald-600 dark:text-emerald-400';
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
                <span className="hidden sm:block absolute top-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                    Low stock
                </span>
            );
        }
        return null;
    };

    const CardInner = (
        <div className="group relative bg-white dark:bg-ink-800 rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden hover:shadow-lg dark:hover:shadow-gold-900/20 hover:-translate-y-0.5 transition-all duration-300">
            <div className="aspect-square bg-slate-100 dark:bg-ink-700 overflow-hidden relative">
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

                <span className="absolute top-1.5 left-1.5 bg-white/90 dark:bg-ink-900/80 backdrop-blur px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-700 dark:text-gold-100 capitalize shadow-sm">
                    {product.condition}
                </span>

                {renderStockBadge()}

                <button
                    type="button"
                    onClick={handleWishlistClick}
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 dark:bg-ink-900/80 backdrop-blur flex items-center justify-center shadow-sm transition ${
                        wishlisted ? 'text-red-500' : 'text-slate-400 dark:text-gold-200/60 hover:text-red-500'
                    }`}
                >
                    <Heart size={12} className={wishlisted ? 'fill-red-500' : ''} />
                </button>
            </div>

            <div className="p-2.5">
                <h3 className="font-semibold text-slate-900 dark:text-gold-50 text-xs line-clamp-2 leading-snug min-h-[2rem]">{product.title}</h3>

                <div className="flex items-center gap-1 mt-1">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-gold-100">{rating ? Number(rating).toFixed(1) : 'New'}</span>
                    {reviewCount > 0 && (
                        <span className="text-[11px] text-slate-400 dark:text-gold-200/50">({reviewCount})</span>
                    )}
                </div>

                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-brand-700 dark:text-gold-400 font-extrabold text-sm">GHS {parseFloat(product.price).toFixed(2)}</span>
                </div>

                <p className="text-[11px] text-slate-400 dark:text-gold-200/50 mt-0.5 truncate flex items-center gap-1">
                    {product.seller_name}
                    {product.seller_verified && <BadgeCheck size={10} className="text-brand-500 dark:text-gold-500 shrink-0" />}
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