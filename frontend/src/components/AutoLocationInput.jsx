// frontend/src/components/AutoLocationInput.jsx
import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AutoLocationInput({ value, onChange, placeholder = "Tap to auto-detect location..." }) {
    const [loading, setLoading] = useState(false);

    const detectLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // Use free Nominatim API to turn coordinates into an address
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`
                    );
                    const data = await response.json();

                    if (data && data.address) {
                        const addr = data.address;
                        // Construct Region, City, Landmark format
                        // Try to get the most specific landmark (road, shop, or suburb), then city, then state/region
                        const landmark = addr.road || addr.shop || addr.suburb || addr.neighbourhood || addr.hamlet || '';
                        const city = addr.city || addr.town || addr.village || addr.county || '';
                        // Use state or region, fallback to country if nothing else exists
                        const region = addr.state || addr.region || addr.country || 'Ghana'; 

                        // Combine them into one string, removing double commas if a part is empty
                        let locationString = '';
                        if (region) locationString += region;
                        if (city) locationString += (locationString ? ', ' : '') + city;
                        if (landmark) locationString += (locationString ? ', ' : '') + landmark;

                        // If we got nothing, use a simple "GPS coords" fallback
                        if (!locationString) {
                            locationString = `Near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                        }

                        onChange(locationString);
                        toast.success("Location detected!");
                    } else {
                        toast.error("Could not find a landmark near this location.");
                    }
                } catch (error) {
                    toast.error("Failed to convert location to address.");
                } finally {
                    setLoading(false);
                }
            },
            (error) => {
                setLoading(false);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error("Location permission denied. Please allow location in your browser settings.");
                } else {
                    toast.error("Unable to retrieve your location.");
                }
            }
        );
    };

    return (
        <div className="relative w-full">
            <div 
                onClick={!loading ? detectLocation : null}
                className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-700 flex items-center justify-between cursor-pointer transition hover:border-brand-400 dark:hover:border-gold-500 ${loading ? 'opacity-80' : ''}`}
            >
                <span className={`text-sm ${value ? 'text-slate-800 dark:text-gold-50' : 'text-slate-400 dark:text-gold-300/40'}`}>
                    {value || placeholder}
                </span>
                {loading ? (
                    <Loader2 className="w-5 h-5 text-brand-600 dark:text-gold-400 animate-spin" />
                ) : (
                    <MapPin className="w-5 h-5 text-slate-400 dark:text-gold-300/40" />
                )}
            </div>
        </div>
    );
}