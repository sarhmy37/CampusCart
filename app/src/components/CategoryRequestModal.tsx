import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator,
} from 'react-native';
import { X, HelpCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import api from '@/api/client';
import Toast from 'react-native-toast-message'; // adjust to your toast lib

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CategoryRequestModal({ open, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [categoryName, setCategoryName] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategoryName('');
    setDetails('');
  };

  const handleClose = () => {
    Keyboard.dismiss();
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!categoryName.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a short title for your suggestion' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/reports', {
        product_id: null,
        reported_user_id: null,
        reason: 'feature_suggestion',
        details: `Feature suggestion: "${categoryName.trim()}"${details.trim() ? ` — ${details.trim()}` : ''}`,
      });
      Toast.show({ type: 'success', text1: 'Request sent! Our team will review it.' });
      handleClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.error || 'Failed to send request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(2, 6, 23, 0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', maxWidth: 400 }}
          >
            {/* Stop propagation — tapping inside the card should not close */}
            <TouchableWithoutFeedback onPress={() => {}}>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 22,
                  width: '100%',
                }}
              >
                {/* Close button */}
                <Pressable
                  onPress={handleClose}
                  hitSlop={10}
                  style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, padding: 4 }}
                >
                  <X size={18} color={colors.textMuted} />
                </Pressable>

                {/* Icon */}
                <View
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: colors.brandSoft,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <HelpCircle size={20} color={colors.brand} />
                </View>

                {/* Title + subtitle */}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: colors.text,
                  }}
                >
                  Suggest a feature
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    marginTop: 6,
                    lineHeight: 19,
                  }}
                >
                  Got an idea to improve the app? Tell us what you'd like to see.
                </Text>

                {/* Inputs */}
                <View style={{ marginTop: 18, gap: 12 }}>
                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: colors.textMuted,
                        marginBottom: 6,
                        letterSpacing: 0.3,
                      }}
                    >
                      Feature title
                    </Text>
                    <TextInput
                      value={categoryName}
                      onChangeText={setCategoryName}
                      placeholder="e.g. Wishlist for saved items"
                      placeholderTextColor={colors.textFaint}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: Platform.OS === 'ios' ? 12 : 9,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        color: colors.text,
                        fontSize: 14,
                      }}
                      returnKeyType="next"
                    />
                  </View>

                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: colors.textMuted,
                        marginBottom: 6,
                        letterSpacing: 0.3,
                      }}
                    >
                      Details (optional)
                    </Text>
                    <TextInput
                      value={details}
                      onChangeText={setDetails}
                      placeholder="How would this help you or other users?"
                      placeholderTextColor={colors.textFaint}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: Platform.OS === 'ios' ? 12 : 9,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        color: colors.text,
                        fontSize: 14,
                        minHeight: 88,
                      }}
                    />
                  </View>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
                  <Pressable
                    onPress={handleClose}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.card,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.brand,
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.textOnGold} size="small" />
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textOnGold }}>
                        Send request
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}