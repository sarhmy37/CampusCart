import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
    Star, MapPin, Clock, ChevronLeft, Calendar, ShieldCheck,
    Loader2, Briefcase, MessageSquare, Tag, ArrowRight,
} from 'lucide-react';

export default function ServiceDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [service, setService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeImage, setActiveImage] = useState(0);
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

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 py-10">
                <div className="h-64 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse mb-6" />
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 h-48 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />
                    <div className="h-64 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />
                </div>
            </div>
        );
    }
    if (!service) return null;

    const isOwner = user && user.id === service.seller_id;
    const images = service.images?.length ? service.images.map(i => i.image_url || i) : (service.primary_image ? [service.primary_image] : []);
    const hasRating = service.rating && parseFloat(service.rating) > 0;
    const duration = service.service_duration || service.duration;

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
            window.location.href = data.authorization_url;
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
            {/* HEADER — video hero */}
            <section className="relative overflow-hidden h-[52vh] min-h-[340px] sm:h-[58vh] sm:min-h-[420px]">
                {service.video_url ? (
                    <video
                        key={service.video_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    >
                        <source src={service.video_url} type="video/mp4" />
                    </video>
                ) : images.length > 0 ? (
                    <img
                        src={images[0]}
                        alt={service.title}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-800 to-brand-600 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900" />
                )}

                {/* Gradient overlays for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/25 to-ink-900/50 pointer-events-none" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                {/* Back button */}
                <div className="absolute top-0 left-0 right-0 z-10 px-4 sm:px-6 pt-6">
                    <div className="max-w-5xl mx-auto">
                        <Link
                            to="/browse"
                            className="inline-flex items-center gap-1.5 bg-white/10 text-white font-semibold px-3.5 py-1.5 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                        >
                            <ChevronLeft size={15} /> Back to browse
                        </Link>
                    </div>
                </div>

                {/* Content, bottom-anchored */}
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 sm:px-6 pb-6 sm:pb-8">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                <Briefcase size={12} /> Service
                            </span>
                            {hasRating && (
                                <span className="inline-flex items-center gap-1 bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur">
                                    <Star size={12} className="text-gold-300 fill-gold-300" />
                                    {parseFloat(service.rating).toFixed(1)}
                                    {service.review_count ? ` (${service.review_count})` : ''}
                                </span>
                            )}
                            {service.video_url && (
                                <span className="inline-flex items-center gap-1 bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur">
                                    🎥 Video
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl sm:text-4xl font-extrabold text-white mt-3 max-w-2xl drop-shadow-sm">
                            {service.title || service.name}
                        </h1>
                        <p className="text-2xl sm:text-3xl font-black text-white mt-2 drop-shadow-sm">
                            GHS {parseFloat(service.price).toFixed(2)}
                        </p>
                    </div>
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="grid md:grid-cols-3 gap-6">
                    {/* ─── LEFT: gallery + details ─── */}
                    <div className="md:col-span-2 space-y-5">
                        {/* GALLERY */}
                        {images.length > 0 && (
                            <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl overflow-hidden shadow-sm">
                                <div className="aspect-[16/10] bg-slate-100 dark:bg-ink-700">
                                    <img
                                        src={images[activeImage]}
                                        alt={service.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {images.length > 1 && (
                                    <div className="flex gap-2 p-3 overflow-x-auto">
                                        {images.map((src, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setActiveImage(i)}
                                                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                                                    activeImage === i
                                                        ? 'border-brand-600 dark:border-gold-500'
                                                        : 'border-transparent opacity-60 hover:opacity-100'
                                                }`}
                                            >
                                                <img src={src} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PROVIDER CARD */}
                        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 shadow-sm">
                            <p className="text-xs font-bold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-3">
                                Provided by
                            </p>
                            <div className="flex items-center gap-3">
                                {service.seller_avatar ? (
                                    <img
                                        src={service.seller_avatar}
                                        alt={service.seller_name}
                                        className="w-12 h-12 rounded-full object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center font-bold shrink-0">
                                        {service.seller_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-slate-900 dark:text-gold-50 truncate">
                                            {service.seller_name || 'Unknown'}
                                        </p>
                                        {service.seller_verified && (
                                            <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gold-200/50">
                                        {service.seller_school || 'Location not specified'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* DESCRIPTION */}
                        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-5 shadow-sm">
                            <p className="text-xs font-bold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-2">
                                About this service
                            </p>
                            <p className="text-sm text-slate-600 dark:text-gold-100/80 whitespace-pre-line leading-relaxed">
                                {service.description}
                            </p>
                        </div>

                        {/* INFO PILLS */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-xl p-3.5">
                                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 dark:text-gold-200/50 uppercase font-semibold">Location</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">
                                        {service.seller_school || 'Not specified'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-xl p-3.5">
                                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center shrink-0">
                                    <Clock size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 dark:text-gold-200/50 uppercase font-semibold">Duration</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">
                                        {duration || 'Flexible timing'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── RIGHT: sticky booking card ─── */}
                    <div className="md:col-span-1">
                        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl p-6 shadow-sm sticky top-24">
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <Calendar size={16} />
                                </div>
                                <h2 className="font-bold text-slate-900 dark:text-gold-50">Book this service</h2>
                            </div>

                            {isOwner ? (
                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">
                                    You're the provider — you can't book your own service.
                                </p>
                            ) : (
                                <form onSubmit={handleBook} className="mt-5 space-y-3.5">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-gold-300/60 mb-1">
                                            <Calendar size={13} /> Date
                                        </label>
                                        <input
                                            type="date"
                                            value={bookingDate}
                                            onChange={e => setBookingDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-gold-300/60 mb-1">
                                            <Clock size={13} /> Time
                                        </label>
                                        <input
                                            type="time"
                                            value={bookingTime}
                                            onChange={e => setBookingTime(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-gold-300/60 mb-1">
                                            <MessageSquare size={13} /> Message (optional)
                                        </label>
                                        <textarea
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            rows="3"
                                            placeholder="Any special requests?"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition resize-none"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting || !user}
                                        className={`w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                                            submitting || !user
                                                ? 'bg-slate-200 dark:bg-ink-600 text-slate-400 dark:text-gold-200/40 cursor-not-allowed'
                                                : 'bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 hover:bg-brand-700 dark:hover:bg-gold-400 shadow-sm'
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Processing…
                                            </>
                                        ) : !user ? (
                                            'Log in to book'
                                        ) : (
                                            <>
                                                Pay & Book <ArrowRight size={15} />
                                            </>
                                        )}
                                    </button>

                                    <p className="text-[11px] text-center text-slate-400 dark:text-gold-200/40">
                                        Secure checkout via Paystack
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}