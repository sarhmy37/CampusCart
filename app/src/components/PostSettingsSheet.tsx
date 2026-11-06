import { View, Text, Pressable, Modal, Switch } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export type PostSettingsT = {
  allow_chat: boolean;
  show_likes: boolean;
  allow_repost: boolean;
  allow_export: boolean;
};

const ROWS: { key: keyof PostSettingsT; label: string }[] = [
  { key: 'allow_chat', label: 'Allow chat' },
  { key: 'show_likes', label: 'Show like count' },
  { key: 'allow_repost', label: 'Allow reposts' },
  { key: 'allow_export', label: 'Allow downloads' },
];

export default function PostSettingsSheet({
  visible, settings, onChange, onClose, allowDefault = true, title = 'Post settings',
  commentsOff, onToggleComments, onEditCaption,
}: {
  visible: boolean;
  settings: Partial<PostSettingsT>;
  onChange: (key: keyof PostSettingsT, value: boolean | undefined) => void;
  onClose: () => void;
  allowDefault?: boolean;
  title?: string;
  commentsOff?: boolean;
  onToggleComments?: () => void;
  onEditCaption?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const rowStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    height: 52, borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
  };
  const label = { fontSize: 16, fontWeight: '600' as const, color: colors.text };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
        />
        <View
          style={{
            backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 8,
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>
            {title}
          </Text>

          {onToggleComments && (
            <View style={rowStyle}>
              <Text style={label}>Comments</Text>
              <Switch
                value={!commentsOff}
                onValueChange={onToggleComments}
                trackColor={{ true: colors.brand }}
              />
            </View>
          )}

          {ROWS.map((r) => (
            <View key={r.key} style={rowStyle}>
              <Text style={label}>{r.label}</Text>
              <Switch
                value={settings[r.key] !== false}
                onValueChange={(v) => onChange(r.key, v)}
                trackColor={{ true: colors.brand }}
              />
            </View>
          ))}

          {onEditCaption && (
            <Pressable
              onPress={() => { onClose(); setTimeout(onEditCaption, 250); }}
              style={[rowStyle, { borderBottomWidth: 0 }]}
            >
              <Text style={label}>Edit caption</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}