import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getDemoProduct } from '../data/demoProducts';
import {
    ShoppingCart,
    MessageCircle,
    Star,
    ChevronLeft,
    Minus,
    Plus,
    ShieldCheck,
    MapPin,
    Clock,
    Truck,
    Tag,
} from 'lucide-react';

export default function ProductDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [reviews, setReviews] = useState(null);
    const [activeImg, setActiveImg] = useState(0);
    const [qty, setQty] = useState(1);
    const isDemo = id.startsWith('demo-');

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
            });    }, [id]);

    useEffect(() => {
        if (isDemo && product) {
            const ratings = product.reviews.map((r) => r.rating);
            const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
            setReviews({ reviews: product.reviews, avg_rating: avg, total: ratings.length });
            return;
        }
        if (product?.seller_id) {
            api.get(`/reviews/seller/${product.seller_id}`).then((res) => setReviews(res.data)).catch(() => {});
        }
    }, [product]);

    if (!product) {
        return <div className="max-w-5xl mx-auto px-4 py-24 text-center text-slate-400">Loading…</div>;
    }

    const images = isDemo
        ? [{ image_url: product.primary_image }]
        : (product.images?.length ? product.images : [{ image_url: null }]);

    const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) {
        addItem({
            id: product.id,
            title: product.title,
            price: product.price,
            primary_image: images[0]?.image_url,
            seller_id: product.seller_id,
            seller_name: product.seller_name,
            seller_whatsapp: product.seller_whatsapp || product.whatsapp,
        });
    }
    toast.success(`Added ${qty} to cart`);
};

    const handleBuyNow = () => {
        handleAddToCart();
        navigate('/cart');
    };

    const handleMessage = () => {
        if (isDemo) return toast('This is a demo listing — messaging isn\u2019t connected yet.');
        if (!user) return navigate('/login');
        navigate(`/messages/${product.seller_id}?product=${product.id}`);
    };

    const sellerName = product.seller_name;
    const sellerInitial = sellerName ? sellerName.charAt(0).toUpperCase() : '?';
    const posted = isDemo ? product.posted : (product.created_at ? new Date(product.created_at).toLocaleDateString() : null);
    const stock = product.stock ?? 1;
    const relatedCategory = product.category || product.category_name;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link to="/browse" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 mb-6">
                <ChevronLeft size={16} /> Back to browse
            </Link>

            <div className="grid lg:grid-cols-5 gap-8">
                {/* IMAGES */}
                <div className="lg:col-span-3">
                    <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden">
                        {images[activeImg]?.image_url ? (
                            <img src={images[activeImg].image_url} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Tag size={48} />
                            </div>
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="flex gap-2 mt-3">
                            {images.map((img, i) => (
                                <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${activeImg === i ? 'border-brand-500' : 'border-transparent'}`}>
                                    <img src={img.image_url} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* DESCRIPTION */}
                    <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5">
                        <h2 className="font-bold text-slate-900 mb-2">Description</h2>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                            {product.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* DETAILS TABLE */}
                    <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-5">
                        <h2 className="font-bold text-slate-900 mb-3">Details</h2>
                        <dl className="grid grid-cols-2 gap-y-3 text-sm">
                            <dt className="text-slate-400">Condition</dt>
                            <dd className="text-slate-800 font-medium capitalize">{product.condition}</dd>
                            {relatedCategory && (
                                <>
                                    <dt className="text-slate-400">Category</dt>
                                    <dd className="text-slate-800 font-medium">{relatedCategory}</dd>
                                </>
                            )}
                            <dt className="text-slate-400">Available</dt>
                            <dd className="text-slate-800 font-medium">{stock} in stock</dd>
                            {posted && (
                                <>
                                    <dt className="text-slate-400">Posted</dt>
                                    <dd className="text-slate-800 font-medium">{posted}</dd>
                                </>
                            )}
                        </dl>
                    </div>

                    {/* REVIEWS */}
                    <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-900">Reviews</h2>
                            {reviews?.avg_rating && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Star size={14} className="fill-amber-400 text-amber-400" />
                                    <span className="font-semibold text-slate-800">{reviews.avg_rating}</span>
                                    <span className="text-slate-400">({reviews.total} reviews)</span>
                                </div>
                            )}
                        </div>

                        {!reviews?.reviews?.length ? (
                            <p className="text-sm text-slate-400">No reviews yet for this seller.</p>
                        ) : (
                            <div className="space-y-4">
                                {reviews.reviews.map((r, i) => (
                                    <div key={i} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-slate-800 text-sm">{r.reviewer_name || r.name}</p>
                                            <div className="flex items-center gap-0.5">
                                                {Array.from({ length: 5 }).map((_, s) => (
                                                    <Star key={s} size={12} className={s < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-slate-500 text-sm mt-1">{r.comment}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SIDEBAR */}
                <div className="lg:col-span-2 space-y-5">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold capitalize">
                            {product.condition}
                        </span>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-3 leading-snug">{product.title}</h1>

                        {reviews?.avg_rating && (
                            <div className="flex items-center gap-1.5 mt-2 text-sm">
                                <Star size={14} className="fill-amber-400 text-amber-400" />
                                <span className="font-semibold text-slate-700">{reviews.avg_rating}</span>
                                <span className="text-slate-400">({reviews.total} reviews)</span>
                            </div>
                        )}

                        <p className="text-3xl font-extrabold text-brand-700 mt-3">GHS {parseFloat(product.price).toFixed(2)}</p>

                        <div className="flex items-center gap-3 mt-5">
                            <span className="text-sm font-semibold text-slate-700">Qty</span>
                            <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-1.5">
                                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-slate-500 hover:text-slate-800">
                                    <Minus size={14} />
                                </button>
                                <span className="text-sm w-4 text-center font-semibold">{qty}</span>
                                <button onClick={() => setQty((q) => Math.min(stock, q + 1))} className="text-slate-500 hover:text-slate-800">
                                    <Plus size={14} />
                                </button>
                            </div>
                            <span className="text-xs text-slate-400">{stock} available</span>
                        </div>

                        <div className="mt-5 flex flex-col gap-2.5">
                            <button onClick={handleBuyNow} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition">
                                Buy now
                            </button>
                            <button onClick={handleAddToCart} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:border-brand-400 text-slate-700 font-semibold text-sm transition">
                                <ShoppingCart size={18} /> Add to cart
                            </button>
                            <button onClick={handleMessage} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:border-brand-400 text-slate-700 font-semibold text-sm transition">
                                <MessageCircle size={18} /> Message seller
                            </button>
                        </div>
                    </div>

                    {/* SELLER CARD */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Sold by</p>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                                {sellerInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">{sellerName}</p>
                                {(isDemo ? product.seller_school : null) && (
                                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                        <MapPin size={11} /> {product.seller_school}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TRUST STRIP */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={18} className="text-brand-600 shrink-0" />
                            <p className="text-sm text-slate-600">Email-verified student seller</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Truck size={18} className="text-brand-600 shrink-0" />
                            <p className="text-sm text-slate-600">Meet up on campus, or arrange delivery with the seller</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock size={18} className="text-brand-600 shrink-0" />
                            <p className="text-sm text-slate-600">Usually responds within a few hours</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}