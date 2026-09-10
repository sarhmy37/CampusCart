import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { CREATE_LISTING_VIDEO } from '../data/media';
import { clampFee, MAX_DELIVERY_FEE } from '../utils/distance';
import { ImagePlus, VideoIcon, X, ArrowLeft, Loader2, Truck, AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2, Wifi, Briefcase, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];
const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const generateTimeOptions = () => {
    const times = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const period = h < 12 ? 'AM' : 'PM';
            const displayHour = h % 12 === 0 ? 12 : h % 12;
            times.push({ value: `${hh}:${mm}`, label: `${displayHour}:${mm} ${period}` });
        }
    }
    return times;
};
const TIME_OPTIONS = generateTimeOptions();
const MAX_IMAGES = 6;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const CLOUD_NAME = 'b7fch4rp';
const UPLOAD_PRESET = 'campuscart_preset';

// Converts whole-number prices to charm pricing: 430 → 429.99.
// Leaves prices that already have cents (e.g. 430.50) untouched.
const toCharmPrice = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (Number.isInteger(num)) {
        return (num - 1 + 0.99).toFixed(2);
    }
    return num.toFixed(2);
};

const uploadToCloudinary = async (file, resourceType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
    const res = await fetch(url, { method: 'POST', body: formData });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Upload failed');
    }
    const data = await res.json();
    return data.secure_url;
};

export default function CreateListing() {
    const { user } = useAuth();
    const isDataSeller = !!user?.is_data_seller;
    const [listingFormCollapsed, setListingFormCollapsed] = useState(isDataSeller);
    const [serviceFormCollapsed, setServiceFormCollapsed] = useState(true); // Start collapsed
    const [bundles, setBundles] = useState([]);
    const [bundlesLoading, setBundlesLoading] = useState(false);
    const [newBundle, setNewBundle] = useState({ network: 'MTN', gb_amount: '', price: '' });
    const [savingBundle, setSavingBundle] = useState(false);
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        title: '', description: '', price: '', category_id: '', condition: 'used', stock: 1, network: '',
    });
    const [deliveryPrices, setDeliveryPrices] = useState({
        delivery_fee_on_campus: '',
        delivery_fee_near_campus: '',
        delivery_fee_far_campus: '',
    });
    const [imageUrls, setImageUrls] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [videoUrl, setVideoUrl] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showDeliveryWarning, setShowDeliveryWarning] = useState(false);

    // ─── SERVICE PROVISION STATE ──────────────────────────────────────────
    const [serviceForm, setServiceForm] = useState({
        title: '',
        description: '',
        price: '',
    });
    const [is247, setIs247] = useState(false);
    const [workingDays, setWorkingDays] = useState(
        WORKING_DAYS.map((day) => ({ day, enabled: false, open: '09:00', close: '17:00' }))
    );
    const [serviceImageUrls, setServiceImageUrls] = useState([]);
    const [servicePreviews, setServicePreviews] = useState([]);
    const [serviceVideoUrl, setServiceVideoUrl] = useState(null);
    const [serviceVideoPreview, setServiceVideoPreview] = useState(null);
    const [serviceUploading, setServiceUploading] = useState(false);
    const [serviceLoading, setServiceLoading] = useState(false);

    const selectedCategory = categories.find((c) => String(c.id) === String(form.category_id));
    const isMobileData = selectedCategory?.name === 'Mobile Data';

    const imageGalleryInputRef = useRef(null);
    const videoGalleryInputRef = useRef(null);
    const serviceImageInputRef = useRef(null);
    const serviceVideoInputRef = useRef(null);

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        return () => previews.forEach((p) => URL.revokeObjectURL(p));
    }, [previews]);

    useEffect(() => {
        return () => { if (videoPreview) URL.revokeObjectURL(videoPreview); };
    }, [videoPreview]);

    useEffect(() => {
        return () => servicePreviews.forEach((p) => URL.revokeObjectURL(p));
    }, [servicePreviews]);

    useEffect(() => {
        return () => { if (serviceVideoPreview) URL.revokeObjectURL(serviceVideoPreview); };
    }, [serviceVideoPreview]);

    const loadBundles = () => {
        if (!isDataSeller) return;
        setBundlesLoading(true);
        api.get('/data-bundles/mine')
            .then((res) => setBundles(res.data))
            .catch(() => setBundles([]))
            .finally(() => setBundlesLoading(false));
    };

    useEffect(() => {
        loadBundles();
    }, [isDataSeller]);

    // ─── REGULAR LISTING IMAGE HANDLERS ──────────────────────────────────
    const handleAddPhotoClick = () => imageGalleryInputRef.current?.click();

    const handleImageFilesSelected = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const totalImages = imageUrls.length + files.length;
        if (totalImages > MAX_IMAGES) {
            toast.error(`You can only upload up to ${MAX_IMAGES} images.`);
            e.target.value = '';
            return;
        }

        const newPreviews = files.map((f) => URL.createObjectURL(f));
        setPreviews((prev) => [...prev, ...newPreviews]);

        setUploading(true);
        try {
            const uploadedUrls = [];
            for (const file of files) {
                const url = await uploadToCloudinary(file, 'image');
                uploadedUrls.push(url);
            }
            setImageUrls((prev) => [...prev, ...uploadedUrls]);
            toast.success(`Uploaded ${uploadedUrls.length} image(s)`);
        } catch (err) {
            toast.error('Failed to upload images to Cloudinary');
            setPreviews((prev) => prev.slice(0, -newPreviews.length));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeImage = (index) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleAddVideoClick = () => videoGalleryInputRef.current?.click();

    const handleVideoSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            toast.error('Please select a video file');
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            toast.error('Video must be under 20MB');
            return;
        }

        setVideoPreview(URL.createObjectURL(file));
        setUploading(true);
        try {
            const url = await uploadToCloudinary(file, 'video');
            setVideoUrl(url);
            toast.success('Video uploaded successfully');
        } catch (err) {
            toast.error('Failed to upload video to Cloudinary');
            setVideoPreview(null);
        } finally {
            setUploading(false);
        }
    };

    const removeVideo = () => {
        setVideoUrl(null);
        setVideoPreview(null);
    };

    // ─── SERVICE IMAGE HANDLERS ──────────────────────────────────────────
    const handleServiceAddPhotoClick = () => serviceImageInputRef.current?.click();

    const handleServiceImageFilesSelected = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const totalImages = serviceImageUrls.length + files.length;
        if (totalImages > MAX_IMAGES) {
            toast.error(`You can only upload up to ${MAX_IMAGES} images.`);
            e.target.value = '';
            return;
        }

        const newPreviews = files.map((f) => URL.createObjectURL(f));
        setServicePreviews((prev) => [...prev, ...newPreviews]);

        setServiceUploading(true);
        try {
            const uploadedUrls = [];
            for (const file of files) {
                const url = await uploadToCloudinary(file, 'image');
                uploadedUrls.push(url);
            }
            setServiceImageUrls((prev) => [...prev, ...uploadedUrls]);
            toast.success(`Uploaded ${uploadedUrls.length} image(s)`);
        } catch (err) {
            toast.error('Failed to upload images to Cloudinary');
            setServicePreviews((prev) => prev.slice(0, -newPreviews.length));
        } finally {
            setServiceUploading(false);
            e.target.value = '';
        }
    };

    const removeServiceImage = (index) => {
        setServiceImageUrls((prev) => prev.filter((_, i) => i !== index));
        setServicePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleServiceAddVideoClick = () => serviceVideoInputRef.current?.click();

    const handleServiceVideoSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            toast.error('Please select a video file');
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            toast.error('Video must be under 20MB');
            return;
        }

        setServiceVideoPreview(URL.createObjectURL(file));
        setServiceUploading(true);
        try {
            const url = await uploadToCloudinary(file, 'video');
            setServiceVideoUrl(url);
            toast.success('Video uploaded successfully');
        } catch (err) {
            toast.error('Failed to upload video to Cloudinary');
            setServiceVideoPreview(null);
        } finally {
            setServiceUploading(false);
        }
    };

    const removeServiceVideo = () => {
        setServiceVideoUrl(null);
        setServiceVideoPreview(null);
    };

    // ─── WORKING HOURS HANDLERS ────────────────────────────────────────
    const toggleWorkingDay = (day) => {
        setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d)));
    };

    const updateWorkingDayTime = (day, field, value) => {
        setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
    };
    // ─── DATA BUNDLE HANDLERS ────────────────────────────────────────────
    const addBundle = async () => {
        if (!newBundle.gb_amount || !newBundle.price) {
            toast.error('Enter both GB amount and price');
            return;
        }
        setSavingBundle(true);
        try {
            await api.post('/data-bundles', newBundle);
            toast.success('Bundle added');
            setNewBundle({ network: newBundle.network, gb_amount: '', price: '' });
            loadBundles();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add bundle');
        } finally {
            setSavingBundle(false);
        }
    };

    const toggleBundleActive = async (bundle) => {
        try {
            await api.patch(`/data-bundles/${bundle.id}`, { active: !bundle.active });
            loadBundles();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update bundle');
        }
    };

    const deleteBundle = async (id) => {
        try {
            await api.delete(`/data-bundles/${id}`);
            toast.success('Bundle removed');
            loadBundles();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove bundle');
        }
    };

    // ─── DELIVERY PRICE HANDLING ──────────────────────────────────────────
    const handleDeliveryPriceChange = (field, value) => {
        if (value !== '' && Number(value) > MAX_DELIVERY_FEE) {
            toast.error(`Delivery fee can't exceed GHS ${MAX_DELIVERY_FEE}`);
            value = String(MAX_DELIVERY_FEE);
        }
        setDeliveryPrices((prev) => ({ ...prev, [field]: value }));
    };

    const hasAnyDeliveryFee = Object.values(deliveryPrices).some((v) => Number(v) > 0);

    // ─── SUBMIT REGULAR LISTING ───────────────────────────────────────────
    const submitListing = async () => {
        setLoading(true);
        try {
            const category = categories.find((c) => String(c.id) === String(form.category_id));

            const payload = {
                title: form.title,
                description: form.description,
                price: toCharmPrice(form.price),
                condition: form.condition,
                stock: form.stock,
                category: category ? category.name : '',
                network: isMobileData ? form.network : null,
                images: imageUrls,
                video: videoUrl || '',
                delivery_fee_on_campus: clampFee(deliveryPrices.delivery_fee_on_campus),
                delivery_fee_near_campus: clampFee(deliveryPrices.delivery_fee_near_campus),
                delivery_fee_far_campus: clampFee(deliveryPrices.delivery_fee_far_campus),
            };

            await api.post('/products', payload);
            toast.success('Listing created!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create listing');
        } finally {
            setLoading(false);
            setShowDeliveryWarning(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();

        if (imageUrls.length === 0) {
            toast.error('Add at least one photo of the item');
            return;
        }

        if (isMobileData && !form.network) {
            toast.error('Please select a network for this Mobile Data listing');
            return;
        }

        if (hasAnyDeliveryFee) {
            setShowDeliveryWarning(true);
            return;
        }

        submitListing();
    };

    // ─── SUBMIT SERVICE ───────────────────────────────────────────────────
    const submitService = async () => {
        if (!serviceForm.title.trim()) {
            toast.error('Enter a service title');
            return;
        }
        if (!serviceForm.price || parseFloat(serviceForm.price) <= 0) {
            toast.error('Enter a valid price');
            return;
        }
        if (serviceImageUrls.length === 0) {
            toast.error('Add at least one photo of your service');
            return;
        }
        if (!is247 && workingDays.every((d) => !d.enabled)) {
            toast.error('Select your working days, or choose Working 24/7');
            return;
        }

        const schedule = is247
            ? { is_24_7: true }
            : {
                is_24_7: false,
                days: workingDays
                    .filter((d) => d.enabled)
                    .map(({ day, open, close }) => ({ day, open, close })),
            };

        setServiceLoading(true);
        try {
            const payload = {
                title: serviceForm.title,
                description: serviceForm.description || 'No description provided.',
                price: toCharmPrice(serviceForm.price),
                condition: 'new',
                stock: 999, // Services are unlimited
                category: 'Services',
                network: null,
                images: serviceImageUrls,
                video: serviceVideoUrl || '',
                delivery_fee_on_campus: 0,
                delivery_fee_near_campus: 0,
                delivery_fee_far_campus: 0,
                // Extra metadata for services — stored as JSON in the existing duration column
                service_duration: JSON.stringify(schedule),
            };

            await api.post('/products', payload);
            toast.success('Service created! It will appear in the Services category.');
            // Reset service form
            setServiceForm({ title: '', description: '', price: '' });
            setIs247(false);
            setWorkingDays(WORKING_DAYS.map((day) => ({ day, enabled: false, open: '09:00', close: '17:00' })));
            setServiceImageUrls([]);
            setServicePreviews([]);
            setServiceVideoUrl(null);
            setServiceVideoPreview(null);
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create service');
        } finally {
            setServiceLoading(false);
        }
    };

    const onServiceSubmit = async (e) => {
        e.preventDefault();
        submitService();
    };

    // ─── RENDER ────────────────────────────────────────────────────────────

    // Reusable image upload UI for regular listings
    const renderImageUpload = (
        previewsArr,
        imageUrlsArr,
        uploadingFlag,
        maxImages,
        onAddClick,
        onRemove,
        label
    ) => (
        <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">{label}</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1 w-full">
                {previewsArr.map((src, i) => (
                    <div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-ink-600">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                            type="button"
                            onClick={() => onRemove(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center"
                        >
                            <X size={12} />
                        </button>
                        {i === 0 && (
                            <span className="absolute bottom-1 left-1 bg-white/90 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                Cover
                            </span>
                        )}
                    </div>
                ))}
                {uploadingFlag && previewsArr.length > 0 && imageUrlsArr.length < maxImages && (
                    <div className="aspect-square rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-800 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-brand-600 dark:text-gold-400 animate-spin" />
                    </div>
                )}
                {imageUrlsArr.length < maxImages && !uploadingFlag && (
                    <button
                        type="button"
                        onClick={onAddClick}
                        className="aspect-square rounded-xl border border-dashed border-slate-300 dark:border-ink-500 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-gold-300/40 hover:border-brand-400 dark:hover:border-gold-500 hover:text-brand-500 dark:hover:text-gold-400 cursor-pointer transition"
                    >
                        <ImagePlus size={20} />
                        <span className="text-[11px] font-semibold">Add</span>
                    </button>
                )}
            </div>
            <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1.5">Up to {maxImages}. First is cover.</p>
        </div>
    );

    // Reusable video upload UI
    const renderVideoUpload = (
        videoPreviewUrl,
        videoUrl,
        uploadingFlag,
        onAddClick,
        onRemove,
        label
    ) => (
        <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">{label}</label>
            <div className="w-[calc(33.333%-0.375rem)] mt-1">
                {uploadingFlag && !videoUrl && videoPreviewUrl ? (
                    <div className="aspect-square rounded-xl border border-slate-200 dark:border-ink-600 bg-black flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-brand-600 dark:text-gold-400 animate-spin" />
                    </div>
                ) : videoPreviewUrl ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-ink-600 bg-black">
                        <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
                        <button
                            type="button"
                            onClick={onRemove}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center z-10"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onAddClick}
                        className="aspect-square rounded-xl border border-dashed border-slate-300 dark:border-ink-500 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-gold-300/40 hover:border-brand-400 dark:hover:border-gold-500 hover:text-brand-500 dark:hover:text-gold-400 cursor-pointer transition"
                    >
                        <VideoIcon size={20} />
                        <span className="text-[11px] font-semibold">Add video</span>
                    </button>
                )}
            </div>
            <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1.5">Optional. Up to 20MB.</p>
        </div>
    );

    return (
        <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2 relative overflow-hidden">
            {/* MOBILE-ONLY background video */}
            <div className="absolute top-0 left-0 right-0 h-[38vh] lg:hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-900 dark:to-gold-900">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src={CREATE_LISTING_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-b from-ink-900/50 via-transparent to-slate-50 dark:from-ink-900/60 dark:via-transparent dark:to-ink-900" />
                <button
                    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
                    className="absolute top-6 left-4 z-20 inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            {/* LEFT — video panel, DESKTOP ONLY */}
            <div className="relative hidden lg:block overflow-hidden">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src={CREATE_LISTING_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-ink-900/80 via-ink-800/55 to-brand-600/35 dark:from-ink-900/90 dark:via-ink-900/75 dark:to-gold-900/50" />
                <button
                    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
                    className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                >
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/4 -bottom-24 w-64 h-64 bg-accent-500/20 dark:bg-gold-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 h-full flex flex-col justify-center px-12 xl:px-16">
                    <h1 className="mt-6 text-3xl xl:text-4xl font-extrabold text-white leading-tight max-w-md">
                        Turn what you're not using into what someone else needs.
                    </h1>
                    <p className="mt-4 text-white/80 text-sm max-w-sm">
                        List an item in minutes. Buyers on your campus will find it, message you, and pick it up or get it delivered.
                    </p>
                </div>
            </div>

            {/* RIGHT — form */}
            <div className="relative z-10 flex items-center justify-center px-4 pt-[24vh] pb-16 lg:pt-16 lg:pb-16 bg-transparent lg:bg-slate-50 dark:lg:bg-ink-900">
                <div className="w-full max-w-sm">
                    <div className="bg-white/90 dark:bg-ink-800/90 backdrop-blur-sm lg:bg-transparent lg:dark:bg-transparent border border-slate-200/70 dark:border-ink-600/70 lg:border-0 rounded-3xl lg:rounded-none p-6 sm:p-7 lg:p-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] lg:shadow-none">
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">New Listing</h1>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">Add the details buyers will see.</p>

                        {/* ─── DATA SELLER SECTION ────────────────────────────── */}
                        {isDataSeller && (
                            <div className="mt-5 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-4">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                                        <Wifi size={16} />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Mobile Data Bundles</h2>
                                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-0.5">
                                            Manage the GB packages buyers can purchase per network.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-3 gap-2 items-end">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-gold-300/60">Network</label>
                                        <select
                                            value={newBundle.network}
                                            onChange={(e) => setNewBundle({ ...newBundle, network: e.target.value })}
                                            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none"
                                        >
                                            {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-gold-300/60">GB</label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={newBundle.gb_amount}
                                            onChange={(e) => setNewBundle({ ...newBundle, gb_amount: e.target.value })}
                                            placeholder="1"
                                            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-gold-300/60">Price (GHS)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={newBundle.price}
                                            onChange={(e) => setNewBundle({ ...newBundle, price: e.target.value })}
                                            placeholder="5.00"
                                            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-sm focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addBundle}
                                    disabled={savingBundle}
                                    className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60"
                                >
                                    <Plus size={15} /> {savingBundle ? 'Adding…' : 'Add bundle'}
                                </button>

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-600 space-y-2">
                                    {bundlesLoading ? (
                                        <div className="h-10 rounded-lg bg-slate-100 dark:bg-ink-700 animate-pulse" />
                                    ) : bundles.length === 0 ? (
                                        <p className="text-xs text-slate-400 dark:text-gold-200/50 text-center py-3">No bundles yet. Add one above.</p>
                                    ) : (
                                        bundles.map((b) => (
                                            <div
                                                key={b.id}
                                                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                                                    b.active
                                                        ? 'border-slate-200 dark:border-ink-600'
                                                        : 'border-slate-200 dark:border-ink-600 opacity-50'
                                                }`}
                                            >
                                                <div className="text-sm text-slate-700 dark:text-gold-100">
                                                    <span className="font-semibold">{b.network}</span> · {parseFloat(b.gb_amount)}GB · GHS {parseFloat(b.price).toFixed(2)}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBundleActive(b)}
                                                        className="text-[11px] font-semibold text-brand-600 dark:text-gold-400 px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-gold-900/30"
                                                    >
                                                        {b.active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteBundle(b.id)}
                                                        className="text-slate-300 dark:text-gold-300/40 hover:text-red-500 p-1"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─── REGULAR LISTING TOGGLE ────────────────────────── */}
                        {isDataSeller && (
                            <button
                                type="button"
                                onClick={() => setListingFormCollapsed((c) => !c)}
                                className="w-full flex items-center justify-between mt-5 px-1 py-2 text-sm font-semibold text-slate-500 dark:text-gold-300/60"
                            >
                                <span>Regular listing details (optional)</span>
                                {listingFormCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>
                        )}

                        {/* ─── REGULAR LISTING FORM ──────────────────────────── */}
                        <form onSubmit={onSubmit} className={`space-y-4 ${isDataSeller ? (listingFormCollapsed ? 'hidden' : 'mt-3') : 'mt-5'}`}>
                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Title</label>
                                <input
                                    required
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Casio scientific calculator"
                                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Description</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Condition, why you're selling, anything a buyer should know"
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {renderImageUpload(
                                    previews,
                                    imageUrls,
                                    uploading,
                                    MAX_IMAGES,
                                    handleAddPhotoClick,
                                    removeImage,
                                    'Photos'
                                )}
                                {renderVideoUpload(
                                    videoPreview,
                                    videoUrl,
                                    uploading,
                                    handleAddVideoClick,
                                    removeVideo,
                                    'Video'
                                )}
                            </div>

                            <input
                                ref={imageGalleryInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageFilesSelected}
                                className="hidden"
                            />
                            <input
                                ref={videoGalleryInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleVideoSelected}
                                className="hidden"
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Price (GHS)</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Stock</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.stock}
                                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Category</label>
                                    <select
                                        value={form.category_id}
                                        onChange={(e) => setForm({ ...form, category_id: e.target.value, network: '' })}
                                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition appearance-none"
                                    >
                                        <option value="">Select</option>
                                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Condition</label>
                                    <select
                                        value={form.condition}
                                        onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition appearance-none"
                                    >
                                        <option value="new">New</option>
                                        <option value="used">Used</option>
                                    </select>
                                </div>
                            </div>

                            {isMobileData && (
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Network</label>
                                    <select
                                        required
                                        value={form.network}
                                        onChange={(e) => setForm({ ...form, network: e.target.value })}
                                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition appearance-none"
                                    >
                                        <option value="">Select network</option>
                                        {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* DELIVERY PRICES */}
                            <div className="border-t border-slate-100 dark:border-ink-600 pt-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Truck size={15} className="text-slate-500 dark:text-gold-300/60" />
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Delivery pricing</label>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-gold-200/40 mb-3">
                                    Optional. Leave at 0 for free delivery. Max GHS {MAX_DELIVERY_FEE} per tier.
                                </p>

                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-gold-200/60">On campus</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={MAX_DELIVERY_FEE}
                                            step="0.5"
                                            value={deliveryPrices.delivery_fee_on_campus}
                                            onChange={(e) => handleDeliveryPriceChange('delivery_fee_on_campus', e.target.value)}
                                            placeholder="0"
                                            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-gold-200/60">Just outside</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={MAX_DELIVERY_FEE}
                                            step="0.5"
                                            value={deliveryPrices.delivery_fee_near_campus}
                                            onChange={(e) => handleDeliveryPriceChange('delivery_fee_near_campus', e.target.value)}
                                            placeholder="0"
                                            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-gold-200/60">Far</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={MAX_DELIVERY_FEE}
                                            step="0.5"
                                            value={deliveryPrices.delivery_fee_far_campus}
                                            onChange={(e) => handleDeliveryPriceChange('delivery_fee_far_campus', e.target.value)}
                                            placeholder="0"
                                            className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || uploading}
                                className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                            >
                                {loading ? 'Publishing…' : 'Publish listing'}
                            </button>
                        </form>

                        {/* ─── SERVICE PROVISION SECTION ────────────────────── */}
                        <div className="mt-6 border-t border-slate-200 dark:border-ink-600 pt-4">
                            <button
                                type="button"
                                onClick={() => setServiceFormCollapsed((c) => !c)}
                                className="w-full flex items-center justify-between px-1 py-2 text-sm font-semibold text-slate-500 dark:text-gold-300/60"
                            >
                                <span className="flex items-center gap-2">
                                    <Briefcase size={16} />
                                    Service provision (for makeup, barbers, tutors, etc.)
                                </span>
                                {serviceFormCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>

                            {!serviceFormCollapsed && (
                                <form onSubmit={onServiceSubmit} className="mt-3 space-y-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Service title</label>
                                        <input
                                            required
                                            value={serviceForm.title}
                                            onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                                            placeholder="e.g. Professional makeup, Barbering, Tutoring"
                                            className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Description</label>
                                        <textarea
                                            rows={3}
                                            value={serviceForm.description}
                                            onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                                            placeholder="What you offer, your experience, availability"
                                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {renderImageUpload(
                                            servicePreviews,
                                            serviceImageUrls,
                                            serviceUploading,
                                            MAX_IMAGES,
                                            handleServiceAddPhotoClick,
                                            removeServiceImage,
                                            'Photos'
                                        )}
                                        {renderVideoUpload(
                                            serviceVideoPreview,
                                            serviceVideoUrl,
                                            serviceUploading,
                                            handleServiceAddVideoClick,
                                            removeServiceVideo,
                                            'Video'
                                        )}
                                    </div>

                                    <input
                                        ref={serviceImageInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleServiceImageFilesSelected}
                                        className="hidden"
                                    />
                                    <input
                                        ref={serviceVideoInputRef}
                                        type="file"
                                        accept="video/*"
                                        onChange={handleServiceVideoSelected}
                                        className="hidden"
                                    />

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Price (GHS)</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={serviceForm.price}
                                            onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                                            placeholder="e.g. 50"
                                            className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm bg-white transition"
                                        />
                                    </div>

                                    {/* WORKING HOURS */}
                                    <div className="border-t border-slate-100 dark:border-ink-600 pt-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock size={15} className="text-slate-500 dark:text-gold-300/60" />
                                            <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Working hours</label>
                                        </div>

                                        {!is247 && (
                                            <div className="space-y-2">
                                                {workingDays.map((d) => (
                                                    <div key={d.day} className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleWorkingDay(d.day)}
                                                            className={`w-14 shrink-0 text-xs font-semibold py-2 rounded-lg border transition ${
                                                                d.enabled
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                                                    : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600 text-slate-400 dark:text-gold-300/50'
                                                            }`}
                                                        >
                                                            {d.day}
                                                        </button>

                                                        {d.enabled ? (
                                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                <select
                                                                    value={d.open}
                                                                    onChange={(e) => updateWorkingDayTime(d.day, 'open', e.target.value)}
                                                                    className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 text-xs focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none appearance-none"
                                                                >
                                                                    {TIME_OPTIONS.map((t) => (
                                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                                    ))}
                                                                </select>
                                                                <span className="text-xs text-slate-400 dark:text-gold-200/40 shrink-0">to</span>
                                                                <select
                                                                    value={d.close}
                                                                    onChange={(e) => updateWorkingDayTime(d.day, 'close', e.target.value)}
                                                                    className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 text-xs focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none appearance-none"
                                                                >
                                                                    {TIME_OPTIONS.map((t) => (
                                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <span className="flex-1 text-xs text-slate-300 dark:text-gold-300/30">Closed</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={is247}
                                                onChange={(e) => setIs247(e.target.checked)}
                                                className="w-4 h-4 rounded accent-emerald-600"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-gold-100">
                                                Working 24/7
                                            </span>
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={serviceLoading || serviceUploading}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                                    >
                                        {serviceLoading ? 'Creating service…' : 'Publish service'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* DELIVERY PRICE CONFIRMATION MODAL */}
            {showDeliveryWarning && (
                <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => !loading && setShowDeliveryWarning(false)}
                    />
                    <div className="relative w-full sm:max-w-sm bg-white dark:bg-ink-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-gold-50 text-base">
                            Delivery fees can affect sales
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-2">
                            Even if your item is priced low, a delivery fee may make buyers hesitate to purchase.
                            Do you want to post this listing with the delivery prices you've set, or go back and edit them?
                        </p>

                        <div className="flex flex-col gap-2 mt-5">
                            <button
                                onClick={submitListing}
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-60"
                            >
                                {loading ? 'Publishing…' : 'Continue to post listing'}
                            </button>
                            <button
                                onClick={() => setShowDeliveryWarning(false)}
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-700 dark:text-gold-200 font-semibold text-sm transition hover:bg-slate-50 dark:hover:bg-ink-700"
                            >
                                Edit delivery prices
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}