import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, TextInput,
  Animated, Dimensions, ActivityIndicator,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import Toast from 'react-native-toast-message';
import {
  X, Send, Loader2, Paperclip, Mic, Check, CheckCheck,
  MoreVertical, Trash2, Volume2, VolumeX, Flag, Image as ImageIcon, Ban, ShoppingBag,
  Video as VideoIcon, FileText, Phone,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useChat } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../hooks/useColors';
import { parseWallpaper } from '../data/wallpapers';
import WallpaperPicker from './WallpaperPicker';
import ReportModal from './ReportModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(SCREEN_WIDTH , 450);
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const TREX_ID = '09dabd6c-c9ea-440d-b42a-0ba1d9011e8a';

function formatMessageTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatPresence(lastActiveAt?: string | null) {
  if (!lastActiveAt) return '';
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return 'Active now';
  if (diffMin < 60) return `Last active ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Last active ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `Last active ${diffDay}d ago`;
}

function isSingleEmoji(text?: string | null) {
  if (!text) return false;
  return /^\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*$/u.test(text.trim());
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ChatModal() {
  const colors = useColors();
  const { user } = useAuth();
  const isPlanActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();

const {
  isOpen,
  conversation,
  messages,
  loading,
  uploading,
  otherUserLastActive,

  closeChat,
  sendMessage,
  sendMedia,
  wallpaper,
  deleteForMe,
  deleteForEveryone,

  deleteMessageForMe,
  deleteMessageForEveryone,

  pendingDraft,
  clearPendingDraft,

  isMuted,
  toggleMute,

  pendingStoryReply,
  clearPendingStoryReply,

  pendingAutoRecord,
  clearPendingAutoRecord,
} = useChat();
  const router = useRouter();
  const { startCall } = useCall();

  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messageMenu, setMessageMenu] = useState<{ id: number; isMine: boolean } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const slideX = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // ─── expo-audio recorder ───
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: PANEL_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen]);

  // Seed draft from pendingDraft
  useEffect(() => {
    if (isOpen && conversation) {
      setDraft(pendingDraft || '');
      if (pendingDraft) clearPendingDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversation?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length, isOpen]);

  // Cleanup recording on close
  useEffect(() => {
    if (!isOpen && isRecording) {
      stopRecordingAndCancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const closeEverything = () => {
    setShowSettingsMenu(false);
    closeChat();
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft('');
  };

    const handleOpenStory = (storyId: string) => {
    closeChat();
    router.push({ pathname: '/stories', params: { openStoryId: storyId } });
  };

  const handleOpenOrder = (orderId: string) => {
    closeChat();
    router.push({ pathname: '/dashboard', params: { tab: 'deliveries', highlightOrder: orderId } });
  };

  const handlePickPicture = async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access photos' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await sendMedia({
      uri: asset.uri,
      name: asset.fileName || 'photo.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const handlePickVideo = async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission needed to access videos' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await sendMedia({
      uri: asset.uri,
      name: asset.fileName || 'video.mp4',
      type: asset.mimeType || 'video/mp4',
    });
  };

  const handlePickFile = async () => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await sendMedia({
      uri: asset.uri,
      name: asset.name || 'file',
      type: asset.mimeType || 'application/octet-stream',
    });
  };

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Microphone permission needed' });
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not start recording' });
    }
  };
  // Auto-start a voice note when arriving from an unanswered call
useEffect(() => {
  if (!isOpen || loading || !conversation || !pendingAutoRecord) return;
  clearPendingAutoRecord();
  const t = setTimeout(() => startRecording(), 300);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen, loading, conversation?.id, pendingAutoRecord]);

  const stopRecordingAndSend = async () => {
    clearInterval(recordingTimerRef.current);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setIsRecording(false);
      setRecordingSeconds(0);
      if (uri) {
        await sendMedia({
          uri,
          name: 'voice-note.m4a',
          type: 'audio/m4a',
        });
      }
    } catch (err) {
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  const stopRecordingAndCancel = async () => {
    clearInterval(recordingTimerRef.current);
    try {
      await recorder.stop();
    } catch {}
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const openMedia = async (m: any) => {
    try {
      const base64 = m.media_url.split(',')[1];
      const ext = m.media_type === 'video' ? 'mp4' : (m.content?.split('.').pop() || 'bin');
      const path = `${FileSystem.cacheDirectory}${m.media_type}-${m.id}.${ext}`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open file' });
    }
  };

  const handleDeleteForMe = async () => {
    setDeleting(true);
    try {
      await deleteForMe();
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    setDeleting(true);
    try {
      await deleteForEveryone();
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleLongPressMessage = (m: any, isMine: boolean) => {
    setMessageMenu({ id: m.id, isMine });
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleMessageAction = async (action: 'me' | 'everyone') => {
    if (!messageMenu) return;
    const id = messageMenu.id;
    setMessageMenu(null);
    if (action === 'me') await deleteMessageForMe(id);
    else await deleteMessageForEveryone(id);
  };

  const isTrexChat = conversation?.otherUserId === TREX_ID;
  const lockedTrex = isTrexChat && !conversation?.allowReplies;

  const wallpaperParsed = parseWallpaper(wallpaper);
  const renderWallpaperBackground = () => {
    if (wallpaperParsed.kind === 'none') return { backgroundColor: '#EFEAFB' };
    if (wallpaperParsed.kind === 'color') return { backgroundColor: wallpaperParsed.color };
    return { backgroundColor: colors.background };
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeEverything}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'transparent' }}>
        <Animated.View style={{ flex: 1, opacity: fadeIn }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            onPress={closeEverything}
          />
        </Animated.View>

         <Animated.View
          style={{
            width: PANEL_WIDTH,
            transform: [{ translateX: slideX }],
            borderTopLeftRadius: 24,
            borderBottomLeftRadius: 24,
            borderTopRightRadius: 24,
            borderBottomRightRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: -4, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <Pressable
              onPress={Keyboard.dismiss}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingTop: insets.top + 10,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderMuted,
                backgroundColor: colors.card,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {!isTrexChat && (
                  <Pressable onPress={() => setShowSettingsMenu((v) => !v)} style={{ padding: 6 }}>
                    <MoreVertical size={18} color={colors.textMuted} />
                  </Pressable>
                )}

                {conversation?.otherUserAvatar ? (
                  <Image
                    source={{ uri: conversation.otherUserAvatar }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: colors.brandSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: colors.brand, fontSize: 14 }}>
                      {conversation?.otherUserName?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>
                    {conversation?.otherUserName || 'Chat'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                    {!loading && formatPresence(otherUserLastActive) === 'Active now' && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
                    )}
                    <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11 }}>
                      {loading ? 'Connecting…' : formatPresence(otherUserLastActive)}
                    </Text>
                  </View>
                </View>
              </View>

              {!isTrexChat && (
                <Pressable
                  onPress={() => {
                    if (!conversation) return;
                    const c = conversation;
                    closeChat();
                    startCall(c.otherUserId, c.otherUserName, c.otherUserAvatar);
                  }}
                  style={{ padding: 6 }}
                >
                  <Phone size={18} color={colors.textMuted} />
                </Pressable>
              )}
              <Pressable onPress={closeEverything} style={{ padding: 6 }}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </Pressable>

            {/* Settings menu */}
            {showSettingsMenu && (
              <>
                <Pressable
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
                  onPress={() => setShowSettingsMenu(false)}
                />
                <View
                  style={{
                    position: 'absolute',
                    top: insets.top + 55,
                    left: 12,
                    zIndex: 21,
                    minWidth: 200,
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                  }}
                >
                  <MenuItem
                    icon={<ImageIcon size={15} color={colors.text} />}
                    label="Change wallpaper"
                    colors={colors}
onPress={() => {
  setShowSettingsMenu(false);
  setShowWallpaperPicker(true);
}}
                  />
                  <MenuItem
                    icon={
                      isMuted(conversation?.id)
                        ? <Volume2 size={15} color={colors.text} />
                        : <VolumeX size={15} color={colors.text} />
                    }
                    label={isMuted(conversation?.id) ? 'Unmute notifications' : 'Mute notifications'}
                    colors={colors}
                    onPress={() => {
                      if (!conversation) return;
                      const willMute = !isMuted(conversation.id);
                      toggleMute(conversation.id);
                      Toast.show({ type: 'success', text1: willMute ? 'Muted' : 'Unmuted' });
                      setShowSettingsMenu(false);
                    }}
                  />
                  {conversation?.otherUserAccountType === 'seller' && (
                    <MenuItem
                      icon={<ShoppingBag size={15} color={colors.text} />}
                      label="View store"
                      colors={colors}
                      onPress={() => {
                        setShowSettingsMenu(false);
                        closeChat();
                        router.push(`/seller/${conversation?.otherUserId}`);
                      }}
                    />
                  )}
                  <MenuItem
                    icon={<Flag size={15} color={colors.text} />}
                    label="Report user"
                    colors={colors}
                    onPress={() => {
                      setShowSettingsMenu(false);
                      setShowReportModal(true);
                    }}
                  />
                </View>
              </>
            )}

            {/* Messages */}
            <Pressable
              onPress={Keyboard.dismiss}
              style={[{ flex: 1 }, renderWallpaperBackground()]}
            >
              {wallpaperParsed.kind === 'gradient' && (
                <LinearGradient
                  colors={wallpaperParsed.colors as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
                />
              )}
              {wallpaperParsed.kind === 'image' && (
                <Image
                  source={{ uri: wallpaperParsed.uri }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
                  contentFit="cover"
                />
              )}

              <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                style={{ zIndex: 1 }}
              >
                {loading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator color={colors.brand} />
                  </View>
                ) : messages.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: colors.textFaint, fontSize: 13, marginTop: 40 }}>
                    Say hello — ask about condition, price, or when to meet up.
                  </Text>
                ) : (
                  (() => {
                    let lastDate: string | null = null;
                    return messages.map((m: any) => {
                      const isMine = m.sender_id === user?.id;
                      const otherUserOnline =
                        otherUserLastActive &&
                        Date.now() - new Date(otherUserLastActive).getTime() < ONLINE_THRESHOLD_MS;
                      const isImage = m.media_type === 'image';
                      const isAudio = m.media_type === 'audio';
                      const isVideo = m.media_type === 'video';
                      const isFile = m.media_type === 'file';
                      const messageDate = new Date(m.created_at).toDateString();
                      const showDateHeader = messageDate !== lastDate;
                      lastDate = messageDate;

                      return (
                        <React.Fragment key={m.id}>
                          {showDateHeader && (
                            <View style={{ alignItems: 'center', marginVertical: 8 }}>
                              <View
                                style={{
                                  backgroundColor: colors.chipBg,
                                  paddingHorizontal: 12,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                }}
                              >
                                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                  {getDateLabel(m.created_at)}
                                </Text>
                              </View>
                            </View>
                          )}

{m.deleted_for_everyone ? (
  <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: isMine ? colors.brand : colors.border,
        backgroundColor: isMine ? colors.brandSoft : colors.chipBg,
      }}
    >
      <Text style={{ fontSize: 12, fontStyle: 'italic', color: isMine ? colors.brand : colors.textFaint }}>
        This message was deleted
      </Text>
    </View>
  </View>
) : (
                            <Pressable
                              onLongPress={() => handleLongPressMessage(m, isMine)}
                              delayLongPress={400}
                              style={{ alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 6 }}
                            >
                              <View style={{ maxWidth: '78%' }}>
                              <BubbleTail isMine={isMine} color={isMine ? colors.brand : colors.chipBg} />
                              <View
                                style={{
                                  borderRadius: 16,
                                  borderBottomRightRadius: isMine ? 4 : 16,
                                  borderBottomLeftRadius: isMine ? 16 : 4,
                                  overflow: 'hidden',
                                  backgroundColor: isMine ? colors.brand : colors.chipBg,
                                  paddingHorizontal: isImage || isAudio ? 4 : 12,
                                  paddingTop: isImage || isAudio ? 4 : 8,
                                  paddingBottom: 6,
                                }}
                              >
                                {isImage && (
                                  <View>
                                    <Pressable onPress={() => setPreviewImage(m.media_url)}>
                                      <Image
                                        source={{ uri: m.media_url }}
                                        style={{ width: 220, height: 220, borderRadius: 12 }}
                                        contentFit="cover"
                                      />
                                    </Pressable>
                                    <View
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: 4,
                                        paddingHorizontal: 8,
                                        paddingTop: 4,
                                      }}
                                    >
                                      <Text style={{ fontSize: 10, color: isMine ? colors.textOnGold : colors.textMuted }}>
                                        {formatMessageTime(m.created_at)}
                                      </Text>
                                      {isMine && (
                                        <MessageTick
                                          read={m.read}
                                          otherOnline={!!otherUserOnline}
                                          color={colors.textOnGold}
                                          blueColor="#4EA4FF"
                                        />
                                      )}
                                    </View>
                                  </View>
                                )}

                                {isAudio && (
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 8,
                                      paddingHorizontal: 10,
                                      paddingVertical: 8,
                                      minWidth: 180,
                                    }}
                                  >
                                    <Volume2 size={18} color={isMine ? colors.textOnGold : colors.text} />
                                    <Text style={{ flex: 1, fontSize: 13, color: isMine ? colors.textOnGold : colors.text }}>
                                      Voice note
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        color: isMine ? colors.textOnGold : colors.textMuted,
                                        opacity: 0.8,
                                      }}
                                    >
                                      {formatMessageTime(m.created_at)}
                                    </Text>
                                    {isMine && (
                                      <MessageTick
                                        read={m.read}
                                        otherOnline={!!otherUserOnline}
                                        color={colors.textOnGold}
                                        blueColor="#4EA4FF"
                                      />
                                    )}
                                  </View>
                                )}

                                {(isVideo || isFile) && (
                                  <Pressable
                                    onPress={() => openMedia(m)}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 140 }}
                                  >
                                    {isVideo
                                      ? <VideoIcon size={20} color={isMine ? colors.textOnGold : colors.text} />
                                      : <FileText size={20} color={isMine ? colors.textOnGold : colors.text} />}
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: isMine ? colors.textOnGold : colors.text }}>
                                      {isVideo ? 'Video (tap to open)' : 'File (tap to open)'}
                                    </Text>
                                  </Pressable>
                                )}

                                {m.reply_story_media_url && (
                                  <Pressable
                                    onPress={() => handleOpenStory(m.reply_story_id)}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 8,
                                      backgroundColor: isMine ? 'rgba(0,0,0,0.12)' : colors.card,
                                      borderRadius: 10,
                                      padding: 6,
                                      marginBottom: m.content ? 6 : 2,
                                      borderLeftWidth: 3,
                                      borderLeftColor: isMine ? colors.textOnGold : colors.brand,
                                    }}
                                  >
                                    <Image
                                      source={{ uri: m.reply_story_media_url }}
                                      style={{ width: 36, height: 48, borderRadius: 6 }}
                                      contentFit="cover"
                                    />
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: '600',
                                        color: isMine ? colors.textOnGold : colors.textMuted,
                                        opacity: 0.85,
                                      }}
                                    >
                                      Replied to a story
                                    </Text>
                                  </Pressable>
                                )}

                                {m.content && (
                                  <Text
                                    style={{
                                      fontSize: isSingleEmoji(m.content) ? 28 : 14,
                                      color: isMine ? colors.textOnGold : colors.text,
                                      lineHeight: isSingleEmoji(m.content) ? 40 : 20,
                                    }}
                                  >
                                    {(() => {
                                      if (isMine) return m.content;
                                      const parts = m.content.split(/(Order #[0-9a-fA-F-]+)/g);
                                      return parts.map((part: string, i: number) => {
                                        const match = part.match(/^Order #([0-9a-fA-F-]+)$/);
                                        if (!match) return <Text key={i}>{part}</Text>;
                                        return (
                                          <Text
                                            key={i}
                                            onPress={() => handleOpenOrder(match[1])}
                                            style={{
                                              textDecorationLine: 'underline',
                                              fontWeight: '700',
                                              color: colors.brand,
                                            }}
                                          >
                                            {part}
                                          </Text>
                                        );
                                      });
                                    })()}
                                  </Text>
                                )}

                                {!isImage && !isAudio && (
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'flex-end',
                                      gap: 4,
                                      marginTop: 3,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        color: isMine ? colors.textOnGold : colors.textMuted,
                                        opacity: isMine ? 0.75 : 1,
                                      }}
                                    >
                                      {formatMessageTime(m.created_at)}
                                    </Text>
                                    {isMine && (
                                      <MessageTick
                                        read={m.read}
                                        otherOnline={!!otherUserOnline}
                                        color={colors.textOnGold}
                                        blueColor="#4EA4FF"
                                      />
                                    )}
                                  </View>
                                )}
                              </View>
                              </View>
                            </Pressable>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()
                )}
              </ScrollView>
            </Pressable>

            {/* Composer */}
            <Pressable
              onPress={Keyboard.dismiss}
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.borderMuted,
                backgroundColor: colors.card,
                paddingBottom: insets.bottom -16,
                paddingTop: 8,
              }}
            >
              {pendingStoryReply && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginHorizontal: 12,
                    marginBottom: 8,
                    padding: 8,
                    borderRadius: 12,
                    backgroundColor: colors.chipBg,
                    borderLeftWidth: 3,
                    borderLeftColor: colors.brand,
                  }}
                >
                  <Image
                    source={{ uri: pendingStoryReply.mediaUrl }}
                    style={{ width: 36, height: 48, borderRadius: 6 }}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                      Replying to story
                    </Text>
                    {!!pendingStoryReply.caption && (
                      <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                        {pendingStoryReply.caption}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={clearPendingStoryReply} style={{ padding: 4 }}>
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}

              {lockedTrex ? (
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: colors.textMuted,
                      textAlign: 'center',
                    }}
                  >
                    You can't reply to this conversation.
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textFaint,
                      textAlign: 'center',
                    }}
                  >
                    This is an announcement from Tre-X.
                  </Text>
                </View>
              ) : isRecording ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Pressable
                    onPress={stopRecordingAndCancel}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: colors.errorSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </Pressable>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {formatDuration(recordingSeconds)}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 12, color: colors.textFaint }}>Tap send to finish</Text>
                  </View>
                  <Pressable
                    onPress={stopRecordingAndSend}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: colors.brand,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Send size={16} color={colors.textOnGold} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
                  <Pressable onPress={() => setShowAttachMenu(true)} disabled={uploading} style={{ padding: 10, opacity: uploading ? 0.4 : 1 }}>
                    <Paperclip size={20} color={colors.textMuted} />
                  </Pressable>

                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={uploading ? 'Uploading…' : 'Type a message…'}
                    placeholderTextColor={colors.textFaint}
                    editable={!uploading}
                    multiline
                    style={{
                      flex: 1,
                      minHeight: 40,
                      maxHeight: 100,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: colors.chipBg,
                      color: colors.text,
                      fontSize: 14,
                    }}
                  />

                  {draft.trim() ? (
                    <Pressable
                      onPress={handleSend}
                      style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: colors.brand,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Send size={18} color={colors.textOnGold} />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={startRecording}
                      disabled={uploading}
                      style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: colors.brand,
                        alignItems: 'center', justifyContent: 'center',
                        opacity: uploading ? 0.4 : 1,
                      }}
                    >
                      <Mic size={18} color={colors.textOnGold} />
                    </Pressable>
                  )}
                </View>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {/* Message long-press menu */}
      {messageMenu && (
        <>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}
            onPress={() => setMessageMenu(null)}
          />
          <View
            style={{
              position: 'absolute',
              alignSelf: 'center',
              top: '40%',
              zIndex: 201,
              minWidth: 200,
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <MenuItem
              icon={<Trash2 size={15} color={colors.text} />}
              label="Delete for me"
              colors={colors}
              onPress={() => handleMessageAction('me')}
            />
            {messageMenu.isMine && (
              <MenuItem
                icon={<Trash2 size={15} color={colors.error} />}
                label="Delete for everyone"
                colors={colors}
                danger
                onPress={() => handleMessageAction('everyone')}
              />
            )}
          </View>
        </>
      )}

      {showAttachMenu && (
        <>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}
            onPress={() => setShowAttachMenu(false)}
          />
          <View
            style={{
              position: 'absolute',
              left: 12,
              bottom: insets.bottom + 64,
              zIndex: 201,
              minWidth: 180,
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <MenuItem
              icon={<FileText size={16} color={colors.text} />}
              label="File"
              colors={colors}
              onPress={handlePickFile}
            />
            <MenuItem
              icon={<ImageIcon size={16} color={colors.text} />}
              label="Picture"
              colors={colors}
              onPress={handlePickPicture}
            />
            <MenuItem
              icon={<VideoIcon size={16} color={colors.text} />}
              label="Video"
              colors={colors}
              onPress={handlePickVideo}
            />
          </View>
        </>
      )}

      <WallpaperPicker
        open={showWallpaperPicker}
        onClose={() => setShowWallpaperPicker(false)}
        currentUserId={user?.id}
      />

      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={conversation?.otherUserId}
        title="Report this user"
        subtitle="Let us know what's wrong. Our team will review it shortly."
      />

      {/* Delete chat confirm */}
      {showDeleteModal && (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 300,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            backgroundColor: 'rgba(15,23,42,0.6)',
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 340,
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              Delete chat
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6 }}>
              Choose how you'd like to delete this conversation with {conversation?.otherUserName}.
            </Text>

            <Pressable
              onPress={handleDeleteForMe}
              disabled={deleting}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                Delete for me
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteForEveryone}
              disabled={deleting}
              style={{
                marginTop: 8,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.error,
                alignItems: 'center',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                Delete for everyone
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDeleteModal(false)}
              disabled={deleting}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      )}
            {/* Full-screen image preview */}
      {previewImage && (
        <Pressable
          onPress={() => setPreviewImage(null)}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 400,
            backgroundColor: 'rgba(0,0,0,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={{ uri: previewImage }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        </Pressable>
      )}
      <Toast />
    </Modal>
  );
}

function BubbleTail({ isMine, color }: { isMine: boolean; color: string }) {
  return (
    <Svg
      width={8}
      height={10}
      viewBox="0 0 8 10"
      style={{
        position: 'absolute',
        bottom: 0,
        ...(isMine ? { right: -6 } : { left: -6, transform: [{ scaleX: -1 }] }),
      }}
    >
      <Path d="M0 0 L0 10 L8 10 C4 9 1 6 0 0 Z" fill={color} />
    </Svg>
  );
}

function MessageTick({
  read, otherOnline, color, blueColor,
}: { read?: boolean; otherOnline: boolean; color: string; blueColor: string }) {
  if (read) return <CheckCheck size={12} color={blueColor} />;
  if (otherOnline) return <CheckCheck size={12} color={color} />;
  return <Check size={12} color={color} />;
}

function MenuItem({
  icon, label, onPress, colors, danger,
}: { icon: React.ReactNode; label: string; onPress: () => void; colors: any; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: danger ? colors.error : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}