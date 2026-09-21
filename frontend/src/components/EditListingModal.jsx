import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { X, ImagePlus, Loader2, VideoIcon, RefreshCw } from 'lucide-react';

const MAX_IMAGES = 6;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB

const CONDITIONS = ['new', 'good', 'fair'];

// Converts whole-number prices to charm pricing: 46 → 45.99.
// Leaves prices that already have cents (e.g. 46.50) untouched.
const toCharmPrice = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (Number.isInteger(num)) {
        return (num - 1 + 0.99).toFixed(2);
    }
    return num.toFixed(2);
};

export default function EditListingModal({ product, open, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        price: '',
        condition: 'good',
        stock: 1,
        category: '',
        delivery_fee_on_campus: '',
        delivery_fee_near_campus: '',
        delivery_fee_far_campus: '',
    });
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);

    // ─── IMAGES ───────────────────────────────────────────────────────────
    // previews/imageUrls stay in sync, same pattern as CreateListing.jsx.
    // Existing gallery images are both their own preview and their own
    // "already uploaded" URL; newly added photos get a blob preview until
    // the upload finishes, then the real Sanity URL replaces it here too.
    const [previews, setPreviews] = useState([]);
    const [imageUrls, setImageUrls] = useState([]);
    const [uploading, setUploading] = useState(false);
    const imageGalleryInputRef = useRef(null);

    // 'idle' or 'selecting-replace' — while selecting-replace, tapping any
    // existing photo picks it as the one to swap out.
    const [photoMode, setPhotoMode] = useState('idle');
    const replaceTargetIndexRef = useRef(null);
    const replacePhotoInputRef = useRef(null);

    // ─── VIDEO ────────────────────────────────────────────────────────────
    const [videoUrl, setVideoUrl] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [videoUploading, setVideoUploading] = useState(false);
    const videoInputRef = useRef(null);

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    // Load the listing's current gallery whenever a different product is opened.
    useEffect(() => {
        if (product?.id) {
            api.get(`/products/${product.id}`)
                .then((res) => {
                    const urls = (res.data.images || []).map((img) => img.image_url);
                    setImageUrls(urls);
                    setPreviews(urls);
                    setVideoUrl(res.data.video_url || null);
                    setVideoPreview(res.data.video_url || null);
                })
                .catch(() => {
                    // Fall back to what we already have (e.g. just the cover image)
                    // if the detail fetch fails, rather than leaving the gallery empty.
                    const fallback = product.primary_image ? [product.primary_image] : [];
                    setImageUrls(fallback);
                    setPreviews(fallback);
                    setVideoUrl(product.video_url || null);
                    setVideoPreview(product.video_url || null);
                });
        }
    }, [product?.id]);

    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/uploads', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        });
        return res.data.url;
    };

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
                uploadedUrls.push(await uploadFile(file));
            }
            setImageUrls((prev) => [...prev, ...uploadedUrls]);
            // Swap the blob previews for the real hosted URLs.
            setPreviews((prev) => [...prev.slice(0, prev.length - newPreviews.length), ...uploadedUrls]);
            toast.success(`Uploaded ${uploadedUrls.length} image(s)`);
        } catch (err) {
            toast.error('Failed to upload images');
            setPreviews((prev) => prev.slice(0, prev.length - newPreviews.length));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeImage = (index) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    // ─── REPLACE AN EXISTING PHOTO ───────────────────────────────────────
    const handleReplacePhotoClick = () => {
        if (imageUrls.length === 0) {
            toast.error('Add a photo first');
            return;
        }
        setPhotoMode('selecting-replace');
        toast('Tap the photo you want to replace', { icon: '👆' });
    };

    const handleThumbnailClick = (index) => {
        if (photoMode !== 'selecting-replace') return;
        replaceTargetIndexRef.current = index;
        replacePhotoInputRef.current?.click();
    };

    const handleReplacePhotoFileSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const index = replaceTargetIndexRef.current;
        setPhotoMode('idle');
        if (!file || index === null || index === undefined) return;

        const blobPreview = URL.createObjectURL(file);
        setPreviews((prev) => prev.map((p, i) => (i === index ? blobPreview : p)));

        setUploading(true);
        try {
            const url = await uploadFile(file);
            setImageUrls((prev) => prev.map((u, i) => (i === index ? url : u)));
            setPreviews((prev) => prev.map((p, i) => (i === index ? url : p)));
            toast.success('Photo replaced');
        } catch (err) {
            toast.error('Failed to replace photo');
            setPreviews((prev) => prev.map((p, i) => (i === index ? imageUrls[index] : p)));
        } finally {
            setUploading(false);
            replaceTargetIndexRef.current = null;
        }
    };

    // ─── VIDEO: ADD / REPLACE ─────────────────────────────────────────────
    const handleVideoButtonClick = () => videoInputRef.current?.click();

    const handleVideoFileSelected = async (e) => {
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

        const previousUrl = videoUrl;
        setVideoPreview(URL.createObjectURL(file));
        setVideoUploading(true);
        try {
            const url = await uploadFile(file);
            setVideoUrl(url);
            setVideoPreview(url);
            toast.success(previousUrl ? 'Video replaced' : 'Video uploaded');
        } catch (err) {
            toast.error('Failed to upload video');
            setVideoPreview(previousUrl);
        } finally {
            setVideoUploading(false);
        }
    };

    useEffect(() => {
        if (product) {
            setForm({
                title: product.title || '',
                description: product.description || '',
                price: product.price || '',
                condition: product.condition || 'good',
                stock: product.stock ?? 1,
                category: product.category || '',
                delivery_fee_on_campus: product.delivery_fee_on_campus ?? '',
                delivery_fee_near_campus: product.delivery_fee_near_campus ?? '',
                delivery_fee_far_campus: product.delivery_fee_far_campus ?? '',
            });
        }
    }, [product]);

    // The "old price" shown here is the item's CURRENT saved price — the
    // number that will become old_price once the seller saves a lower price.
    // This is purely a preview; the backend decides what actually gets saved.
    const currentSavedPrice = product ? parseFloat(product.price) : null;

    const calculateDiscount = () => {
        // Use the charmed price here too, so the preview matches what
        // actually gets saved (e.g. typing 46 previews against 45.99).
        const newPrice = parseFloat(toCharmPrice(form.price));
        if (!currentSavedPrice || !newPrice || currentSavedPrice <= newPrice || currentSavedPrice <= 0 || newPrice <= 0) {
            return null;
        }
        return Math.round(((currentSavedPrice - newPrice) / currentSavedPrice) * 100);
    };

    const discount = calculateDiscount();

    // Lock body scroll while open. Self-aware like ConfirmModal — only
    // locks/unlocks if nothing already has the body locked, so it plays
    // nicely if ever opened from within an already-locked parent.
    const didLockRef = useRef(false);

    useEffect(() => {
        if (open) {
            if (document.body.style.position !== 'fixed') {
                const scrollY = window.scrollY;
                document.body.style.position = 'fixed';
                document.body.style.top = `-${scrollY}px`;
                document.body.style.left = '0';
                document.body.style.right = '0';
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
                document.documentElement.style.overscrollBehavior = 'none';
                didLockRef.current = true;
            }
        } else if (didLockRef.current) {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
            didLockRef.current = false;
        }
        return () => {
            if (didLockRef.current) {
                const scrollY = document.body.style.top;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.documentElement.style.overscrollBehavior = '';
                if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
                didLockRef.current = false;
            }
        };
    }, [open]);

    if (!open || !product) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        if (imageUrls.length === 0) {
            toast.error('Add at least one photo');
            return;
        }
        setSaving(true);
        try {
            // old_price is never sent from the client — the backend works out
            // whether this counts as a discount by comparing to what's already
            // saved, and manages old_price entirely on its own.
            const payload = { ...form, price: toCharmPrice(form.price), images: imageUrls, video_url: videoUrl };
            await api.patch(`/products/${product.id}`, payload);
            toast.success('Listing updated');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update listing');
        } finally {
            setSaving(false);
        }
    };

        return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Edit listing</h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-gold-200/50 hover:text-slate-600 dark:hover:text-gold-100">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Title</label>
                        <input
                            required
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Description</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm resize-none"
                        />
                    </div>

                    {/* ─── PRICE SECTION ─── */}
                    <div className="bg-slate-50 dark:bg-ink-700/50 rounded-xl p-3 border border-slate-200/50 dark:border-ink-600/50">
                        <p className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 mb-2">Price</p>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Old Price (read-only) — shows the CURRENT saved price, since
                                that's what becomes "old" the moment a lower price is saved. */}
                            <div>
                                <label className="text-[10px] font-medium text-slate-400 dark:text-gold-200/50">Current Price (read-only)</label>
                                <div className="relative mt-0.5">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={currentSavedPrice ?? ''}
                                        readOnly
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-100 dark:bg-ink-700/50 text-slate-400 dark:text-gold-200/40 cursor-not-allowed text-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-gold-200/40">
                                        GHS
                                    </span>
                                </div>
                            </div>

                            {/* New Price (editable) */}
                            <div>
                                <label className="text-[10px] font-medium text-slate-400 dark:text-gold-200/50">New Price</label>
                                <div className="relative mt-0.5">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-gold-200/40">
                                        GHS
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-gold-200/40 mt-1.5">
                            The current price is what's saved right now. Lowering it below this will show as a sale to buyers.
                        </p>

                        {/* Discount Preview — only shown if the new price is actually lower.
                            A price increase never shows anything here, matching the backend. */}
                        {discount !== null && (
                            <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                    🎉 This will show as -{discount}% off
                                </p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400/70">
                                    Old price: GHS {currentSavedPrice.toFixed(2)} → New price: GHS {toCharmPrice(form.price)}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Photos</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-1 w-full">
                            {previews.map((src, i) => (
                                <div
                                    key={src + i}
                                    onClick={() => handleThumbnailClick(i)}
                                    className={`relative aspect-square rounded-xl overflow-hidden border transition ${
                                        photoMode === 'selecting-replace'
                                            ? 'border-brand-400 dark:border-gold-500 ring-2 ring-brand-200 dark:ring-gold-800 cursor-pointer'
                                            : 'border-slate-200 dark:border-ink-600'
                                    }`}
                                >
                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                    {photoMode === 'selecting-replace' && (
                                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                                            <RefreshCw size={14} className="text-white" />
                                        </div>
                                    )}
                                    {photoMode !== 'selecting-replace' && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-900/70 text-white flex items-center justify-center"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                    {i === 0 && (
                                        <span className="absolute bottom-0.5 left-0.5 bg-white/90 text-[8px] font-semibold px-1 py-0.5 rounded">
                                            Cover
                                        </span>
                                    )}
                                </div>
                            ))}
                            {uploading && (
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-800 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-brand-600 dark:text-gold-400 animate-spin" />
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-gold-200/40 mt-1">
                            Up to {MAX_IMAGES}. First is cover.
                            {photoMode === 'selecting-replace' && ' Tap a photo to replace it.'}
                        </p>
                        <div className="flex gap-1 mt-1.5">
                            <button
                                type="button"
                                onClick={handleReplacePhotoClick}
                                disabled={uploading || photoMode === 'selecting-replace'}
                                className="flex-1 py-1.5 rounded-lg bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-[10px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1"
                            >
                                <RefreshCw size={10} /> Replace
                            </button>
                            <button
                                type="button"
                                onClick={handleAddPhotoClick}
                                disabled={uploading || imageUrls.length >= MAX_IMAGES}
                                className="flex-1 py-1.5 rounded-lg bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-[10px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1"
                            >
                                <ImagePlus size={10} /> Add
                            </button>
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
                            ref={replacePhotoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReplacePhotoFileSelected}
                            className="hidden"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">Video</label>
                        <div className="w-[calc(33.333%-0.375rem)] mt-1">
                            {videoUploading ? (
                                <div className="aspect-square rounded-xl border border-slate-200 dark:border-ink-600 bg-black flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-brand-600 dark:text-gold-400 animate-spin" />
                                </div>
                            ) : videoPreview ? (
                                <video src={videoPreview} className="w-full aspect-square rounded-xl object-cover bg-black" muted playsInline />
                            ) : (
                                <div className="aspect-square rounded-xl border border-dashed border-slate-300 dark:border-ink-500 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-gold-300/40">
                                    <VideoIcon size={16} />
                                    <span className="text-[8px] font-semibold">No video</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1 mt-1.5">
                            <button
                                type="button"
                                onClick={handleVideoButtonClick}
                                disabled={videoUploading || !videoUrl}
                                className="flex-1 py-1.5 rounded-lg bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-[10px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1"
                            >
                                <RefreshCw size={10} /> Replace
                            </button>
                            <button
                                type="button"
                                onClick={handleVideoButtonClick}
                                disabled={videoUploading || !!videoUrl}
                                className="flex-1 py-1.5 rounded-lg bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-[10px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1"
                            >
                                <VideoIcon size={10} /> Add
                            </button>
                        </div>
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleVideoFileSelected}
                            className="hidden"
                        />
                    </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-ink-700/50 rounded-xl p-3 border border-slate-200/50 dark:border-ink-600/50">
                        <p className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 mb-2">Delivery fees</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] font-medium text-slate-400 dark:text-gold-200/50">On campus</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.delivery_fee_on_campus}
                                    onChange={(e) => setForm({ ...form, delivery_fee_on_campus: e.target.value })}
                                    className="w-full mt-0.5 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-slate-400 dark:text-gold-200/50">Near campus</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.delivery_fee_near_campus}
                                    onChange={(e) => setForm({ ...form, delivery_fee_near_campus: e.target.value })}
                                    className="w-full mt-0.5 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-medium text-slate-400 dark:text-gold-200/50">Far campus</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.delivery_fee_far_campus}
                                    onChange={(e) => setForm({ ...form, delivery_fee_far_campus: e.target.value })}
                                    className="w-full mt-0.5 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Stock</label>
                            <input
                                type="number"
                                min="0"
                                required
                                value={form.stock}
                                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Condition</label>
                            <select
                                value={form.condition}
                                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm capitalize"
                            >
                                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                        >
                            <option value="">—</option>
                            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || uploading || videoUploading}
                            className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : (uploading || videoUploading) ? 'Uploading…' : 'Save changes'}
                        </button>
                    </div>
                                </form>
            </div>
        </div>,
        document.body
    );
}