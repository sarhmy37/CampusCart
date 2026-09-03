import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import HeroSlideshow from '../components/HeroSlideshow';
import { BROWSE_HEADER_IMAGES } from '../data/media';
import { DUMMY_PRODUCTS } from '../data/demoProducts';
import { SlidersHorizontal, ArrowLeft, X, ChevronDown, Check, Search } from 'lucide-react';
import {
    AdjustmentsHorizontalIcon,
    SparklesIcon,
    MapPinIcon,
    CheckBadgeIcon,
    Squares2X2Icon,
    WalletIcon,
} from '@heroicons/react/24/outline';
import {
    AdjustmentsHorizontalIcon as AdjustmentsHorizontalIconSolid,
    SparklesIcon as SparklesIconSolid,
    MapPinIcon as MapPinIconSolid,
    CheckBadgeIcon as CheckBadgeIconSolid,
    Squares2X2Icon as Squares2X2IconSolid,
} from '@heroicons/react/24/solid';
import CategoryRequestModal from '../components/CategoryRequestModal';

const ITEM_TYPES = ['Clothes', 'Gadgets', 'Stationery', 'Perfumes', 'Food', 'Sneakers', 'Other'];

const VERIFIED_NOTE_FULL = 'Verified sellers are recommended — their university email has been confirmed.';
const VERIFIED_NOTE_TYPE_SPEED_MS = 40;
const VERIFIED_NOTE_DELAY_MS = 500;

const SCHOOLS = [
    { name: 'KNUST', lat: 6.6732, lng: -1.5654 },
    { name: 'UG', lat: 5.6505, lng: -0.1895 },
    { name: 'ATU', lat: 5.554028, lng: -0.205556 },
    { name: 'UHAS', lat: 6.6008, lng: 0.4713 },
    { name: 'UCC', lat: 5.1153, lng: -1.2903 },
    { name: 'UDS', lat: 9.393273, lng: -0.823513 },
    { name: 'UEW', lat: 5.35000, lng: -0.62500 },
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

// ─── TAB CONFIG (mobile bottom bar) ────────────────────────────────────────
const MOBILE_TABS = ['all', 'new', 'categories', 'nearby', 'verified'];

const BROWSE_TAB_LABELS = {
    all: 'All',
    new: 'New',
    categories: 'Categories',
    nearby: 'Nearby',
    verified: 'Verified',
};

const TAB_ICONS = {
    all: { outline: AdjustmentsHorizontalIcon, solid: AdjustmentsHorizontalIconSolid },
    new: { outline: SparklesIcon, solid: SparklesIconSolid },
    categories: { outline: Squares2X2Icon, solid: Squares2X2IconSolid },
    nearby: { outline: MapPinIcon, solid: MapPinIconSolid },
    verified: { outline: CheckBadgeIcon, solid: CheckBadgeIconSolid },
};

// How many px of scroll it takes for the target to reach fully collapsed.
const MOBILE_COLLAPSE_DISTANCE = 100;
const SPRING_SMOOTHING = 1;

const lerp = (from, to, t) => from + (to - from) * t;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

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
    const [openSheet, setOpenSheet] = useState(null);
    const search = searchParams.get('search') || '';
    const [showCategoryRequest, setShowCategoryRequest] = useState(false);

    const [progress, setProgress] = useState(0);
    const [isMobileViewport, setIsMobileViewport] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 640 : false
    );
    const targetProgressRef = useRef(0);
    const scrollTickingRef = useRef(false);

    const [verifiedNoteText, setVerifiedNoteText] = useState('');

    useEffect(() => {
        if (!verifiedOnly) {
            setVerifiedNoteText('');
            return;
        }
        setVerifiedNoteText('');
        let typeInterval;
        const delayTimer = setTimeout(() => {
            let i = 0;
            typeInterval = setInterval(() => {
                i++;
                setVerifiedNoteText(VERIFIED_NOTE_FULL.slice(0, i));
                if (i >= VERIFIED_NOTE_FULL.length) {
                    clearInterval(typeInterval);
                }
            }, VERIFIED_NOTE_TYPE_SPEED_MS);
        }, VERIFIED_NOTE_DELAY_MS);

        return () => {
            clearTimeout(delayTimer);
            if (typeInterval) clearInterval(typeInterval);
        };
    }, [verifiedOnly]);

    useEffect(() => {
        const evaluate = () => {
            const mobile = window.innerWidth < 640;
            setIsMobileViewport(mobile);
            targetProgressRef.current = mobile ? clamp01(window.scrollY / MOBILE_COLLAPSE_DISTANCE) : 0;
        };

        const onScrollOrResize = () => {
            if (scrollTickingRef.current) return;
            scrollTickingRef.current = true;
            window.requestAnimationFrame(() => {
                evaluate();
                scrollTickingRef.current = false;
            });
        };

        evaluate();
        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, []);

    useEffect(() => {
        let rafId;
        const loop = () => {
            setProgress((prev) => {
                const target = targetProgressRef.current;
                const diff = target - prev;
                if (Math.abs(diff) < 0.0006) return target;
                return prev + diff * SPRING_SMOOTHING;
            });
            rafId = window.requestAnimationFrame(loop);
        };
        rafId = window.requestAnimationFrame(loop);
        return () => window.cancelAnimationFrame(rafId);
    }, []);

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

    const applyBudgetValue = () => {
        const val = parseFloat(budgetInput);
        if (!val || val <= 0) return;
        setPriceRange({ min: 0, max: val, label: `Under GHS ${val}` });
    };

    const applyBudget = (e) => {
        if (e.key !== 'Enter') return;
        applyBudgetValue();
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
        if (school) {
            filteredByType = verifiedFiltered.filter(p => p.seller_school === school);
        } else {
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

    const renderBudgetInput = () => (
        <div className="relative shrink-0">
            <WalletIcon className="w-3 h-3 sm:w-[16px] sm:h-[16px] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
                type="number"
                min="1"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={applyBudget}
                placeholder="My budget (GHS)…"
                className="bg-white/10 text-white placeholder-white/50 text-xs sm:text-sm font-medium pl-7 sm:pl-8 pr-8 sm:pr-9 py-1 sm:py-1.5 rounded-full border border-white/30 backdrop-blur focus:outline-none focus:border-white/60 w-32 sm:w-44"
            />
            <button
                type="button"
                onClick={applyBudgetValue}
                aria-label="Apply budget filter"
                className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/35 active:scale-90 text-white transition-all"
            >
                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
        </div>
    );

    const handleDesktopTabChange = (tab) => {
        if (tab === 'verified') {
            setVerifiedOnly(!verifiedOnly);
        } else if (tab === 'nearby') {
            setFilterType('nearby');
            if (!school) {
                handleSchoolChange({ target: { value: 'nearby' } });
            }
        } else {
            setFilterType(tab);
        }
    };

    const handleMobileTabChange = (tab) => {
        if (tab === 'verified') {
            setVerifiedOnly(!verifiedOnly);
        } else if (tab === 'categories') {
            setOpenSheet('category');
        } else if (tab === 'nearby') {
            setOpenSheet('school');
        } else {
            setFilterType(tab);
        }
    };

    const selectCategory = (value) => {
        setItemCategory(value);
        setOpenSheet(null);
    };

    const selectSchool = (value) => {
        if (value === '') {
            setSchool('');
            setFilterType('all');
        } else if (value === 'nearby') {
            handleSchoolChange({ target: { value: 'nearby' } });
            setFilterType('nearby');
        } else {
            setSchool(value);
            setFilterType('nearby');
        }
        setOpenSheet(null);
    };

    const isTabActive = (tab) => {
        if (tab === 'verified') return verifiedOnly;
        if (tab === 'categories') return !!itemCategory;
        return filterType === tab;
    };

    const categoryOptions = [
        { value: '', label: 'All categories' },
        ...ITEM_TYPES.map((t) => ({ value: t, label: t })),
    ];

    const schoolOptions = [
        { value: '', label: 'All schools' },
        { value: 'nearby', label: locating ? 'Locating…' : '📍 Near me' },
        ...SCHOOLS.map((s) => ({ value: s.name, label: s.name })),
    ];

    const headerTitle = search ? `Results for "${search}"` : 'Browse listings';

    const sectionPadding = isMobileViewport
        ? { paddingTop: lerp(32, 14, progress), paddingBottom: lerp(32, 14, progress) }
        : undefined;

    const imageOpacity = isMobileViewport ? 1 - progress : 1;

    const btnPadX = lerp(10, 9, progress);
    const btnPadY = lerp(4, 9, progress);
    const btnIconSize = lerp(12, 14, progress);
    const btnInnerGap = lerp(4, 0, progress);
    const labelMaxWidth = lerp(40, 0, progress);
    const labelOpacity = 1 - progress;

    const rowAGap = lerp(0, 8, progress);
    const rowATitleOpacity = progress;
    const rowATitleFontSize = lerp(0, 16, progress);

    const rowBMaxHeight = lerp(76, 0, progress);
    const rowBOpacity = 1 - progress;
    const rowBMarginTop = lerp(16, 0, progress);

    return (
        <div className="relative min-h-screen">
            {/* HEADER STRIP */}
            <section className="sticky top-14 sm:top-16 z-30 relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-accent-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900">
                <div className="absolute inset-0" style={{ opacity: imageOpacity }}>
                    <HeroSlideshow images={BROWSE_HEADER_IMAGES} />
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-900/70 via-brand-800/50 to-accent-600/40 dark:from-ink-900/85 dark:via-ink-900/60 dark:to-gold-900/30" />
                </div>
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" style={{ opacity: imageOpacity }} />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" style={{ opacity: imageOpacity }} />

                <div
                    className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10"
                    style={sectionPadding}
                >
                    {/* ── MOBILE Row A: back button + title ── */}
                    <div className="sm:hidden flex items-center" style={{ gap: `${rowAGap}px` }}>
                        <Link
                            to="/"
                            aria-label="Back to home"
                            className="inline-flex items-center bg-white/10 text-white font-semibold rounded-full border border-white/30 hover:bg-white/20 active:scale-95 backdrop-blur shrink-0 transition-colors duration-200"
                            style={{
                                paddingLeft: btnPadX,
                                paddingRight: btnPadX,
                                paddingTop: btnPadY,
                                paddingBottom: btnPadY,
                                gap: `${btnInnerGap}px`,
                            }}
                        >
                            <ArrowLeft
                                className="shrink-0"
                                style={{ width: btnIconSize, height: btnIconSize }}
                            />
                            <span
                                className="text-xs whitespace-nowrap overflow-hidden inline-block"
                                style={{ maxWidth: labelMaxWidth, opacity: labelOpacity }}
                            >
                                Home
                            </span>
                        </Link>

                        <span
                            className="font-extrabold text-white truncate"
                            style={{ opacity: rowATitleOpacity, fontSize: `${rowATitleFontSize}px` }}
                        >
                            {headerTitle}
                        </span>
                    </div>

                    {/* ── MOBILE Row B: original title + budget + category request ── */}
                    <div
                        className="sm:hidden overflow-hidden"
                        style={{
                            maxHeight: rowBMaxHeight,
                            opacity: rowBOpacity,
                            marginTop: rowBMarginTop,
                            pointerEvents: progress > 0.6 ? 'none' : 'auto',
                        }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h1 className="text-xl font-extrabold text-white truncate">
                                {headerTitle}
                            </h1>
                            {renderBudgetInput()}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCategoryRequest(true)}
                            className="block text-right w-full text-[11px] font-semibold text-white/70 hover:text-white underline underline-offset-2 transition mt-1"
                        >
                            Can't find category? Contact admin
                        </button>
                    </div>

                    {/* ── DESKTOP ── */}
                    <div className="hidden sm:flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to home</span>
                        </Link>

                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative inline-flex items-center">
                                <select
                                    value={itemCategory}
                                    onChange={(e) => setItemCategory(e.target.value)}
                                    className="appearance-none bg-white/10 text-white text-sm font-semibold pl-4 pr-6 py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none cursor-pointer"
                                >
                                    <option value="" className="text-slate-900">All categories</option>
                                    {ITEM_TYPES.map((t) => (
                                        <option key={t} value={t} className="text-slate-900">{t}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-white/70" />
                            </div>

                            <div className="relative inline-flex items-center">
                                <select
                                    value={school}
                                    onChange={handleSchoolChange}
                                    className="appearance-none bg-white/10 text-white text-sm font-semibold pl-4 pr-6 py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none cursor-pointer"
                                >
                                    <option value="" className="text-slate-900">All schools</option>
                                    <option value="nearby" className="text-slate-900">{locating ? 'Locating…' : '📍 Near me'}</option>
                                    {SCHOOLS.map((s) => (
                                        <option key={s.name} value={s.name} className="text-slate-900">{s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-white/70" />
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center justify-between gap-3 mt-4 sm:mt-5">
                        <h1 className="text-xl sm:text-3xl font-extrabold text-white truncate">
                            {headerTitle}
                        </h1>
                        {renderBudgetInput()}
                    </div>
                    <div className="hidden sm:block h-px bg-gradient-to-r from-gold-400/40 via-white/10 to-transparent mt-4" />
                </div>
            </section>

            {/* ─── DESKTOP FILTER BAR — sits below the header, above the listings ─── */}
            <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 bg-slate-100 dark:bg-ink-900">
            <div className="flex items-center gap-2 flex-wrap">
                {['all', 'new', 'categories', 'nearby', 'verified'].map((tab) => {
                    if (tab === 'categories') {
                        const active = !!itemCategory;
                        const Icon = active ? TAB_ICONS.categories.solid : TAB_ICONS.categories.outline;
                        return (
                            <div key="categories" className="relative inline-flex items-center">
                                <select
                                    value={itemCategory}
                                    onChange={(e) => setItemCategory(e.target.value)}
                                    className={`appearance-none inline-flex items-center text-sm pl-8 pr-6 py-1.5 rounded-full border transition-all cursor-pointer ${
                                        active
                                            ? 'bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 border-brand-600 dark:border-gold-600 font-bold'
                                            : 'bg-white dark:bg-ink-800 text-slate-700 dark:text-gold-200 border-slate-200 dark:border-ink-600 hover:bg-slate-50 dark:hover:bg-ink-700 font-semibold'
                                    }`}
                                >
                                    <option value="">Categories</option>
                                    {ITEM_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <Icon className={`pointer-events-none absolute left-2.5 w-4 h-4 ${active ? 'text-white dark:text-ink-900' : 'text-slate-500 dark:text-gold-300/60'}`} />
                            </div>
                        );
                    }

                    const active = isTabActive(tab);
                    const Icon = active ? TAB_ICONS[tab].solid : TAB_ICONS[tab].outline;
                    const label = tab === 'nearby'
                        ? (school ? school : 'Nearby')
                        : BROWSE_TAB_LABELS[tab];
                    return (
                        <button
                            key={tab}
                            onClick={() => handleDesktopTabChange(tab)}
                            className={`inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all ${
                                active
                                    ? 'bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 border-brand-600 dark:border-gold-600 font-bold'
                                    : 'bg-white dark:bg-ink-800 text-slate-700 dark:text-gold-200 border-slate-200 dark:border-ink-600 hover:bg-slate-50 dark:hover:bg-ink-700 font-semibold'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-3">
                {PRICE_RANGES.map((r) => (
                    <button
                        key={r.label}
                        onClick={() => setPriceRange(priceRange?.label === r.label ? null : r)}
                        className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border transition ${
                            priceRange?.label === r.label
                                ? 'bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 border-brand-600 dark:border-gold-600'
                                : 'bg-white dark:bg-ink-800 text-slate-700 dark:text-gold-200 border-slate-200 dark:border-ink-600 hover:bg-slate-50 dark:hover:bg-ink-700'
                        }`}
                    >
                        {r.label}
                    </button>
                ))}
                <button
                    onClick={() => setShowCategoryRequest(true)}
                    className="text-sm font-semibold px-3.5 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-ink-600 text-slate-500 dark:text-gold-200/70 hover:bg-slate-50 dark:hover:bg-ink-700 hover:text-slate-700 dark:hover:text-gold-100 transition ml-auto"
                >
                    Can't find category? Contact admin
                </button>
            </div>
            </div>

            {/* ─── LISTINGS ───────────────────────────────────────────────── */}
            {/* ✅ Updated background: bg-slate-100 in light mode, dark mode unchanged */}
            <section className="relative overflow-hidden bg-slate-100 dark:from-ink-900 dark:via-ink-950 dark:to-ink-900 dark:bg-gradient-to-b">
                {/* Decorative overlays — hidden in light mode, shown only in dark mode */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.5] dark:opacity-[0.35] hidden dark:block"
                    style={{
                        backgroundImage: `
                            repeating-linear-gradient(0deg, rgba(180,140,60,0.10) 0px, rgba(180,140,60,0.10) 1px, transparent 1px, transparent 56px),
                            repeating-linear-gradient(90deg, rgba(180,140,60,0.10) 0px, rgba(180,140,60,0.10) 1px, transparent 1px, transparent 56px)
                        `,
                    }}
                />
                <div
                    className="absolute inset-0 pointer-events-none hidden dark:block"
                    style={{
                        background: 'linear-gradient(135deg, rgba(212,175,90,0.14) 0%, transparent 42%)',
                    }}
                />
                <div
                    className="absolute inset-0 pointer-events-none hidden dark:block"
                    style={{
                        background: 'linear-gradient(135deg, rgba(212,175,90,0.10) 0%, transparent 45%)',
                    }}
                />
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink-900/20 dark:from-black/40 to-transparent pointer-events-none hidden dark:block" />
                <div
                    className="absolute inset-0 pointer-events-none hidden dark:block"
                    style={{
                        background: 'radial-gradient(120% 100% at 50% 0%, transparent 50%, rgba(15,12,8,0.08) 100%)',
                    }}
                />
                <svg className="absolute inset-0 w-full h-full opacity-[0.05] dark:opacity-[0.07] pointer-events-none hidden dark:block" xmlns="http://www.w3.org/2000/svg">
                    <filter id="listingsGrain">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#listingsGrain)" />
                </svg>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-32 sm:pb-10">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2">
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
                                <CheckBadgeIconSolid className="w-3 h-3" /> Verified
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
                            {verifiedNoteText}
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
                </div>
            </section>

            {/* ─── MOBILE BOTTOM TABS ──────────────────────────────────── */}
            <div className="block sm:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
                <BrowseGlassTabs
                    tabs={MOBILE_TABS}
                    isTabActive={isTabActive}
                    onTabChange={handleMobileTabChange}
                    school={school}
                    itemCategory={itemCategory}
                />
            </div>

            <MobileFilterSheet
                open={openSheet === 'category'}
                title="Categories"
                options={categoryOptions}
                selectedValue={itemCategory}
                onSelect={selectCategory}
                onClose={() => setOpenSheet(null)}
            />
            <MobileFilterSheet
                open={openSheet === 'school'}
                title="School"
                options={schoolOptions}
                selectedValue={school}
                onSelect={selectSchool}
                onClose={() => setOpenSheet(null)}
            />
            <CategoryRequestModal
                open={showCategoryRequest}
                onClose={() => setShowCategoryRequest(false)}
            />
        </div>
    );
}

function BrowseGlassTabs({ tabs, isTabActive, onTabChange, school, itemCategory }) {
    const getTabLabel = (tab) => {
        if (tab === 'nearby') return school || 'Nearby';
        if (tab === 'categories') return itemCategory || 'Categories';
        return BROWSE_TAB_LABELS[tab] || tab;
    };

    return (
        <>
            <div
                className="relative w-full rounded-2xl border border-white/50 dark:border-white/10 bg-white/65 dark:bg-ink-900/55 shadow-[0_10px_30px_-6px_rgba(15,23,42,0.35)] overflow-hidden"
                style={{
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                }}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent dark:from-white/10" />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40 dark:ring-white/5" />

                <div className="relative flex items-stretch h-[50px] px-1.5">
                    {tabs.map((tab) => {
                        const active = isTabActive(tab);
                        const Icon = active ? TAB_ICONS[tab].solid : TAB_ICONS[tab].outline;
                        const label = getTabLabel(tab);

                        return (
                            <button
                                key={tab}
                                onClick={() => onTabChange(tab)}
                                className="relative flex-1 min-w-0 my-1 mx-0.5"
                            >
                                <span
                                    className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-300 ease-out active:scale-[0.94] ${
                                        active
                                            ? 'bg-white/40 dark:bg-white/10 shadow-[0_1px_4px_rgba(15,23,42,0.06)]'
                                            : 'bg-transparent'
                                    }`}
                                >
                                    <Icon
                                        className={`w-[17px] h-[17px] transition-colors duration-300 ${
                                            active
                                                ? 'text-brand-700 dark:text-gold-400'
                                                : 'text-slate-500 dark:text-gold-200/50'
                                        }`}
                                    />
                                    <span
                                        className={`text-[9.5px] leading-none truncate max-w-full px-0.5 transition-all duration-300 ${
                                            active
                                                ? 'font-bold text-brand-700 dark:text-gold-400'
                                                : 'font-medium text-slate-500 dark:text-gold-200/50'
                                        }`}
                                    >
                                        {label}
                                    </span>
                                </span>

                                {active && (
                                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-[3.5px] w-6 rounded-full bg-brand-600 dark:bg-gold-500 transition-all duration-300" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-center gap-1.5 mt-2">
                {tabs.map((tab) => {
                    const active = isTabActive(tab);
                    return (
                        <button
                            key={tab}
                            onClick={() => onTabChange(tab)}
                            aria-label={`Go to ${BROWSE_TAB_LABELS[tab] || tab}`}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                active
                                    ? 'w-4 bg-brand-600 dark:bg-gold-500'
                                    : 'w-1.5 bg-slate-300 dark:bg-ink-600 hover:bg-slate-400 dark:hover:bg-ink-500'
                            }`}
                        />
                    );
                })}
            </div>
        </>
    );
}

function MobileFilterSheet({ open, title, options, selectedValue, onSelect, onClose }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (open) {
            setMounted(false);
            const raf = requestAnimationFrame(() => setMounted(true));
            return () => cancelAnimationFrame(raf);
        }
        setMounted(false);
    }, [open]);

    useEffect(() => {
        if (open) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            document.documentElement.style.overscrollBehavior = 'none';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY, 10) * -1);
        }
    }, [open]);

    if (!open) return null;

    return (
        <div className="sm:hidden fixed inset-0 z-50">
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                className={`absolute bottom-0 left-0 right-0 max-h-[70vh] flex flex-col rounded-t-3xl bg-white dark:bg-ink-800 shadow-2xl transition-transform duration-300 ease-out ${
                    mounted ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ overscrollBehavior: 'contain' }}
            >
                <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
                    <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-ink-600" />
                </div>
                <div className="flex items-center justify-between px-5 pb-3 shrink-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-gold-100">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-gold-200/60"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="overflow-y-auto no-scrollbar px-2 pb-[max(16px,env(safe-area-inset-bottom))]">
                    {options.map((opt) => {
                        const isSelected = opt.value === selectedValue
                            || (opt.value === 'nearby' && selectedValue !== '' && selectedValue === opt.value);
                        return (
                            <button
                                key={opt.value || 'all'}
                                onClick={() => onSelect(opt.value)}
                                className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl text-sm transition ${
                                    isSelected
                                        ? 'bg-brand-50 dark:bg-gold-900/30 text-brand-700 dark:text-gold-300 font-bold'
                                        : 'text-slate-700 dark:text-gold-100 font-medium hover:bg-slate-50 dark:hover:bg-ink-700'
                                }`}
                            >
                                {opt.label}
                                {isSelected && <Check size={16} className="text-brand-600 dark:text-gold-400" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}