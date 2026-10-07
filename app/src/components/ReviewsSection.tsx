import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Star, ThumbsUp, MessageSquare, X, Send, ImagePlus } from 'lucide-react-native';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function ReviewsSection({ reviewsData, productId }: { reviewsData: any; productId: any }) {
  const colors = useColors();
  const { user } = useAuth();
  const [data, setData] = useState<any>(reviewsData || null);
  const [loading, setLoading] = useState(!reviewsData);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [canReview, setCanReview] = useState(false);

  const load = () => {
    if (!productId) return;
    setLoading(true);
    api.get(`/reviews/product/${productId}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadCanReview = () => {
    if (!productId || !user) return setCanReview(false);
    api.get(`/reviews/can-review-product/${productId}`)
      .then((res) => setCanReview(!!res.data?.can_review))
      .catch(() => setCanReview(false));
  };

  useEffect(() => {
    if (reviewsData) {
      setData(reviewsData);
      setLoading(false);
    } else if (productId) {
      load();
    }
  }, [reviewsData, productId]);

  useEffect(() => { loadCanReview(); }, [productId, user]);

  const refresh = () => load();

  if (loading) {
    return (
      <View style={{ marginTop: 24, backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ height: 60, borderRadius: 12, backgroundColor: colors.cardAlt }} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 24, backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Reviews</Text>
          {data?.avg_rating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{data.avg_rating}</Text>
              <Text style={{ fontSize: 14, color: colors.textFaint }}>({data.total})</Text>
            </View>
          )}
        </View>
        {canReview && (
          <Pressable onPress={() => setShowReviewModal(true)}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>+ Add review</Text>
          </Pressable>
        )}
      </View>

      {!data?.reviews?.length ? (
        <Text style={{ fontSize: 14, color: colors.textFaint }}>No reviews yet for this product.</Text>
      ) : (
        <View style={{ gap: 16 }}>
          {data.reviews.map((r: any) => (
            <ReviewCard key={r.id} review={r} onChanged={refresh} />
          ))}
        </View>
      )}

      <ReviewModal
        visible={showReviewModal}
        productId={productId}
        onClose={() => setShowReviewModal(false)}
        onSubmitted={() => { setShowReviewModal(false); refresh(); loadCanReview(); }}
      />
    </View>
  );
}

function ReviewCard({ review, onChanged }: { review: any; onChanged: () => void }) {
  const colors = useColors();
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLike = async () => {
    if (!user) return Toast.show({ type: 'error', text1: 'Log in to like reviews' });
    try {
      await api.post(`/reviews/product/${review.id}/like`);
      onChanged();
    } catch {
      Toast.show({ type: 'error', text1: 'Something went wrong' });
    }
  };

  const handleComment = async () => {
    if (!user) return Toast.show({ type: 'error', text1: 'Log in to comment' });
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/reviews/product/${review.id}/comments`, { content: commentText.trim() });
      setCommentText('');
      onChanged();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to add comment' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{review.reviewer_name || 'Anonymous'}</Text>
        <View style={{ flexDirection: 'row' }}>
          {Array.from({ length: 5 }).map((_, s) => (
            <Star key={s} size={12} color={s < review.rating ? '#f59e0b' : colors.border} fill={s < review.rating ? '#f59e0b' : 'transparent'} />
          ))}
        </View>
      </View>

      {review.comment && <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>{review.comment}</Text>}
      {review.image_url && (
        <Image source={{ uri: review.image_url }} style={{ width: 80, height: 80, borderRadius: 8, marginTop: 8 }} cachePolicy="disk" />
      )}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <Pressable onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ThumbsUp size={13} color={review.liked_by_me ? colors.brand : colors.textFaint} fill={review.liked_by_me ? colors.brand : 'transparent'} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: review.liked_by_me ? colors.brand : colors.textFaint }}>
            {review.like_count || 0}
          </Text>
        </Pressable>
        <Pressable onPress={() => setShowComments((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={13} color={colors.textFaint} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textFaint }}>{review.comments?.length || 0}</Text>
        </Pressable>
      </View>

      {showComments && (
        <View style={{ marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.borderMuted, gap: 10 }}>
          {review.comments?.map((c: any) => (
            <View key={c.id}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{c.commenter_name}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{c.content}</Text>
            </View>
          ))}
          {user && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment…"
                placeholderTextColor={colors.textFaint}
                style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, fontSize: 12, backgroundColor: colors.inputBg, color: colors.text }}
              />
              <Pressable onPress={handleComment} disabled={submitting || !commentText.trim()}>
                <Send size={15} color={commentText.trim() ? colors.brand : colors.textFaint} />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ReviewModal({
  visible, productId, onClose, onSubmitted,
}: {
  visible: boolean; productId: any; onClose: () => void; onSubmitted: () => void;
}) {
  const colors = useColors();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [imageAsset, setImageAsset] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImagePick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setImageAsset(result.assets[0]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('product_id', String(productId));
      form.append('rating', String(rating));
      if (comment.trim()) form.append('comment', comment.trim());
      if (imageAsset) {
        form.append('image', {
          uri: imageAsset.uri,
          name: imageAsset.fileName || 'review.jpg',
          type: imageAsset.mimeType || 'image/jpeg',
        } as any);
      }
      await api.post('/reviews/product', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      Toast.show({ type: 'success', text1: 'Review submitted!' });
      setComment(''); setRating(5); setImageAsset(null);
      onSubmitted();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to submit review' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
          <Pressable onPress={onClose} style={{ position: 'absolute', top: 16, right: 16 }}>
            <X size={18} color={colors.textFaint} />
          </Pressable>

          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Rate this product</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>Based on your completed purchase.</Text>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Star size={26} color={n <= rating ? '#f59e0b' : colors.border} fill={n <= rating ? '#f59e0b' : 'transparent'} />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Optional — share your experience with the product."
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              marginTop: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
              borderWidth: 1, borderColor: colors.border, fontSize: 14, minHeight: 80, textAlignVertical: 'top',
              color: colors.text, backgroundColor: colors.inputBg,
            }}
          />

          {imageAsset ? (
            <View style={{ marginTop: 12, position: 'relative', width: 80, height: 80 }}>
                      <Image source={{ uri: imageAsset.uri }} style={{ width: 80, height: 80, borderRadius: 8 }} cachePolicy="disk" />
              <Pressable onPress={() => setImageAsset(null)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: colors.text, borderRadius: 10, padding: 2 }}>
                <X size={11} color={colors.card} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={handleImagePick} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <ImagePlus size={14} color={colors.brand} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>Add photo of the item</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={{ marginTop: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}