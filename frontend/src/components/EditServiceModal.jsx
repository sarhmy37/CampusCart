import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { X, Clock, MapPin, Map as MapIcon, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_MAP_CENTER = { lat: 6.6885, lng: -1.6244 };

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

const toCharmPrice = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (Number.isInteger(num)) {
        return (num - 1 + 0.99).toFixed(2);
    }
    return num.toFixed(2);
};

function LocationPickerMap({ initialPosition, onConfirm, onCancel }) {
    const [position, setPosition] = useState(initialPosition || DEFAULT_MAP_CENTER);

    function ClickCapture() {
        useMapEvents({
            click(e) {
                setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
            },
        });
        return null;
    }

    return (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative w-full sm:max-w-lg bg-white dark:bg-ink-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-ink-600">
                    <h3 className="font-bold text-slate-900 dark:text-gold-50 text-base">Set service location</h3>
                    <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-1">
                        Tap anywhere on the map to drop a pin at your actual place of work.
                    </p>
                </div>
                <div className="h-80 sm:h-96">
                    <MapContainer center={[position.lat, position.lng]} zoom={16} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <Marker position={[position.lat, position.lng]} />
                        <ClickCapture />
                    </MapContainer>
                </div>
                <div className="flex gap-2 p-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-700 dark:text-gold-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(position)}
                        className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 font-semibold text-sm hover:bg-brand-700 dark:hover:bg-gold-400 transition"
                    >
                        Confirm pin
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function EditServiceModal({ product, open, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        price: '',
        priceMax: '',
    });
    const [is247, setIs247] = useState(false);
    const [workingDays, setWorkingDays] = useState(
        WORKING_DAYS.map((day) => ({ day, enabled: false, open: '09:00', close: '17:00' }))
    );
    const [location, setLocation] = useState(null); // { lat, lng }
    const [locating, setLocating] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    // Turns a parsed schedule object into working-day/location state.
    const applySchedule = (schedule) => {
        setIs247(!!schedule.is_24_7);
        if (Array.isArray(schedule.days) && schedule.days.length > 0) {
            setWorkingDays(
                WORKING_DAYS.map((day) => {
                    const match = schedule.days.find((d) => d.day === day);
                    return match
                        ? { day, enabled: true, open: match.open, close: match.close }
                        : { day, enabled: false, open: '09:00', close: '17:00' };
                })
            );
        } else {
            setWorkingDays(WORKING_DAYS.map((day) => ({ day, enabled: false, open: '09:00', close: '17:00' })));
        }

        if (typeof schedule.lat === 'number' && typeof schedule.lng === 'number') {
            setLocation({ lat: schedule.lat, lng: schedule.lng });
        } else {
            setLocation(null);
        }
    };

    const parseSchedule = (raw) => {
        try {
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    };

    // Quick paint from whatever the Dashboard list already gave us (title,
    // price range), then fetch the full record below — the /products/mine
    // list the Dashboard uses never includes description, service_duration
    // (the saved working hours + location), or price_max, so without this
    // fetch those always reset to blank/default when editing.
    useEffect(() => {
        if (!product) return;
        setForm({
            title: product.title || '',
            description: product.description || '',
            price: product.price || '',
            priceMax: product.price_max || '',
        });
        applySchedule(parseSchedule(product.service_duration));

        if (!product.id) return;
        api.get(`/products/${product.id}`)
            .then((res) => {
                const data = res.data;
                setForm({
                    title: data.title || '',
                    description: data.description || '',
                    price: data.price || '',
                    priceMax: data.price_max || '',
                });
                applySchedule(parseSchedule(data.service_duration));
            })
            .catch(() => {
                // Keep what we already parsed from the list item above.
            });
    }, [product]);

    const toggleWorkingDay = (day) => {
        setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d)));
    };

    const updateWorkingDayTime = (day, field, value) => {
        setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
    };

    const captureLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Your device doesn't support location detection.");
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
                toast.success('Location captured');
            },
            () => {
                toast.error("Couldn't get your location. Please try again.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Lock body scroll while open — same self-aware pattern as EditListingModal.
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

        if (!form.title.trim()) {
            toast.error('Enter a service title');
            return;
        }
        if (!form.price || parseFloat(form.price) <= 0) {
            toast.error('Enter a valid starting price');
            return;
        }
        if (form.priceMax && parseFloat(form.priceMax) < parseFloat(form.price)) {
            toast.error("The upper price can't be less than the starting price");
            return;
        }
        if (!is247 && workingDays.every((d) => !d.enabled)) {
            toast.error('Select your working days, or choose Working 24/7');
            return;
        }
        if (!location) {
            toast.error('Please set your service location so buyers can find you.');
            return;
        }

        const schedule = {
            ...(is247
                ? { is_24_7: true }
                : {
                    is_24_7: false,
                    days: workingDays
                        .filter((d) => d.enabled)
                        .map(({ day, open, close }) => ({ day, open, close })),
                }),
            lat: location.lat,
            lng: location.lng,
        };

        setSaving(true);
        try {
            const payload = {
                title: form.title,
                description: form.description || 'No description provided.',
                price: toCharmPrice(form.price),
                price_max: form.priceMax ? toCharmPrice(form.priceMax) : null,
                service_duration: JSON.stringify(schedule),
            };
            await api.patch(`/products/${product.id}`, payload);
            toast.success('Service updated');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update service');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">Edit service</h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-gold-200/50 hover:text-slate-600 dark:hover:text-gold-100">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Service title</label>
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

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60">Price range (GHS)</label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                placeholder="From"
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                            />
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.priceMax}
                                onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                                placeholder="To (optional)"
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm"
                            />
                        </div>
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
                                                    ? 'bg-brand-600 dark:bg-gold-500 border-brand-600 dark:border-gold-500 text-white dark:text-ink-900'
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
                                                    className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-xs focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none appearance-none"
                                                >
                                                    {TIME_OPTIONS.map((t) => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                                <span className="text-xs text-slate-400 dark:text-gold-200/40 shrink-0">to</span>
                                                <select
                                                    value={d.close}
                                                    onChange={(e) => updateWorkingDayTime(d.day, 'close', e.target.value)}
                                                    className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 text-xs focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none appearance-none"
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
                            <span className="text-sm font-medium text-slate-700 dark:text-gold-100">Working 24/7</span>
                        </label>
                    </div>

                    {/* LOCATION */}
                    <div className="border-t border-slate-100 dark:border-ink-600 pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin size={15} className="text-slate-500 dark:text-gold-300/60" />
                            <label className="text-sm font-semibold text-slate-700 dark:text-gold-200">
                                Service location <span className="text-red-500">*</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setShowLocationPicker(true)}
                                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                            >
                                <MapIcon size={15} /> Set on map
                            </button>
                            <button
                                type="button"
                                onClick={captureLocation}
                                disabled={locating}
                                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold text-center leading-tight transition disabled:opacity-60 ${
                                    location
                                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                        : 'border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 hover:bg-slate-50 dark:hover:bg-ink-700'
                                }`}
                            >
                                {locating ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <MapPin size={15} className="shrink-0" />}
                                <span>{locating ? 'Getting…' : 'Use current location'}</span>
                            </button>
                        </div>

                        {location && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                                ✓ Location set — tap either button above to update it.
                            </p>
                        )}
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
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>

            {showLocationPicker && (
                <LocationPickerMap
                    initialPosition={location || DEFAULT_MAP_CENTER}
                    onConfirm={(pos) => {
                        setLocation(pos);
                        setShowLocationPicker(false);
                        toast.success('Location set');
                    }}
                    onCancel={() => setShowLocationPicker(false)}
                />
            )}
        </div>,
        document.body
    );
}