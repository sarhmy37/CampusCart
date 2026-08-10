import { Link } from 'react-router-dom';
import { Tag, Star, Heart, BadgeCheck } from 'lucide-react';

// Deterministic pseudo-rating so demo/dummy cards look populated.
// Real products can pass an actual `rating` field once reviews are per-product.
function fakeRating(id) {
    const seed = String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return (3.6 + (seed % 14) / 10).toFixed(1);
}

export default function ProductCard({ product }) {
    const rating = product.rating || fakeRating(product.id);
    const reviewCount = product.review_count ?? (1 + (String(product.id).length * 3) % 24);

    const CardInner = (
        <div className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="aspect-square bg-slate-100 overflow-hidden relative">
                {product.primary_image ? (
                    <img
                        src={product.primary_image}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100">
                        <Tag size={36} />
                    </div>
                )}

                <span className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-700 capitalize shadow-sm">
                    {product.condition}
                </span>

                <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition"
                >
                    <Heart size={14} />
                </button>
            </div>

            <div className="p-3.5">
                <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug min-h-[2.5rem]">{product.title}</h3>

                <div className="flex items-center gap-1 mt-1.5">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold text-slate-700">{rating}</span>
                    <span className="text-xs text-slate-400">({reviewCount})</span>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <span className="text-brand-700 font-extrabold text-lg">GHS {parseFloat(product.price).toFixed(2)}</span>
                </div>
<p className="text-xs text-slate-400 mt-1 truncate flex items-center gap-1">
                    {product.seller_name}
                    {product.seller_verified && <BadgeCheck size={12} className="text-brand-500 shrink-0" />}
                </p>            </div>
        </div>
    );

    return <Link to={`/product/${product.id}`}>{CardInner}</Link>;
}