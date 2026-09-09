import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Star, MapPin, Clock, MessageCircle, ChevronLeft, Calendar, User, Loader2 } from 'lucide-react';
import { formatWhatsAppNumber } from '../utils/whatsapp';

export default function ServiceDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [service, setService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get(`/products/${id}`)
            .then(res => setService(res.data))
            .catch(() => {
                toast.error('Service not found.');
                navigate('/browse');
            })
            .finally(() => setLoading(false));
    }, [id, navigate]);

    if (loading) return <div className="max-w-5xl mx-auto px-4 py-24 text-center text-slate-400">Loading…</div>;
    if (!service) return null;

    const isOwner = user && user.id === service.seller_id;

    const handleBook = async (e) => {
        e.preventDefault();
        if (!bookingDate || !bookingTime) {
            toast.error('Please select a date and time.');
            return;
        }
        if (!user) {
            toast.error('Please log in to book this service.');
            return;
        }
        if (user.id === service.seller_id) {
            toast.error('You cannot book your own service.');
            return;
        }
        setSubmitting(true);
        try {
            const { data } = await api.post('/bookings', {
                service_id: service.id,
                booking_date: bookingDate,
                booking_time: bookingTime,
                message: message || '',
            });
            // Redirect to Paystack checkout
            window.location.href = data.authorization_url;
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 min-h-screen">
            <Link to="/browse" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 mb-6">
                <ChevronLeft size={16} /> Back to browse
            </Link>

            <div className="grid md:grid-cols-3 gap-8">
                {/* left: main info */}
                <div className="md:col-span-2">
                    <div className="bg-white dark:bg-ink-800 rounded-2xl p-6 shadow">
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gold-50">{service.title || service.name}</h1>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">
                            by {service.seller_name || 'Unknown'}
                            {service.seller_verified && <span className="ml-2 text-brand-600 dark:text-gold-400">✓ Verified</span>}
                        </p>
                        <p className="text-2xl font-bold text-brand-600 dark:text-gold-400 mt-3">GHS {parseFloat(service.price).toFixed(2)}</p>
                        <p className="text-slate-600 dark:text-gold-100/80 mt-4 whitespace-pre-line">{service.description}</p>
                        <div className="mt-4 flex items-center gap-3 text-sm">
                            <MapPin size={16} className="text-slate-400" />
                            <span>{service.seller_school || 'Location not specified'}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-sm">
                            <Clock size={16} className="text-slate-400" />
                            <span>{service.duration ? `Duration: ${service.duration}` : 'Flexible timing'}</span>
                        </div>
                    </div>
                </div>

                {/* right: booking form */}
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-ink-800 rounded-2xl p-6 shadow sticky top-24">
                        <h2 className="font-bold text-slate-900 dark:text-gold-50">Book this service</h2>
                        {isOwner ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">You are the provider – cannot book your own service.</p>
                        ) : (
                            <form onSubmit={handleBook} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-gold-200/60">Date</label>
                                    <input
                                        type="date"
                                        value={bookingDate}
                                        onChange={e => setBookingDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-gold-200/60">Time</label>
                                    <input
                                        type="time"
                                        value={bookingTime}
                                        onChange={e => setBookingTime(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-gold-200/60">Message (optional)</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        rows="3"
                                        placeholder="Any special requests?"
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting || !user}
                                    className={`w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                                        submitting || !user
                                            ? 'bg-slate-300 dark:bg-ink-600 text-slate-500 dark:text-gold-200/40 cursor-not-allowed'
                                            : 'bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 hover:bg-brand-700 dark:hover:bg-gold-400'
                                    }`}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Processing...
                                        </>
                                    ) : !user ? (
                                        'Log in to book'
                                    ) : (
                                        'Pay & Book (GHS 2.00)'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}