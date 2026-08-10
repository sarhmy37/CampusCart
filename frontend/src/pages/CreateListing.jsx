import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';

export default function CreateListing() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        title: '', description: '', price: '', category_id: '', condition: 'used', stock: 1, images: [''],
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
    }, []);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { ...form, images: form.images.filter(Boolean) };
            await api.post('/products', payload);
            toast.success('Listing created!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create listing');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto px-4 py-10">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-6">New Listing</h1>

            <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <Field label="Title">
                    <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm" />
                </Field>

                <Field label="Description">
                    <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Price (GHS)">
                        <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm" />
                    </Field>
                    <Field label="Stock">
                        <input type="number" min="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm" />
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Category">
                        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm">
                            <option value="">Select</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Condition">
                        <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm">
                            <option value="new">New</option>
                            <option value="used">Used</option>
                        </select>
                    </Field>
                </div>

                <Field label="Image URL">
                    <input value={form.images[0]} onChange={(e) => setForm({ ...form, images: [e.target.value] })}
                        placeholder="https://..."
                        className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm" />
                </Field>

                <button type="submit" disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition disabled:opacity-60">
                    {loading ? 'Publishing...' : 'Publish listing'}
                </button>
            </form>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="text-sm font-semibold text-slate-700">{label}</label>
            {children}
        </div>
    );
}
