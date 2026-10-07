import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { X, ImagePlus, Loader2, Video as VideoIcon, RefreshCw } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import api from '@/api/client';
import ModalPicker from '@/components/ModalPicker';
import { useColors } from '@/hooks/useColors';

const MAX_IMAGES = 6;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const toCharmPrice = (value: string) => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Number.isInteger(num)) return (num - 1 + 0.99).toFixed(2);
  return num.toFixed(2);
};

export default function EditListingModal({
  product, open, onClose, onSaved,
}: { product: any; open: boolean; onClose: () => void; onSaved: () => void }) {
  const colors = useColors();

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    condition: 'good',
    stock: '1',
    category: '',
    delivery_fee_on_campus: '',
    delivery_fee_near_campus: '',
    delivery_fee_far_campus: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [previews, setPreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoMode, setPhotoMode] = useState<'idle' | 'selecting-replace'>('idle');
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  useEffect(() => {
    api.get('/categories')
      .then((res) => {
        const list = [...res.data].sort((a: any, b: any) =>
          (a.name === 'Other' ? 1 : 0) - (b.name === 'Other' ? 1 : 0)
        );
        setCategories(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (product?.id) {
      api.get(`/products/${product.id}`)
        .then((res) => {
          const urls = (res.data.images || []).map((img: any) => img.image_url);
          setImageUrls(urls);
          setPreviews(urls);
          setVideoUrl(res.data.video_url || null);
          setVideoPreview(res.data.video_url || null);
        })
        .catch(() => {
          const fallback = product.primary_image ? [product.primary_image] : [];
          setImageUrls(fallback);
          setPreviews(fallback);
          setVideoUrl(product.video_url || null);
          setVideoPreview(product.video_url || null);
        });
    }
  }, [product?.id]);

  useEffect(() => {
    if (product) {
      setForm({
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        condition: product.condition || 'good',
        stock: String(product.stock ?? 1),
        category: product.category || '',
        delivery_fee_on_campus: String(product.delivery_fee_on_campus ?? ''),
        delivery_fee_near_campus: String(product.delivery_fee_near_campus ?? ''),
        delivery_fee_far_campus: String(product.delivery_fee_far_campus ?? ''),
      });
    }
  }, [product]);

  const uploadFile = async (file: any) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return res.data.url as string;
  };

  // ─── IMAGES ──────────────────────────────────────────────────────
  const handleAddPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed' });
      return;
    }
    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) {
      Toast.show({ type: 'error', text1: `Max ${MAX_IMAGES} images.` });
      return;
    }
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
    setReplaceIndex(index);
    setPhotoMode('idle');

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) {
      setReplaceIndex(null);
      return;
    }
    const asset = result.assets[0];
    const blobPreview = asset.uri;
    setPreviews((prev) => prev.map((p, i) => (i === index ? blobPreview : p)));

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
      setReplaceIndex(null);
    }
  };

  // ─── VIDEO ───────────────────────────────────────────────────────
  const handleVideoButtonClick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed' });
      return;
    }
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

  // ─── PRICE PREVIEW ───────────────────────────────────────────────
  const currentSavedPrice = product ? parseFloat(product.price) : null;
  const newPrice = parseFloat(toCharmPrice(form.price));
  const discount =
    currentSavedPrice && newPrice && currentSavedPrice > newPrice && currentSavedPrice > 0 && newPrice > 0
      ? Math.round(((currentSavedPrice - newPrice) / currentSavedPrice) * 100)
      : null;

  // ─── SAVE ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (imageUrls.length === 0) {
      Toast.show({ type: 'error', text1: 'Add at least one photo' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: toCharmPrice(form.price),
        images: imageUrls,
        video_url: videoUrl,
      };
      await api.patch(`/products/${product.id}`, payload);
      Toast.show({ type: 'success', text1: 'Listing updated' });
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
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Edit listing</Text>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <X size={18} color={colors.textFaint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>Title</Text>
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

            {/* Price section */}
            <View style={{ backgroundColor: colors.chipBg, borderRadius: 14, padding: 12, marginTop: 14, borderWidth: 1, borderColor: colors.borderMuted }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8 }}>Price</Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>Current (read-only)</Text>
                  <TextInput
                    value={currentSavedPrice ? String(currentSavedPrice) : ''}
                    editable={false}
                    style={[inputStyle, { marginTop: 4, opacity: 0.6 }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>New price</Text>
                  <TextInput
                    value={form.price}
                    onChangeText={(v) => setForm({ ...form, price: v })}
                    keyboardType="numeric"
                    style={[inputStyle, { marginTop: 4 }]}
                  />
                </View>
              </View>

              <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 6 }}>
                Lowering below the current price shows as a sale to buyers.
              </Text>

              {discount !== null && (
                <View style={{ marginTop: 8, padding: 8, borderRadius: 10, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.success }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>
                    🎉 This will show as -{discount}% off
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.success, marginTop: 2 }}>
                    GHS {currentSavedPrice!.toFixed(2)} → GHS {toCharmPrice(form.price)}
                  </Text>
                </View>
              )}
            </View>

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

            <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 6 }}>
              Up to {MAX_IMAGES}. First is cover.{photoMode === 'selecting-replace' && ' Tap a photo to replace it.'}
            </Text>

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
                onPress={handleVideoButtonClick}
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
                onPress={handleVideoButtonClick}
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

            {/* Delivery fees */}
            <View style={{ backgroundColor: colors.chipBg, borderRadius: 14, padding: 12, marginTop: 16, borderWidth: 1, borderColor: colors.borderMuted }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8 }}>Delivery fees</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>On campus</Text>
                  <TextInput
                    value={form.delivery_fee_on_campus}
                    onChangeText={(v) => setForm({ ...form, delivery_fee_on_campus: v })}
                    keyboardType="numeric"
                    style={[inputStyle, { paddingVertical: 8, marginTop: 4 }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>Near</Text>
                  <TextInput
                    value={form.delivery_fee_near_campus}
                    onChangeText={(v) => setForm({ ...form, delivery_fee_near_campus: v })}
                    keyboardType="numeric"
                    style={[inputStyle, { paddingVertical: 8, marginTop: 4 }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>Far</Text>
                  <TextInput
                    value={form.delivery_fee_far_campus}
                    onChangeText={(v) => setForm({ ...form, delivery_fee_far_campus: v })}
                    keyboardType="numeric"
                    style={[inputStyle, { paddingVertical: 8, marginTop: 4 }]}
                  />
                </View>
              </View>
            </View>

            {/* Stock + Condition */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>Stock</Text>
                <TextInput
                  value={form.stock}
                  onChangeText={(v) => setForm({ ...form, stock: v })}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>Condition</Text>
                <ModalPicker
                  value={form.condition}
                  onSelect={(v) => setForm({ ...form, condition: v })}
                  options={CONDITIONS}
                />
              </View>
            </View>

            {/* Category */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 14, marginBottom: 4 }}>Category</Text>
            <ModalPicker
              value={form.category}
              onSelect={(v) => setForm({ ...form, category: v })}
              placeholder="Select"
              options={categories.map((c) => ({ label: c.name, value: c.name }))}
            />

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