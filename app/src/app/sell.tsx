import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal,
useWindowDimensions, KeyboardAvoidingView, Platform, FlatList, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { VideoView, useVideoPlayer } from 'expo-video';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { SUBCATEGORIES } from '@/data/subcategories';
import { useColors } from '@/hooks/useColors';
import { CREATE_LISTING_VIDEO } from '@/data/media';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ImagePlus, Video as VideoIcon, X, ArrowLeft, Truck, AlertTriangle, ChevronDown,
  Plus, Trash2, Wifi, Briefcase, Package, Clock, MapPin, Check, Map as MapIcon,
} from 'lucide-react-native';
import LocationPickerModal from '@/components/LocationPickerModal';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];
const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DURATION_OPTIONS = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
  { label: 'Half day (6 hours)', value: 360 },
  { label: 'Full day', value: 1440 },
];
const TIME_OPTIONS = (() => {
  const t: { label: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const dh = h % 12 === 0 ? 12 : h % 12;
      t.push({ value: `${hh}:${mm}`, label: `${dh}:${mm} ${h < 12 ? 'AM' : 'PM'}` });
    }
  }
  return t;
})();
const MAX_DELIVERY_FEE = 50;
const DELIVERY_FEE_OPTIONS = [
  { label: 'Free', value: '' },
  ...Array.from({ length: MAX_DELIVERY_FEE }, (_, i) => ({ label: `GHS ${i + 1}`, value: String(i + 1) })),
];
const CONDITION_OPTIONS = [
  { label: 'New', value: 'new' },
  { label: 'Used', value: 'used' },
];
const MAX_IMAGES = 6;

const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const clampFee = (v: string) => Math.min(Math.max(Number(v) || 0, 0), MAX_DELIVERY_FEE);

async function uploadToBackend(file: { uri: string; name: string; type: string }) {
  const formData = new FormData();
  formData.append('file', file as any);
  const res = await api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return res.data.url as string;
}

export default function CreateListing() {
  const colors = useColors();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const isDataSeller = !!user?.is_data_seller;
 const heroHeight = height * 0.38;
const scrollY = useRef(new Animated.Value(0)).current;
const [backVisible, setBackVisible] = useState(true);
const backOpacity = scrollY.interpolate({
  inputRange: [0, 80],
  outputRange: [1, 0],
  extrapolate: 'clamp',
});

  const [activeTab, setActiveTab] = useState<'product' | 'service'>('product');

  // Data bundles
  const [bundles, setBundles] = useState<any[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [newBundle, setNewBundle] = useState({ network: 'MTN', gb_amount: '', price: '' });
  const [savingBundle, setSavingBundle] = useState(false);

  // Product form
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '', description: '', price: '', category_id: '', condition: 'used', stock: '1', network: '', subcategory: '',

  });
  const [deliveryPrices, setDeliveryPrices] = useState({
    delivery_fee_on_campus: '',
    delivery_fee_near_campus: '',
    delivery_fee_far_campus: '',
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeliveryWarning, setShowDeliveryWarning] = useState(false);

  // Service form
  const [serviceForm, setServiceForm] = useState({ title: '', description: '', price: '', priceMax: '' });
  const [is247, setIs247] = useState(false);
  const [workingDays, setWorkingDays] = useState(
    WORKING_DAYS.map((day) => ({ day, enabled: false, open: '09:00', close: '17:00' }))
  );
  const [serviceLocation, setServiceLocation] = useState<{ lat: number; lng: number } | null>(null);
const [locatingService, setLocatingService] = useState(false);
const [locationSource, setLocationSource] = useState<'map' | 'gps' | null>(null);
const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [serviceDuration, setServiceDuration] = useState(60);
  const [serviceImageUrls, setServiceImageUrls] = useState<string[]>([]);
  const [servicePreviews, setServicePreviews] = useState<string[]>([]);
  const [serviceVideoUrl, setServiceVideoUrl] = useState<string | null>(null);
  const [serviceVideoPreview, setServiceVideoPreview] = useState<string | null>(null);
  const [serviceUploading, setServiceUploading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);

  const selectedCategory = categories.find((c) => String(c.id) === String(form.category_id));
  const isMobileData = selectedCategory?.name === 'Mobile Data';
  const subOptions = (SUBCATEGORIES[selectedCategory?.name ?? ''] ?? []).map((s) => ({ label: s, value: s }));


  const heroPlayer = useVideoPlayer(CREATE_LISTING_VIDEO as any, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    api.get('/categories')
      .then((res) => {
        const list = [...res.data].sort((a: any, b: any) =>
          (a.name === 'Other' ? 1 : 0) - (b.name === 'Other' ? 1 : 0)
        );
        setCategories(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBundles();
  }, [isDataSeller]);

  const loadBundles = () => {
    if (!isDataSeller) return;
    setBundlesLoading(true);
    api.get('/data-bundles/mine')
      .then((res) => setBundles(res.data))
      .catch(() => setBundles([]))
      .finally(() => setBundlesLoading(false));
  };

  // ─── Pickers ─────────────────────────────────────────────────────
  const pickImages = async (existing: string[], setUrls: any, setPrevs: any, setUploadingFlag: any) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access photos' });
      return;
    }
    const remaining = MAX_IMAGES - existing.length;
    if (remaining <= 0) {
      Toast.show({ type: 'error', text1: `You can only upload up to ${MAX_IMAGES} images.` });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled) return;

    const assets = result.assets.slice(0, remaining);
    const newPreviews = assets.map((a) => a.uri);
    setPrevs((prev: string[]) => [...prev, ...newPreviews]);

    setUploadingFlag(true);
    try {
      const urls: string[] = [];
      for (const asset of assets) {
        const jpeg = await ImageManipulator.manipulateAsync(asset.uri, [], {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        urls.push(await uploadToBackend({
          uri: jpeg.uri,
          name: `photo-${Date.now()}.jpg`,
          type: 'image/jpeg',
        }));
      }
      setUrls((prev: string[]) => [...prev, ...urls]);
      Toast.show({ type: 'success', text1: `Uploaded ${urls.length} image(s)` });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to upload images' });
      setPrevs((prev: string[]) => prev.slice(0, -newPreviews.length));
    } finally {
      setUploadingFlag(false);
    }
  };

  const pickVideo = async (setUrl: any, setPrev: any, setUploadingFlag: any) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access videos' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
      Toast.show({ type: 'error', text1: 'Video must be under 20MB' });
      return;
    }

    setPrev(asset.uri);
    setUploadingFlag(true);
    try {
      const url = await uploadToBackend({
        uri: asset.uri,
        name: asset.fileName || 'video.mp4',
        type: asset.mimeType || 'video/mp4',
      });
      setUrl(url);
      Toast.show({ type: 'success', text1: 'Video uploaded' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to upload video' });
      setPrev(null);
    } finally {
      setUploadingFlag(false);
    }
  };

  // ─── Data bundles ────────────────────────────────────────────────
  const addBundle = async () => {
    if (!newBundle.gb_amount || !newBundle.price) {
      Toast.show({ type: 'error', text1: 'Enter both GB amount and price' });
      return;
    }
    setSavingBundle(true);
    try {
      await api.post('/data-bundles', newBundle);
      Toast.show({ type: 'success', text1: 'Bundle added' });
      setNewBundle({ network: newBundle.network, gb_amount: '', price: '' });
      loadBundles();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to add bundle' });
    } finally {
      setSavingBundle(false);
    }
  };

  const toggleBundleActive = async (bundle: any) => {
    try {
      await api.patch(`/data-bundles/${bundle.id}`, { active: !bundle.active });
      loadBundles();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to update bundle' });
    }
  };

  const deleteBundle = async (id: number) => {
    try {
      await api.delete(`/data-bundles/${id}`);
      Toast.show({ type: 'success', text1: 'Bundle removed' });
      loadBundles();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to remove bundle' });
    }
  };

  // ─── Service helpers ─────────────────────────────────────────────
  const captureServiceLocation = async () => {
    setLocatingService(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission needed' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setServiceLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
setLocationSource('gps');
      Toast.show({ type: 'success', text1: 'Location captured' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not get your location' });
    } finally {
      setLocatingService(false);
    }
  };

  const toggleWorkingDay = (day: string) =>
    setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d)));

  const setDayTime = (day: string, field: 'open' | 'close', value: string) =>
    setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)));

  const handleDeliveryChange = (field: keyof typeof deliveryPrices, value: string) =>
    setDeliveryPrices((prev) => ({ ...prev, [field]: value }));

  // ─── Submits ─────────────────────────────────────────────────────
  const submitListing = async () => {
    setLoading(true);
    try {
      const category = categories.find((c) => String(c.id) === String(form.category_id));
      await api.post('/products', {
        title: form.title,
        description: form.description,
        price: form.price,
        condition: form.condition,
        stock: form.stock,
        category: category ? category.name : '',
        network: isMobileData ? form.network : null,
        subcategory: form.subcategory || null,
        images: imageUrls,
        video: videoUrl || '',
        delivery_fee_on_campus: clampFee(deliveryPrices.delivery_fee_on_campus),
        delivery_fee_near_campus: clampFee(deliveryPrices.delivery_fee_near_campus),
        delivery_fee_far_campus: clampFee(deliveryPrices.delivery_fee_far_campus),
      });
      Toast.show({ type: 'success', text1: 'Listing created!' });
      router.replace('/dashboard');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to create listing' });
    } finally {
      setLoading(false);
      setShowDeliveryWarning(false);
    }
  };

  const onSubmitProduct = () => {
    if (!form.title.trim()) return Toast.show({ type: 'error', text1: 'Enter a title' });
    if (!form.price) return Toast.show({ type: 'error', text1: 'Enter a price' });
    if (imageUrls.length === 0) return Toast.show({ type: 'error', text1: 'Add at least one photo of the item' });
    if (isMobileData && !form.network) return Toast.show({ type: 'error', text1: 'Please select a network' });
    if (subOptions.length > 0 && !form.subcategory) return Toast.show({ type: 'error', text1: 'Please select a subcategory' });
    if (Object.values(deliveryPrices).some((v) => Number(v) > 0)) {
      setShowDeliveryWarning(true);
      return;
    }
    submitListing();
  };

  const submitService = async () => {
    if (!serviceForm.title.trim()) return Toast.show({ type: 'error', text1: 'Enter a service title' });
    if (!serviceForm.price || parseFloat(serviceForm.price) <= 0)
      return Toast.show({ type: 'error', text1: 'Enter a valid starting price' });
    if (serviceForm.priceMax && parseFloat(serviceForm.priceMax) < parseFloat(serviceForm.price))
      return Toast.show({ type: 'error', text1: "The upper price can't be less than the starting price" });
    if (serviceImageUrls.length === 0) return Toast.show({ type: 'error', text1: 'Add at least one photo' });
    if (!is247 && workingDays.every((d) => !d.enabled))
      return Toast.show({ type: 'error', text1: 'Select working days or 24/7' });
    if (!serviceLocation) return Toast.show({ type: 'error', text1: 'Set your service location' });

    const schedule = {
      ...(is247
        ? { is_24_7: true }
        : {
            is_24_7: false,
            days: workingDays.filter((d) => d.enabled).map(({ day, open, close }) => ({ day, open, close })),
          }),
      lat: serviceLocation.lat,
      lng: serviceLocation.lng,
      duration_minutes: serviceDuration,
    };

    setServiceLoading(true);
    try {
      await api.post('/products', {
        title: serviceForm.title,
        description: serviceForm.description || 'No description provided.',
        price: serviceForm.price,
        price_max: serviceForm.priceMax || null,
        condition: 'new',
        stock: 999,
        category: 'Services',
        network: null,
        images: serviceImageUrls,
        video: serviceVideoUrl || '',
        delivery_fee_on_campus: 0,
        delivery_fee_near_campus: 0,
        delivery_fee_far_campus: 0,
        service_duration: JSON.stringify(schedule),
      });
      Toast.show({ type: 'success', text1: 'Service created!' });
      router.replace('/dashboard');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to create service' });
    } finally {
      setServiceLoading(false);
    }
  };

const goBack = () => {
  if (from === 'dashboard' && router.canGoBack()) return router.back();
  return router.replace('/');
};

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Hero video (top 38%) */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight, overflow: 'hidden', backgroundColor: '#0f172a' }}>
        <VideoView
          player={heroPlayer}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          nativeControls={false}
        />
        <LinearGradient
          colors={['rgba(15,23,42,0.5)', 'transparent', colors.background]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: heroHeight * 0.62, paddingHorizontal: 16, paddingBottom: insets.bottom + 64 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
scrollEventThrottle={16}
onScroll={(e) => {
  const y = e.nativeEvent.contentOffset.y;
  scrollY.setValue(y);
  setBackVisible(y < 40);
}}
      >
        {/* Card */}
        <View
          style={{
            backgroundColor: colors.card, borderRadius: 24, padding: 22,
            borderWidth: 1, borderColor: colors.border,
            shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>New Listing</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>Add the details buyers will see.</Text>

          {/* Data seller section */}
          {isDataSeller && (
            <View style={{ marginTop: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Wifi size={16} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>Mobile Data Bundles</Text>
                  <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                    Manage the GB packages buyers can purchase per network.
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <View style={{ flex: 1.2 }}>
                  <MiniLabel colors={colors} label="Network" />
                  <SelectField
                    colors={colors}
                    compact
                    value={newBundle.network}
                    options={NETWORKS.map((n) => ({ label: n, value: n }))}
                    onChange={(v) => setNewBundle({ ...newBundle, network: v })}
                  />
                </View>
                <View style={{ flex: 0.8 }}>
                  <MiniLabel colors={colors} label="GB" />
                  <TextInput
                    value={newBundle.gb_amount}
                    onChangeText={(v) => setNewBundle({ ...newBundle, gb_amount: v })}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.textFaint}
                    style={[inputStyle(colors), { paddingVertical: 9, marginBottom: 0, fontSize: 13 }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <MiniLabel colors={colors} label="Price (GHS)" />
                  <TextInput
                    value={newBundle.price}
                    onChangeText={(v) => setNewBundle({ ...newBundle, price: v })}
                    keyboardType="decimal-pad"
                    placeholder="5.00"
                    placeholderTextColor={colors.textFaint}
                    style={[inputStyle(colors), { paddingVertical: 9, marginBottom: 0, fontSize: 13 }]}
                  />
                </View>
              </View>

              <Pressable
                onPress={addBundle}
                disabled={savingBundle}
                style={{
                  marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: colors.brand, paddingVertical: 10, borderRadius: 10, opacity: savingBundle ? 0.6 : 1,
                }}
              >
                <Plus size={15} color={colors.textOnGold} />
                <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 13 }}>
                  {savingBundle ? 'Adding…' : 'Add bundle'}
                </Text>
              </Pressable>

              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderMuted, gap: 8 }}>
                {bundlesLoading ? (
                  <View style={{ height: 40, borderRadius: 10, backgroundColor: colors.chipBg }} />
                ) : bundles.length === 0 ? (
                  <Text style={{ fontSize: 12, color: colors.textFaint, textAlign: 'center', paddingVertical: 8 }}>
                    No bundles yet. Add one above.
                  </Text>
                ) : (
                  bundles.map((b) => (
                    <View
                      key={b.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                        borderWidth: 1, borderColor: colors.border, opacity: b.active ? 1 : 0.5,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>
                        <Text style={{ fontWeight: '700' }}>{b.network}</Text> · {parseFloat(b.gb_amount)}GB · GHS {parseFloat(b.price).toFixed(2)}
                      </Text>
                      <Pressable onPress={() => toggleBundleActive(b)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>
                          {b.active ? 'Deactivate' : 'Activate'}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => deleteBundle(b.id)} style={{ padding: 4 }}>
                        <Trash2 size={14} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* Tab toggle */}
          <View
            style={{
              flexDirection: 'row', gap: 4, marginTop: 20, marginBottom: 4, alignSelf: 'center',
              backgroundColor: colors.chipBg, padding: 4, borderRadius: 12,
            }}
          >
            {([
              { key: 'product', label: 'Product listing', Icon: Package },
              { key: 'service', label: 'Service listing', Icon: Briefcase },
            ] as const).map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setActiveTab(key)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
                    backgroundColor: active ? colors.card : 'transparent',
                  }}
                >
                  <Icon size={13} color={active ? colors.brand : colors.textMuted} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? colors.brand : colors.textMuted }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* PRODUCT */}
          {activeTab === 'product' && (
            <View style={{ marginTop: 12 }}>
              <FieldLabel colors={colors} label="Title" />
              <TextInput
                value={form.title}
                onChangeText={(v) => setForm({ ...form, title: v })}
                placeholder="e.g. Casio scientific calculator"
                placeholderTextColor={colors.textFaint}
                style={inputStyle(colors)}
              />

              <FieldLabel colors={colors} label="Description" />
              <TextInput
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                multiline
                placeholder="Condition, why you're selling, anything a buyer should know"
                placeholderTextColor={colors.textFaint}
                style={[inputStyle(colors), { minHeight: 84, textAlignVertical: 'top' }]}
              />

              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <MediaGrid
                    colors={colors}
                    label="Photos"
                    previews={previews}
                    uploading={uploading}
                    maxReached={imageUrls.length >= MAX_IMAGES}
                    onAdd={() => pickImages(imageUrls, setImageUrls, setPreviews, setUploading)}
                    onRemove={(i) => {
                      setImageUrls((p) => p.filter((_, idx) => idx !== i));
                      setPreviews((p) => p.filter((_, idx) => idx !== i));
                    }}
                  />
                </View>
                <VideoTile
                  colors={colors}
                  label="Video"
                  preview={videoPreview}
                  uploading={uploading}
                  onAdd={() => pickVideo(setVideoUrl, setVideoPreview, setUploading)}
                  onRemove={() => { setVideoUrl(null); setVideoPreview(null); }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel colors={colors} label="Price (GHS)" />
                  <TextInput
                    value={form.price}
                    onChangeText={(v) => setForm({ ...form, price: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textFaint}
                    style={inputStyle(colors)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel colors={colors} label="Stock" />
                  <TextInput
                    value={form.stock}
                    onChangeText={(v) => setForm({ ...form, stock: v })}
                    keyboardType="number-pad"
                    style={inputStyle(colors)}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel colors={colors} label="Category" />
                  <SelectField
                    colors={colors}
                    placeholder="Select"
                    value={form.category_id}
                    options={categories.map((c) => ({ label: c.name, value: String(c.id) }))}
                    onChange={(v) => setForm({ ...form, category_id: v, network: '', subcategory: '' })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel colors={colors} label="Condition" />
                  <SelectField
                    colors={colors}
                    value={form.condition}
                    options={CONDITION_OPTIONS}
                    onChange={(v) => setForm({ ...form, condition: v })}
                  />
                </View>
              </View>

              {subOptions.length > 0 && (
                <>
                  <FieldLabel colors={colors} label="Subcategory" />
                  <SelectField
                    colors={colors}
                    placeholder="Select subcategory"
                    value={form.subcategory}
                    options={subOptions}
                    onChange={(v) => setForm({ ...form, subcategory: v })}
                  />
                </>
              )}

              {isMobileData && (
                <>
                  <FieldLabel colors={colors} label="Network" />
                  <SelectField
                    colors={colors}
                    placeholder="Select network"
                    value={form.network}
                    options={NETWORKS.map((n) => ({ label: n, value: n }))}
                    onChange={(v) => setForm({ ...form, network: v })}
                  />
                </>
              )}

              {/* Delivery */}
              <Divider colors={colors} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Truck size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Delivery pricing</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 12 }}>
                Optional. Leave at 0 for free delivery. Max GHS {MAX_DELIVERY_FEE} per tier.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([
                  ['delivery_fee_on_campus', 'On campus'],
                  ['delivery_fee_near_campus', 'Just outside'],
                  ['delivery_fee_far_campus', 'Far'],
                ] as const).map(([key, label]) => (
                  <View key={key} style={{ flex: 1 }}>
                    <MiniLabel colors={colors} label={label} />
                    <SelectField
                      colors={colors}
                      compact
                      value={deliveryPrices[key]}
                      options={DELIVERY_FEE_OPTIONS}
                      onChange={(v) => handleDeliveryChange(key, v)}
                    />
                  </View>
                ))}
              </View>

              <SubmitButton
                colors={colors}
                onPress={onSubmitProduct}
                disabled={loading || uploading}
                label={loading ? 'Publishing…' : 'Publish listing'}
              />
            </View>
          )}

          {/* SERVICE */}
          {activeTab === 'service' && (
            <View style={{ marginTop: 12 }}>
              <FieldLabel colors={colors} label="Service title" />
              <TextInput
                value={serviceForm.title}
                onChangeText={(v) => setServiceForm({ ...serviceForm, title: v })}
                placeholder="e.g. Professional makeup, Barbering, Tutoring"
                placeholderTextColor={colors.textFaint}
                style={inputStyle(colors)}
              />

              <FieldLabel colors={colors} label="Description" />
              <TextInput
                value={serviceForm.description}
                onChangeText={(v) => setServiceForm({ ...serviceForm, description: v })}
                multiline
                placeholder={'If your service has different options\n\n(e.g. Box braids – GHS 80, Cornrows – GHS 50), list them so buyers know what to expect.'}
                placeholderTextColor={colors.textFaint}
                style={[inputStyle(colors), { minHeight: 110, textAlignVertical: 'top' }]}
              />

               <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <MediaGrid
                    colors={colors}
                    label="Photos"
                    previews={servicePreviews}
                    uploading={serviceUploading}
                    maxReached={serviceImageUrls.length >= MAX_IMAGES}
                    onAdd={() => pickImages(serviceImageUrls, setServiceImageUrls, setServicePreviews, setServiceUploading)}
                    onRemove={(i) => {
                      setServiceImageUrls((p) => p.filter((_, idx) => idx !== i));
                      setServicePreviews((p) => p.filter((_, idx) => idx !== i));
                    }}
                  />
                </View>
                <VideoTile
                  colors={colors}
                  label="Video"
                  preview={serviceVideoPreview}
                  uploading={serviceUploading}
                  onAdd={() => pickVideo(setServiceVideoUrl, setServiceVideoPreview, setServiceUploading)}
                  onRemove={() => { setServiceVideoUrl(null); setServiceVideoPreview(null); }}
                />
              </View>

              <FieldLabel colors={colors} label="Price range (GHS)" />
              <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 6 }}>
                What your service typically costs, from cheapest to priciest option.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TextInput
                  value={serviceForm.price}
                  onChangeText={(v) => setServiceForm({ ...serviceForm, price: v })}
                  keyboardType="decimal-pad"
                  placeholder="From e.g. 30"
                  placeholderTextColor={colors.textFaint}
                  style={[inputStyle(colors), { flex: 1 }]}
                />
                <TextInput
                  value={serviceForm.priceMax}
                  onChangeText={(v) => setServiceForm({ ...serviceForm, priceMax: v })}
                  keyboardType="decimal-pad"
                  placeholder="To (optional)"
                  placeholderTextColor={colors.textFaint}
                  style={[inputStyle(colors), { flex: 1 }]}
                />
              </View>

              {/* Duration */}
              <Divider colors={colors} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Clock size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Time per booking</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 8 }}>
                How long one booking takes you. We use this to stop buyers from booking a time you're still busy with someone else.
              </Text>
              <SelectField
                colors={colors}
                value={String(serviceDuration)}
                options={DURATION_OPTIONS.map((d) => ({ label: d.label, value: String(d.value) }))}
                onChange={(v) => setServiceDuration(Number(v))}
              />

              {/* Working hours */}
              <Divider colors={colors} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Working hours</Text>
              </View>

              {!is247 && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[workingDays.slice(0, 4), workingDays.slice(4)].map((col, ci) => (
                    <View key={ci} style={{ flex: 1, gap: 8 }}>
                      {col.map((d) => (
                        <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Pressable
                            onPress={() => toggleWorkingDay(d.day)}
                            style={{
                              width: 46, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1,
                              borderColor: d.enabled ? colors.brand : colors.border,
                              backgroundColor: d.enabled ? colors.brand : colors.card,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: d.enabled ? colors.textOnGold : colors.textFaint }}>
                              {d.day}
                            </Text>
                          </Pressable>
                          {d.enabled ? (
                            <View style={{ flex: 1, gap: 4 }}>
                              <SelectField
                                colors={colors}
                                tiny
                                value={d.open}
                                options={TIME_OPTIONS}
                                onChange={(v) => setDayTime(d.day, 'open', v)}
                              />
                              <SelectField
                                colors={colors}
                                tiny
                                value={d.close}
                                options={TIME_OPTIONS}
                                onChange={(v) => setDayTime(d.day, 'close', v)}
                              />
                            </View>
                          ) : (
                            <Text style={{ flex: 1, fontSize: 12, color: colors.textFaint }}>Closed</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                onPress={() => setIs247(!is247)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}
              >
                <View
                  style={{
                    width: 18, height: 18, borderRadius: 4, borderWidth: 2,
                    borderColor: is247 ? colors.brand : colors.border,
                    backgroundColor: is247 ? colors.brand : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {is247 && <Check size={11} color={colors.textOnGold} />}
                </View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Working 24/7</Text>
              </Pressable>

              {/* Location */}
              <Divider colors={colors} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <MapPin size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Service location <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 8 }}>
                Buyers will see this pinned on a map so they know where to find you. Required.
              </Text>
<View style={{ flexDirection: 'row', gap: 8 }}>
  {([
    { key: 'map', label: 'Set on map', onPress: () => setShowLocationPicker(true), loading: false },
    { key: 'gps', label: locatingService ? 'Getting…' : 'Use current location', onPress: captureServiceLocation, loading: locatingService },
  ] as const).map((b) => {
    const active = locationSource === b.key;
    const c = active ? '#059669' : colors.textSecondary;
    return (
      <Pressable
        key={b.key}
        onPress={b.onPress}
        disabled={b.loading}
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingVertical: 12, borderRadius: 12, borderWidth: 1, opacity: b.loading ? 0.6 : 1,
          borderColor: active ? '#6ee7b7' : colors.border,
          backgroundColor: active ? 'rgba(16,185,129,0.1)' : 'transparent',
        }}
      >
        {b.loading ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : b.key === 'map' ? (
          <MapIcon size={15} color={c} />
        ) : (
          <MapPin size={15} color={c} />
        )}
        <Text style={{ fontSize: 13, fontWeight: '600', color: c }}>{b.label}</Text>
      </Pressable>
    );
  })}
</View>
              {serviceLocation && (
                <Text style={{ fontSize: 12, color: '#059669', marginTop: 8, fontWeight: '500' }}>
                  ✓ Location set — tap the button above to update it.
                </Text>
              )}

              <SubmitButton
                colors={colors}
                onPress={submitService}
                disabled={serviceLoading || serviceUploading}
                label={serviceLoading ? 'Creating service…' : 'Publish service'}
              />
            </View>
          )}
        </View>
      </ScrollView>

<AnimatedPressable
        onPress={goBack}
        disabled={!backVisible}
        hitSlop={10}
        style={{
          opacity: backOpacity,
          position: 'absolute', top: insets.top + 12, left: 16, zIndex: 20,
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
        }}
      >
        <ArrowLeft size={12} color="#fff" />
<Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Back</Text>
      </AnimatedPressable>

      {showLocationPicker && (
        <LocationPickerModal
          colors={colors}
          initial={serviceLocation}
          onCancel={() => setShowLocationPicker(false)}
          onConfirm={(pos: { lat: number; lng: number }) => {
            setServiceLocation(pos);
            setLocationSource('map');
            setShowLocationPicker(false);
            Toast.show({ type: 'success', text1: 'Location set' });
          }}
        />
      )}

      {/* Delivery warning modal (bottom sheet, like web on mobile) */}
      <Modal visible={showDeliveryWarning} transparent animationType="slide" onRequestClose={() => setShowDeliveryWarning(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' }}
          onPress={() => !loading && setShowDeliveryWarning(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: 20, paddingBottom: insets.bottom + 20,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <AlertTriangle size={18} color="#d97706" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Delivery fees can affect sales</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 20 }}>
              Even if your item is priced low, a delivery fee may make buyers hesitate to purchase.
              Do you want to post this listing with the delivery prices you've set, or go back and edit them?
            </Text>
            <Pressable
              onPress={submitListing}
              disabled={loading}
              style={{ marginTop: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', opacity: loading ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.textOnGold, fontWeight: '600', fontSize: 14 }}>
                {loading ? 'Publishing…' : 'Continue to post listing'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowDeliveryWarning(false)}
              disabled={loading}
              style={{ marginTop: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Edit delivery prices</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        <Toast />
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────
function inputStyle(colors: any) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 14,
    marginBottom: 12,
  } as const;
}

function FieldLabel({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4, marginTop: 4 }}>
      {label}
    </Text>
  );
}

function MiniLabel({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>{label}</Text>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={{ height: 1, backgroundColor: colors.borderMuted, marginTop: 8, marginBottom: 16 }} />;
}

function SubmitButton({ colors, onPress, disabled, label }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        marginTop: 20, backgroundColor: colors.brand, paddingVertical: 12, borderRadius: 12,
        alignItems: 'center', opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: colors.textOnGold, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

// Dropdown that mirrors the web <select>, opening a bottom-sheet list.
function SelectField({
  colors, value, options, onChange, placeholder, compact, tiny,
}: {
  colors: any;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
  tiny?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);
  const pad = tiny ? { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }
    : compact ? { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 }
    : { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4,
            borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: tiny ? 0 : 12,
          },
          pad,
        ]}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: tiny ? 11 : compact ? 13 : 14, color: selected ? colors.text : colors.textFaint }}
        >
          {selected?.label ?? placeholder ?? 'Select'}
        </Text>
        <ChevronDown size={tiny ? 11 : 14} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <View
            style={{
              backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              maxHeight: '60%', paddingBottom: insets.bottom + 8,
            }}
          >
            <FlatList
              data={options}
              keyExtractor={(o) => o.value || 'empty'}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => { onChange(item.value); setOpen(false); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 20, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: active ? colors.brand : colors.text, fontWeight: active ? '700' : '400' }}>
                      {item.label}
                    </Text>
                    {active && <Check size={16} color={colors.brand} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// 3-column square grid with "Cover" badge, like web.
function MediaGrid({ colors, label, previews, uploading, maxReached, onAdd, onRemove }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {previews.map((uri: string, i: number) => (
          <View
            key={uri + i}
            style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
          >
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            <Pressable
              onPress={() => onRemove(i)}
              style={{
                position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
                backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={12} color="#fff" />
            </Pressable>
            {i === 0 && (
              <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#0f172a' }}>Cover</Text>
              </View>
            )}
          </View>
        ))}
        {uploading && previews.length > 0 && (
          <View style={{ width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        )}
        {!maxReached && !uploading && (
          <Pressable
            onPress={onAdd}
            style={{
              width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
              borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <ImagePlus size={20} color={colors.textFaint} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textFaint }}>Add</Text>
          </Pressable>
        )}
      </View>
      <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 6 }}>Up to {MAX_IMAGES}. First is cover.</Text>
    </View>
  );
}

function VideoTile({ colors, label, preview, uploading, onAdd, onRemove }: any) {
  return (
    <View style={{ flex: 1, marginBottom: 12, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{label}</Text>
      <View style={{ width: 64, height: 64 }}>
        {preview ? (
          <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#000' }}>
            <VideoPreview uri={preview} />
            {uploading ? (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <Pressable
                onPress={onRemove}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
                  backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={12} color="#fff" />
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            onPress={onAdd}
            style={{
              flex: 1, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <VideoIcon size={20} color={colors.textFaint} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textFaint }}>Add</Text>
          </Pressable>
        )}
      </View>
      <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 6 }}>Optional. Max 20MB.</Text>
    </View>
  );
}

function VideoPreview({ uri }: { uri: string | number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} />;
}