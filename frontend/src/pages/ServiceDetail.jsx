import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SCHOOL_COORDS } from './Register';
import {
    Star, MapPin, Clock, ChevronLeft, Calendar, ShieldCheck,
    Loader2, Briefcase, MessageSquare, Tag, ArrowRight,
    Maximize2, Minimize2,
} from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseAvailability(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
        return null;
    } catch {
        return null; // old plain-text duration values (e.g. "2hrs")
    }
}

// "9:00 AM" -> "09:00" (24hr, for <input type="time"> min/max)
// Defensive: returns undefined instead of throwing if label is missing/malformed,
// since older/partial availability records may not have openTime/closeTime set.
function to24Hour(label) {
    if (!label || typeof label !== 'string') return undefined;
    const [time, period] = label.split(' ');
    if (!time) return undefined;
    let [hours, minutes] = time.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

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
    const [buyerLocation, setBuyerLocation] = useState(null);
    const [locatingBuyer, setLocatingBuyer] = useState(false);
    const [buyerLocationError, setBuyerLocationError] = useState('');
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);

    // Escape-to-close + lock background scroll while the map is full screen
    useEffect(() => {
        if (!isMapFullscreen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') setIsMapFullscreen(false);
        };
        document.addEventListener('keydown', handleKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [isMapFullscreen]);

    const findMyLocation = () => {
        if (!navigator.geolocation) {
            setBuyerLocationError("Your device doesn't support location detection.");
            return;
        }
        setLocatingBuyer(true);
        setBuyerLocationError('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setBuyerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocatingBuyer(false);
            },
            () => {
                setBuyerLocationError("Couldn't get your location. You can still see the pin below.");
                setLocatingBuyer(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

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
    const availability = parseAvailability(service.service_duration || service.duration);
    const legacyDuration = !availability ? (service.service_duration || service.duration) : null;

    // Only treat the schedule as "set" if it actually has the fields we need.
    const hasScheduledHours = !!(
        availability &&
        !availability.is247 &&
        availability.days?.length &&
        availability.openTime &&
        availability.closeTime
    );

    const availabilitySummary = availability
        ? (availability.is247
            ? 'Open 24/7'
            : hasScheduledHours
                ? `${availability.days.join(', ')} · ${availability.openTime}–${availability.closeTime}`
                : 'Hours not fully set')
        : (legacyDuration || 'Flexible timing');

    const exactLat = availability?.lat;
    const exactLng = availability?.lng;
    const hasExactLocation = typeof exactLat === 'number' && typeof exactLng === 'number';

    const schoolCoords = SCHOOL_COORDS[service.seller_school];
    const serviceLat = hasExactLocation ? exactLat : schoolCoords?.lat;
    const serviceLng = hasExactLocation ? exactLng : schoolCoords?.lng;
    const hasServiceLocation = typeof serviceLat === 'number' && typeof serviceLng === 'number';

    const timeInputBounds = hasScheduledHours
        ? { min: to24Hour(availability.openTime), max: to24Hour(availability.closeTime) }
        : {};

    const handleBook = async (e) => {
        e.preventDefault();
        if (!bookingDate || !bookingTime) {
            toast.error('Please select a date and time.');
            return;
        }
        if (hasScheduledHours) {
            const pickedDay = DAY_NAMES[new Date(bookingDate + 'T00:00:00').getDay()];
            if (!availability.days?.includes(pickedDay)) {
                toast.error(`This provider isn't available on ${pickedDay}s. Pick from: ${availability.days.join(', ')}`);
                return;
            }
            if (timeInputBounds.min && timeInputBounds.max &&
                (bookingTime < timeInputBounds.min || bookingTime > timeInputBounds.max)) {
                toast.error(`This provider is only available ${availability.openTime}–${availability.closeTime}`);
                return;
            }
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
            <section className="relative overflow-hidden h-[36vh] min-h-[240px] sm:h-[40vh] sm:min-h-[300px]">
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
                {/* Fade the hero into the page background, same treatment as the video panel on Create Listing */}
                <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-b from-transparent to-slate-50 dark:to-ink-900 pointer-events-none" />
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                {/* Back button */}
                <div className="absolute top-0 left-0 right-0 z-10 px-4 sm:px-6 pt-6">
                    <div className="max-w-5xl mx-auto">
                        <Link
                            to="/browse"
                            className="inline-flex items-center gap-1 bg-white/10 text-white font-semibold px-3.5 py-1.5 rounded-full border border-white/30 hover:bg-white/20 transition backdrop-blur text-sm"
                        >
                            <ChevronLeft size={15} /> Browse
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

                        <div className="flex items-stretch mt-3">
                            {service.seller_avatar && (
                                <img
                                    src={service.seller_avatar}
                                    alt={service.seller_name}
                                    className="w-20 sm:w-24 object-cover rounded-r-full -ml-4 sm:-ml-6 shrink-0"
                                />
                            )}
                            <div className="ml-3 min-w-0">
                                <h1 className="text-2xl sm:text-4xl font-extrabold text-white max-w-2xl drop-shadow-sm">
                                    {service.title || service.name}
                                </h1>
                                <p className="text-2xl sm:text-3xl font-black text-white mt-2 drop-shadow-sm">
                                    GHS {parseFloat(service.price).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-8">
                <div className="grid md:grid-cols-3 gap-6">
                    {/* ─── LEFT: gallery + details ─── */}
                    <div className="md:col-span-2 space-y-5">
                        {/* TRACK SERVICE — map + directions, replaces the old image gallery */}
                        <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 pb-0 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-400 dark:text-gold-200/50 uppercase tracking-wide mb-1">
                                        Track service
                                    </p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">
                                        {service.seller_meeting_place
                                            ? `${service.seller_meeting_place}, ${service.seller_school}`
                                            : service.seller_school || 'Location not specified'}
                                    </p>
                                </div>
                                {hasServiceLocation && (
                                    <button
                                        type="button"
                                        onClick={findMyLocation}
                                        disabled={locatingBuyer}
                                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-brand-200 dark:border-gold-700 text-brand-600 dark:text-gold-400 hover:bg-brand-50 dark:hover:bg-gold-900/30 transition disabled:opacity-60"
                                    >
                                        {locatingBuyer ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                                        {locatingBuyer ? 'Locating…' : buyerLocation ? 'Update my location' : 'Show route from me'}
                                    </button>
                                )}
                            </div>

                            {hasServiceLocation ? (
                                <div className="mt-3 h-64 sm:h-72">
                                    <iframe
                                        title="Service location"
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        loading="lazy"
                                        className="dark:invert dark:hue-rotate-180 dark:brightness-95 dark:contrast-125"
                                        src={
                                            buyerLocation
                                                ? `https://www.google.com/maps?saddr=${buyerLocation.lat},${buyerLocation.lng}&daddr=${serviceLat},${serviceLng}&output=embed`
                                                : `https://www.google.com/maps?q=${serviceLat},${serviceLng}&z=15&output=embed`
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="mt-3 h-40 flex flex-col items-center justify-center text-center px-4 text-slate-400 dark:text-gold-200/40">
                                    <MapPin size={28} className="mb-2" />
                                    <p className="text-sm">This provider hasn't set an exact location yet.</p>
                                </div>
                            )}

                            {buyerLocationError && (
                                <p className="text-xs text-red-500 dark:text-red-400 px-4 py-2">{buyerLocationError}</p>
                            )}
                            {hasServiceLocation && (
                                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                                    <p className="text-[11px] text-slate-400 dark:text-gold-200/40">
                                        {buyerLocation
                                            ? 'Showing the shortest route from your current location.'
                                            : hasExactLocation
                                                ? 'Tap "Show route from me" to see directions from your location.'
                                                : "This is an approximate pin based on the provider's school — they haven't set an exact location yet."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setIsMapFullscreen(true)}
                                        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 dark:text-gold-200/50 hover:text-brand-600 dark:hover:text-gold-400 hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                                        aria-label="View map full screen"
                                        title="View full screen"
                                    >
                                        <Maximize2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Photo thumbnails, now secondary to the map */}
                        {images.length > 1 && (
                            <div className="bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl overflow-hidden shadow-sm">
                                <div className="aspect-[16/10] bg-slate-100 dark:bg-ink-700">
                                    <img
                                        src={images[activeImage]}
                                        alt={service.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
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
                                    <p className="text-[10px] text-slate-400 dark:text-gold-200/50 uppercase font-semibold">Availability</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-gold-100 truncate">
                                        {availabilitySummary}
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
                                            {...timeInputBounds}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                                            required
                                        />
                                        {hasScheduledHours && (
                                            <p className="text-[11px] text-slate-400 dark:text-gold-200/50 mt-1">
                                                Available {availability.days.join(', ')} · {availability.openTime}–{availability.closeTime}
                                            </p>
                                        )}
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

            {/* Full screen map overlay */}
            {isMapFullscreen && hasServiceLocation && (
                <div className="fixed inset-0 z-50 bg-black">
                    <button
                        type="button"
                        onClick={() => setIsMapFullscreen(false)}
                        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full bg-white/95 dark:bg-ink-800/95 text-slate-700 dark:text-gold-100 shadow-md backdrop-blur hover:bg-white dark:hover:bg-ink-800 transition"
                        aria-label="Exit full screen"
                        title="Minimize"
                    >
                        <Minimize2 size={15} /> Minimize
                    </button>
                    <iframe
                        title="Service location full screen"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        className="dark:invert dark:hue-rotate-180 dark:brightness-95 dark:contrast-125"
                        src={
                            buyerLocation
                                ? `https://www.google.com/maps?saddr=${buyerLocation.lat},${buyerLocation.lng}&daddr=${serviceLat},${serviceLng}&output=embed`
                                : `https://www.google.com/maps?q=${serviceLat},${serviceLng}&z=15&output=embed`
                        }
                    />
                </div>
            )}
        </div>
    );
}