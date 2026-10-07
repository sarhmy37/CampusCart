import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import Toast from 'react-native-toast-message';
import {
  X, Clock, MapPin, Map as MapIcon, Loader2, ImagePlus, Video as VideoIcon, RefreshCw, Check,
} from 'lucide-react-native';
import api from '@/api/client';
import ModalPicker from '@/components/ModalPicker';
import LocationPickerModal from '@/components/LocationPickerModal';
import { useColors } from '@/hooks/useColors';

const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_IMAGES = 6;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const TIME_OPTIONS = (() => {
  const t: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const dh = h % 12 === 0 ? 12 : h % 12;
      t.push({ value: `${hh}:${mm}`, label: `${dh}:${mm} ${h < 12 ? 'AM' : 'PM'}` });
    }
  }
  return t;
})();

const toCharmPrice = (value: string) => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Number.isInteger(num)) return (num - 1 + 0.99).toFixed(2);
  return num.toFixed(2);
};

export default function EditServiceModal({
  product, open, onClose, onSaved,
}: { product: any; open: boolean; onClose: () => void; onSaved: () => void }) {
  const colors = useColors();

  const [form, setForm] = useState({ title: '', description: '', price: '', priceMax: '' });
  const [is247, setIs247] = useState(false);
  const [workingDays, setWorkingDays] = useState(
    WORKING_DAYS.map((day) => ({ day, enabled: false, open: '09:00', close: '17:00' }))
  );
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<'map' | 'gps' | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [previews, setPreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoMode, setPhotoMode] = useState<'idle' | 'selecting-replace'>('idle');

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  const applySchedule = (schedule: any) => {
    setIs247(!!schedule.is_24_7);
    if (Array.isArray(schedule.days) && schedule.days.length > 0) {
      setWorkingDays(
        WORKING_DAYS.map((day) => {
          const match = schedule.days.find((d: any) => d.day === day);
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
      setLocationSource('map');
    } else {
      setLocation(null);
      setLocationSource(null);
    }
  };

  const parseSchedule = (raw: any) => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

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

        const urls = (data.images || []).map((img: any) => img.image_url);
        setImageUrls(urls);
        setPreviews(urls);
        setVideoUrl(data.video_url || null);
        setVideoPreview(data.video_url || null);
      })
      .catch(() => {
        const fallback = product.primary_image ? [product.primary_image] : [];
        setImageUrls(fallback);
        setPreviews(fallback);
        setVideoUrl(product.video_url || null);
        setVideoPreview(product.video_url || null);
      });
  }, [product]);

  const toggleWorkingDay = (day: string) => {
    setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d)));
  };
  const updateWorkingDayTime = (day: string, field: 'open' | 'close', value: string) => {
    setWorkingDays((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
  };

  const uploadFile = async (file: any) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return res.data.url as string;
  };

  // ─── PHOTOS ──────────────────────────────────────────────────────
  const handleAddPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed' });
      return;
    }
    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled) return;

    const assets = result.assets.slice(0, remaining);
    const newPreviews = assets.map((a) => a.uri);
    setPreviews((prev) => [...prev, ...newPreviews]);

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const a of assets) {
        const url = await uploadFile({
          uri: a.uri,
          name: a.fileName || 'photo.jpg',
          type: a.mimeType || 'image/jpeg',
        });
        urls.push(url);
      }
      setImageUrls((prev) => [...prev, ...urls]);
      setPreviews((prev) => [...prev.slice(0, prev.length - newPreviews.length), ...urls]);
      Toast.show({ type: 'success', text1: `Uploaded ${urls.length} image(s)` });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to upload' });
      setPreviews((prev) => prev.slice(0, prev.length - newPreviews.length));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (i: number) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleReplacePhotoClick = () => {
    if (imageUrls.length === 0) {
      Toast.show({ type: 'error', text1: 'Add a photo first' });
      return;
    }
    setPhotoMode('selecting-replace');
    Toast.show({ type: 'info', text1: 'Tap the photo to replace' });
  };

  const handleThumbnailTap = async (index: number) => {
    if (photoMode !== 'selecting-replace') return;
    setPhotoMode('idle');

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setPreviews((prev) => prev.map((p, i) => (i === index ? asset.uri : p)));
    setUploading(true);
    try {
      const url = await uploadFile({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      setImageUrls((prev) => prev.map((u, i) => (i === index ? url : u)));
      setPreviews((prev) => prev.map((p, i) => (i === index ? url : p)));
      Toast.show({ type: 'success', text1: 'Photo replaced' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to replace' });
      setPreviews((prev) => prev.map((p, i) => (i === index ? imageUrls[index] : p)));
    } finally {
      setUploading(false);
    }
  };

  // ─── VIDEO ───────────────────────────────────────────────────────
  const handleVideoPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
      Toast.show({ type: 'error', text1: 'Video must be under 20MB' });
      return;
    }

    const previousUrl = videoUrl;
    setVideoPreview(asset.uri);
    setVideoUploading(true);
    try {
      const url = await uploadFile({
        uri: asset.uri,
        name: asset.fileName || 'video.mp4',
        type: asset.mimeType || 'video/mp4',
      });
      setVideoUrl(url);
      setVideoPreview(url);
      Toast.show({ type: 'success', text1: previousUrl ? 'Video replaced' : 'Video uploaded' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to upload video' });
      setVideoPreview(previousUrl);
    } finally {
      setVideoUploading(false);
    }
  };

  // ─── LOCATION ────────────────────────────────────────────────────
  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission needed' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationSource('gps');
      Toast.show({ type: 'success', text1: 'Location captured' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not get your location' });
    } finally {
      setLocating(false);
    }
  };

  // ─── SAVE ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a service title' });
      return;
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid starting price' });
      return;
    }
    if (form.priceMax && parseFloat(form.priceMax) < parseFloat(form.price)) {
      Toast.show({ type: 'error', text1: "Upper price can't be lower than starting" });
      return;
    }
    if (!is247 && workingDays.every((d) => !d.enabled)) {
      Toast.show({ type: 'error', text1: 'Select working days or 24/7' });
      return;
    }
    if (!location) {
      Toast.show({ type: 'error', text1: 'Set your service location' });
      return;
    }
    if (imageUrls.length === 0) {
      Toast.show({ type: 'error', text1: 'Add at least one photo' });
      return;
    }

    const schedule = {
      ...(is247
        ? { is_24_7: true }
        : {
            is_24_7: false,
            days: workingDays.filter((d) => d.enabled).map(({ day, open, close }) => ({ day, open, close })),
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
        images: imageUrls,
        video_url: videoUrl,
      };
      await api.patch(`/products/${product.id}`, payload);
      Toast.show({ type: 'success', text1: 'Service updated' });
      onSaved();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  if (!open || !product) return null;

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.text,
    backgroundColor: colors.inputBg,
    fontSize: 13,
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 20,
            paddingBottom: 24,
            maxHeight: '92%',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Edit service</Text>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <X size={18} color={colors.textFaint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>Service title</Text>
            <TextInput
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
              style={inputStyle}
            />

            {/* Description */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 14, marginBottom: 4 }}>Description</Text>
            <TextInput
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
              multiline
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
            />

            {/* Photos */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 16, marginBottom: 6 }}>Photos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {previews.map((uri, i) => (
                <Pressable
                  key={uri + i}
                  onPress={() => handleThumbnailTap(i)}
                  style={{
                    width: 84, height: 84, borderRadius: 12, overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: photoMode === 'selecting-replace' ? colors.brand : colors.border,
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  {photoMode === 'selecting-replace' && (
                    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                      <RefreshCw size={14} color="#fff" />
                    </View>
                  )}
                  {photoMode !== 'selecting-replace' && (
                    <Pressable
                      onPress={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 18, height: 18, borderRadius: 9,
                        backgroundColor: 'rgba(15,23,42,0.85)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={10} color="#fff" />
                    </Pressable>
                  )}
                  {i === 0 && (
                    <View style={{ position: 'absolute', bottom: 2, left: 2, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, fontWeight: '700' }}>Cover</Text>
                    </View>
                  )}
                </Pressable>
              ))}
              {uploading && (
                <View style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={handleReplacePhotoClick}
                disabled={uploading || photoMode === 'selecting-replace'}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                  paddingVertical: 8, borderRadius: 10, backgroundColor: colors.brand,
                  opacity: uploading || photoMode === 'selecting-replace' ? 0.5 : 1,
                }}
              >
                <RefreshCw size={11} color={colors.textOnGold} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textOnGold }}>Replace</Text>
              </Pressable>
              <Pressable
                onPress={handleAddPhotos}
                disabled={uploading || imageUrls.length >= MAX_IMAGES}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                  paddingVertical: 8, borderRadius: 10, backgroundColor: colors.brand,
                  opacity: uploading || imageUrls.length >= MAX_IMAGES ? 0.5 : 1,
                }}
              >
                <ImagePlus size={11} color={colors.textOnGold} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textOnGold }}>Add</Text>
              </Pressable>
            </View>

            {/* Video */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 16, marginBottom: 6 }}>Video</Text>
            {videoUploading ? (
              <View style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : videoPreview ? (
              <VideoPreview uri={videoPreview} />
            ) : (
              <View style={{ width: 84, height: 84, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <VideoIcon size={16} color={colors.textFaint} />
                <Text style={{ fontSize: 9, color: colors.textFaint, marginTop: 4 }}>No video</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={handleVideoPick}
                disabled={videoUploading || !videoUrl}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                  paddingVertical: 8, borderRadius: 10, backgroundColor: colors.brand,
                  opacity: videoUploading || !videoUrl ? 0.5 : 1,
                }}
              >
                <RefreshCw size={11} color={colors.textOnGold} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textOnGold }}>Replace</Text>
              </Pressable>
              <Pressable
                onPress={handleVideoPick}
                disabled={videoUploading || !!videoUrl}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                  paddingVertical: 8, borderRadius: 10, backgroundColor: colors.brand,
                  opacity: videoUploading || !!videoUrl ? 0.5 : 1,
                }}
              >
                <VideoIcon size={11} color={colors.textOnGold} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textOnGold }}>Add</Text>
              </Pressable>
            </View>

            {/* Price range */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 16, marginBottom: 4 }}>Price range (GHS)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v })}
                keyboardType="numeric"
                placeholder="From"
                placeholderTextColor={colors.textFaint}
                style={[inputStyle, { flex: 1 }]}
              />
              <TextInput
                value={form.priceMax}
                onChangeText={(v) => setForm({ ...form, priceMax: v })}
                keyboardType="numeric"
                placeholder="To (optional)"
                placeholderTextColor={colors.textFaint}
                style={[inputStyle, { flex: 1 }]}
              />
            </View>

            {/* Working hours */}
            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Clock size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Working hours</Text>
              </View>

              {!is247 && workingDays.map((d) => (
                <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Pressable
                    onPress={() => toggleWorkingDay(d.day)}
                    style={{
                      width: 56, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                      backgroundColor: d.enabled ? colors.brand : colors.chipBg,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: d.enabled ? colors.textOnGold : colors.textMuted }}>
                      {d.day}
                    </Text>
                  </Pressable>
                  {d.enabled ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <ModalPicker
                          value={d.open}
                          onSelect={(v) => updateWorkingDayTime(d.day, 'open', v)}
                          options={TIME_OPTIONS}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ModalPicker
                          value={d.close}
                          onSelect={(v) => updateWorkingDayTime(d.day, 'close', v)}
                          options={TIME_OPTIONS}
                        />
                      </View>
                    </>
                  ) : (
                    <Text style={{ flex: 1, fontSize: 12, color: colors.textFaint }}>Closed</Text>
                  )}
                </View>
              ))}

              <Pressable
                onPress={() => setIs247(!is247)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}
              >
                <View
                  style={{
                    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                    borderColor: is247 ? colors.brand : colors.border,
                    backgroundColor: is247 ? colors.brand : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {is247 && <Check size={12} color={colors.textOnGold} />}
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Working 24/7</Text>
              </Pressable>
            </View>

            {/* Location */}
            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <MapPin size={15} color={colors.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                  Service location <Text style={{ color: colors.error }}>*</Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setShowLocationPicker(true)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: locationSource === 'map' ? colors.brand : colors.border,
                    backgroundColor: locationSource === 'map' ? colors.brandSoft : 'transparent',
                  }}
                >
                  <MapIcon size={15} color={locationSource === 'map' ? colors.brand : colors.textMuted} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: locationSource === 'map' ? colors.brand : colors.textSecondary }}>
                    Set on map
                  </Text>
                </Pressable>
                <Pressable
                  onPress={captureLocation}
                  disabled={locating}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: locationSource === 'gps' ? colors.brand : colors.border,
                    backgroundColor: locationSource === 'gps' ? colors.brandSoft : 'transparent',
                    opacity: locating ? 0.6 : 1,
                  }}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <MapPin size={15} color={locationSource === 'gps' ? colors.brand : colors.textMuted} />
                  )}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: locationSource === 'gps' ? colors.brand : colors.textSecondary }}>
                    {locating ? 'Getting…' : 'Current'}
                  </Text>
                </Pressable>
              </View>

              {location && (
                <Text style={{ fontSize: 12, color: colors.success, marginTop: 8, fontWeight: '600' }}>
                  ✓ Location set — tap either button to update it.
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border, alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving || uploading || videoUploading}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12,
                  backgroundColor: colors.brand, alignItems: 'center',
                  opacity: saving || uploading || videoUploading ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>
                  {saving ? 'Saving…' : (uploading || videoUploading) ? 'Uploading…' : 'Save changes'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      {showLocationPicker && (
        <LocationPickerModal
          colors={colors}
          initial={location}
          onCancel={() => setShowLocationPicker(false)}
          onConfirm={(pos: { lat: number; lng: number }) => {
            setLocation(pos);
            setLocationSource('map');
            setShowLocationPicker(false);
            Toast.show({ type: 'success', text1: 'Location set' });
          }}
        />
      )}
    </Modal>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => { player.play(); }, [player]);
  return (
    <VideoView
      player={player}
      style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: '#000' }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}