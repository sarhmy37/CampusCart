import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import { ArrowLeft, Star, Tag, ShieldCheck } from 'lucide-react';

export default function Store() {
    const { id } = useParams();
    const [seller, setSeller] = useState(null);
    const [listings, setListings] = useState([]);
    const [rating, setRating] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setLoading(true);
        setNotFound(false);
        Promise.all([
            api.get(`/products/seller/${id}`),
            api.get(`/reviews/seller/${id}`).catch(() => ({ data: { avg_rating: null, total: 0 } })),
        ])
            .then(([storeRes, reviewsRes]) => {
                setSeller(storeRes.data.seller);
                setListings(storeRes.data.listings);
                setRating(reviewsRes.data);
            })
            .catch((err) => {
                if (err.response?.status === 404) setNotFound(true);
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse mb-6" />
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (notFound || !seller) {
        return (
            <div className="max-w-md mx-auto px-4 py-20 text-center">
                <p className="text-lg font-bold text-slate-800 dark:text-gold-100">Store not found</p>
                <p className="text-sm text-slate-400 dark:text-gold-200/50 mt-2">
                    This seller doesn't exist or their account is no longer active.
                </p>
                <Link
                    to="/browse"
                    className="inline-flex items-center gap-1.5 mt-6 px-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition"
                >
                    Browse listings →
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* HEADER */}
            <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-accent-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                    <Link
                        to="/browse"
                        className="inline-flex items-center gap-1.5 bg-white/10 text-white font-semibold px-3 py-1.5 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-sm"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Browse
                    </Link>

                    <div className="flex items-center gap-4 mt-6">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 border-2 border-white/30 backdrop-blur flex items-center justify-center overflow-hidden shrink-0">
                            {seller.avatar_url ? (
                                <img src={seller.avatar_url} alt={seller.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-white font-bold text-2xl">
                                    {seller.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-extrabold text-white truncate">{seller.name}</h1>
                                {seller.verified && (
                                    <span className="inline-flex items-center gap-1 bg-white/15 text-white text-xs font-semibold px-2 py-0.5 rounded-full border border-white/20">
                                        <ShieldCheck size={12} /> Verified
                                    </span>
                                )}
                            </div>
                            <p className="text-white/70 text-sm mt-1">{seller.school}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-5 mt-5">
                        <div className="flex items-center gap-1.5">
                            <Tag size={15} className="text-white/70" />
                            <span className="text-sm font-semibold text-white">{listings.length}</span>
                            <span className="text-xs text-white/60">listings</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Star size={15} className={rating?.avg_rating ? 'text-gold-300 fill-gold-300' : 'text-white/40'} />
                            <span className="text-sm font-semibold text-white">
                                {rating?.avg_rating ? rating.avg_rating : '—'}
                            </span>
                            <span className="text-xs text-white/60">
                                {rating?.total ? `(${rating.total} review${rating.total === 1 ? '' : 's'})` : 'No reviews yet'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* LISTINGS */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {listings.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm text-slate-400 dark:text-gold-200/50">
                            {seller.name} hasn't listed anything yet.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                        {listings.map((p) => (
                            <ProductCard key={p.id} product={p} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}