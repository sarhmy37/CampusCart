import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Bookmark } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import HeroSlideshow from '../components/HeroSlideshow';
import { BROWSE_HEADER_IMAGES } from '../data/media';
import { DUMMY_PRODUCTS } from '../data/demoProducts';
import { ArrowLeft, X, ChevronDown, Check, Search, Wifi, Loader2, SlidersHorizontal, Rocket } from 'lucide-react';
import toast from 'react-hot-toast';
import { MTN_LOGO, VODAFONE_LOGO, AIRTELTIGO_LOGO } from '../data/media';
import ServiceCard from '../components/ServiceCard';
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

const ITEM_TYPES = ['Mobile Data', 'Services', 'Clothes', 'Gadgets', 'Stationery', 'Perfumes', 'Food', 'Sneakers', 'Other'];

const VERIFIED_NOTE_FULL = 'Verified sellers are recommended — their university email has been confirmed.';
const VERIFIED_NOTE_TYPE_SPEED_MS = 40;
const VERIFIED_NOTE_DELAY_MS = 500;
const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];
const SUBCATEGORIES = {
    Clothes: [
        { label: 'T-Shirts', keywords: ['t-shirt', 'tshirt', 'tee', 't shirt', 'polo', 'jersey', 'crew neck', 'graphic tee'] },
        { label: 'Shirts', keywords: ['shirt', 'button-up', 'button up', 'dress shirt', 'flannel', 'long sleeve'] },
        { label: 'Jeans', keywords: ['jeans', 'denim', 'skinny jeans', 'baggy jeans', 'straight leg'] },
        { label: 'Trousers', keywords: ['trouser', 'pants', 'chinos', 'slacks', 'khakis', 'cargo pants', 'joggers'] },
        { label: 'Shorts', keywords: ['shorts', 'denim shorts', 'cargo shorts', 'boxer shorts'] },
        { label: 'Dresses', keywords: ['dress', 'gown', 'maxi dress', 'gown dress', 'sundress', 'bodycon'] },
        { label: 'Skirts', keywords: ['skirt', 'mini skirt', 'midi skirt', 'pencil skirt'] },
        { label: 'Jackets/Hoodies', keywords: ['jacket', 'hoodie', 'sweater', 'cardigan', 'sweatshirt', 'coat', 'bomber', 'denim jacket', 'windbreaker', 'pullover'] },
        { label: 'Traditional wear', keywords: ['kente', 'smock', 'traditional', 'batakari', 'ankara', 'kaba', 'slit', 'agbada', 'african print'] },
        { label: 'Underwear', keywords: ['underwear', 'boxers', 'briefs', 'bra', 'panties', 'lingerie', 'singlet'] },
        { label: 'Activewear', keywords: ['gym wear', 'sportswear', 'leggings', 'tights', 'tracksuit', 'jogging suit'] },
        { label: 'Suits/Formal', keywords: ['suit', 'blazer', 'tuxedo', 'formal wear', 'waistcoat', 'vest'] },
    ],
    Gadgets: [
        { label: 'Phones', keywords: ['phone', 'iphone', 'samsung', 'smartphone', 'android', 'tecno', 'infinix', 'itel', 'huawei', 'xiaomi', 'redmi', 'galaxy'] },
        { label: 'Laptops', keywords: ['laptop', 'macbook', 'notebook', 'chromebook', 'hp laptop', 'dell', 'lenovo', 'thinkpad', 'ultrabook'] },
        { label: 'Headphones', keywords: ['headphone', 'earbud', 'earphone', 'airpod', 'earpiece', 'bluetooth headset', 'headset'] },
        { label: 'Chargers & Cables', keywords: ['charger', 'cable', 'adapter', 'power bank', 'powerbank', 'usb cable', 'type-c', 'lightning cable', 'fast charger'] },
        { label: 'Accessories', keywords: ['case', 'cover', 'screen protector', 'accessory', 'phone case', 'tempered glass', 'pop socket', 'stylus'] },
        { label: 'Smartwatches', keywords: ['smartwatch', 'watch', 'fitness tracker', 'apple watch', 'smart band'] },
        { label: 'Speakers', keywords: ['speaker', 'bluetooth speaker', 'jbl', 'soundbar', 'woofer'] },
        { label: 'Tablets', keywords: ['tablet', 'ipad', 'tab', 'e-reader', 'kindle'] },
        { label: 'Cameras', keywords: ['camera', 'dslr', 'gopro', 'webcam', 'camcorder', 'action cam'] },
        { label: 'Gaming', keywords: ['console', 'playstation', 'ps4', 'ps5', 'xbox', 'controller', 'gaming', 'joystick'] },
        { label: 'Computer Parts', keywords: ['ram', 'ssd', 'hard drive', 'hdd', 'flash drive', 'memory card', 'mouse', 'keyboard', 'monitor', 'graphics card', 'motherboard'] },
    ],
    Stationery: [
        { label: 'Notebooks', keywords: ['notebook', 'exercise book', 'exam pad', 'jotter', 'sketch pad', 'diary', 'planner'] },
        { label: 'Pens & Pencils', keywords: ['pen', 'pencil', 'biro', 'marker pen', 'highlighter', 'eraser', 'sharpener', 'mechanical pencil'] },
        { label: 'Files & Folders', keywords: ['file', 'folder', 'ring binder', 'document holder', 'envelope', 'clip board'] },
        { label: 'Textbooks', keywords: ['textbook', 'book', 'past questions', 'reference book', 'novel', 'course material'] },
        { label: 'Calculators', keywords: ['calculator', 'scientific calculator', 'casio'] },
        { label: 'Art supplies', keywords: ['art', 'paint', 'marker', 'drawing', 'crayon', 'sketching', 'canvas', 'paintbrush'] },
        { label: 'Office supplies', keywords: ['stapler', 'staples', 'tape', 'glue', 'scissors', 'ruler', 'paper clip', 'sticky note', 'correction fluid'] },
        { label: 'Printing supplies', keywords: ['ink', 'toner', 'printer paper', 'a4 paper', 'cartridge'] },
        { label: 'Bags', keywords: ['school bag', 'backpack', 'lunch bag', 'pencil case', 'pouch'] },
    ],
    Perfumes: [
        { label: 'Men', keywords: ['men', 'male', 'for him', "men's perfume", 'cologne'] },
        { label: 'Women', keywords: ['women', 'female', 'for her', "women's perfume"] },
        { label: 'Unisex', keywords: ['unisex', 'shared scent'] },
        { label: 'Body sprays', keywords: ['body spray', 'deodorant', 'antiperspirant', 'mist'] },
        { label: 'Oils', keywords: ['oil', 'attar', 'oud', 'perfume oil', 'concentrated oil'] },
        { label: 'Body care', keywords: ['lotion', 'body cream', 'shower gel', 'body wash', 'body mist', 'body butter'] },
    ],
    Food: [
        { label: 'Snacks', keywords: ['snack', 'chips', 'biscuit', 'chin chin', 'plantain chips', 'popcorn', 'nuts', 'gari'] },
        { label: 'Drinks', keywords: ['drink', 'juice', 'water', 'soda', 'smoothie', 'malt', 'soft drink', 'zobo', 'sobolo'] },
        { label: 'Homemade meals', keywords: ['meal', 'jollof', 'food', 'homemade', 'waakye', 'banku', 'fufu', 'rice', 'stew', 'soup', 'kenkey'] },
        { label: 'Baked goods', keywords: ['bread', 'cake', 'pastry', 'baked', 'meat pie', 'doughnut', 'donut', 'cupcake', 'cookies'] },
        { label: 'Fruits', keywords: ['fruit', 'banana', 'orange', 'mango', 'pineapple', 'watermelon', 'apple'] },
        { label: 'Local delicacies', keywords: ['kelewele', 'yam', 'boiled egg', 'kebab', 'khebab', 'shawarma', 'suya', 'fried rice'] },
    ],
    Sneakers: [
        { label: 'Running', keywords: ['running', 'jogger', 'trainer', 'runner shoe'] },
        { label: 'Casual', keywords: ['casual', 'canvas', 'low top', 'high top'] },
        { label: 'Basketball', keywords: ['basketball', 'jordan', 'lebron', 'kd shoe'] },
        { label: 'Slides & Sandals', keywords: ['slide', 'sandal', 'slipper', 'flip flop', 'crocs'] },
        { label: 'Boots', keywords: ['boot', 'timberland', 'chelsea boot', 'combat boot'] },
        { label: 'Official/Loafers', keywords: ['loafer', 'official shoe', 'oxford', 'dress shoe', 'moccasin'] },
        { label: 'Brands', keywords: ['nike', 'adidas', 'puma', 'vans', 'converse', 'new balance', 'yeezy'] },
    ],
    Other: [],
};

const SERVICE_TYPES = [
    { label: '💄 Makeup', keywords: ['makeup', 'make-up', 'mua'] },
    { label: '💅 Nail fixing', keywords: ['nail'] },
    { label: '💇 Hair styling/braiding', keywords: ['hair', 'braid', 'braiding', 'weave'] },
    { label: '🖨️ Printing & photocopying', keywords: ['print', 'photocopy', 'photocopying'] },
    { label: '🎨 Graphic design', keywords: ['graphic', 'flyer', 'poster', 'logo', 'invitation'] },
    { label: '💻 Website development', keywords: ['website', 'web dev', 'web development'] },
    { label: '📸 Photography', keywords: ['photography', 'photo shoot', 'photoshoot', 'photographer'] },
    { label: '💈 Haircuts/barbering', keywords: ['haircut', 'barber', 'barbering'] },
    { label: '🏃 Errand running', keywords: ['errand'] },
    { label: '🎥 Video recording/editing', keywords: ['video', 'videography', 'editing'] },
    { label: '👕 Custom T-shirts/hoodies', keywords: ['t-shirt', 'tshirt', 'hoodie', 'custom shirt', 'branding'] },
    { label: '📱 Mobile app development', keywords: ['app dev', 'mobile app', 'app development'] },
    { label: '📦 Pickup & delivery', keywords: ['pickup', 'delivery', 'courier'] },
    { label: '📚 Tutoring/lessons', keywords: ['tutor', 'tutoring', 'lessons', 'coaching', 'extra classes'] },
    { label: '🧺 Laundry', keywords: ['laundry', 'washing', 'ironing'] },
    { label: '🔧 Phone/laptop repair', keywords: ['repair', 'phone repair', 'laptop repair', 'screen fix'] },
    { label: '🎉 Event planning/MC', keywords: ['event planning', 'mc', 'emcee', 'host', 'party planning'] },
    { label: '🧹 Cleaning services', keywords: ['cleaning', 'cleaner', 'housekeeping'] },
    { label: '🧵 Tailoring/sewing', keywords: ['tailor', 'tailoring', 'sewing', 'seamstress'] },
];
const NETWORK_IMAGES = {
    MTN: MTN_LOGO,
    Telecel: VODAFONE_LOGO,
    AirtelTigo: AIRTELTIGO_LOGO,
};

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
    { name: 'Ashesi', lat: 5.75972, lng: -0.21972 },
    { name: 'KTU', lat: 6.0630, lng: -0.2642 },
    { name: 'GCTU', lat: 5.5998, lng: -0.2362 },
    { name: 'GIMPA', lat: 5.6380, lng: -0.1670 },
    { name: 'UENR', lat: 7.3495, lng: -2.3435 },
];

const SCHOOL_FULL_NAMES = {
    KNUST: 'Kwame Nkrumah University of Science and Technology',
    ATU: 'Accra Technical University',
    UCC: 'University of Cape Coast',
    UHAS: 'University of Health and Allied Sciences',
    UG: 'University of Ghana',
    UDS: 'University for Development Studies',
    UMaT: 'University of Mines and Technology',
    UEW: 'University of Education, Winneba',
    UPSA: 'University of Professional Studies, Accra',
    PentUni: 'Pentecost University',
    KsTU: 'Kumasi Technical University',
    CU: 'Central University',
    Ashesi: 'Ashesi University',
    KTU: 'Koforidua Technical University',
    GCTU: 'Ghana Communication Technology University',
    GIMPA: 'Ghana Institute of Management and Public Administration',
    UENR: 'University of Energy and Natural Resources',
};

const schoolOptionLabel = (code) => `${code} — ${SCHOOL_FULL_NAMES[code] || code}`;

const PRICE_RANGES = [
    { label: 'Below 100', min: 0, max: 100 },
    { label: '100 - 200', min: 100, max: 200 },
    { label: '200 - 500', min: 200, max: 500 },
    { label: '500 - 1000', min: 500, max: 1000 },
    { label: 'Above 1000', min: 1000, max: Infinity },
];

const BOOST_TIERS = [
    { id: '24h', label: '24 hours', price: 20 },
    { id: '3d', label: '3 days', price: 45 },
    { id: '7d', label: '7 days', price: 90 },
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
}
export default function Browse() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [savingSearch, setSavingSearch] = useState(false);

    const isPlanActive = user?.plan && user.plan !== 'free' &&
        user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
    const isSeller = user?.account_type === 'seller';
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [itemCategory, setItemCategory] = useState(() => searchParams.get('category') || '');
    const [school, setSchool] = useState('');
    const [locating, setLocating] = useState(false);
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [priceRange, setPriceRange] = useState(null);
    const [budgetInput, setBudgetInput] = useState('');
    const [subCategory, setSubCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [openSheet, setOpenSheet] = useState(null);
    const search = searchParams.get('search') || '';
    const [showCategoryRequest, setShowCategoryRequest] = useState(false);
    const [boostMode, setBoostMode] = useState(false);
    const [boostTarget, setBoostTarget] = useState(null);
    const [selectedBoostTier, setSelectedBoostTier] = useState(null);
    const [boostSubmitting, setBoostSubmitting] = useState(false);
    const [dataNetwork, setDataNetwork] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [dataBundles, setDataBundles] = useState([]);
    const [dataBundlesLoading, setDataBundlesLoading] = useState(false);
    const [confirmBundle, setConfirmBundle] = useState(null);
    const [momoNumber, setMomoNumber] = useState('');
    const [placingOrder, setPlacingOrder] = useState(false);

    const [isMobileViewport, setIsMobileViewport] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 640 : false
    );
    const [headerScrollY, setHeaderScrollY] = useState(0);
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
        if (itemCategory !== 'Mobile Data' || !dataNetwork) {
            setDataBundles([]);
            return;
        }
        setDataBundlesLoading(true);
        api.get('/data-bundles/browse', { params: { network: dataNetwork } })
            .then((res) => setDataBundles(res.data))
            .catch(() => setDataBundles([]))
            .finally(() => setDataBundlesLoading(false));
    }, [itemCategory, dataNetwork]);

    useEffect(() => {
        const evaluate = () => setIsMobileViewport(window.innerWidth < 640);
        evaluate();
        window.addEventListener('resize', evaluate);
        return () => window.removeEventListener('resize', evaluate);
    }, []);

    // Scroll-linked header fade: as the page scrolls, the bottom of the
    // sticky header progressively fades to transparent (revealing the
    // listings underneath). Past FADE_DISTANCE the whole header also
    // starts dimming, up to a max of 50% opacity.
    useEffect(() => {
        let raf = null;
        const handleScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                setHeaderScrollY(window.scrollY);
                raf = null;
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    const HEADER_FADE_DISTANCE = 110;
    const HEADER_OPACITY_DISTANCE = 110;
    const headerMaskProgress = Math.min(headerScrollY / HEADER_FADE_DISTANCE, 1);
    const headerOpacityProgress = Math.min(
        Math.max((headerScrollY - HEADER_FADE_DISTANCE) / HEADER_OPACITY_DISTANCE, 0),
        1
    );
    const headerMaskStop = (1 - headerMaskProgress) * 100;
    const headerFadeStyle = {
        WebkitMaskImage: `linear-gradient(to bottom, black ${headerMaskStop}%, transparent 100%)`,
        maskImage: `linear-gradient(to bottom, black ${headerMaskStop}%, transparent 100%)`,
        opacity: 1 - headerOpacityProgress * 0.9,
    };

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

    const handleSaveSearch = async () => {
        if (!search && !itemCategory && !school) {
            toast.error('Set a search, category, or school filter first');
            return;
        }
        setSavingSearch(true);
        try {
            await api.post('/saved-searches', {
                keyword: search || null,
                category: itemCategory || null,
                school: school || null,
                price_min: priceRange?.min ?? null,
                price_max: priceRange?.max === Infinity ? null : (priceRange?.max ?? null),
                verified_only: verifiedOnly || false,
                filter_type: filterType !== 'all' ? filterType : null,
                service_type: serviceType || null,
            });
            toast.success("Saved! We'll notify you when a matching listing appears.");
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save this search');
        } finally {
            setSavingSearch(false);
        }
    };

    const isDemo = products.length === 0;
    const baseProducts = isDemo ? DUMMY_PRODUCTS : products;
const categoryFiltered = itemCategory
    ? baseProducts.filter((p) => (p.category || p.category_name) === itemCategory)
    : search
        ? baseProducts
        : baseProducts.filter((p) => (p.category || p.category_name) !== 'Services');
    const activeSubCategory = (SUBCATEGORIES[itemCategory] || []).find((s) => s.label === subCategory);
    const subCategoryFiltered = activeSubCategory
        ? categoryFiltered.filter((p) => {
            const text = `${p.title || ''} ${p.description || ''}`.toLowerCase();
            return activeSubCategory.keywords.some((kw) => text.includes(kw));
        })
        : categoryFiltered;

    const boostEligibleFiltered = boostMode
        ? subCategoryFiltered.filter((p) => p.seller_id === user?.id)
        : subCategoryFiltered;

    const verifiedFiltered = verifiedOnly
        ? boostEligibleFiltered.filter((p) => p.seller_verified)
        : boostEligibleFiltered;
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

    const priceFilteredList = priceRange
        ? filteredByType.filter((p) => {
            const price = parseFloat(p.price);
            return price >= priceRange.min && price <= priceRange.max;
        })
        : filteredByType;

    let visibleProducts = priceFilteredList;
    let outOfStockProducts = [];

    if (isDemo) {
        outOfStockProducts = priceFilteredList.filter((_, i) => i % 3 === 0);
        const outOfStockIds = new Set(outOfStockProducts.map((p) => p.id));
        visibleProducts = priceFilteredList.filter((p) => !outOfStockIds.has(p.id));
    } else {
        outOfStockProducts = priceFilteredList.filter((p) => {
            const stock = p.stock !== undefined ? p.stock : 1;
            return stock <= 0;
        });
        visibleProducts = priceFilteredList.filter((p) => {
            const stock = p.stock !== undefined ? p.stock : 1;
            return stock > 0;
        });
    }

    const isServiceItem = (p) => (p.category || p.category_name) === 'Services';
    const searchProductResults = search ? visibleProducts.filter((p) => !isServiceItem(p)) : visibleProducts;
    const searchServiceResults = search ? visibleProducts.filter(isServiceItem) : [];

    const renderBudgetInput = () => (
        <div className="relative shrink-0">
            <WalletIcon className="w-3 h-3 sm:w-[16px] sm:h-[16px] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
                type="number"
                min="1"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={applyBudget}
                placeholder="My budget(GHS)…"
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

    const handlePlaceDataOrder = async () => {
        const digits = momoNumber.replace(/\D/g, '');
        if (digits.length < 9) {
            toast.error('Enter a valid mobile money number');
            return;
        }
        setPlacingOrder(true);
        try {
            await api.post('/data-orders', { bundle_id: confirmBundle.id, momo_number: digits });
            toast.success('Order placed! You will receive your data once confirmed.');
            setConfirmBundle(null);
            setMomoNumber('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to place order');
        } finally {
            setPlacingOrder(false);
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

    const getCategorySubOptions = (value) => {
        if (!value || value === 'Mobile Data' || value === 'Services') return null;
        const subs = SUBCATEGORIES[value] || [];
        if (subs.length === 0) return null;
        return subs.map((s) => ({ value: s.label, label: s.label }));
    };

    const handleCategorySubSelect = (categoryValue, subValue) => {
        selectCategory(categoryValue);
        setSubCategory(subValue);
    };

    const selectCategory = (value) => {
    setItemCategory(value);
    setSubCategory('');
    if (value !== 'Mobile Data') setDataNetwork('');
        if (value !== 'Services') setServiceType('');
        setOpenSheet(null);

        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set('category', value);
        } else {
            params.delete('category');
        }
        setSearchParams(params, { replace: true });
    }
    
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

    const enterBoostMode = () => {
        setBoostMode(true);
        setItemCategory('');
        setSubCategory('');
        setOpenSheet(null);
    };

    const exitBoostMode = () => {
        setBoostMode(false);
        setBoostTarget(null);
        setSelectedBoostTier(null);
    };

    const closeBoostConfirm = () => {
        setBoostTarget(null);
        setSelectedBoostTier(null);
    };

    const handleBoostButtonClick = () => {
        if (boostBtnArmed) {
            setBoostBtnArmed(false);
            enterBoostMode();
            return;
        }
        setBoostBtnArmed(true);
        setBoostBtnBouncing(true);
        setTimeout(() => setBoostBtnBouncing(false), 600);
    };

        const [boostBtnFaded, setBoostBtnFaded] = useState(false);
    const [boostBtnArmed, setBoostBtnArmed] = useState(false);
    const [boostBtnBouncing, setBoostBtnBouncing] = useState(false);
    const boostBtnScrollTimer = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            setBoostBtnFaded(true);
            clearTimeout(boostBtnScrollTimer.current);
            boostBtnScrollTimer.current = setTimeout(() => {
                setBoostBtnFaded(false);
            }, 1500);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearTimeout(boostBtnScrollTimer.current);
        };
    }, []);

       useEffect(() => {
        if (boostTarget) {
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
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
    }, [boostTarget]);

    const handleConfirmBoost = async () => {
        if (!selectedBoostTier || !boostTarget) return;
        setBoostSubmitting(true);
        try {
            const res = await api.post('/boosts', {
                product_id: boostTarget.id,
                tier: selectedBoostTier,
            });
            window.location.href = res.data.authorization_url;
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to start boost checkout');
            setBoostSubmitting(false);
        }
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
        ...SCHOOLS.map((s) => ({ value: s.name, label: schoolOptionLabel(s.name) })),
    ];

    const headerTitle = itemCategory === 'Services'
        ? 'Browse Services'
        : search ? `Results for "${search}"` : 'Browse listings';

    return (
        <div className="relative min-h-screen">
            <style>{`
                @keyframes boostBtnBounce {
                    0% { transform: scale(1); }
                    30% { transform: scale(1.25); }
                    50% { transform: scale(0.92); }
                    70% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                .boost-btn-bounce {
                    animation: boostBtnBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
            {/* HEADER STRIP */}
            <section
                className="sticky top-14 sm:top-16 z-30 relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900"
                style={headerFadeStyle}
            >
                <div className="absolute inset-0">
                    <HeroSlideshow images={BROWSE_HEADER_IMAGES} />
                    <div className="absolute inset-0 bg-gradient-to-br from-ink-900/65 via-ink-800/45 to-brand-600/25 dark:from-ink-900/85 dark:via-ink-900/60 dark:to-gold-900/30" />
                </div>
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/3 -bottom-20 w-56 h-56 bg-brand-300/20 dark:bg-gold-300/10 rounded-full blur-3xl" />
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                    {/* ── MOBILE: back button + title + budget + category request, always shown ── */}
                    <div className="sm:hidden">
                        <Link
                            to="/"
                            aria-label="Back to home"
                            className="inline-flex items-center gap-1 bg-white/10 text-white font-semibold rounded-full border border-white/30 hover:bg-white/20 active:scale-95 backdrop-blur shrink-0 transition-colors duration-200 px-2.5 py-1"
                        >
                            <ArrowLeft className="w-3 h-3 shrink-0" />
                            <span className="text-xs whitespace-nowrap">Home</span>
                        </Link>

                        <div className="flex items-center justify-between gap-3 mt-4">
<h1 className="flex-1 min-w-0 text-xl font-extrabold text-white truncate">
    {headerTitle}
</h1>
                            {renderBudgetInput()}
                        </div>
                        <div className={`flex items-center mt-1 ${isPlanActive ? 'justify-between' : 'justify-end'}`}>
                            {isPlanActive && (
                                <button
                                    type="button"
                                    onClick={handleSaveSearch}
                                    disabled={savingSearch}
                                    className="text-[11px] font-semibold text-white/90 hover:text-white underline underline-offset-2 transition disabled:opacity-60"
                                >
                                    {savingSearch ? 'Saving…' : '🔖 Save search'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowCategoryRequest(true)}
                                className="text-[11px] font-semibold text-white/70 hover:text-white underline underline-offset-2 transition"
                            >
                                Suggest a feature
                            </button>
                        </div>
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
                                    onChange={(e) => selectCategory(e.target.value)}
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
                                    className="appearance-none bg-white/10 text-white text-sm font-semibold pl-4 pr-6 py-2 rounded-full border border-white/30 backdrop-blur focus:outline-none cursor-pointer max-w-[160px] truncate"
                                >
                                    <option value="" className="text-slate-900">All schools</option>
                                    <option value="nearby" className="text-slate-900">{locating ? 'Locating…' : '📍 Near me'}</option>
                                    {SCHOOLS.map((s) => (
                                        <option key={s.name} value={s.name} className="text-slate-900">{schoolOptionLabel(s.name)}</option>
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
                        <div className="flex items-center gap-2 shrink-0">
                            {isPlanActive && (
                                <button
                                    onClick={handleSaveSearch}
                                    disabled={savingSearch}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-full border border-white/30 text-white hover:bg-white/10 transition disabled:opacity-60"
                                >
                                    <Bookmark className="w-3.5 h-3.5" />
                                    {savingSearch ? 'Saving…' : 'Save search'}
                                </button>
                            )}
                            <button
                                onClick={() => setShowCategoryRequest(true)}
                                className="text-sm font-semibold px-3.5 py-1.5 rounded-full border border-dashed border-white/30 text-white/70 hover:bg-white/10 hover:text-white transition"
                            >
                                Suggest a feature
                            </button>
                        </div>
                    </div>
                    <div className="hidden sm:block h-px bg-gradient-to-r from-gold-400/40 via-white/10 to-transparent mt-4" />

                    <div className="hidden sm:flex items-center justify-between gap-2 flex-wrap mt-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {PRICE_RANGES.map((r) => (
                                <button
                                    key={r.label}
                                    onClick={() => setPriceRange(priceRange?.label === r.label ? null : r)}
                                    className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border transition backdrop-blur ${
                                        priceRange?.label === r.label
                                            ? 'bg-white text-brand-700 dark:bg-gold-500 dark:text-ink-900 border-white dark:border-gold-500'
                                            : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        {renderBudgetInput()}
                    </div>
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
                                        onChange={(e) => selectCategory(e.target.value)}
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
            </div>

            {/* ─── LISTINGS ───────────────────────────────────────────────── */}
            <section className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] bg-slate-100 dark:from-ink-900 dark:via-ink-950 dark:to-ink-900 dark:bg-gradient-to-b">
                {/* Decorative overlays — hidden in light mode, shown only in dark mode */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.4] dark:hidden"
                    style={{
                        backgroundImage: `
                            repeating-linear-gradient(0deg, rgba(15,23,42,0.05) 0px, rgba(15,23,42,0.05) 1px, transparent 1px, transparent 56px),
                            repeating-linear-gradient(90deg, rgba(15,23,42,0.05) 0px, rgba(15,23,42,0.05) 1px, transparent 1px, transparent 56px)
                        `,
                    }}
                />
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.5] dark:opacity-[0.35] hidden dark:block"
                    style={{
                        backgroundImage: `
                            repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 56px),
                            repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 56px)
                        `,
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

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-32 sm:pb-10">
                    {itemCategory === 'Mobile Data' ? (
                        <div className="grid sm:grid-cols-[160px_1fr] gap-6">
                            {/* NETWORK PICKER — left side */}
                            <div className="flex sm:flex-col gap-2">
                                {NETWORKS.map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setDataNetwork(n)}
                                        className={`flex-1 sm:flex-none flex items-center px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                                            dataNetwork === n
                                                ? 'bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 border-brand-600 dark:border-gold-600'
                                                : 'bg-white dark:bg-ink-800 text-slate-700 dark:text-gold-200 border-slate-200 dark:border-ink-600 hover:bg-slate-50 dark:hover:bg-ink-700'
                                        }`}
                                    >
                                        <span className="w-1/3 self-stretch shrink-0">
                                            <img
                                                src={NETWORK_IMAGES[n]}
                                                alt={n}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        </span>
                                        <span className="w-2/3 text-left truncate pl-3">{n}</span>
                                    </button>
                                ))}
                            </div>

                            {/* BUNDLES — right side */}
                            <div>
                                {!dataNetwork ? (
                                    <div className="text-center py-16 text-slate-400 dark:text-gold-200/40">
                                        <Wifi className="mx-auto mb-3" size={32} />
                                        <p>Pick a network to see available data bundles.</p>
                                    </div>
                                ) : dataBundlesLoading ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="aspect-square rounded-2xl bg-slate-100 dark:bg-ink-700 animate-pulse" />
                                        ))}
                                    </div>
                                ) : dataBundles.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400 dark:text-gold-200/40">
                                        <p>No {dataNetwork} bundles available right now.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {dataBundles.map((b) => (
                                            <button
                                                key={b.id}
                                                onClick={() => {
                                                    if (user && user.id === b.seller_id) {
                                                        toast.error('You cannot purchase your own listing.');
                                                        return;
                                                    }
                                                    setConfirmBundle(b);
                                                }}
                                                className="group relative bg-white dark:bg-ink-800 rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden hover:shadow-lg dark:hover:shadow-gold-900/20 hover:-translate-y-0.5 transition-all duration-300 p-4 flex flex-col items-center text-center"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-2">
                                                    <Wifi size={18} />
                                                </div>
                                                <p className="font-extrabold text-slate-900 dark:text-gold-50 text-lg">{parseFloat(b.gb_amount)}GB</p>
                                                <p className="text-brand-700 dark:text-gold-400 font-bold text-sm mt-1">GHS {parseFloat(b.price).toFixed(2)}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : itemCategory === 'Services' ? (
                        <>
                            <div className="flex justify-end mb-2">
                                <button
                                    type="button"
                                    onClick={() => selectCategory('')}
                                    className="inline-flex items-center gap-1 shrink-0 text-xs sm:text-sm font-semibold text-brand-600 dark:text-gold-400 hover:underline whitespace-nowrap"
                                >
                                    <ArrowLeft size={14} /> Browse listings
                                </button>
                            </div>

                            <ServiceTypeDropdown
                                value={serviceType}
                                onChange={setServiceType}
                            />

                            {(() => {
                                const activeType = SERVICE_TYPES.find((t) => t.label === serviceType);
                                const serviceResults = activeType
                                    ? visibleProducts.filter((p) => {
                                        const text = `${p.title || ''} ${p.description || ''}`.toLowerCase();
                                        return activeType.keywords.some((kw) => text.includes(kw));
                                    })
                                    : visibleProducts;

                                if (loading) {
                                    return (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-ink-700 animate-pulse" />
                                            ))}
                                        </div>
                                    );
                                }
                                if (serviceResults.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center text-center flex-1 min-h-[40vh] text-slate-400 dark:text-gold-200/40">
                                            <p>
                                                {activeType
                                                    ? `No "${activeType.label}" services right now. Try another type.`
                                                    : 'No services available right now. Check back later!'}
                                            </p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {serviceResults.map((p) => (
                                            <ServiceCard key={p.id} service={p} />
                                        ))}
                                    </div>
                                );
                            })()}
                        </>
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1">
                                {itemCategory && subCategory ? (
                                    <span className="inline-flex items-center gap-1.5 bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 px-3 py-1 rounded-full text-xs font-semibold">
                                        {itemCategory} | {subCategory}
                                        <button onClick={() => setSubCategory('')} className="hover:bg-white/20 rounded-full p-0.5">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ) : itemCategory ? (
                                    <span className="inline-flex items-center gap-1.5 bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 px-3 py-1 rounded-full text-xs font-semibold">
                                        {itemCategory}
                                        <button onClick={() => setItemCategory('')} className="hover:bg-white/20 rounded-full p-0.5">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ) : null}

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

                                <div className="shrink-0">
                                    {boostMode ? (
                                        <button
                                            type="button"
                                            onClick={exitBoostMode}
                                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-gold-200/60 hover:underline whitespace-nowrap"
                                        >
                                            <X size={13} /> Cancel boost
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => selectCategory('Services')}
                                            className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-gold-400 hover:underline whitespace-nowrap"
                                        >
                                            Browse services →
                                        </button>
                                    )}
                                </div>
                            </div>

                                                        {boostMode && (
                                <div className="flex items-center gap-2 bg-brand-50 dark:bg-gold-900/20 border border-brand-100 dark:border-gold-900/40 text-brand-700 dark:text-gold-300 text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-xl mb-4">
                                    <Rocket size={14} className="shrink-0" />
                                    Select one of your listings below to boost it.
                                </div>
                            )}

                            {verifiedOnly && (
                                <p className="text-xs text-slate-400 dark:text-gold-200/50 mb-4">
                                    {verifiedNoteText}
                                </p>
                            )}

                            {filterType === 'special' && (
                                <div className="flex flex-col items-center justify-center text-center flex-1 min-h-[50vh] text-slate-400 dark:text-gold-200/40">
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
) : searchProductResults.length === 0 && searchServiceResults.length === 0 && filterType !== 'special' ? (
    <div className="flex flex-col items-center justify-center text-center flex-1 min-h-[50vh] text-slate-400 dark:text-gold-200/40">
        <SlidersHorizontal className="mx-auto mb-3" size={32} />
        <p>No listings found. Try a different category, price range, or filter.</p>
    </div>
) : (
    <>
        {isDemo && (
            <p className="text-sm text-slate-400 dark:text-gold-200/40 mb-4">No live listings yet — here's a preview of how they'll look:</p>
        )}
        {searchProductResults.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {searchProductResults.map((p) => (
                    <ProductCard
                        key={p.id}
                        product={p}
                        boostMode={boostMode}
                        onBoostSelect={boostMode ? setBoostTarget : undefined}
                    />
                ))}
            </div>
        )}
        {search && searchServiceResults.length > 0 && (
            <>
                <div className="flex items-center gap-3 mt-10 mb-3">
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-gold-200/50 whitespace-nowrap">
                        Services
                    </span>
                    <div className="flex-1 h-px bg-slate-300 dark:bg-ink-600" />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {searchServiceResults.map((p) => <ServiceCard key={`svc-${p.id}`} service={p} />)}
                </div>
            </>
        )}
    </>
)}

                            {!boostMode && outOfStockProducts.length > 0 && (
                                <>
                                    <div className="flex items-center gap-3 mt-10 mb-3">
                                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-gold-200/50 whitespace-nowrap">
                                            Out of Stock
                                        </span>
                                        <div className="flex-1 h-px bg-slate-300 dark:bg-ink-600" />
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 opacity-60 grayscale-[30%]">
                                        {outOfStockProducts.map((p) => (
                                            <ProductCard key={`oos-${p.id}`} product={p} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* ─── FLOATING BOOST BUTTON ──────────────────────────────── */}
            {isSeller && !boostMode && itemCategory !== 'Mobile Data' && itemCategory !== 'Services' && (
                <button
                    type="button"
                    onClick={handleBoostButtonClick}
                    aria-label="Boost your product"
                    className={`fixed right-4 sm:right-6 bottom-32 sm:bottom-8 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 dark:bg-ink-800/90 backdrop-blur border-[3px] border-brand-600 dark:border-gold-500 text-brand-600 dark:text-gold-400 shadow-lg flex items-center justify-center hover:bg-brand-50 dark:hover:bg-ink-700 transition-all duration-300 ${
                        boostBtnFaded ? 'opacity-20 scale-90' : 'opacity-100 scale-100'
                    } ${boostBtnBouncing ? 'boost-btn-bounce' : ''}`}
                >
                    <Rocket size={20} />
                </button>
            )}

            {/* ─── MOBILE BOTTOM TABS ──────────────────────────────────── */}
            <div className="block sm:hidden fixed bottom-0 left-0 right-0 z-40">
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
                selectedSubValue={subCategory}
                getSubOptions={getCategorySubOptions}
                onSelect={selectCategory}
                onSelectSub={handleCategorySubSelect}
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
            {confirmBundle && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !placingOrder && setConfirmBundle(null)} />
                    <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center mb-3">
                            <Wifi size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">
                            {parseFloat(confirmBundle.gb_amount)}GB {confirmBundle.network} — GHS {parseFloat(confirmBundle.price).toFixed(2)}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1.5">
                            Enter the mobile money number to receive this data. You'll be sent a prompt to approve the payment.
                        </p>

                        <input
                            type="tel"
                            inputMode="numeric"
                            required
                            placeholder="e.g. 0551234567"
                            value={momoNumber}
                            onChange={(e) => setMomoNumber(e.target.value.replace(/\D/g, ''))}
                            className="w-full mt-4 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                        />

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setConfirmBundle(null)}
                                disabled={placingOrder}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePlaceDataOrder}
                                disabled={placingOrder}
                                className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                            >
                                {placingOrder ? <Loader2 size={14} className="animate-spin" /> : null}
                                {placingOrder ? 'Placing…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <CategoryRequestModal
                open={showCategoryRequest}
                onClose={() => setShowCategoryRequest(false)}
            />

            {boostTarget && (
                <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        onClick={() => !boostSubmitting && closeBoostConfirm()}
                    />
                    <div className="relative bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                <Rocket size={20} />
                            </div>
                            <button
                                onClick={() => !boostSubmitting && closeBoostConfirm()}
                                className="text-slate-300 dark:text-gold-300/40 hover:text-slate-500 dark:hover:text-gold-200 p-1 -mr-1 -mt-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg mt-2">
                            Boost "{boostTarget.title}"
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1">
                            Choose how long this listing should stay at the top of search and browse results.
                        </p>

                        <div className="flex flex-col gap-2 mt-4">
                            {BOOST_TIERS.map((tier) => (
                                <button
                                    key={tier.id}
                                    type="button"
                                    onClick={() => setSelectedBoostTier(tier.id)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                                        selectedBoostTier === tier.id
                                            ? 'bg-brand-50 dark:bg-gold-900/30 border-brand-500 dark:border-gold-500 text-brand-700 dark:text-gold-300'
                                            : 'border-slate-200 dark:border-ink-600 text-slate-700 dark:text-gold-100 hover:bg-slate-50 dark:hover:bg-ink-700'
                                    }`}
                                >
                                    <span>{tier.label}</span>
                                    <span className="flex items-center gap-2">
                                        GHS {tier.price}
                                        {selectedBoostTier === tier.id && <Check size={16} />}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleConfirmBoost}
                            disabled={!selectedBoostTier || boostSubmitting}
                            className="w-full mt-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                            {boostSubmitting && <Loader2 size={14} className="animate-spin" />}
                            {boostSubmitting ? 'Processing…' : 'Pay and Boost'}
                        </button>
                        <p className="text-center text-[11px] text-slate-400 dark:text-gold-200/50 mt-2">
                            🔒 Secured by Paystack
                        </p>
                    </div>
                </div>
            )}
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
        <div
            className="relative w-full border-t border-white/50 dark:border-white/10 bg-white/65 dark:bg-ink-900/55 shadow-[0_-4px_20px_-6px_rgba(15,23,42,0.25)] overflow-hidden"
            style={{
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent dark:from-white/10" />

            <div className="relative flex items-stretch h-[56px]">
                {tabs.map((tab) => {
                    const active = isTabActive(tab);
                    const Icon = active ? TAB_ICONS[tab].solid : TAB_ICONS[tab].outline;
                    const label = getTabLabel(tab);

                    return (
                        <button
                            key={tab}
                            onClick={() => onTabChange(tab)}
                            className="relative flex-1 min-w-0"
                        >
                            <span
                                className="flex h-full w-full flex-col items-center justify-center gap-0.5 transition-all duration-300 ease-out active:scale-[0.94]"
                            >
                                <Icon
                                    className={`transition-all duration-300 ${
                                        active
                                            ? 'w-[19px] h-[19px] text-brand-700 dark:text-gold-400'
                                            : 'w-[17px] h-[17px] text-slate-500 dark:text-gold-200/50'
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
                                <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-[3.5px] w-9 rounded-full bg-brand-600 dark:bg-gold-500 transition-all duration-300" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ServiceTypeDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selected = SERVICE_TYPES.find((t) => t.label === value);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Lock background scroll (and pull-to-refresh) while the dropdown list
    // is open, so touch/scroll gestures stay inside the list instead of
    // moving the Browse page underneath it.
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
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
    }, [open]);

    return (
        <div ref={containerRef} className="relative mb-5">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full sm:w-auto min-w-[260px] flex items-center gap-2.5 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-xl px-4 py-2.5 hover:border-slate-300 dark:hover:border-ink-500 transition"
            >
                <SlidersHorizontal size={16} className="text-slate-400 dark:text-gold-300/50 shrink-0" />
                <span className="flex-1 text-left text-sm font-semibold text-slate-700 dark:text-gold-100 truncate">
                    {selected ? selected.label : 'All services'}
                </span>
                <ChevronDown size={16} className={`text-slate-400 dark:text-gold-300/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-20 mt-1.5 w-full sm:min-w-[280px] bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                    <button
                        onClick={() => { onChange(''); setOpen(false); }}
                        className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-sm transition ${
                            value === ''
                                ? 'bg-brand-50 dark:bg-gold-900/30 text-brand-700 dark:text-gold-300 font-bold'
                                : 'text-slate-700 dark:text-gold-100 font-medium hover:bg-slate-50 dark:hover:bg-ink-700'
                        }`}
                    >
                        All services
                        {value === '' && <Check size={15} className="text-brand-600 dark:text-gold-400" />}
                    </button>
                    {SERVICE_TYPES.map((t) => (
                        <button
                            key={t.label}
                            onClick={() => { onChange(value === t.label ? '' : t.label); setOpen(false); }}
                            className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-sm transition ${
                                value === t.label
                                    ? 'bg-brand-50 dark:bg-gold-900/30 text-brand-700 dark:text-gold-300 font-bold'
                                    : 'text-slate-700 dark:text-gold-100 font-medium hover:bg-slate-50 dark:hover:bg-ink-700'
                            }`}
                        >
                            {t.label}
                            {value === t.label && <Check size={15} className="text-brand-600 dark:text-gold-400" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function SubcategoryScroller({ options, value, onChange }) {
    if (!options || options.length === 0) return null;
    const pillClass = (active) =>
        `shrink-0 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full border transition whitespace-nowrap ${
            active
                ? 'bg-brand-600 dark:bg-gold-600 text-white dark:text-ink-900 border-brand-600 dark:border-gold-600'
                : 'bg-white dark:bg-ink-800 text-slate-700 dark:text-gold-200 border-slate-200 dark:border-ink-600 hover:bg-slate-50 dark:hover:bg-ink-700'
        }`;

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-4 -mx-1 px-1">
            <button onClick={() => onChange('')} className={pillClass(value === '')}>
                All
            </button>
            {options.map((opt) => (
                <button
                    key={opt.label}
                    onClick={() => onChange(value === opt.label ? '' : opt.label)}
                    className={pillClass(value === opt.label)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function MobileFilterSheet({
    open, title, options, selectedValue, selectedSubValue,
    onSelect, onSelectSub, onClose, getSubOptions,
}) {
    const [mounted, setMounted] = useState(false);
    const [drillDown, setDrillDown] = useState(null); // { value, label, subs }

    useEffect(() => {
        if (open) {
            setMounted(false);
            setDrillDown(null);
            const raf = requestAnimationFrame(() => setMounted(true));
            return () => cancelAnimationFrame(raf);
        }
        setMounted(false);
        setDrillDown(null);
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

    const handleOptionClick = (opt) => {
        const subs = getSubOptions ? getSubOptions(opt.value) : null;
        if (subs && subs.length > 0) {
            setDrillDown({ value: opt.value, label: opt.label, subs });
            return;
        }
        onSelect(opt.value);
    };

    const handleSubClick = (subValue) => {
        if (onSelectSub) {
            onSelectSub(drillDown.value, subValue);
        } else {
            onSelect(drillDown.value);
        }
    };

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
                    <div className="flex items-center gap-1.5 min-w-0">
                        {drillDown && (
                            <button
                                onClick={() => setDrillDown(null)}
                                aria-label="Back"
                                className="p-1 -ml-1 rounded-full text-slate-500 dark:text-gold-200/60 hover:bg-slate-100 dark:hover:bg-ink-700 shrink-0"
                            >
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <h3 className="text-base font-bold text-slate-900 dark:text-gold-100 truncate">
                            {drillDown ? drillDown.label : title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-gold-200/60"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="overflow-y-auto no-scrollbar px-2 pb-[max(16px,env(safe-area-inset-bottom))]">
                    {drillDown ? (
                        <>
                            <button
                                onClick={() => onSelect(drillDown.value)}
                                className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl text-sm transition ${
                                    selectedValue === drillDown.value && !selectedSubValue
                                        ? 'bg-brand-50 dark:bg-gold-900/30 text-brand-700 dark:text-gold-300 font-bold'
                                        : 'text-slate-700 dark:text-gold-100 font-medium hover:bg-slate-50 dark:hover:bg-ink-700'
                                }`}
                            >
                                All {drillDown.label}
                                {selectedValue === drillDown.value && !selectedSubValue && <Check size={16} className="text-brand-600 dark:text-gold-400" />}
                            </button>
                            {drillDown.subs.map((sub) => {
                                const isSelected = selectedValue === drillDown.value && selectedSubValue === sub.value;
                                return (
                                    <button
                                        key={sub.value}
                                        onClick={() => handleSubClick(sub.value)}
                                        className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl text-sm transition ${
                                            isSelected
                                                ? 'bg-brand-50 dark:bg-gold-900/30 text-brand-700 dark:text-gold-300 font-bold'
                                                : 'text-slate-700 dark:text-gold-100 font-medium hover:bg-slate-50 dark:hover:bg-ink-700'
                                        }`}
                                    >
                                        {sub.label}
                                        {isSelected && <Check size={16} className="text-brand-600 dark:text-gold-400" />}
                                    </button>
                                );
                            })}
                        </>
                    ) : (
                        options.map((opt) => {
                            const isSelected = opt.value === selectedValue
                                || (opt.value === 'nearby' && selectedValue !== '' && selectedValue === opt.value);
                            const subs = getSubOptions ? getSubOptions(opt.value) : null;
                            const hasSubs = subs && subs.length > 0;
                            return (
                                <button
                                    key={opt.value || 'all'}
                                    onClick={() => handleOptionClick(opt)}
                                    className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl text-sm transition ${
                                        isSelected
                                            ? 'bg-brand-50 dark:bg-gold-900/30 text-brand-700 dark:text-gold-300 font-bold'
                                            : 'text-slate-700 dark:text-gold-100 font-medium hover:bg-slate-50 dark:hover:bg-ink-700'
                                    }`}
                                >
                                    {opt.label}
                                    {isSelected && !hasSubs && <Check size={16} className="text-brand-600 dark:text-gold-400" />}
                                    {hasSubs && <ChevronDown size={16} className="-rotate-90 text-slate-400 dark:text-gold-200/40" />}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}