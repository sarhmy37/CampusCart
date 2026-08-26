import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import HeroSlideshow from '../components/HeroSlideshow';
import { BROWSE_HEADER_IMAGES } from '../data/media';
import { DUMMY_PRODUCTS } from '../data/demoProducts';
import { SlidersHorizontal, ArrowLeft, X, BadgeCheck, Wallet, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEM_TYPES = ['Clothes', 'Phone accessories', 'Stationery', 'Laptops', 'Perfumes', 'Food', 'Sneakers', 'Other'];

const SCHOOLS = [
    { name: 'KNUST', lat: 6.6732, lng: -1.5654 },
    { name: 'UG', lat: 5.6505, lng: -0.1895 },
    { name: 'ATU', lat: 5.5504, lng: -0.2174 },
    { name: 'UHAS', lat: 6.6008, lng: 0.4713 },
    { name: 'UCC', lat: 5.1153, lng: -1.2903 },
    { name: 'UDS', lat: 9.3730, lng: -0.8850 },
    { name: 'UEW', lat: 5.3621, lng: -0.6339 },
    { name: 'UPSA', lat: 5.6614, lng: -0.1664 },
    { name: 'PentUni', lat: 5.6262, lng: -0.2742 },
    { name: 'KsTU', lat: 6.6911, lng: -1.6100 },
    { name: 'CU', lat: 5.5663, lng: -0.2410 },
    { name: 'UMaT', lat: 5.3005, lng: -1.9900 },
];

const PRICE_RANGES = [
    { label: 'Below 100', min: 0, max: 100 },
    { label: '100 - 200', min: 100, max: 200 },
    { label: '200 - 500', min: 200, max: 500 },
    { label: '500 - 1000', min: 500, max: 1000 },
    { label: 'Above 1000', min: 1000, max: Infinity },
];

// ─── TAB CONFIG ────────────────────────────────────────────────────────────
const BROWSE_TAB_LABELS = {
    all: 'All',
    new: 'New',
    nearby: 'Nearby',
    verified: 'Verified',
};

const BROWSE_TAB_ICONS = {
    all: SlidersHorizontal,
    new: '✨',
    nearby: '📍',
    verified: BadgeCheck,
};

export default function Browse() {
    const [searchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [itemCategory, setItemCategory] = useState('');
    const [school, setSchool] = useState('');
    const [locating, setLocating] = useState(false);
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [priceRange, setPriceRange] = useState(null);
    const [budgetInput, setBudgetInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
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
        if (school) params.school = school;

        api.get('/products', { params })
            .then((res) => setProducts(res.data))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, [search, activeCategory, itemCategory, school]);

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

    let filteredByType = verifiedFiltered;
    if (filterType === 'new') {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        filteredByType = verifiedFiltered.filter(p => {
            if (!p.created_at) return false;
            return new Date(p.created_at) >= threeDaysAgo;
        });
        if (isDemo) {
            filteredByType = verifiedFiltered.slice(0, 4);
        }
    } else if (filterType === 'nearby') {
        // If school is set, filter by that school
        if (school) {
            filteredByType = verifiedFiltered.filter(p => p.school === school);
        } else {
            // If no school set, try to detect
            filteredByType = verifiedFiltered;
        }
    } else if (filterType === 'special') {
        filteredByType = [];
    } else if (filterType === 'soldout') {
        filteredByType = verifiedFiltered.filter(p => {
            const stock = p.stock !== undefined ? p.stock : 1;
            return stock <= 0;
        });
        if (isDemo) {
            filteredByType = verifiedFiltered.filter((_, i) => i % 3 === 0);
        }
    }

    const visibleProducts = priceRange
        ? filteredByType.filter((p) => {
            const price = parseFloat(p.price);
            return price >= priceRange.min && price <= priceRange.max;
        })
        : filteredByType;

    const budgetInputField = (
        <div className="relative shrink-0">
            <Wallet className="w-3 h-3 sm:w-[14px] sm:h-[14px] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
                type="number"
                min="1"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={applyBudget}
                placeholder="My budget (GHS)…"
                className="bg-white/10 text-white placeholder-white/50 text-xs sm:text-sm font-medium pl-7 sm:pl-8 pr-2 sm:pr-3 py-1 sm:py-1.5 rounded-full border border-white/30 backdrop-blur focus:outline-none focus:border-white/60 w-28 sm:w-40"
            />
        </div>
    );

    // Handle tab changes
    const handleTabChange = (tab) => {
        if (tab === 'verified') {
            setVerifiedOnly(!verifiedOnly);
            setFilterType('all');
        } else if (tab === 'nearby') {
            setFilterType('nearby');
            // If no school is set, trigger geolocation
            if (!school) {
                const event = { target: { value: 'nearby' } };
                handleSchoolChange(event);
            }
        } else {
            setFilterType(tab);
            // If switching away from verified, maybe keep it? Let's keep it independent
        }
    };

    // Get active tab for the roll
    const getActiveTab = () => {
        if (verifiedOnly) return 'verified';
        if (filterType === 'nearby') return 'nearby';
        if (filterType === 'new') return 'new';
        return 'all';
    };

    const activeTab = getActiveTab();

    return (
        <div>
            {/* HEADER STRIP */}
            <section className="sticky top-14 sm:top-16 z-30 relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-accent-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute inset-0">
                    <HeroSlideshow images={BROWSE_HEADER_IMAGES} />
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/70 via-brand-800/50 to-accent-600/40 dark:from-ink-900/85 dark:via-ink-900/60 dark:to-gold-900/30" />
                </div>
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-1 sm:gap-2 bg-white/10 text-white font-semibold px-2.5 py-1 sm:px-4 sm:py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-xs sm:text-sm shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                        >
                            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="sm:hidden">Home</span>
                            <span className="hidden sm:inline">Back to home</span>
                        </Link>

                        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                            <div className="relative inline-flex items-center">
                                <select
                                    value={itemCategory}
                                    onChange={(e) => setItemCategory(e.target.value)}
                                    className="appearance-none bg-white/10 text-white text-xs sm:text-sm font-semibold pl-2.5 sm:pl-4 pr-5 sm:pr-6 py-1 sm:py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none focus-visible:border-white/60 cursor-pointer"
                                >
                                    <option value="" className="text-slate-900">All categories</option>
                                    {ITEM_TYPES.map((t) => (
                                        <option key={t} value={t} className="text-slate-900">{t}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-1.5 sm:right-2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/70" />
                            </div>

                            <div className="relative inline-flex items-center">
                                <select
                                    value={school}
                                    onChange={handleSchoolChange}
                                    className="appearance-none bg-white/10 text-white text-xs sm:text-sm font-semibold pl-2.5 sm:pl-4 pr-5 sm:pr-6 py-1 sm:py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none focus-visible:border-white/60 cursor-pointer"
                                >
                                    <option value="" className="text-slate-900">All schools</option>
                                    <option value="nearby" className="text-slate-900">{locating ? 'Locating…' : '📍 Near me'}</option>
                                    {SCHOOLS.map((s) => (
                                        <option key={s.name} value={s.name} className="text-slate-900">{s.name}</option>
                                    ))} 
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-1.5 sm:right-2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/70" />
                            </div>

                            <div className="sm:hidden">
                                {budgetInputField}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3 sm:mt-5">
                        <h1 className="text-xl sm:text-3xl font-extrabold text-white">
                            {search ? `Results for "${search}"` : 'Browse listings'}
                        </h1>
                        <div className="hidden sm:block">
                            {budgetInputField}
                        </div>
                    </div>

                    {/* ─── SWIPEABLE TABS (MOBILE) ────────────────────── */}
                    <div className="block sm:hidden mt-4">
                        <BrowseTabRoll
                            tabs={['all', 'new', 'nearby', 'verified']}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            verifiedOnly={verifiedOnly}
                            school={school}
                        />
                    </div>

                    {/* ─── DESKTOP FILTER PILLS ────────────────────────── */}
                    <div className="hidden sm:flex items-center gap-2 flex-wrap mt-4">
                        <button
                            onClick={() => { setFilterType('all'); setVerifiedOnly(false); }}
                            className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border backdrop-blur transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                                filterType === 'all' && !verifiedOnly
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('new')}
                            className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border backdrop-blur transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                                filterType === 'new'
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                            }`}
                        >
                            ✨ New
                        </button>
                        <button
                            onClick={() => {
                                setFilterType('nearby');
                                if (!school) {
                                    const event = { target: { value: 'nearby' } };
                                    handleSchoolChange(event);
                                }
                            }}
                            className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border backdrop-blur transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                                filterType === 'nearby'
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                            }`}
                        >
                            📍 Nearby
                        </button>
                        <button
                            onClick={() => setVerifiedOnly(!verifiedOnly)}
                            className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border backdrop-blur transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                                verifiedOnly
                                    ? 'bg-emerald-500 text-white border-emerald-400'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                            }`}
                        >
                            <BadgeCheck className="inline w-4 h-4 mr-1" /> Verified
                        </button>

                        <div className="w-px h-5 bg-white/25 mx-1" aria-hidden="true" />

                        {PRICE_RANGES.map((r) => (
                            <button
                                key={r.label}
                                onClick={() => setPriceRange(priceRange?.label === r.label ? null : r)}
                                className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border backdrop-blur transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                                    priceRange?.label === r.label
                                        ? 'bg-white text-brand-700 border-white'
                                        : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* LISTINGS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 bg-white dark:bg-ink-900">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2">
                    {/* Active filter indicators */}
                    {itemCategory && (
                        <span className="inline-flex items-center gap-1.5 bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 px-3 py-1 rounded-full text-xs font-semibold">
                            {itemCategory}
                            <button onClick={() => setItemCategory('')} className="hover:bg-white/20 rounded-full p-0.5">
                                <X size={12} />
                            </button>
                        </span>
                    )}

                    {school && filterType !== 'nearby' && (
                        <span className="inline-flex items-center gap-1.5 bg-slate-700 dark:bg-ink-700 text-white dark:text-gold-200 px-3 py-1 rounded-full text-xs font-semibold">
                            📍 {school}
                            <button onClick={() => setSchool('')} className="hover:bg-white/20 rounded-full p-0.5">
                                <X size={12} />
                            </button>
                        </span>
                    )}

                    {verifiedOnly && (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            <BadgeCheck size={12} /> Verified
                        </span>
                    )}

                    {priceRange && (
                        <span className="inline-flex items-center gap-1.5 bg-slate-800 dark:bg-gold-900 text-white dark:text-gold-100 px-3 py-1 rounded-full text-xs font-semibold">
                            {priceRange.label}
                            <button onClick={() => { setPriceRange(null); setBudgetInput(''); }} className="hover:bg-white/20 rounded-full p-0.5">
                                <X size={12} />
                            </button>
                        </span>
                    )}

                    {filterType === 'new' && !verifiedOnly && (
                        <span className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            ✨ Newly posted
                        </span>
                    )}
                </div>

                {verifiedOnly && (
                    <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-4">
                        Verified sellers are recommended — their university email has been confirmed.
                    </p>
                )}

                {filterType === 'special' && (
                    <div className="text-center py-10 text-slate-400 dark:text-gold-200/40">
                        <p className="text-lg font-semibold">🚀 Special Listings</p>
                        <p className="text-sm mt-1">This feature is coming soon! Stay tuned for curated deals and top-rated items.</p>
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-ink-700 animate-pulse" />
                        ))}
                    </div>
                ) : visibleProducts.length === 0 && filterType !== 'special' ? (
                    <div className="text-center py-20 text-slate-400 dark:text-gold-200/40">
                        <SlidersHorizontal className="mx-auto mb-3" size={32} />
                        <p>No listings found. Try a different category, price range, or filter.</p>
                    </div>
                ) : (
                    <>
                        {isDemo && (
                            <p className="text-sm text-slate-400 dark:text-gold-200/40 mb-4">No live listings yet — here's a preview of how they'll look:</p>
                        )}
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {visibleProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

// ─── BROWSE SWIPEABLE TABS ROLL ────────────────────────────────────────
// A frosted-glass segmented control that matches the desktop filter pills.
// A single sliding pill tracks the active tab instead of an underline, and
// "Verified" gets its own emerald tint since it's a trust toggle, not a
// view mode like All / New / Nearby.
function BrowseTabRoll({ tabs, activeTab, onTabChange, verifiedOnly, school }) {
    const containerRef = useRef(null);
    const [startX, setStartX] = useState(0);
    const [scrollStart, setScrollStart] = useState(0);
    const [showLeftChevron, setShowLeftChevron] = useState(false);
    const [showRightChevron, setShowRightChevron] = useState(true);
    const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
    const draggingRef = useRef(false);
    const movedRef = useRef(false);

    const activeIndex = tabs.indexOf(activeTab);

    const measurePill = () => {
        const container = containerRef.current;
        if (!container) return;
        const items = container.querySelectorAll('.browse-tab-item');
        const el = items[activeIndex];
        if (el) {
            setPillStyle({ left: el.offsetLeft, width: el.offsetWidth });
        }
    };

    const checkChevrons = () => {
        if (containerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
            setShowLeftChevron(scrollLeft > 10);
            setShowRightChevron(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        if (containerRef.current && activeIndex >= 0) {
            const container = containerRef.current;
            const tabElements = container.querySelectorAll('.browse-tab-item');
            if (tabElements[activeIndex]) {
                const tab = tabElements[activeIndex];
                const containerRect = container.getBoundingClientRect();
                const tabRect = tab.getBoundingClientRect();
                const scrollTo = tab.offsetLeft - containerRect.width / 2 + tabRect.width / 2;
                container.scrollTo({ left: scrollTo, behavior: 'smooth' });
            }
        }
        measurePill();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex]);

    useEffect(() => {
        checkChevrons();
        measurePill();
        const handleResize = () => { checkChevrons(); measurePill(); };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs]);

    const handleStart = (clientX) => {
        setStartX(clientX);
        setScrollStart(containerRef.current?.scrollLeft || 0);
        draggingRef.current = true;
        movedRef.current = false;
    };

    const handleMove = (clientX) => {
        if (!draggingRef.current || !containerRef.current) return;
        const diff = clientX - startX;
        if (Math.abs(diff) > 5) movedRef.current = true;
        containerRef.current.scrollLeft = scrollStart - diff;
        checkChevrons();
    };

    const handleEnd = () => {
        draggingRef.current = false;
        if (movedRef.current) {
            if (containerRef.current) {
                const container = containerRef.current;
                const tabElements = container.querySelectorAll('.browse-tab-item');
                let closestIndex = 0;
                let closestDistance = Infinity;
                const containerCenter = container.scrollLeft + container.clientWidth / 2;

                tabElements.forEach((tab, i) => {
                    const tabCenter = tab.offsetLeft + tab.offsetWidth / 2;
                    const distance = Math.abs(tabCenter - containerCenter);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIndex = i;
                    }
                });

                if (closestIndex !== activeIndex) {
                    onTabChange(tabs[closestIndex]);
                }
            }
        }
        checkChevrons();
    };

    const onTouchStart = (e) => handleStart(e.touches[0].clientX);
    const onTouchMove = (e) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();

    const onMouseDown = (e) => {
        handleStart(e.clientX);
        const onMouseMove = (ev) => handleMove(ev.clientX);
        const onMouseUp = () => {
            handleEnd();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const scrollToTab = (tab) => {
        const index = tabs.indexOf(tab);
        if (index >= 0 && containerRef.current) {
            const container = containerRef.current;
            const tabElements = container.querySelectorAll('.browse-tab-item');
            if (tabElements[index]) {
                const el = tabElements[index];
                const containerRect = container.getBoundingClientRect();
                const tabRect = el.getBoundingClientRect();
                const scrollTo = el.offsetLeft - containerRect.width / 2 + tabRect.width / 2;
                container.scrollTo({ left: scrollTo, behavior: 'smooth' });
            }
        }
        onTabChange(tab);
    };

    const getTabLabel = (tab) => {
        if (tab === 'verified') {
            return verifiedOnly ? '✓ Verified' : 'Verified';
        }
        if (tab === 'nearby') {
            return school ? `📍 ${school}` : '📍 Nearby';
        }
        return BROWSE_TAB_LABELS[tab] || tab;
    };

    const isVerifiedActive = activeTab === 'verified';

    return (
        <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onScroll={checkChevrons}
            className="relative rounded-full border border-white/25 dark:border-white/10 bg-white/10 dark:bg-black/20 backdrop-blur-md overflow-x-auto overflow-y-hidden select-none cursor-grab active:cursor-grabbing scrollbar-hide"
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                height: 40,
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>

            {/* Sliding active pill — emerald for the Verified trust toggle, white otherwise */}
            <div
                className={`absolute top-1 bottom-1 rounded-full shadow-sm transition-all duration-300 ease-out pointer-events-none ${
                    isVerifiedActive ? 'bg-emerald-500' : 'bg-white dark:bg-gold-400'
                }`}
                style={{ left: pillStyle.left, width: pillStyle.width }}
            />

            <div className="relative flex h-full items-center" style={{ minWidth: 'max-content', padding: '0 6px', gap: '2px' }}>
                {tabs.map((tab) => {
                    const isActive = tab === activeTab;
                    const label = getTabLabel(tab);
                    const isVerifiedTab = tab === 'verified';
                    const isNearbyTab = tab === 'nearby';

                    return (
                        <button
                            key={tab}
                            onClick={() => scrollToTab(tab)}
                            className={`browse-tab-item relative z-10 shrink-0 h-full flex items-center justify-center gap-1 px-3.5 text-xs font-semibold rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                                isActive
                                    ? isVerifiedTab ? 'text-white' : 'text-brand-700 dark:text-ink-900'
                                    : 'text-white/75 hover:text-white'
                            }`}
                            style={{ minWidth: 56 }}
                        >
                            {isVerifiedTab && <BadgeCheck size={13} />}
                            {isNearbyTab && <span className="text-sm leading-none">📍</span>}
                            {tab === 'new' && <span className="text-sm leading-none">✨</span>}
                            {tab === 'all' && <SlidersHorizontal size={13} />}
                            <span className="whitespace-nowrap">{label}</span>
                        </button>
                    );
                })}
            </div>

            {showLeftChevron && (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/15 to-transparent rounded-l-full flex items-center">
                    <ChevronLeft size={12} className="text-white/70 ml-1" />
                </div>
            )}

            {showRightChevron && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/15 to-transparent rounded-r-full flex items-center justify-end">
                    <ChevronRight size={12} className="text-white/70 mr-1" />
                </div>
            )}
        </div>
    );
}

function FilterPill({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`shrink-0 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition ${
                active
                    ? 'bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 border-brand-600 dark:border-gold-600'
                    : 'bg-white dark:bg-ink-800 text-slate-600 dark:text-gold-200 border-slate-200 dark:border-ink-600 hover:border-brand-300 dark:hover:border-gold-500'
            }`}
        >
            {label}
        </button>
    );
}