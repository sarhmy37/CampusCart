import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

type Option = { label: string; value: string };

export default function ModalPicker({
  value,
  options,
  onSelect,
  placeholder = 'Select',
  disabled = false,
  showValueOnly = false,
  style,
}: {
  value: string;
  options: Option[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showValueOnly?: boolean;
  style?: any;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={[
          {
            height: 46,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            color: selected ? colors.text : colors.textFaint,
            flex: 1,
          }}
        >
          {selected ? (showValueOnly ? selected.value : selected.label) : placeholder}
        </Text>
        <ChevronDown size={16} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{ backgroundColor: colors.card, borderRadius: 20, maxHeight: 460, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
          >
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderMuted }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{placeholder}</Text>
            </View>
            <ScrollView>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value || '__empty'}
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      backgroundColor: isSelected ? colors.brandSoft : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSelected ? colors.brand : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                        flex: 1,
                      }}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && <Check size={16} color={colors.brand} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}