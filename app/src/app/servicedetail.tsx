import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal,
  Linking, Platform, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import {
  Star, MapPin, Clock, ChevronLeft, ChevronRight, Calendar, ShieldCheck,
  Briefcase, MessageSquare, ArrowRight, Sparkles, Maximize2, X, Navigation,
} from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same coordinates used on the browse page / web Register screen.
const SCHOOL_COORDS: Record<string, { lat: number; lng: number }> = {
  KNUST: { lat: 6.6732, lng: -1.5654 },
  UG: { lat: 5.6505, lng: -0.1895 },
  ATU: { lat: 5.554028, lng: -0.205556 },
  UHAS: { lat: 6.6008, lng: 0.4713 },
  UCC: { lat: 5.1153, lng: -1.2903 },
  UDS: { lat: 9.393273, lng: -0.823513 },
  UEW: { lat: 5.35, lng: -0.625 },
  UPSA: { lat: 5.6614, lng: -0.1664 },
  PentUni: { lat: 5.6262, lng: -0.2742 },
  KsTU: { lat: 6.6911, lng: -1.61 },
  CU: { lat: 5.5663, lng: -0.241 },
  UMaT: { lat: 5.3005, lng: -1.99 },
  Ashesi: { lat: 5.75972, lng: -0.21972 },
  KTU: { lat: 6.063, lng: -0.2642 },
  GCTU: { lat: 5.5998, lng: -0.2362 },
  GIMPA: { lat: 5.638, lng: -0.167 },
  UENR: { lat: 7.3495, lng: -2.3435 },
};

function parseAvailability(raw: any) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null; // old plain-text duration values (e.g. "2hrs")
  }
}

// "09:00" (24hr, as stored) -> "9:00 AM"
function formatTime12(time24?: string) {
  if (!time24 || typeof time24 !== 'string') return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return '';
  const period = h < 12 ? 'AM' : 'PM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${period}`;
}

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toHM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function ServiceDetail() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [bookingTime, setBookingTime] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingBlocked, setBookingBlocked] = useState(false);

  const [buyerLocation, setBuyerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingBuyer, setLocatingBuyer] = useState(false);
  const [buyerLocationError, setBuyerLocationError] = useState('');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${id}`)
      .then((res) => setService(res.data))
      .catch(() => {
        Toast.show({ type: 'error', text1: 'Service not found.' });
        router.replace('/browse');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const findMyLocation = async () => {
    setLocatingBuyer(true);
    setBuyerLocationError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setBuyerLocationError("Location permission needed. You can still see the pin below.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setBuyerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setBuyerLocationError("Couldn't get your location. You can still see the pin below.");
    } finally {
      setLocatingBuyer(false);
    }
  };

  const view = useMemo(() => {
    if (!service) return null;
    const images: string[] = service.images?.length
      ? service.images.map((i: any) => i.image_url || i)
      : service.primary_image ? [service.primary_image] : [];
    const availability = parseAvailability(service.service_duration || service.duration);
    const legacyDuration = !availability ? (service.service_duration || service.duration) : null;
    const hasScheduledHours = !!(
      availability && !availability.is_24_7 &&
      Array.isArray(availability.days) && availability.days.length > 0
    );
    const allSameHours = hasScheduledHours && availability.days.every(
      (d: any) => d.open === availability.days[0].open && d.close === availability.days[0].close
    );
    const availabilitySummary = availability
      ? (availability.is_24_7
        ? 'Open 24/7'
        : hasScheduledHours
          ? (allSameHours
            ? `${availability.days.map((d: any) => d.day).join(', ')} · ${formatTime12(availability.days[0].open)}–${formatTime12(availability.days[0].close)}`
            : availability.days.map((d: any) => `${d.day} ${formatTime12(d.open)}–${formatTime12(d.close)}`).join(', '))
          : 'Hours not fully set')
      : (legacyDuration || 'Flexible timing');

    const exactLat = availability?.lat;
    const exactLng = availability?.lng;
    const hasExactLocation = typeof exactLat === 'number' && typeof exactLng === 'number';
    const schoolCoords = SCHOOL_COORDS[service.seller_school];
    const serviceLat = hasExactLocation ? exactLat : schoolCoords?.lat;
    const serviceLng = hasExactLocation ? exactLng : schoolCoords?.lng;
    const hasServiceLocation = typeof serviceLat === 'number' && typeof serviceLng === 'number';

    return {
      images, availability, hasScheduledHours, allSameHours, availabilitySummary,
      hasExactLocation, serviceLat, serviceLng, hasServiceLocation,
    };
  }, [service]);

  if (loading || !service || !view) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const {
    images, availability, hasScheduledHours, allSameHours, availabilitySummary,
    hasExactLocation, serviceLat, serviceLng, hasServiceLocation,
  } = view;

  const isOwner = !!user && user.id === service.seller_id;
  const sellerPlanActive = service.seller_plan && service.seller_plan !== 'free' &&
    service.seller_plan_expires_at && new Date(service.seller_plan_expires_at) > new Date();
  const sellerPlan = sellerPlanActive ? service.seller_plan.toLowerCase() : null;
  const hasRating = service.rating && parseFloat(service.rating) > 0;
  const heroHeight = Math.max(280, height * 0.42);

  const priceLabel =
    service.price_max && parseFloat(service.price_max) > parseFloat(service.price)
      ? `GHS ${parseFloat(service.price).toFixed(2)} – ${parseFloat(service.price_max).toFixed(2)}`
      : `GHS ${parseFloat(service.price).toFixed(2)}`;

  const openDirections = () => {
    if (!hasServiceLocation) return;
    const origin = buyerLocation ? `&origin=${buyerLocation.lat},${buyerLocation.lng}` : '';
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1${origin}&destination=${serviceLat},${serviceLng}&travelmode=walking`
    );
  };

  const handleBook = async () => {
    const dateStr = toYMD(bookingDate);
    const timeStr = toHM(bookingTime);

    if (hasScheduledHours) {
      const pickedDay = DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
      const dayInfo = availability.days.find((d: any) => d.day === pickedDay);
      if (!dayInfo) {
        Toast.show({
          type: 'error',
          text1: `This provider isn't available on ${pickedDay}s.`,
          text2: `Pick from: ${availability.days.map((d: any) => d.day).join(', ')}`,
        });
        return;
      }
      if (timeStr < dayInfo.open || timeStr > dayInfo.close) {
        Toast.show({
          type: 'error',
          text1: `Only available ${formatTime12(dayInfo.open)}–${formatTime12(dayInfo.close)} on ${pickedDay}s`,
        });
        return;
      }
    }
    if (!user) {
      Toast.show({ type: 'error', text1: 'Please log in to book this service.' });
      return;
    }
    if (user.id === service.seller_id) {
      Toast.show({ type: 'error', text1: 'You cannot book your own service.' });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/bookings', {
        service_id: service.id,
        booking_date: dateStr,
        booking_time: timeStr,
        message: message || '',
      });
      await Linking.openURL(data.authorization_url);
      setSubmitting(false);
    } catch (err: any) {
      if (err.response?.status === 409) setBookingBlocked(true);
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Something went wrong. Please try again.' });
      setSubmitting(false);
    }
  };

  const goBack = () => router.replace({ pathname: '/browse', params: { category: 'Services' } });

  const card = {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  const sectionLabel = {
    fontSize: 11, fontWeight: '700' as const, color: colors.textFaint,
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
  };

  const mapRegion = hasServiceLocation
    ? { latitude: serviceLat as number, longitude: serviceLng as number, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : undefined;

  const bookDisabled = submitting || !user || bookingBlocked;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {/* HERO */}
        <View style={{ height: heroHeight, overflow: 'hidden', backgroundColor: '#0f172a' }}>
          {service.video_url ? (
            <HeroVideo uri={service.video_url} />
          ) : images.length > 0 ? (
            <Image
              source={{ uri: images[activeImage] }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              contentFit="cover"
            />
          ) : null}

          <LinearGradient
            colors={['rgba(15,23,42,0.5)', 'rgba(15,23,42,0.25)', 'rgba(15,23,42,0.9)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', colors.background]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
            pointerEvents="none"
          />

          {/* Image nav (photos only) */}
          {!service.video_url && images.length > 1 && (
            <>
              <Pressable
                onPress={() => setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1))}
                style={{
                  position: 'absolute', left: 12, top: '42%', width: 24, height: 64, borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={18} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1))}
                style={{
                  position: 'absolute', right: 12, top: '42%', width: 24, height: 64, borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={18} color="#fff" />
              </Pressable>
            </>
          )}

          {/* Back */}
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={{
              position: 'absolute', top: insets.top + 12, left: 16,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <ChevronLeft size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Browse</Text>
          </Pressable>

          {/* Hero content */}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 72 }}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {hasRating && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Star size={12} color="#fcd34d" fill="#fcd34d" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {parseFloat(service.rating).toFixed(1)}{service.review_count ? ` (${service.review_count})` : ''}
                  </Text>
                </View>
              )}
              {!!service.video_url && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>🎥 Video</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
              {!!service.seller_avatar && (
                <Image
                  source={{ uri: service.seller_avatar }}
                  style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' }}
                  contentFit="cover"
                />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>
                  {service.title || service.name}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 4 }}>{priceLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* BODY */}
        <View style={{ paddingHorizontal: 16, marginTop: -48, gap: 16 }}>
          {/* TRACK SERVICE */}
          <View style={{ ...card, overflow: 'hidden' }}>
            <View style={{ padding: 16, paddingBottom: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={sectionLabel}>Track service</Text>
                <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 }}>
                  {service.seller_meeting_place
                    ? `${service.seller_meeting_place}, ${service.seller_school}`
                    : service.seller_school || 'Location not specified'}
                </Text>
              </View>
              {hasServiceLocation && (
                <Pressable
                  onPress={findMyLocation}
                  disabled={locatingBuyer}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                    borderWidth: 1, borderColor: colors.brand, opacity: locatingBuyer ? 0.6 : 1,
                  }}
                >
                  {locatingBuyer ? <ActivityIndicator size="small" color={colors.brand} /> : <MapPin size={13} color={colors.brand} />}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>
                    {locatingBuyer ? 'Locating…' : buyerLocation ? 'Update my location' : 'Show me'}
                  </Text>
                </Pressable>
              )}
            </View>

            {hasServiceLocation ? (
              <View style={{ marginTop: 12, height: 240 }}>
                <MapView
                  style={{ flex: 1 }}
                  region={mapRegion}
                  key={buyerLocation ? 'with-buyer' : 'service-only'}
                  initialRegion={mapRegion}
                  scrollEnabled
                  zoomEnabled
                >
                  <Marker coordinate={{ latitude: serviceLat as number, longitude: serviceLng as number }} title={service.title} />
                  {buyerLocation && (
                    <Marker
                      coordinate={{ latitude: buyerLocation.lat, longitude: buyerLocation.lng }}
                      title="You"
                      pinColor="#3b82f6"
                    />
                  )}
                </MapView>
              </View>
            ) : (
              <View style={{ marginTop: 12, height: 140, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                <MapPin size={28} color={colors.textFaint} />
                <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 8, textAlign: 'center' }}>
                  This provider hasn't set an exact location yet.
                </Text>
              </View>
            )}

            {!!buyerLocationError && (
              <Text style={{ fontSize: 12, color: colors.error, paddingHorizontal: 16, paddingTop: 8 }}>{buyerLocationError}</Text>
            )}

            {hasServiceLocation && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ flex: 1, fontSize: 11, color: colors.textFaint }}>
                  {hasExactLocation
                    ? 'Tap "Open directions" to get a route from your location.'
                    : "This is an approximate pin based on the provider's school — they haven't set an exact location yet."}
                </Text>
                <Pressable onPress={openDirections} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Navigation size={13} color={colors.brand} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>Open directions</Text>
                </Pressable>
                <Pressable onPress={() => setIsMapFullscreen(true)} hitSlop={8}>
                  <Maximize2 size={15} color={colors.textFaint} />
                </Pressable>
              </View>
            )}
          </View>

          {/* PROVIDER */}
          <View
            style={{
              ...card, padding: 20,
              borderColor: sellerPlan === 'premium' ? '#c4b5fd' : sellerPlan === 'pro' ? '#93c5fd' : colors.border,
            }}
          >
            <Text style={{ ...sectionLabel, marginBottom: 12 }}>Provided by</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {service.seller_avatar ? (
                <Image source={{ uri: service.seller_avatar }} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 16 }}>
                    {service.seller_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    {service.seller_name || 'Unknown'}
                  </Text>
                  {service.seller_verified && <ShieldCheck size={15} color="#10b981" />}
                  {sellerPlan && (
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
                        backgroundColor: sellerPlan === 'premium' ? '#f5f3ff' : '#eff6ff',
                      }}
                    >
                      {sellerPlan === 'premium' ? <Sparkles size={11} color="#7c3aed" fill="#7c3aed" /> : <Star size={11} color="#2563eb" fill="#2563eb" />}
                      <Text style={{ fontSize: 10, fontWeight: '600', color: sellerPlan === 'premium' ? '#7c3aed' : '#2563eb' }}>
                        {sellerPlan === 'premium' ? 'Premium Seller' : 'Pro Seller'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
                  {service.seller_school || 'Location not specified'}
                </Text>
              </View>
            </View>
          </View>

          {/* DESCRIPTION */}
          <View style={{ ...card, padding: 20 }}>
            <Text style={{ ...sectionLabel, marginBottom: 8 }}>About this service</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 21 }}>
              {service.description}
            </Text>
          </View>

          {/* AVAILABILITY */}
          <View style={{ ...card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 10, color: colors.textFaint, fontWeight: '600', textTransform: 'uppercase' }}>Availability</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }}>{availabilitySummary}</Text>
            </View>
          </View>

          {/* BOOKING */}
          <View style={{ ...card, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} color={colors.success} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Book this service</Text>
            </View>

            {isOwner ? (
              <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.warningSoft }}>
                <Text style={{ fontSize: 13, color: colors.warning }}>
                  You're the provider — you can't book your own service.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 16, gap: 14 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel colors={colors} icon={<Calendar size={13} color={colors.textMuted} />} label="Date" />
                    <DateTimeField
                      colors={colors}
                      mode="date"
                      value={bookingDate}
                      display={toYMD(bookingDate)}
                      onChange={(d) => { setBookingDate(d); setBookingBlocked(false); }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel colors={colors} icon={<Clock size={13} color={colors.textMuted} />} label="Time" />
                    <DateTimeField
                      colors={colors}
                      mode="time"
                      value={bookingTime}
                      display={formatTime12(toHM(bookingTime))}
                      onChange={(d) => { setBookingTime(d); setBookingBlocked(false); }}
                    />
                  </View>
                </View>

                {hasScheduledHours && (
                  <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: -6 }}>
                    {allSameHours
                      ? `Available ${availability.days.map((d: any) => d.day).join(', ')} · ${formatTime12(availability.days[0].open)}–${formatTime12(availability.days[0].close)}`
                      : 'Hours vary by day — check the details above'}
                  </Text>
                )}

                <View>
                  <FieldLabel colors={colors} icon={<MessageSquare size={13} color={colors.textMuted} />} label="Message (optional)" />
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={3}
                    placeholder="Any special requests?"
                    placeholderTextColor={colors.textFaint}
                    style={{
                      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 10, minHeight: 80,
                      color: colors.text, backgroundColor: colors.card, fontSize: 14, textAlignVertical: 'top',
                    }}
                  />
                </View>

                <Pressable
                  onPress={handleBook}
                  disabled={bookDisabled}
                  style={{
                    paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 8,
                    backgroundColor: bookDisabled ? colors.chipBg : colors.brand,
                  }}
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator size="small" color={colors.textFaint} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textFaint }}>Processing…</Text>
                    </>
                  ) : !user ? (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textFaint }}>Log in to book</Text>
                  ) : bookingBlocked ? (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textFaint }}>Pick another time</Text>
                  ) : (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textOnGold }}>Pay (GHS 2) & Book</Text>
                      <ArrowRight size={15} color={colors.textOnGold} />
                    </>
                  )}
                </Pressable>

                <Text style={{ fontSize: 11, textAlign: 'center', color: colors.textFaint }}>
                  Secure checkout via Paystack
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FULLSCREEN MAP */}
      <Modal visible={isMapFullscreen} animationType="slide" onRequestClose={() => setIsMapFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {hasServiceLocation && (
            <MapView style={{ flex: 1 }} initialRegion={mapRegion}>
              <Marker coordinate={{ latitude: serviceLat as number, longitude: serviceLng as number }} title={service.title} />
              {buyerLocation && (
                <Marker
                  coordinate={{ latitude: buyerLocation.lat, longitude: buyerLocation.lng }}
                  title="You"
                  pinColor="#3b82f6"
                />
              )}
            </MapView>
          )}
          <Pressable
            onPress={() => setIsMapFullscreen(false)}
            style={{
              position: 'absolute', top: insets.top + 12, right: 16,
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.95)',
            }}
          >
            <X size={14} color="#0f172a" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a' }}>Minimize</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────
function FieldLabel({ colors, icon, label }: { colors: any; icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

function HeroVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// iOS shows the native compact picker inline; Android opens the system dialog on tap.
function DateTimeField({
  colors, mode, value, display, onChange,
}: {
  colors: any;
  mode: 'date' | 'time';
  value: Date;
  display: string;
  onChange: (d: Date) => void;
}) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'ios') {
    return (
      <View
        style={{
          height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
          backgroundColor: colors.card, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 6,
        }}
      >
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minimumDate={mode === 'date' ? new Date() : undefined}
          onChange={(_, d) => { if (d) onChange(d); }}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setShow(true)}
        style={{
          height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
          backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 14,
        }}
      >
        <Text style={{ fontSize: 14, color: colors.text }}>{display}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode={mode}
          minimumDate={mode === 'date' ? new Date() : undefined}
          onChange={(e, d) => {
            setShow(false);
            if (e.type === 'set' && d) onChange(d);
          }}
        />
      )}
    </>
  );
}