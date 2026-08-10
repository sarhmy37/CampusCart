import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import HeroSlideshow from '../components/HeroSlideshow';
import { DUMMY_PRODUCTS } from '../data/demoProducts';
import { SlidersHorizontal, ArrowLeft, X, BadgeCheck, Wallet } from 'lucide-react';

const ITEM_TYPES = ['Clothes', 'Phone accessories', 'Stationery', 'Laptops', 'Perfumes', 'Food', 'Sneakers', 'Other'];

const SCHOOLS = [
    { name: 'KNUST', lat: 6.6732, lng: -1.5654 },
    { name: 'ATU', lat: 5.5504, lng: -0.2174 },
    { name: 'UHAS', lat: 6.6008, lng: 0.4713 },
    { name: 'UCC', lat: 5.1153, lng: -1.2903 },
    { name: 'UDS', lat: 9.3730, lng: -0.8850 },
    { name: 'UEW', lat: 5.3621, lng: -0.6339 },
    { name: 'UPSA', lat: 5.6614, lng: -0.1664 },
    { name: 'PentUni', lat: 5.6262, lng: -0.2742 },
    { name: 'KsTU', lat: 6.6911, lng: -1.6100 },
    { name: 'CU', lat: 5.5663, lng: -0.2410 },
];

const PRICE_RANGES = [
    { label: 'Below 100', min: 0, max: 100 },
    { label: '100 - 200', min: 100, max: 200 },
    { label: '200 - 500', min: 200, max: 500 },
    { label: '500 - 1000', min: 500, max: 1000 },
    { label: 'Above 1000', min: 1000, max: Infinity },
];

export default function Browse() {
    const [searchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [itemCategory, setItemCategory] = useState('');
    const [school, setSchool] = useState('');
    const [locating, setLocating] = useState(false);
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [priceRange, setPriceRange] = useState(null); // { min, max } | null
    const [budgetInput, setBudgetInput] = useState('');
    const [loading, setLoading] = useState(true);
    const search = searchParams.get('search') || '';

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    const handleSchoolChange = (e) => {
        const value = e.target.value;
        if (value !== 'nearby') {
            setSchool(value);
            return;
        }
        if (!navigator.geolocation) {
            alert('Location isn\u2019t supported on this browser.');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                let nearest = SCHOOLS[0];
                let best = Infinity;
                SCHOOLS.forEach((s) => {
                    const d = haversine(latitude, longitude, s.lat, s.lng);
                    if (d < best) { best = d; nearest = s; }
                });
                setSchool(nearest.name);
                setLocating(false);
            },
            () => {
                alert('Couldn\u2019t get your location. Please choose a school manually.');
                setLocating(false);
            }
        );
    };

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    useEffect(() => {
        setLoading(true);
        const params = {};
        if (search) params.search = search;
        if (activeCategory) params.category = activeCategory;
        if (itemCategory) params.itemCategory = itemCategory;
        api.get('/products', { params })
            .then((res) => setProducts(res.data))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, [search, activeCategory]);

    const applyBudget = (e) => {
        if (e.key !== 'Enter') return;
        const val = parseFloat(budgetInput);
        if (!val || val <= 0) return;
        setPriceRange({ min: 0, max: val, label: `Under GHS ${val}` });
    };

    const isDemo = products.length === 0;
    const baseProducts = isDemo ? DUMMY_PRODUCTS : products;
    const categoryFiltered = itemCategory
        ? baseProducts.filter((p) => (p.category || p.category_name) === itemCategory)
        : baseProducts;
    const verifiedFiltered = verifiedOnly
        ? categoryFiltered.filter((p) => p.seller_verified)
        : categoryFiltered;
    const visibleProducts = priceRange
        ? verifiedFiltered.filter((p) => {
            const price = parseFloat(p.price);
            return price >= priceRange.min && price <= priceRange.max;
        })
        : verifiedFiltered;

    return (
        <div>
            {/* HEADER STRIP */}
            <section className="overflow-hidden sticky top-0 z-50">
                <div className="absolute inset-0">
                    <HeroSlideshow images={[
                        '/IMG_8639 2.jpg', '/knust-hero.jpg', '/ATU.jpg', '/UHAS.jpg', '/UCC.jpg',
                        '/UDS.jpg', '/UOE.jpg', '/UPSA.jpg', '/PentUNI.jpg', '/KsTU.png', '/CU.jpg',
                    ]} />
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/70 via-brand-800/50 to-accent-600/40" />
                </div>
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" style={{ minHeight: '260px' }}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                        >
                            <ArrowLeft size={16} /> Back to home
                        </Link>

                        <div className="flex items-center gap-3 flex-wrap">
                            <select
                                value={itemCategory}
                                onChange={(e) => setItemCategory(e.target.value)}
                                className="bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none cursor-pointer"
                            >
                                <option value="" className="text-slate-900">All categories</option>
                                {ITEM_TYPES.map((t) => (
                                    <option key={t} value={t} className="text-slate-900">{t}</option>
                                ))}
                            </select>

                            <select
                                value={school}
                                onChange={handleSchoolChange}
                                className="bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none cursor-pointer"
                            >
                                <option value="" className="text-slate-900">All schools</option>
                                <option value="nearby" className="text-slate-900">{locating ? 'Locating…' : '📍 Near me'}</option>
                                {SCHOOLS.map((s) => (
                                    <option key={s.name} value={s.name} className="text-slate-900">{s.name}</option>
                                ))}
                            </select>

                            <button
                                onClick={() => setVerifiedOnly((v) => !v)}
                                className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border backdrop-blur transition ${
                                    verifiedOnly
                                        ? 'bg-white text-brand-700 border-white'
                                        : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                                }`}
                            >
                                <BadgeCheck size={15} /> Verified sellers only
                            </button>
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-5">
                        {search ? `Results for "${search}"` : 'Browse listings'}
                    </h1>

                    {/* PRICE FILTER ROW */}
                    <div className="flex items-center gap-2 flex-wrap mt-5">
                        {PRICE_RANGES.map((r) => (
                            <button
                                key={r.label}
                                onClick={() => setPriceRange(priceRange?.label === r.label ? null : r)}
                                className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border backdrop-blur transition ${
                                    priceRange?.label === r.label
                                        ? 'bg-white text-brand-700 border-white'
                                        : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}

                        <div className="relative">
                            <Wallet size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                            <input
                                type="number"
                                min="1"
                                value={budgetInput}
                                onChange={(e) => setBudgetInput(e.target.value)}
                                onKeyDown={applyBudget}
                                placeholder="My budget (GHS)…"
                                className="bg-white/10 text-white placeholder-white/50 text-sm font-medium pl-8 pr-3 py-1.5 rounded-full border border-white/30 backdrop-blur focus:outline-none focus:border-white/60 w-40"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* LISTINGS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <FilterPill label="All" active={!itemCategory} onClick={() => setItemCategory('')} />
                    {itemCategory && (
                        <span className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                            Category: {itemCategory}
                            <button onClick={() => setItemCategory('')} className="hover:bg-white/20 rounded-full p-0.5">
                                <X size={13} />
                            </button>
                        </span>
                    )}
                    {verifiedOnly && (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                            <BadgeCheck size={14} /> Verified sellers only
                        </span>
                    )}
                    {priceRange && (
                        <span className="inline-flex items-center gap-1.5 bg-slate-800 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                            {priceRange.label}
                            <button onClick={() => { setPriceRange(null); setBudgetInput(''); }} className="hover:bg-white/20 rounded-full p-0.5">
                                <X size={13} />
                            </button>
                        </span>
                    )}
                </div>
                {verifiedOnly && (
                    <p className="text-xs text-slate-400 mb-4">
                        Verified sellers are recommended — their university email has been confirmed.
                    </p>
                )}

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : visibleProducts.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <SlidersHorizontal className="mx-auto mb-3" size={32} />
                        <p>No listings found. Try a different category or price range.</p>
                    </div>
                ) : (
                    <>
                        {isDemo && (
                            <p className="text-sm text-slate-400 mb-4">No live listings yet — here's a preview of how they'll look:</p>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {visibleProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

function FilterPill({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
            }`}
        >
            {label}
        </button>
    );
}