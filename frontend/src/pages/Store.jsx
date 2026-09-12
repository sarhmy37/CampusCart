import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import { ArrowLeft, Star, Tag, Sparkles } from 'lucide-react';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

const SOCIAL_LINKS = [
    {
        key: 'social_tiktok',
        label: 'TikTok',
        color: 'bg-black hover:bg-slate-800',
        href: (v) => `https://www.tiktok.com/@${v.replace('@', '')}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M16.6 5.82c-1-.87-1.6-2.14-1.6-3.52h-3.15v13.4c0 1.62-1.3 2.93-2.92 2.93a2.92 2.92 0 0 1-2.92-2.93 2.92 2.92 0 0 1 2.92-2.92c.3 0 .58.04.85.13V9.75a6.13 6.13 0 0 0-.85-.06A6.1 6.1 0 0 0 3.02 15.8 6.1 6.1 0 0 0 9.13 21.9a6.1 6.1 0 0 0 6.1-6.1V8.57a9.14 9.14 0 0 0 5.31 1.7V7.1a5.97 5.97 0 0 1-3.94-1.28z"/>
            </svg>
        ),
    },
    {
        key: 'social_whatsapp',
        label: 'WhatsApp',
        color: 'bg-[#25D366] hover:bg-[#1da851]',
        href: (v) => `https://wa.me/${v.replace(/\D/g, '')}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2z"/>
            </svg>
        ),
    },
    {
        key: 'social_instagram',
        label: 'Instagram',
        color: 'bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] hover:opacity-90',
        href: (v) => `https://instagram.com/${v.replace('@', '')}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 2c-2.72 0-3.06.01-4.13.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2.01 8.94 2 9.28 2 12s.01 3.06.06 4.13c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.94 21.99 9.28 22 12 22s3.06-.01 4.13-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.07.06-1.41.06-4.13s-.01-3.06-.06-4.13c-.05-1.06-.22-1.79-.47-2.43a4.9 4.9 0 0 0-1.16-1.77 4.9 4.9 0 0 0-1.77-1.16c-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2Z"/>
            </svg>
        ),
    },
    {
        key: 'social_snapchat',
        label: 'Snapchat',
        color: 'bg-[#FFFC00] hover:bg-[#e6e300]',
        textColor: 'text-black',
        href: (v) => `https://snapchat.com/add/${v.replace('@', '')}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12.006 2.001C9.875 2.001 8.05 3.254 6.874 5.328c-.858 1.38-1.372 3.053-1.58 4.883-.211 1.86-.042 3.544.458 4.897-.36.082-.744.132-1.142.132-1.63 0-3.114-.709-3.114-2.188 0-.554.286-1.006.601-1.273.5-.5 1.5-.7 1.5-2.05 0-.6-.4-1.1-.9-1.2 0 0 .8-2.5 3-2.5 1.5 0 2.5 1 3.5 1s2-1 3.5-1c2.2 0 3 2.5 3 2.5-.5.1-.9.6-.9 1.2 0 1.35 1 1.55 1.5 2.05.315.267.601.719.601 1.273 0 1.479-1.484 2.188-3.114 2.188-.398 0-.782-.05-1.142-.132.5 1.353.669 3.037.458 4.897 5.077 4.487.709.306 1.262.489 1.694.625 4.548-.382-.789-.773-1.647-1.157-2.608z"/>
            </svg>
        ),
    },
    {
        key: 'social_facebook',
        label: 'Facebook',
        color: 'bg-[#1877F2] hover:bg-[#0d65d9]',
        href: (v) => (v.startsWith('http') ? v : `https://facebook.com/${v}`),
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z"/>
            </svg>
        ),
    },
];

function SocialHandlesRow({ seller }) {
    const activeLinks = SOCIAL_LINKS.filter((link) => seller?.[link.key]);
    if (activeLinks.length === 0) return null;

    return (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
            {activeLinks.map((link) => (
                <a
                    key={link.key}
                    href={link.href(seller[link.key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label}
                    className={`p-2 rounded-lg text-white transition ${link.color} ${link.textColor || ''}`}
                >
                    {link.icon}
                </a>
            ))}
        </div>
    );
}

export default function StorePage({ id: idProp, embedded }) {
    const { id: idParam } = useParams();
    const id = idProp || idParam;
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

    const sellerPlanActive = seller?.plan && seller.plan !== 'free' &&
        seller?.plan_expires_at && new Date(seller.plan_expires_at) > new Date();
    const sellerPlan = sellerPlanActive ? seller.plan.toLowerCase() : null;

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
            <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900" style={{ paddingTop: 'var(--safe-top)' }}>
                {seller.avatar_url && (
                    <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 pointer-events-none"
                        style={{
                            backgroundImage: `url(${seller.avatar_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(8px)',
                            opacity: 0.6,
                            borderRadius: '9999px',
                            maskImage: 'radial-gradient(circle, black 30%, transparent 72%)',
                            WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 72%)',
                        }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900 opacity-25 pointer-events-none" />          
                      <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />
                
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10">
                    {!embedded && (
                        <Link
                            to="/browse"
                            className="inline-flex items-center gap-1.5 bg-white/10 text-white font-semibold px-3 py-1.5 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-sm"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Browse
                        </Link>
                    )}

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
                                    <CheckBadgeIcon title="Verified seller" className="w-5 h-5 text-emerald-400 shrink-0" />
                                )}
                                {sellerPlan && (
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                        sellerPlan === 'premium'
                                            ? 'bg-purple-500/20 text-purple-100 border-purple-300/30'
                                            : 'bg-blue-500/20 text-blue-100 border-blue-300/30'
                                    }`}>
                                        {sellerPlan === 'premium' ? <Sparkles size={12} /> : <Star size={12} />}
                                        {sellerPlan === 'premium' ? 'Premium Seller' : 'Pro Seller'}
                                    </span>
                                )}
                            </div>
                            <p className="text-white/70 text-sm mt-1">
                                {[seller.school, seller.location].filter(Boolean).join(' · ')}
                            </p>
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

                    <SocialHandlesRow seller={seller} />
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