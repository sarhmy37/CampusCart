import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { GraduationCap, ImagePlus, X ,ArrowLeft } from 'lucide-react';

const MAX_IMAGES = 6;

export default function CreateListing() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        title: '', description: '', price: '', category_id: '', condition: 'used', stock: 1,
    });
    const [imageFiles, setImageFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    // Clean up object URLs when they're replaced/unmounted
    useEffect(() => {
        return () => previews.forEach((p) => URL.revokeObjectURL(p));
    }, [previews]);

    const handleFilesSelected = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const combined = [...imageFiles, ...files].slice(0, MAX_IMAGES);
        setImageFiles(combined);
        setPreviews(combined.map((f) => URL.createObjectURL(f)));
        e.target.value = ''; // allow re-selecting the same file later
    };

    const removeImage = (index) => {
        const nextFiles = imageFiles.filter((_, i) => i !== index);
        setImageFiles(nextFiles);
        setPreviews(nextFiles.map((f) => URL.createObjectURL(f)));
    };

    const onSubmit = async (e) => {
        e.preventDefault();

        if (imageFiles.length === 0) {
            toast.error('Add at least one photo of the item');
            return;
        }

        setLoading(true);
        try {
            const category = categories.find((c) => String(c.id) === String(form.category_id));

            const payload = new FormData();
            payload.append('title', form.title);
            payload.append('description', form.description);
            payload.append('price', form.price);
            payload.append('condition', form.condition);
            payload.append('stock', form.stock);
            if (category) payload.append('category', category.name);
            imageFiles.forEach((file) => payload.append('images', file));

            await api.post('/products', payload, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Listing created!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create listing');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2">
            {/* LEFT — video panel */}
            <div className="relative hidden lg:block overflow-hidden">
                <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                    <source src="/create-listing-bg.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-accent-600/60" />
                <button
    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
    className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-4 py-2 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
>
    <ArrowLeft size={16} /> Back
</button>
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute left-1/4 -bottom-24 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl" />

                <div className="relative z-10 h-full flex flex-col justify-center px-12 xl:px-16">
                    <span className="inline-flex items-center gap-1.5 w-fit bg-white/15 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                        <GraduationCap size={13} /> CampusCart
                    </span>
                    <h1 className="mt-6 text-3xl xl:text-4xl font-extrabold text-white leading-tight max-w-md">
                        Turn what you're not using into what someone else needs.
                    </h1>
                    <p className="mt-4 text-white/80 text-sm max-w-sm">
                        List an item in minutes. Buyers on your campus will find it, message you, and pick it up or get it delivered.
                    </p>
                </div>
            </div>
                
            {/* RIGHT — form */}
            <div className="flex items-center justify-center px-4 py-16 bg-slate-50">
                <div className="w-full max-w-sm">
                    
                    <h1 className="text-2xl font-extrabold text-slate-900">New Listing</h1>
                    <p className="text-sm text-slate-500 mt-1">Add the details buyers will see.</p>

                    <form onSubmit={onSubmit} className="mt-5 space-y-4">
                        <div>
    <label className="text-sm font-semibold text-slate-700">Title</label>
    <input
        required
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="e.g. Casio scientific calculator"
        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
    />
</div>

<div className="grid grid-cols-2 gap-3">
    <div>
        <label className="text-sm font-semibold text-slate-700">Description</label>
        <textarea
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Condition, why you're selling, anything a buyer should know"
            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition resize-none"
        />
    </div>
    <div>
        <label className="text-sm font-semibold text-slate-700">Photos</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
            {previews.map((src, i) => (
                <div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
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
            {imageFiles.length < MAX_IMAGES && (
                <label className="aspect-square rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-brand-400 hover:text-brand-500 cursor-pointer transition">
                    <ImagePlus size={20} />
                    <span className="text-[11px] font-semibold">Add</span>
                    <input type="file" accept="image/*" multiple onChange={handleFilesSelected} className="hidden" />
                </label>
            )}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">Up to {MAX_IMAGES}. First is cover.</p>
    </div>

    
</div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Price (GHS)</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Stock</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.stock}
                                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Category</label>
                                <select
                                    value={form.category_id}
                                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition appearance-none"
                                >
                                    <option value="">Select</option>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Condition</label>
                                <select
                                    value={form.condition}
                                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm bg-white transition appearance-none"
                                >
                                    <option value="new">New</option>
                                    <option value="used">Used</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
                        >
                            {loading ? 'Publishing…' : 'Publish listing'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}