import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { CREATE_LISTING_VIDEO } from '../data/media';
import { clampFee, MAX_DELIVERY_FEE } from '../utils/distance';
import { ImagePlus, VideoIcon, X, ArrowLeft, Loader2, Truck, AlertTriangle } from 'lucide-react';

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
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        title: '', description: '', price: '', category_id: '', condition: 'used', stock: 1,
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

    const imageGalleryInputRef = useRef(null);
    const videoGalleryInputRef = useRef(null);

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        return () => previews.forEach((p) => URL.revokeObjectURL(p));
    }, [previews]);

    useEffect(() => {
        return () => { if (videoPreview) URL.revokeObjectURL(videoPreview); };
    }, [videoPreview]);

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

    // ---- DELIVERY PRICE HANDLING ----
    const handleDeliveryPriceChange = (field, value) => {
        // Allow free typing but clamp once it exceeds the max
        if (value !== '' && Number(value) > MAX_DELIVERY_FEE) {
            toast.error(`Delivery fee can't exceed GHS ${MAX_DELIVERY_FEE}`);
            value = String(MAX_DELIVERY_FEE);
        }
        setDeliveryPrices((prev) => ({ ...prev, [field]: value }));
    };

    const hasAnyDeliveryFee = Object.values(deliveryPrices).some((v) => Number(v) > 0);

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

        // If the seller set any delivery fee, warn them it may affect buyer interest
        // before letting them confirm the post.
        if (hasAnyDeliveryFee) {
            setShowDeliveryWarning(true);
            return;
        }

        submitListing();
    };

    return (
        <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2 relative overflow-hidden">
            {/* MOBILE-ONLY background video, fills top 1/3 of screen.
                bg-gradient-to-br sits on the SECTION itself (not just an overlay div),
                so it shows immediately even before the video file has loaded — same
                pattern as CartHeader in Cart.jsx and the Dashboard header video. */}
            <div className="absolute top-0 left-0 right-0 h-[38vh] lg:hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-900 dark:to-gold-900">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src={CREATE_LISTING_VIDEO} type="video/mp4" />
                </video>
                {/* Fades the bottom of the video into the form's background color,
                    so there's no hard seam — the form overlaps the last bit of video. */}
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

            {/* RIGHT — form (mobile: sits below the 1/3-height video, in a card like Login) */}
            <div className="relative z-10 flex items-center justify-center px-4 pt-[24vh] pb-16 lg:pt-16 lg:pb-16 bg-transparent lg:bg-slate-50 dark:lg:bg-ink-900">                <div className="w-full max-w-sm">
                    <div className="bg-white/90 dark:bg-ink-800/90 backdrop-blur-sm lg:bg-transparent lg:dark:bg-transparent border border-slate-200/70 dark:border-ink-600/70 lg:border-0 rounded-3xl lg:rounded-none p-6 sm:p-7 lg:p-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] lg:shadow-none">
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">New Listing</h1>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">Add the details buyers will see.</p>

                        <form onSubmit={onSubmit} className="mt-5 space-y-4">
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
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Photos</label>
                                    <div className="grid grid-cols-3 gap-1.5 mt-1 w-full">
                                        {previews.map((src, i) => (
                                            <div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-ink-600">
                                                <img src={src} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(i)}
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
                                        {uploading && previews.length > 0 && imageUrls.length < MAX_IMAGES && (
                                            <div className="aspect-square rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-800 flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 text-brand-600 dark:text-gold-400 animate-spin" />
                                            </div>
                                        )}
                                        {imageUrls.length < MAX_IMAGES && !uploading && (
                                            <button
                                                type="button"
                                                onClick={handleAddPhotoClick}
                                                className="aspect-square rounded-xl border border-dashed border-slate-300 dark:border-ink-500 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-gold-300/40 hover:border-brand-400 dark:hover:border-gold-500 hover:text-brand-500 dark:hover:text-gold-400 cursor-pointer transition"
                                            >
                                                <ImagePlus size={20} />
                                                <span className="text-[11px] font-semibold">Add</span>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1.5">Up to {MAX_IMAGES}. First is cover.</p>

                                    <input
                                        ref={imageGalleryInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageFilesSelected}
                                        className="hidden"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Video</label>
                                    <div className="w-[calc(33.333%-0.375rem)] mt-1">
                                        {uploading && !videoUrl && videoPreview ? (
                                            <div className="aspect-square rounded-xl border border-slate-200 dark:border-ink-600 bg-black flex items-center justify-center">
                                                <Loader2 className="w-8 h-8 text-brand-600 dark:text-gold-400 animate-spin" />
                                            </div>
                                        ) : videoPreview ? (
                                            <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-ink-600 bg-black">
                                                <video src={videoPreview} controls className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={removeVideo}
                                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center z-10"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleAddVideoClick}
                                                className="aspect-square rounded-xl border border-dashed border-slate-300 dark:border-ink-500 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-gold-300/40 hover:border-brand-400 dark:hover:border-gold-500 hover:text-brand-500 dark:hover:text-gold-400 cursor-pointer transition"
                                            >
                                                <VideoIcon size={20} />
                                                <span className="text-[11px] font-semibold">Add video</span>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1.5">Optional. Up to 20MB.</p>

                                    <input
                                        ref={videoGalleryInputRef}
                                        type="file"
                                        accept="video/*"
                                        onChange={handleVideoSelected}
                                        className="hidden"
                                    />
                                </div>
                            </div>

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
                                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
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