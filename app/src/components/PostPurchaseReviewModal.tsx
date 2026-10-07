import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Star, X, ChevronDown, ImagePlus } from 'lucide-react-native';
import { useReviewPrompt } from '@/context/ReviewPromptContext';
import { useColors } from '@/hooks/useColors';

export default function PostPurchaseReviewModal() {
  const colors = useColors();
  const { groups: rawGroups, hasPending, submitReviews, skipAll } = useReviewPrompt();
  const groups = rawGroups || [];

  const [entries, setEntries] = useState<Record<string, any>>({});
  const [expandedSellers, setExpandedSellers] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const open = hasPending;

  // Reset form when a fresh batch of groups comes in
  useEffect(() => {
    if (!groups.length) return;
    const initial: Record<string, any> = {};
    groups.forEach((g: any) => {
      g.products.forEach((p: any) => {
        initial[p.product_id] = { rating: 5, comment: '', imageFile: null, imagePreview: null };
      });
    });
    setEntries(initial);
    setExpandedSellers({ [groups[0].seller_id]: true });
  }, [groups]);

  if (!open) return null;

  const toggleSeller = (sellerId: string) => {
    setExpandedSellers((prev) => ({ ...prev, [sellerId]: !prev[sellerId] }));
  };

  const setProductRating = (productId: string, rating: number) => {
    setEntries((prev) => ({ ...prev, [productId]: { ...prev[productId], rating } }));
  };

  const setProductComment = (productId: string, comment: string) => {
    setEntries((prev) => ({ ...prev, [productId]: { ...prev[productId], comment } }));
  };

  const pickProductImage = async (productId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access photos' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'Image must be under 5MB' });
      return;
    }

    const file = {
      uri: asset.uri,
      name: asset.fileName || 'review.jpg',
      type: asset.mimeType || 'image/jpeg',
    };

    setEntries((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], imageFile: file, imagePreview: asset.uri },
    }));
  };

  const removeProductImage = (productId: string) => {
    setEntries((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], imageFile: null, imagePreview: null },
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = Object.entries(entries).map(([product_id, v]: any) => ({
        product_id,
        rating: v.rating,
        comment: (v.comment || '').trim(),
        imageFile: v.imageFile,
      }));
      await submitReviews(payload);
      Toast.show({ type: 'success', text1: 'Reviews submitted!' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to submit some reviews' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await skipAll();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleSkip}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            maxHeight: '85%',
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleSkip}
            disabled={submitting}
            style={{ position: 'absolute', top: 14, right: 14, padding: 6, zIndex: 10 }}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>

          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
            How was it?
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            Rate the items you received.
          </Text>

          <ScrollView
            style={{ marginTop: 16, maxHeight: 480 }}
            contentContainerStyle={{ gap: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group: any) => {
              const isExpanded = !!expandedSellers[group.seller_id];
              return (
                <View
                  key={group.seller_id}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                  }}
                >
                  <Pressable
                    onPress={() => toggleSeller(group.seller_id)}
                    disabled={submitting}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    }}
                  >
                    {group.seller_avatar ? (
                      <Image
                        source={{ uri: group.seller_avatar }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: colors.brandSoft,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontWeight: '800', color: colors.brand, fontSize: 13 }}>
                          {group.seller_name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                        {group.seller_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textFaint }}>
                        {group.products.length} item{group.products.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <ChevronDown
                      size={16}
                      color={colors.textMuted}
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                  </Pressable>

                  {isExpanded && (
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingBottom: 14,
                        paddingTop: 12,
                        gap: 16,
                        borderTopWidth: 1,
                        borderTopColor: colors.borderMuted,
                      }}
                    >
                      {group.products.map((product: any) => {
                        const entry = entries[product.product_id] || { rating: 5, comment: '', imageFile: null, imagePreview: null };
                        return (
                          <View key={product.product_id}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                              {product.title}
                            </Text>

                            {/* Stars */}
                            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Pressable
                                  key={n}
                                  onPress={() => setProductRating(product.product_id, n)}
                                  disabled={submitting}
                                >
                                  <Star
                                    size={22}
                                    color={n <= entry.rating ? '#f59e0b' : colors.border}
                                    fill={n <= entry.rating ? '#f59e0b' : 'transparent'}
                                  />
                                </Pressable>
                              ))}
                            </View>

                            <TextInput
                              value={entry.comment}
                              onChangeText={(v) => setProductComment(product.product_id, v)}
                              placeholder="Optional — share how it went."
                              placeholderTextColor={colors.textFaint}
                              multiline
                              editable={!submitting}
                              style={{
                                width: '100%',
                                marginTop: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.inputBg,
                                color: colors.text,
                                fontSize: 12,
                                minHeight: 44,
                                textAlignVertical: 'top',
                              }}
                            />

                            {entry.imagePreview ? (
                              <View style={{ position: 'relative', marginTop: 8, width: 76, height: 76 }}>
                                <Image
                                  source={{ uri: entry.imagePreview }}
                                  style={{ width: 76, height: 76, borderRadius: 10 }}
                                  contentFit="cover"
                                />
                                <Pressable
                                  onPress={() => removeProductImage(product.product_id)}
                                  disabled={submitting}
                                  style={{
                                    position: 'absolute',
                                    top: -6, right: -6,
                                    width: 20, height: 20,
                                    borderRadius: 10,
                                    backgroundColor: 'rgba(15,23,42,0.85)',
                                    alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <X size={11} color="#fff" />
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => pickProductImage(product.product_id)}
                                disabled={submitting}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  marginTop: 8,
                                }}
                              >
                                <ImagePlus size={14} color={colors.brand} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>
                                  Add photo
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Pressable
              onPress={handleSkip}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                Skip
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.brand,
                alignItems: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.textOnGold} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textOnGold }}>
                  Submit reviews
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}