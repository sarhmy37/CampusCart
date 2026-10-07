import { useRef, useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { X, Check, Upload } from 'lucide-react-native';
import { WALLPAPER_PRESETS } from '../data/wallpapers';
import { useChat } from '../context/ChatContext';
import { useColors } from '../hooks/useColors';

export default function WallpaperPicker({
  open,
  onClose,
  currentUserId,
  isPlanActive,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
  isPlanActive?: boolean;
}) {
  const colors = useColors();
  const {
    wallpaper, setWallpaperPreset, uploadWallpaper, uploadingWallpaper, hideWallpaperForMe,
  } = useChat();

  const [staged, setStaged] = useState<
    { kind: 'preset'; preset: any } | { kind: 'custom'; file: any; previewUrl: string } | null
  >(null);
  const [applying, setApplying] = useState(false);
  const [togglingHide, setTogglingHide] = useState(false);
  const [planError, setPlanError] = useState(false);

  const hasSharedWallpaper = wallpaper && wallpaper.type && wallpaper.type !== 'none';
  const iSetIt = hasSharedWallpaper && wallpaper.set_by === currentUserId;
  const someoneElseSetIt = hasSharedWallpaper && !iSetIt;

  const handleToggleHideForMe = async () => {
    setTogglingHide(true);
    try {
      await hideWallpaperForMe(!wallpaper?.hidden_for_me);
    } finally {
      setTogglingHide(false);
    }
  };

  const handlePresetClick = (preset: any) => {
    setStaged({ kind: 'preset', preset });
  };

  const handlePickImage = async () => {
    if (!isPlanActive) {
      setPlanError(true);
      return;
    }
    setPlanError(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access photos' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const file = {
      uri: asset.uri,
      name: asset.fileName || 'wallpaper.jpg',
      type: asset.mimeType || 'image/jpeg',
    };
    setStaged({ kind: 'custom', file, previewUrl: asset.uri });
  };

  const isCurrentlyActive = (preset: any) => {
    if (preset.id === 'default') return !wallpaper || wallpaper.type === 'none';
    return wallpaper?.type === 'preset' && wallpaper?.value === preset.value;
  };

  const isHighlighted = (preset: any) => {
    if (staged?.kind === 'preset') return staged.preset.id === preset.id;
    if (staged?.kind === 'custom') return false;
    return isCurrentlyActive(preset);
  };

  const handleSet = async () => {
    if (!staged) return;
    setApplying(true);
    try {
      if (staged.kind === 'preset') {
        if (staged.preset.id === 'default') {
          await setWallpaperPreset('none', null);
        } else {
          await setWallpaperPreset('preset', staged.preset.value);
        }
      } else if (staged.kind === 'custom') {
        await uploadWallpaper(staged.file);
      }
      setStaged(null);
    } finally {
      setApplying(false);
    }
  };

  const busy = applying || uploadingWallpaper;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '85%',
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              top: 14, right: 14,
              padding: 6,
              borderRadius: 8,
              zIndex: 10,
            }}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>

          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
            Chat wallpaper
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
            This changes how this chat looks for both of you.
          </Text>

          <ScrollView
            style={{ marginTop: 16 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Preset grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
              {WALLPAPER_PRESETS.map((preset) => {
                const highlighted = isHighlighted(preset);
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => handlePresetClick(preset)}
                    style={{ width: '25%', paddingHorizontal: 6, marginBottom: 12 }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: '100%',
                          aspectRatio: 1,
                          borderRadius: 12,
                          overflow: 'hidden',
                          borderWidth: 2,
                          borderColor: highlighted ? colors.brand : colors.border,
                        }}
                      >
                        {preset.preview ? (
                          preset.preview.length > 1 ? (
                            <LinearGradient
                              colors={preset.preview as any}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{ flex: 1 }}
                            />
                          ) : (
                            <View style={{ flex: 1, backgroundColor: preset.preview[0] }} />
                          )
                        ) : (
                          <View
                            style={{
                              flex: 1,
                              backgroundColor: colors.background,
                            }}
                          />
                        )}

                        {highlighted && (
                          <View
                            style={{
                              position: 'absolute',
                              top: -6, right: -6,
                              width: 20, height: 20,
                              borderRadius: 10,
                              backgroundColor: colors.brand,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={12} color={colors.textOnGold} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          marginTop: 4,
                          textAlign: 'center',
                        }}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom upload */}
            <View
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: colors.borderMuted,
              }}
            >
              <Pressable
                onPress={handlePickImage}
                disabled={busy}
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    staged?.kind === 'custom'
                      ? colors.brand
                      : colors.border,
                  borderStyle: staged?.kind === 'custom' ? 'solid' : 'dashed',
                  backgroundColor:
                    staged?.kind === 'custom' ? colors.brandSoft : 'transparent',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Upload
                  size={16}
                  color={staged?.kind === 'custom' ? colors.brand : colors.textSecondary}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color:
                      staged?.kind === 'custom'
                        ? colors.brand
                        : colors.textSecondary,
                  }}
                >
                  {staged?.kind === 'custom'
                    ? 'Image selected — tap Set to apply'
                    : 'Upload custom image'}
                </Text>
              </Pressable>

              {planError && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.error,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Custom images are for Pro and Premium members
                </Text>
              )}

              {staged?.kind === 'custom' && (
                <Image
                  source={{ uri: staged.previewUrl }}
                  style={{
                    width: '100%',
                    height: 112,
                    borderRadius: 12,
                    marginTop: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  contentFit="cover"
                />
              )}

              {wallpaper?.type === 'custom' && !staged && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textFaint,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Custom image currently applied
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Set button */}
          <Pressable
            onPress={handleSet}
            disabled={!staged || busy}
            style={{
              width: '100%',
              marginTop: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: !staged || busy ? 0.4 : 1,
            }}
          >
            {busy ? (
              <>
                <ActivityIndicator size="small" color={colors.textOnGold} />
                <Text
                  style={{
                    color: colors.textOnGold,
                    fontSize: 14,
                    fontWeight: '700',
                  }}
                >
                  Setting…
                </Text>
              </>
            ) : (
              <Text
                style={{
                  color: colors.textOnGold,
                  fontSize: 14,
                  fontWeight: '700',
                }}
              >
                Set wallpaper
              </Text>
            )}
          </Pressable>

          {/* Owner: remove for both */}
          {iSetIt && !staged && (
            <Pressable
              onPress={async () => {
                setTogglingHide(true);
                try {
                  await setWallpaperPreset('none', null);
                } finally {
                  setTogglingHide(false);
                }
              }}
              disabled={togglingHide}
              style={{
                width: '100%',
                marginTop: 8,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.error,
                alignItems: 'center',
                opacity: togglingHide ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.error,
                  fontSize: 14,
                  fontWeight: '600',
                }}
              >
                {togglingHide ? 'Removing…' : 'Remove wallpaper'}
              </Text>
            </Pressable>
          )}

          {/* Non-owner: personal hide toggle */}
          {someoneElseSetIt && !staged && (
            <Pressable
              onPress={handleToggleHideForMe}
              disabled={togglingHide}
              style={{
                width: '100%',
                marginTop: 8,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                opacity: togglingHide ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: '600',
                }}
              >
                {togglingHide
                  ? 'Updating…'
                  : wallpaper?.hidden_for_me
                    ? 'Show wallpaper for me'
                    : 'Disable wallpaper for me'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      <Toast />
    </Modal>
  );
}