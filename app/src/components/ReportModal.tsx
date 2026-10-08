import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, Keyboard } from 'react-native';
import { Flag, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '@/api/client';
import ModalPicker from '@/components/ModalPicker';
import { useColors } from '@/hooks/useColors';

const REASONS = [
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'fake_listing', label: 'Fake or misleading listing' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment or unsafe behavior' },
  { value: 'account_security', label: 'Suspicious account access' },
  { value: 'other', label: 'Something else' },
];

export default function ReportModal({
  visible,
  open,
  onClose,
  productId,
  reportedUserId,
  publicReporterId,
  initialReason,
  initialDetails,
  title,
  subtitle,
}: {
  visible?: boolean;
  open?: boolean;
  onClose: () => void;
  productId?: string | number | null;
  reportedUserId?: string | number | null;
  publicReporterId?: string | number | null;
  initialReason?: string;
  initialDetails?: string;
  title?: string;
  subtitle?: string;
}) {
  const colors = useColors();
  const isVisible = visible ?? open ?? false;

  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Seed initial values when the modal opens
  useEffect(() => {
    if (isVisible) {
      setReason(initialReason || '');
      setDetails(initialDetails || '');
    }
  }, [isVisible, initialReason, initialDetails]);

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setDetails('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) {
      Toast.show({ type: 'error', text1: 'Select a reason' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/reports', {
        product_id: productId || null,
        reported_user_id: reportedUserId || null,
        public_reporter_id: publicReporterId || null,
        reason,
        details: details.trim() || null,
      });
      Toast.show({ type: 'success', text1: 'Report submitted. Our team will review it.' });
      handleClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to submit report' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 20 }}
        onPress={handleClose}
      >
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            Keyboard.dismiss();
          }}
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Pressable onPress={handleClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <X size={18} color={colors.textFaint} />
          </Pressable>

          <View
            style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: colors.errorSoft,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Flag size={20} color={colors.error} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
            {title || 'Report this listing'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6 }}>
            {subtitle || "Let us know what's wrong. Our team will review it shortly."}
          </Text>

          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 20 }}>
            Reason
          </Text>
          <View style={{ marginTop: 6 }}>
            <ModalPicker
              value={reason}
              onSelect={setReason}
              placeholder="Select a reason"
              options={REASONS.map((r) => ({ label: r.label, value: r.value }))}
            />
          </View>

          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 16 }}>
            Details (optional)
          </Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Anything that helps us understand what happened"
            placeholderTextColor={colors.textFaint}
            multiline
            numberOfLines={3}
            style={{
              marginTop: 6,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              fontSize: 14,
              color: colors.text,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
            <Pressable
              onPress={handleClose}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: colors.error,
                alignItems: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>
                {submitting ? 'Submitting…' : 'Submit report'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      <Toast />
    </Modal>
  );
}