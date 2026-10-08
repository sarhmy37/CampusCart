import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import {
  View, Text, Pressable, Image, FlatList, Modal, ActivityIndicator,
  ScrollView, TextInput, Platform, useColorScheme, Animated, Easing, Linking,
  PanResponder, Dimensions,
} from 'react-native';
import InsetShadow from '@/components/InsetShadow';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  X, Check, SlidersHorizontal, ChevronDown, ChevronRight, MapPin, Sparkles, CheckCircle, Search, ArrowLeft, ArrowRight, LayoutGrid, Tag, Rocket, Wifi, Loader2,
} from 'lucide-react-native';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import {
  Squares2X2Icon as GridOutline,
  SparklesIcon as SparklesOutline,
  TagIcon as TagOutline,
  MapPinIcon as PinOutline,
  CheckCircleIcon as CheckOutline,
} from 'react-native-heroicons/outline';
import { SUBCATEGORIES } from '@/data/subcategories';
import {
  Squares2X2Icon as GridSolid,
  SparklesIcon as SparklesSolid,
  TagIcon as TagSolid,
  MapPinIcon as PinSolid,
  CheckCircleIcon as CheckSolid,
} from 'react-native-heroicons/solid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/client';
import HeroSlideshow from '@/components/HeroSlideshow';
import ProductCard from '@/components/ProductCard';
import ServiceCard from '@/components/ServiceCard';
import { BROWSE_HEADER_IMAGES, MTN_LOGO, VODAFONE_LOGO, AIRTELTIGO_LOGO, LOGO_LIGHT, LOGO_DARK } from '@/data/media';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import CategoryRequestModal from '@/components/CategoryRequestModal';
import CustomScrollbar from '@/components/CustomScrollbar';
import { getScrollbarEnabled } from '@/utils/scrollbarPref';
import PaystackCheckout from '@/components/PaystackCheckout';

const ITEM_TYPES = [
  'Mobile Data', 'Services', 'Clothes', 'Sneakers', 'Bags', 'Gadgets', 'Stationery',
  'Books', 'Perfumes', 'Beauty & Skincare', 'Hair & Wigs', 'Jewelry & Watches',
  'Food', 'Groceries', 'Room Essentials', 'Furniture', 'Appliances',
  'Sports & Fitness', 'Music & Instruments', 'Tickets & Events', 'Other',
];

const NETWORKS = [
  { id: 'MTN', name: 'MTN', logo: MTN_LOGO },
  { id: 'Telecel', name: 'Telecel', logo: VODAFONE_LOGO },
  { id: 'AirtelTigo', name: 'AirtelTigo', logo: AIRTELTIGO_LOGO },
];

const SCHOOLS = [
  { name: 'KNUST', lat: 6.6732, lng: -1.5654 },
  { name: 'UG', lat: 5.6505, lng: -0.1895 },
  { name: 'ATU', lat: 5.554028, lng: -0.205556 },
  { name: 'UHAS', lat: 6.6008, lng: 0.4713 },
  { name: 'UCC', lat: 5.1153, lng: -1.2903 },
  { name: 'UDS', lat: 9.393273, lng: -0.823513 },
  { name: 'UEW', lat: 5.35, lng: -0.625 },
  { name: 'UPSA', lat: 5.6614, lng: -0.1664 },
  { name: 'PentUni', lat: 5.6262, lng: -0.2742 },
  { name: 'KsTU', lat: 6.6911, lng: -1.61 },
  { name: 'CU', lat: 5.5663, lng: -0.241 },
  { name: 'UMaT', lat: 5.3005, lng: -1.99 },
  { name: 'Ashesi', lat: 5.75972, lng: -0.21972 },
  { name: 'KTU', lat: 6.063, lng: -0.2642 },
  { name: 'GCTU', lat: 5.5998, lng: -0.2362 },
  { name: 'GIMPA', lat: 5.638, lng: -0.167 },
  { name: 'UENR', lat: 7.3495, lng: -2.3435 },
];

const PRICE_RANGES = [
  { label: 'Below 100', min: 0, max: 100 },
  { label: '100 - 200', min: 100, max: 200 },
  { label: '200 - 500', min: 200, max: 500 },
  { label: '500 - 1000', min: 500, max: 1000 },
  { label: 'Above 1000', min: 1000, max: Infinity },
];

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

const BOOST_TIERS = [
  { id: '24h', label: '24 hours', price: 20 },
  { id: '3d', label: '3 days', price: 45 },
  { id: '7d', label: '7 days', price: 90 },
];

function getBoostSelectLimit(plan?: string, planExpiresAt?: string) {
  const active = plan && plan !== 'free' && planExpiresAt && new Date(planExpiresAt) > new Date();
  if (!active) return 2;
  if (plan === 'premium') return 15;
  if (plan === 'pro') return 10;
  return 2;
}

type Filter = 'all' | 'new' | 'categories' | 'nearby' | 'verified';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function BrowsePage({ filter }: { filter: Filter }) {
  const colors = useColors();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const [budgetInput, setBudgetInput] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);
  const { user } = useAuth();

  const isSeller = user?.account_type === 'seller';

  const navigation = useNavigation();
  const params = useLocalSearchParams<{ search?: string; category?: string; boost_ref?: string }>();
  const search = params.search || '';
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);

  const [itemCategory, setItemCategory] = useState(params.category || '');
  const [subCategory, setSubCategory] = useState('');
  const [school, setSchool] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [newOnly, setNewOnly] = useState(filter === 'new');
  const [verifiedOnly, setVerifiedOnly] = useState(filter === 'verified');
  const [locating, setLocating] = useState(false);
  const [priceRange, setPriceRange] = useState<typeof PRICE_RANGES[number] | null>(null);
  const [openSheet, setOpenSheet] = useState<'category' | 'school' | 'service' | null>(null);
  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  const [boostMode, setBoostMode] = useState(false);
  const [selectedBoostIds, setSelectedBoostIds] = useState<string[]>([]);
  const [boostConfirmOpen, setBoostConfirmOpen] = useState(false);
  const [selectedBoostTier, setSelectedBoostTier] = useState<string | null>(null);
  const [boostSubmitting, setBoostSubmitting] = useState(false);
  const [boostCheckoutUrl, setBoostCheckoutUrl] = useState<string | null>(null);
  const [boostBtnFaded, setBoostBtnFaded] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);
  const boostFadeTimer = useRef<any>(null);
  const [scrollbarOn, setScrollbarOn] = useState(true);
  useEffect(() => {
    const load = () => getScrollbarEnabled().then(setScrollbarOn);
    load();
    return navigation.addListener('focus', load);
  }, [navigation]);
  const scrollProgress = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);
  const contentH = useRef(0);
  const viewH = useRef(0);

  const handleKnobDrag = (ratio: number) => {
    const max = contentH.current - viewH.current;
    if (max <= 0) return;
    listRef.current?.scrollToOffset({ offset: ratio * max, animated: false });
  };

  const boostSelectLimit = getBoostSelectLimit(user?.plan, user?.plan_expires_at);

  const [dataNetwork, setDataNetwork] = useState('');
const [dataBundles, setDataBundles] = useState<any[]>([]);
const [dataBundlesLoading, setDataBundlesLoading] = useState(false);
const [confirmBundle, setConfirmBundle] = useState<any>(null);
const [momoNumber, setMomoNumber] = useState('');
const [placingOrder, setPlacingOrder] = useState(false);

  const enterBoostMode = () => {
    setBoostMode(true);
    setItemCategory((c) => (c === 'Services' ? c : ''));
    setSubCategory('');
    setOpenSheet(null);
  };

  const exitBoostMode = () => {
    setBoostMode(false);
    setSelectedBoostIds([]);
    setBoostConfirmOpen(false);
    setSelectedBoostTier(null);
  };

  const closeBoostConfirm = () => {
    setBoostConfirmOpen(false);
    setSelectedBoostTier(null);
  };

  const handleListScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    scrollProgress.setValue(max > 0 ? Math.min(Math.max(contentOffset.y / max, 0), 1) : 0);
    setBoostBtnFaded(true);
    clearTimeout(boostFadeTimer.current);
    boostFadeTimer.current = setTimeout(() => setBoostBtnFaded(false), 1500);
  };

  const handleSelectBoostTarget = (product: any) => {
    const isBoosted = product.boosted_until && new Date(product.boosted_until) > new Date();
    if (isBoosted) {
      Toast.show({ type: 'error', text1: 'This listing is already boosted.' });
      return;
    }
    setSelectedBoostIds((prev) => {
      if (prev.includes(product.id)) return prev.filter((id) => id !== product.id);
      if (prev.length >= boostSelectLimit) {
        Toast.show({ type: 'error', text1: `You can boost up to ${boostSelectLimit} items on your plan.` });
        return prev;
      }
      return [...prev, product.id];
    });
  };

  const handleConfirmBoost = async () => {
    if (!selectedBoostTier || selectedBoostIds.length === 0) return;
    setBoostSubmitting(true);
    try {
      const res = await api.post('/boosts', {
        product_ids: selectedBoostIds,
        tier: selectedBoostTier,
      });
      const url = res.data.authorization_url;
      closeBoostConfirm();
      exitBoostMode();
      // Wait for the confirm sheet to finish closing, otherwise iOS can refuse to open a second modal.
      setTimeout(() => setBoostCheckoutUrl(url), 400);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to start boost checkout' });
    } finally {
      setBoostSubmitting(false);
    }
  };

  const confirmBoostPayment = async (reference: string) => {
    setBoostCheckoutUrl(null);
    if (!reference) return;
    Toast.show({ type: 'info', text1: 'Payment received', text2: 'Confirming your boost…' });

    // The webhook can take a few seconds, so check a few times.
    for (let i = 0; i < 6; i++) {
      try {
        const res = await api.get(`/boosts/status/${reference}`);
        if (res.data.status === 'confirmed') {
          Toast.show({ type: 'success', text1: 'Boost confirmed! 🚀', text2: 'Your listings are now featured.' });
          const p: Record<string, string> = {};
          if (search) p.search = search;
          if (itemCategory) p.itemCategory = itemCategory;
          if (school) p.school = school;
          api.get('/products', { params: buildParams(0) }).then((r) => {
            pageRef.current = { offset: r.data.length, more: r.data.length >= PAGE, busy: false };
            setProducts(r.data);
          }).catch(() => {});
          return;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    Toast.show({ type: 'info', text1: 'Still confirming…', text2: 'Your boost will show up shortly.' });
  };

    const handlePlaceDataOrder = async () => {
  const digits = momoNumber.replace(/\D/g, '');
  if (digits.length < 9) {
    Toast.show({ type: 'error', text1: 'Enter a valid mobile money number' });
    return;
  }
  setPlacingOrder(true);
  try {
    await api.post('/data-orders', { bundle_id: confirmBundle.id, momo_number: digits });
    Toast.show({ type: 'success', text1: 'Order placed! You will receive your data once confirmed.' });
    setConfirmBundle(null);
    setMomoNumber('');
  } catch (err: any) {
    Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to place order' });
  } finally {
    setPlacingOrder(false);
  }
};

  const applyBudgetValue = () => {
    const val = parseFloat(budgetInput);
    if (!val || val <= 0) return;
    setPriceRange({ min: 0, max: val, label: `Under GHS ${val}` });
  };

  const handleSaveSearch = async () => {
    setSavingSearch(true);
    try {
      await api.post('/saved-searches', {
        keyword: search || null,
        category: itemCategory || null,
        school: school || null,
        price_min: priceRange?.min ?? null,
        price_max: priceRange?.max === Infinity ? null : (priceRange?.max ?? null),
      });
      Toast.show({ type: 'success', text1: "Saved! We'll notify you when a matching listing appears." });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to save this search' });
    } finally {
      setSavingSearch(false);
    }
  };

  const PAGE = 24;
  const pageRef = useRef({ offset: 0, more: true, busy: false });
  const [loadingMore, setLoadingMore] = useState(false);

  const buildParams = (offset: number) => {
    const p: Record<string, any> = { limit: PAGE, offset };
    if (search) p.search = search;
    if (itemCategory) p.itemCategory = itemCategory;
    else if (!search) p.excludeServices = 1;
    if (school) p.school = school;
    if (newOnly) p.newOnly = 1;
    if (verifiedOnly) p.verified = 1;
    if (priceRange) {
      p.priceMin = priceRange.min;
      if (priceRange.max !== Infinity) p.priceMax = priceRange.max;
    }
    if (boostMode) p.mine = 1;
    if (subCategory) p.subcategory = subCategory;
    return p;
  };

  const loadMoreProducts = () => {
    const s = pageRef.current;
    if (s.busy || !s.more || loading) return;
    s.busy = true;
    setLoadingMore(true);
    api.get('/products', { params: buildParams(s.offset) })
      .then((res) => {
        if (pageRef.current !== s) return;
        const next = res.data || [];
        s.offset += next.length;
        s.more = next.length >= PAGE;
        setProducts((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...next.filter((x: any) => !seen.has(x.id))];
        });
      })
      .catch(() => {})
      .finally(() => { s.busy = false; setLoadingMore(false); });
  };

  useEffect(() => {
    const s = { offset: 0, more: true, busy: false };
    pageRef.current = s;
    setLoading(true);
    api.get('/products', { params: buildParams(0) })
      .then((res) => {
        if (pageRef.current !== s) return;
        const d = res.data || [];
        s.offset = d.length;
        s.more = d.length >= PAGE;
        setProducts(d);
      })
      .catch(() => { if (pageRef.current === s) setProducts([]); })
      .finally(() => { if (pageRef.current === s) setLoading(false); });
  }, [search, itemCategory, subCategory, school, newOnly, verifiedOnly, priceRange, boostMode]);

  useEffect(() => {
    if (!params.boost_ref) return;
    const ref = params.boost_ref;
    api.get(`/boosts/status/${ref}`)
      .then((res) => {
        if (res.data.status === 'confirmed') {
          Toast.show({
            type: 'success',
            text1: 'Boost confirmed! 🚀',
            text2: 'Check the Stories tab — your item is featured there now.',
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        router.setParams({ boost_ref: undefined } as any);
      });
  }, [params.boost_ref]);

  // Auto-open the sheet when the tab mounts with no selection
  useEffect(() => {
    if (filter === 'nearby' && !school) setOpenSheet('school');
    if (filter === 'categories' && !itemCategory) setOpenSheet('category');
  }, [filter]);

  // Toggle the category sheet when the Categories tab is pressed again
  useEffect(() => {
    if (filter !== 'categories') return;
    const unsub = navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        setOpenSheet((prev) => (prev === 'category' ? null : 'category'));
      }
    });
    return unsub;
  }, [navigation, filter]);

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
  if (itemCategory !== 'Mobile Data') {
    setDataNetwork('');
    setConfirmBundle(null);
    setMomoNumber('');
  }
}, [itemCategory]);

  useEffect(() => {
    if (itemCategory !== 'Services') setServiceType('');
  }, [itemCategory]);

  const detectNearest = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocating(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let nearest = SCHOOLS[0], best = Infinity;
      SCHOOLS.forEach((s) => {
        const d = haversine(pos.coords.latitude, pos.coords.longitude, s.lat, s.lng);
        if (d < best) { best = d; nearest = s; }
      });
      setSchool(nearest.name);
    } catch {}
    setLocating(false);
    setOpenSheet(null);
  };

  const getCategorySubOptions = (value: string) => {
    if (!value || value === 'Mobile Data' || value === 'Services' || value === 'Other') return null;
    const subs = SUBCATEGORIES[value] || [];
    if (subs.length === 0) return null;
    return subs.map((s) => ({ value: s, label: s }));
  };

  const filtered = useMemo(() => {
    let list = itemCategory
      ? products.filter((p) => (p.category || p.category_name) === itemCategory)
      : search
        ? products
        : products.filter((p) => (p.category || p.category_name) !== 'Services');

    if (subCategory) {
      list = list.filter((p) => p.subcategory === subCategory);
    }

    if (newOnly) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      list = list.filter((p) => p.created_at && new Date(p.created_at) >= threeDaysAgo);
    }
    if (school) {
      list = list.filter((p) => p.seller_school === school);
    }
    if (verifiedOnly) {
      list = list.filter((p) => p.seller_verified);
    }

    if (priceRange) {
      list = list.filter((p) => {
        const price = parseFloat(p.price);
        return price >= priceRange.min && price <= priceRange.max;
      });
    }
    if (boostMode) {
      list = list.filter((p) => p.seller_id === user?.id);
    }
    if (itemCategory === 'Services' && serviceType) {
      const active = SERVICE_TYPES.find((t) => t.label === serviceType);
      if (active) {
        list = list.filter((p) => {
          const text = `${p.title || ''} ${p.description || ''}`.toLowerCase();
          return active.keywords.some((kw) => text.includes(kw));
        });
      }
    }
    return list;
  }, [products, itemCategory, subCategory, newOnly, verifiedOnly, school, priceRange, search, boostMode, user?.id, serviceType]);

  const stockOf = (p: any) => (p.stock !== undefined ? p.stock : 1);
  const inStock = useMemo(() => filtered.filter((p) => stockOf(p) > 0), [filtered]);
  const outOfStock = useMemo(() => filtered.filter((p) => stockOf(p) <= 0), [filtered]);

  const categoryActive = !!itemCategory && itemCategory !== 'Services';

  const isTabActive = (key: string) => {
    if (key === 'all') return !newOnly && !verifiedOnly && !categoryActive && !school;
    if (key === 'new') return newOnly;
    if (key === 'verified') return verifiedOnly;
    if (key === 'categories') return categoryActive;
    return !!school;
  };

  const handleTabPress = (key: string) => {
    if (key === 'all') {
      setNewOnly(false);
      setVerifiedOnly(false);
      setItemCategory('');
      setSubCategory('');
      setSchool('');
      return;
    }
    if (key === 'new') return setNewOnly((v) => !v);
    if (key === 'verified') return setVerifiedOnly((v) => !v);
    if (key === 'categories') {
      if (categoryActive) { setItemCategory(''); setSubCategory(''); }
      else setOpenSheet('category');
      return;
    }
    if (school) setSchool('');
    else setOpenSheet('school');
  };
  const isBoosted = (p: any) => p.boosted_until && new Date(p.boosted_until) > new Date();
  const isServices = itemCategory === 'Services';
  const showBand = isTabActive('all') && (!itemCategory || isServices) && !search && !boostMode;
  const boostedBand = useMemo(() => (showBand ? inStock.filter(isBoosted) : []), [showBand, inStock]);
  const gridData = useMemo(() => (showBand ? inStock.filter((p) => !isBoosted(p)) : inStock), [showBand, inStock]);

  const headerTitle =
    itemCategory === 'Services' ? 'Browse Services'
    : search ? `Results for "${search}"`
    : 'Browse listings';

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <GridBackground isDark={isDark} />

      {/* HEADER STRIP */}
      <View style={{ position: 'relative', overflow: 'hidden', height: 150 }}>
        <HeroSlideshow images={BROWSE_HEADER_IMAGES} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)' }} />

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Pressable
            onPress={() => router.replace('/')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
              paddingHorizontal: 12, paddingVertical: 7,
              borderRadius: 999, alignSelf: 'flex-start',
            }}
          >
            <ArrowLeft size={12} color="white" />
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Home</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 40, marginBottom: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '800', color: 'white' }}>
              {headerTitle}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, width: 120 }}>
              <TextInput
                value={budgetInput}
                onChangeText={setBudgetInput}
                onSubmitEditing={applyBudgetValue}
                placeholder="My budget…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="number-pad"
                returnKeyType="search"
                style={{ flex: 1, color: 'white', fontSize: 12, padding: 0, fontWeight: '500' }}
              />
              <Pressable onPress={applyBudgetValue} hitSlop={6}>
                <Search size={12} color="white" />
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isPlanActive ? 'space-between' : 'flex-end', marginTop: -2 }}>
            {isPlanActive && (
              <Pressable onPress={handleSaveSearch} disabled={savingSearch}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline' }}>
                  {savingSearch ? 'Saving…' : '🔖 Save search'}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={() => setFeatureModalOpen(true)}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textDecorationLine: 'underline' }}>
                Suggest a feature
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Browse sub-tabs */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', height: 40 }}>
          {[
            { key: 'all', label: 'All', outline: GridOutline, solid: GridSolid },
            { key: 'new', label: 'New', outline: SparklesOutline, solid: SparklesSolid },
            { key: 'categories', label: itemCategory && itemCategory !== 'Services' ? itemCategory : 'Categories', outline: TagOutline, solid: TagSolid },
            { key: 'nearby', label: school || 'Nearby', outline: PinOutline, solid: PinSolid },
            { key: 'verified', label: 'Verified', outline: CheckOutline, solid: CheckSolid },
          ].map((t) => {
            const active = isTabActive(t.key);
            const Icon = active ? t.solid : t.outline;
            return (
              <Pressable
                key={t.key}
                onPress={() => handleTabPress(t.key)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <Icon size={14} color={active ? colors.brand : colors.textFaint} />
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.brand : colors.textFaint,
                  }}
                >
                  {t.label}
                </Text>
                {active && (
                  <View
                    style={{
                      position: 'absolute', bottom: -1, alignSelf: 'center',
                      height: 3, width: 28, borderRadius: 999, backgroundColor: colors.brand,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Switch row: Type chip (left) + Browse services / Browse listings (right) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 }}>
        {subCategory ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>
              Type: {subCategory}
            </Text>
            <Pressable onPress={() => setSubCategory('')} hitSlop={6}>
              <X size={12} color={colors.brand} />
            </Pressable>
          </View>
        ) : (
          isServices ? (
            <Pressable
              onPress={() => setOpenSheet('service')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: serviceType ? colors.brandSoft : colors.card,
                borderWidth: 1, borderColor: serviceType ? colors.brand : colors.border,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: '60%',
              }}
            >
              <SlidersHorizontal size={12} color={serviceType ? colors.brand : colors.textMuted} />
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: serviceType ? colors.brand : colors.textMuted, flexShrink: 1 }}>
                {serviceType || 'All services'}
              </Text>
              <ChevronDown size={12} color={serviceType ? colors.brand : colors.textMuted} />
            </Pressable>
          ) : <View />
        )}

        {boostMode ? (
          <Pressable onPress={exitBoostMode} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <X size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Cancel boost</Text>
          </Pressable>
        ) : itemCategory === 'Services' ? (
          <Pressable onPress={() => setItemCategory('')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} color={colors.brand} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>Browse listings</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setItemCategory('Services')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>Browse services</Text>
            <ArrowRight size={14} color={colors.brand} />
          </Pressable>
        )}
      </View>

      {/* Listings */}
{/* Listings */}
{itemCategory === 'Mobile Data' ? (
  <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
      Choose a network
    </Text>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
      {NETWORKS.map((n) => {
        const active = dataNetwork === n.id;
        return (
<Pressable
  key={n.id}
  onPress={() => setDataNetwork(n.id)}
  style={{
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: active ? colors.brand : colors.border,
    backgroundColor: active ? colors.brandSoft : colors.card,
  }}
>
  <Image source={n.logo} style={{ width: 24, height: 24, borderRadius: 6 }} contentFit="cover" />
  <Text
    numberOfLines={1}
    style={{ flex: 1, fontSize: 12, fontWeight: active ? '700' : '600', color: active ? colors.brand : colors.text }}
  >
    {n.name}
  </Text>
</Pressable>
        );
      })}
    </View>

    {!dataNetwork ? (
      <View style={{ alignItems: 'center', paddingVertical: 60 }}>
        <Wifi size={32} color={colors.textFaint} />
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.textFaint, textAlign: 'center' }}>
          Pick a network to see available data bundles.
        </Text>
      </View>
    ) : dataBundlesLoading ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ width: '31.5%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.cardAlt }} />
        ))}
      </View>
    ) : dataBundles.length === 0 ? (
      <View style={{ alignItems: 'center', paddingVertical: 60 }}>
        <Text style={{ fontSize: 14, color: colors.textFaint, textAlign: 'center' }}>
          No {dataNetwork} bundles available right now.
        </Text>
      </View>
    ) : (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {dataBundles.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => {
              if (user && user.id === b.seller_id) {
                Toast.show({ type: 'error', text1: 'You cannot purchase your own listing.' });
                return;
              }
              setConfirmBundle(b);
            }}
            style={{
              width: '31.5%',
              aspectRatio: 1,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 10,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={16} color={colors.brand} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              {parseFloat(b.gb_amount)}GB
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand }}>
              GHS {parseFloat(b.price).toFixed(2)}
            </Text>
          </Pressable>
        ))}
      </View>
    )}
  </ScrollView>
) : loading ? (
  <BrowseSkeleton colors={colors} />
) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <SlidersHorizontal size={28} color={colors.textFaint} />
          <Text style={{ marginTop: 10, fontSize: 13, color: colors.textFaint, textAlign: 'center' }}>
            No listings found. Try a different filter.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          onContentSizeChange={(_w, h) => { contentH.current = h; }}
          onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
          data={gridData}
          ListHeaderComponent={
            boostedBand.length > 0 ? (
              <View style={{ marginBottom: 4, backgroundColor: isDark ? '#0a0a0a' : '#ececec' }}>
                <InsetShadow direction="down" />
                <View style={{ paddingBottom: 4 }}>
                  <View style={{ paddingHorizontal: 16, marginBottom: 10, marginTop: -12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <RocketLaunch color={colors.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.brand, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {isServices ? 'Boosted services' : 'Boosted'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 15 }}>
                        {isServices
                          ? 'Promoted by providers. Priority placement, just for a while.'
                          : 'Promoted by sellers. Priority placement, just for a while.'}
                      </Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                    {boostedBand.map((item) => (
                      <View key={`boost-${item.id}`} style={{ width: 128 }}>
                        {(item.category || item.category_name) === 'Services'
                          ? <ServiceCard service={item} />
                          : <ProductCard product={item} />}
                      </View>
                    ))}
                  </ScrollView>
                </View>
                <InsetShadow direction="up" />
                <View style={{ height: 1, backgroundColor: colors.border }} />
              </View>
            ) : null
          }
          keyExtractor={(p) => String(p.id)}
          ListFooterComponent={
            !boostMode && outOfStock.length > 0 ? (
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textFaint }}>
                    Out of Stock
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, opacity: 0.6 }}>
                  {outOfStock.map((item) => (
                    <View key={`oos-${item.id}`} style={{ width: '31.5%' }}>
                      {(item.category || item.category_name) === 'Services'
                        ? <ServiceCard service={item} />
                        : <ProductCard product={item} />}
                    </View>
                  ))}
                </View>
              </View>
            ) : loadingMore ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} /> : null
          }
          numColumns={3}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleListScroll}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.6}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={{ width: '31.5%' }}>
              {(item.category || item.category_name) === 'Services'
                ? (
                  <ServiceCard
                    service={item}
                    boostMode={boostMode}
                    boostSelected={selectedBoostIds.includes(item.id)}
                    onBoostSelect={boostMode ? handleSelectBoostTarget : undefined}
                  />
                )
                : (
                  <ProductCard
                    product={item}
                    boostMode={boostMode}
                    boostSelected={selectedBoostIds.includes(item.id)}
                    onBoostSelect={boostMode ? handleSelectBoostTarget : undefined}
                  />
                )}
            </View>
          )}
        />
      )}
      {scrollbarOn && itemCategory !== 'Mobile Data' && !loading && filtered.length > 0 && (
        <CustomScrollbar
          progress={scrollProgress}
          onDrag={handleKnobDrag}
          scrolling={boostBtnFaded}
          centerY={222 + (containerHeight - 222) / 2}
        />
      )}

      {boostMode && selectedBoostIds.length > 0 && (
        <Pressable
          onPress={() => setBoostConfirmOpen(true)}
          style={{
            position: 'absolute', left: 16, right: 16, bottom: 60,
            backgroundColor: colors.brand, borderRadius: 16,
            paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
            elevation: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
            Boost {selectedBoostIds.length} {selectedBoostIds.length === 1 ? 'item' : 'items'} ({selectedBoostIds.length}/{boostSelectLimit})
          </Text>
        </Pressable>
      )}

      {isSeller && !boostMode && itemCategory !== 'Mobile Data' && (
        <FloatingBoostButton
          colors={colors}
          faded={boostBtnFaded}
          containerHeight={containerHeight}
          onPress={enterBoostMode}
        />
      )}

      <Modal visible={boostConfirmOpen} transparent animationType="fade" onRequestClose={closeBoostConfirm}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight }} onPress={() => !boostSubmitting && closeBoostConfirm()} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Rocket size={20} color={colors.brand} />
            </View>
            <Pressable onPress={() => !boostSubmitting && closeBoostConfirm()} hitSlop={8}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 10 }}>
            Boost {selectedBoostIds.length} {selectedBoostIds.length === 1 ? 'listing' : 'listings'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            Choose how long these listings should stay at the top of search and browse results. One flat price for all selected items.
          </Text>

          <View style={{ gap: 8, marginTop: 14 }}>
            {BOOST_TIERS.map((tier) => {
              const active = selectedBoostTier === tier.id;
              return (
                <Pressable
                  key={tier.id}
                  onPress={() => setSelectedBoostTier(tier.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
                    borderWidth: 1, borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandSoft : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: active ? colors.brand : colors.text }}>
                    {tier.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: active ? colors.brand : colors.text }}>
                      GHS {tier.price}
                    </Text>
                    {active && <Check size={16} color={colors.brand} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleConfirmBoost}
            disabled={!selectedBoostTier || boostSubmitting}
            style={{
              marginTop: 16, paddingVertical: 13, borderRadius: 14,
              backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              opacity: !selectedBoostTier || boostSubmitting ? 0.6 : 1,
            }}
          >
            {boostSubmitting && <ActivityIndicator size="small" color="#fff" />}
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
              {boostSubmitting ? 'Processing…' : 'Pay and Boost'}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 8 }}>
            🔒 Secured by Paystack
          </Text>
        </View>
      </Modal>

      <Modal
  visible={!!confirmBundle}
  transparent
  animationType="fade"
  onRequestClose={() => !placingOrder && setConfirmBundle(null)}
>
  <Pressable
    style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 24 }}
    onPress={() => !placingOrder && setConfirmBundle(null)}
  >
    <Pressable
      onPress={(e) => e.stopPropagation?.()}
      style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Wifi size={20} color={colors.brand} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        {parseFloat(confirmBundle?.gb_amount || '0')}GB {confirmBundle?.network} — GHS {parseFloat(confirmBundle?.price || '0').toFixed(2)}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19 }}>
        Enter the mobile money number to receive this data. You'll be sent a prompt to approve the payment.
      </Text>

      <TextInput
        value={momoNumber}
        onChangeText={(v) => setMomoNumber(v.replace(/\D/g, ''))}
        placeholder="e.g. 0551234567"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        style={{
          marginTop: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          color: colors.text,
          fontSize: 14,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
        <Pressable
          onPress={() => !placingOrder && setConfirmBundle(null)}
          style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handlePlaceDataOrder}
          disabled={placingOrder}
          style={{
            flex: 1, paddingVertical: 12, borderRadius: 12,
            backgroundColor: colors.brand, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 6,
            opacity: placingOrder ? 0.6 : 1,
          }}
        >
          {placingOrder && <ActivityIndicator size="small" color={colors.textOnGold} />}
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textOnGold }}>
            {placingOrder ? 'Placing…' : 'Confirm'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  </Pressable>
</Modal>

      {/* BOOST PAYMENT (in-app Paystack) */}
      <PaystackCheckout
        key={boostCheckoutUrl ?? 'none'}
        visible={!!boostCheckoutUrl}
        authorizationUrl={boostCheckoutUrl}
        callbackUrl="https://campuscart-tdfn.onrender.com/paystack/callback"
        onSuccess={confirmBoostPayment}
        onClose={() => setBoostCheckoutUrl(null)}
      />

      {/* CATEGORY SHEET */}
      <FilterSheet
        visible={openSheet === 'category'}
        title="Categories"
        options={['', ...ITEM_TYPES]}
        renderLabel={(v) => v || 'All categories'}
        selected={itemCategory}
        onSelect={(v) => { setItemCategory(v); setSubCategory(''); setOpenSheet(null); }}
        onClose={() => setOpenSheet(null)}
        getSubOptions={getCategorySubOptions}
        onSelectSub={(cat, sub) => { setItemCategory(cat); setSubCategory(sub); setOpenSheet(null); }}
      />

      {/* SERVICE TYPE SHEET */}
      <FilterSheet
        visible={openSheet === 'service'}
        title="Service type"
        options={['', ...SERVICE_TYPES.map((t) => t.label)]}
        renderLabel={(v) => v || 'All services'}
        selected={serviceType}
        onSelect={(v) => { setServiceType(v); setOpenSheet(null); }}
        onClose={() => setOpenSheet(null)}
      />

      {/* SCHOOL SHEET */}
      <FilterSheet
        visible={openSheet === 'school'}
        title="School"
        options={['', ...SCHOOLS.map((s) => s.name)]}
        renderLabel={(v) => v || 'All schools'}
        selected={school}
        onSelect={(v) => { setSchool(v); setOpenSheet(null); }}
        onClose={() => setOpenSheet(null)}
        autoDetectLabel={locating ? 'Detecting…' : '📍 Auto-detect nearby school'}
        onAutoDetect={detectNearest}
      />

      {/* FEATURE REQUEST MODAL */}
      <CategoryRequestModal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
      />
    </View>
  );
}

function FilterSheet({
  visible, title, options, renderLabel, selected, onSelect, onClose,
  autoDetectLabel, onAutoDetect, getSubOptions, onSelectSub,
}: {
  visible: boolean;
  title: string;
  options: string[];
  renderLabel: (v: string) => string;
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  autoDetectLabel?: string;
  onAutoDetect?: () => void;
  getSubOptions?: (value: string) => { label: string; value: string }[] | null;
  onSelectSub?: (cat: string, sub: string) => void;
}) {
  const colors = useColors();
  const [drillDown, setDrillDown] = useState<{ value: string; label: string; subs: any[] } | null>(null);

  useEffect(() => {
    if (!visible) setDrillDown(null);
  }, [visible]);

  const handleOptionClick = (opt: string) => {
    const subs = getSubOptions ? getSubOptions(opt) : null;
    if (subs && subs.length > 0) {
      setDrillDown({ value: opt, label: renderLabel(opt), subs });
      return;
    }
    onSelect(opt);
  };



  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', borderTopWidth: 1, borderColor: colors.border }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>

        {/* Header — with back button when drilled in */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {drillDown && (
              <Pressable onPress={() => setDrillDown(null)} style={{ padding: 4, marginLeft: -4, borderRadius: 999 }}>
                <ArrowLeft size={18} color={colors.textMuted} />
              </Pressable>
            )}
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 }} numberOfLines={1}>
              {drillDown ? drillDown.label : title}
            </Text>
          </View>
          <Pressable onPress={onClose}><X size={18} color={colors.textMuted} /></Pressable>
        </View>

        {drillDown ? (
          <FlatList
            data={[{ value: '__all__', label: `All ${drillDown.label}` }, ...drillDown.subs]}
            keyExtractor={(v) => v.value}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
            renderItem={({ item }) => {
              const isAll = item.value === '__all__';
              const isSelected = !isAll && item.value === selected;
              return (
                <Pressable
                  onPress={() => {
                    if (isAll) {
                      onSelect(drillDown.value);
                    } else if (onSelectSub) {
                      onSelectSub(drillDown.value, item.value);
                    } else {
                      onSelect(drillDown.value);
                    }
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
                    backgroundColor: isSelected ? colors.brandSoft : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, color: isSelected ? colors.brand : colors.textSecondary, fontWeight: isSelected ? '700' : '500' }}>
                    {item.label}
                  </Text>
                  {isSelected && <Check size={16} color={colors.brand} />}
                </Pressable>
              );
            }}
          />
        ) : (
          <FlatList
            data={options}
            keyExtractor={(v) => v || 'all'}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
            ListHeaderComponent={
              onAutoDetect ? (
                <Pressable
                  onPress={onAutoDetect}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 4,
                    borderRadius: 12, backgroundColor: colors.brandSoft,
                  }}
                >
                  <MapPin size={16} color={colors.brand} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand }}>
                    {autoDetectLabel || 'Auto-detect'}
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = item === selected;
              const subs = getSubOptions ? getSubOptions(item) : null;
              const hasSubs = subs && subs.length > 0;
              return (
                <Pressable
                  onPress={() => handleOptionClick(item)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
                    backgroundColor: isSelected && !hasSubs ? colors.brandSoft : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, color: isSelected && !hasSubs ? colors.brand : colors.textSecondary, fontWeight: isSelected && !hasSubs ? '700' : '500' }}>
                    {renderLabel(item)}
                  </Text>
                  {isSelected && !hasSubs && <Check size={16} color={colors.brand} />}
                  {hasSubs && <ChevronRight size={16} color={colors.textFaint} />}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// Faint line-grid backdrop — light lines on dark backgrounds, dark lines on light ones.
function GridBackground({ isDark }: { isDark: boolean }) {
  const lineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Defs>
        <Pattern id="grid" width={64} height={64} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={0} y2={64} stroke={lineColor} strokeWidth={1} />
          <Line x1={0} y1={0} x2={64} y2={0} stroke={lineColor} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

// AssistiveTouch-style boost FAB: draggable anywhere, but always snaps to the
// nearest left/right edge on release and stays clamped between the sub-tabs
// (top) and the bottom tab bar (bottom) — it can't drift over either.
const BOOST_BTN_SIZE = 52;
const BOOST_BTN_MARGIN = 16;
// Below header (150) + sub-tabs (40) + switch row (~40 incl. padding).
const BOOST_BTN_TOP_BOUND = 222;
const BOOST_BTN_BOTTOM_GAP = 60; // matches the space already reserved above the bottom tab bar
const BOOST_BTN_POS_KEY = 'boost_fab_position';

function FloatingBoostButton({
  colors, faded, containerHeight, onPress,
}: {
  colors: any;
  faded: boolean;
  containerHeight: number;
  onPress: () => void;
}) {
  const screenWidth = Dimensions.get('window').width;

  const pan = useRef(
    new Animated.ValueXY({
      x: screenWidth - BOOST_BTN_SIZE - BOOST_BTN_MARGIN,
      y: BOOST_BTN_TOP_BOUND,
    })
  ).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rx = useRef(new Animated.Value(0)).current;
  const rsx = useRef(new Animated.Value(1)).current;
  const rshake = useRef(new Animated.Value(0)).current;
  const launching = useRef(false);

  const playLaunch = () => {
    if (launching.current) return;
    launching.current = true;
    const t = (v: Animated.Value, to: number, duration: number, easing?: (n: number) => number) =>
      Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // slow squeeze while vibrating
    Animated.parallel([
      t(rsx, 0.6, 600, Easing.inOut(Easing.quad)),
      t(rx, -3, 600),
      Animated.sequence([
        ...Array.from({ length: 12 }).map((_, i) => t(rshake, i % 2 === 0 ? 1.5 : -1.5, 50)),
        t(rshake, 0, 0),
      ]),
    ]).start(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      // launch toward top-right
      Animated.parallel([
        t(rsx, 1.3, 260, Easing.in(Easing.cubic)),
        t(rx, 40, 260, Easing.in(Easing.cubic)),
      ]).start(() => {
        onPress();
        rx.setValue(-40);
        rsx.setValue(1);
        t(rx, 0, 450, Easing.out(Easing.cubic)).start(() => {
          launching.current = false;
        });
      });
    });
  };

  const startPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const hasCustomPos = useRef(false);
  const [positionLoaded, setPositionLoaded] = useState(false);

  const clampY = (y: number) => {
    const maxY = Math.max(
      BOOST_BTN_TOP_BOUND,
      (containerHeight || Dimensions.get('window').height) - BOOST_BTN_SIZE - BOOST_BTN_BOTTOM_GAP
    );
    return Math.min(Math.max(y, BOOST_BTN_TOP_BOUND), maxY);
  };

  const clampX = (x: number) => {
    const maxX = screenWidth - BOOST_BTN_SIZE - BOOST_BTN_MARGIN;
    return Math.min(Math.max(x, BOOST_BTN_MARGIN), maxX);
  };

  // Load a saved position once on mount; falls back to the default spot.
  useEffect(() => {
    AsyncStorage.getItem(BOOST_BTN_POS_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved?.x === 'number' && typeof saved?.y === 'number') {
            hasCustomPos.current = true;
            pan.setValue({ x: clampX(saved.x), y: clampY(saved.y) });
          }
        }
      })
      .catch(() => {})
      .finally(() => setPositionLoaded(true));
  }, []);

  // Keep the resting spot pinned bottom-right of the visible area until the
  // user drags it somewhere else themselves (or we've restored a saved spot).
  useEffect(() => {
    if (positionLoaded && containerHeight > 0 && !hasCustomPos.current) {
      pan.setValue({
        x: screenWidth - BOOST_BTN_SIZE - BOOST_BTN_MARGIN,
        y: clampY(containerHeight - BOOST_BTN_SIZE - BOOST_BTN_BOTTOM_GAP),
      });
    }
  }, [containerHeight, positionLoaded]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        moved.current = false;
        pan.stopAnimation((value) => {
          startPos.current = value;
        });
        Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, friction: 5 }).start();
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) moved.current = true;
        pan.setValue({
          x: clampX(startPos.current.x + gesture.dx),
          y: clampY(startPos.current.y + gesture.dy),
        });
      },
      onPanResponderRelease: (_, gesture) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();

        if (!moved.current) {
          playLaunch();
          return;
        }

        hasCustomPos.current = true;
        const endX = startPos.current.x + gesture.dx;
        const snapToRight = endX + BOOST_BTN_SIZE / 2 > screenWidth / 2;
        const snappedX = snapToRight
          ? screenWidth - BOOST_BTN_SIZE - BOOST_BTN_MARGIN
          : BOOST_BTN_MARGIN;
        const snappedY = clampY(startPos.current.y + gesture.dy);

        Animated.spring(pan, {
          toValue: { x: snappedX, y: snappedY },
          useNativeDriver: true,
          friction: 7,
        }).start();

        AsyncStorage.setItem(
          BOOST_BTN_POS_KEY,
          JSON.stringify({ x: snappedX, y: snappedY })
        ).catch(() => {});
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        opacity: faded ? 0.2 : 1,
        transform: [...pan.getTranslateTransform(), { scale }],
      }}
    >
      <View
        style={{
          width: BOOST_BTN_SIZE, height: BOOST_BTN_SIZE, borderRadius: BOOST_BTN_SIZE / 2,
          backgroundColor: colors.card, borderWidth: 3, borderColor: colors.brand,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        }}
      >
        <View style={{ width: 28, height: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ transform: [{ rotate: '-45deg' }] }}>
            <Animated.View style={{ transform: [{ translateX: rx }, { translateY: rshake }, { scaleX: rsx }] }}>
              <View style={{ transform: [{ rotate: '45deg' }] }}>
                <Rocket size={20} color={colors.brand} />
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function BrowseSkeleton({ colors }: { colors: any }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const Block = ({ style }: { style: any }) => (
    <Animated.View style={[{ backgroundColor: colors.cardAlt, opacity: pulse }, style]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={{ width: '31.5%' }}>
            <Block style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }} />
            <Block style={{ width: '80%', height: 10, borderRadius: 5, marginTop: 8 }} />
            <Block style={{ width: '50%', height: 10, borderRadius: 5, marginTop: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Rocket squeezes along its diagonal, shoots off top-right, then re-enters from bottom-left. Loops ~every 3s.
function RocketLaunch({ color }: { color: string }) {
  const x = useRef(new Animated.Value(0)).current;
  const sx = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = (v: Animated.Value, to: number, duration: number, easing?: (n: number) => number) =>
      Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4500),
        // slow squeeze while vibrating
        Animated.parallel([
          t(sx, 0.6, 900, Easing.inOut(Easing.quad)),
          t(x, -4, 900),
          Animated.sequence(
            Array.from({ length: 18 }).map((_, i) =>
              t(shake, i % 2 === 0 ? 2.5 : -2.5, 50)
            ).concat([t(shake, 0, 0)])
          ),
        ]),
        // launch toward top-right, stretching
        Animated.parallel([t(sx, 1.3, 260, Easing.in(Easing.cubic)), t(x, 50, 260, Easing.in(Easing.cubic))]),
        // jump instantly to the bottom-left, outside the clip box
        Animated.parallel([t(x, -50, 0), t(sx, 1, 0)]),
        // glide back into place
        t(x, 0, 450, Easing.out(Easing.cubic)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ width: 40, height: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ rotate: '-45deg' }] }}>
        <Animated.View style={{ transform: [{ translateX: x }, { translateY: shake }, { scaleX: sx }] }}>
          <View style={{ transform: [{ rotate: '45deg' }] }}>
            <Rocket size={40} color={color} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function PulsingLogo({ colors }: { colors: any }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <GridBackground isDark={isDark} />
      <Animated.Image
        source={isDark ? LOGO_LIGHT : LOGO_DARK}
        style={{ width: 64, height: 64, transform: [{ scale: pulse }] }}
        resizeMode="contain"
      />
    </View>
  );
}