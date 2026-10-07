import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, Dimensions, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api from '@/api/client';
import { SCHOOL_COORDS } from '@/data/schoolCoords';
import LocationPickerModal from '@/components/LocationPickerModal';
import VerifyModal from '@/components/VerifyModal';
import Toast from 'react-native-toast-message';
import {
  X, BadgeCheck, ShieldAlert, Mail, Phone,
  MapPin, Map as MapIcon, FileText, Settings, LogOut, LayoutDashboard, Store, ShoppingBag, Clock,
  ChevronDown, ChevronUp, ChevronRight, MessageCircle, Info, Shield, Star, Sparkles, User,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useColors } from '@/hooks/useColors';

const COOLDOWN_MS = 60 * 60 * 1000;
const APP_VERSION = '1.0.0';
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout, updateProfile, uploadAvatar, removeAvatar } = useAuth();
  const { unreadCount: chatUnreadCount } = useChat();
  const [showVerify, setShowVerify] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locSource, setLocSource] = useState<'map' | 'gps' | 'campus' | null>(null);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [form, setForm] = useState({
    about: user?.about || '',
    personal_email: user?.personal_email || '',
    whatsapp: user?.whatsapp || '',
    sms_number: user?.sms_number || '',
    location: user?.location || '',
  });

  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user) {
      setForm({
        about: user.about || '',
        personal_email: user.personal_email || '',
        whatsapp: user.whatsapp || '',
        sms_number: user.sms_number || '',
        location: user.location || '',
      });
    }
  }, [user]);

  const cooldownRemaining = useMemo(() => {
    if (!user?.profile_updated_at) return 0;
    const elapsed = Date.now() - new Date(user.profile_updated_at).getTime();
    return Math.max(0, COOLDOWN_MS - elapsed);
  }, [user?.profile_updated_at]);
  const onCooldown = cooldownRemaining > 0;
  const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);

  if (!user) return null;

  const isBuyer = user.account_type === 'buyer';

source: 'map' | 'gps' | 'campus') => {  const guardLocationEdit = async () => {
    if (!isBuyer) return true;
    try {
      const res = await api.get('/auth/me/location-lock');
      if (res.data.locked) {
        Toast.show({ type: 'error', text1: 'Location cannot be edited while an order is Pending or Placed' });
        return false;
      }
      return true;
    } catch {
      Toast.show({ type: 'error', text1: 'Could not check your orders. Try again.' });
      return false;
    }
  };

  const applyLocation = async (c: { lat: number; lng: number }, source: 'map' | 'gps' | 'campus') => {
    setLocCoords(c);
    setLocSource(source);
    let text = 'Pinned location';
    try {
      const [p] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      text = [p?.name, p?.street, p?.district, p?.city].filter(Boolean).join(', ') || text;
    } catch {}
    setForm((f) => ({ ...f, location: text }));
  };

  const onUseCampus = () => {
    const c = user.school ? SCHOOL_COORDS[user.school] : undefined;
    if (!c) {
      Toast.show({ type: 'error', text1: 'No campus found on your account' });
      return;
    }
    setLocCoords(c);
    setLocSource('campus');
    setForm((f) => ({ ...f, location: [(user as any).meeting_place, user.school].filter(Boolean).join(', ') }));
  };

  const onSetOnMap = async () => {
    if (await guardLocationEdit()) setShowLocPicker(true);
  };

  const onUseCurrent = async () => {
    if (!(await guardLocationEdit())) return;
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission needed' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await applyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps');
    } catch {
      Toast.show({ type: 'error', text1: 'Could not get your location' });
    } finally {
      setLocBusy(false);
    }
  };

  const closeDrawer = (onClosed?: () => void) => {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
      // buttons pass a press event here, so only run real callbacks
      if (typeof onClosed === 'function') onClosed();
    });
  };

  const handleAvatarPick = async () => {
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
    setAvatarPreview(asset.uri);
    setUploading(true);
    try {
      await uploadAvatar({
        uri: asset.uri,
        name: asset.fileName || 'avatar.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      Toast.show({ type: 'success', text1: 'Profile picture updated' });
    } catch (err: any) {
      setAvatarPreview(null);
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ ...form, location_lat: locCoords?.lat, location_lng: locCoords?.lng } as any);
      setLocCoords(null);
      setLocSource(null);
      Toast.show({ type: 'success', text1: 'Profile updated' });
      setEditing(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      "You'll need to log back in with your university email to continue.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            closeDrawer(async () => {
              await logout();
              router.replace('/');
              Toast.show({ type: 'success', text1: 'Logged out successfully. See you soon! 👋' });
            });
          },
        },
      ]
    );
  };

  const planIsActive = user?.plan && user.plan !== 'free' &&
    user?.plan_expires_at && new Date(user.plan_expires_at) > new Date();
  const planTier = planIsActive ? user.plan.toLowerCase() : 'free';

  const infoRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'transparent' }}>
      {/* Left — drawer */}
      <Animated.View
        style={{
          width: DRAWER_WIDTH,
          backgroundColor: colors.card,
          transform: [{ translateX: slideX }],
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.card }}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1, backgroundColor: colors.card }}
          bounces
          alwaysBounceVertical
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
        >
          {/* Header banner */}
          <LinearGradient
            colors={
              colors.card === '#161411'
                ? ['#0d0c0a', '#161411', 'rgba(230,171,43,0.35)']
                : ['#1e293b', '#334155', 'rgba(184,117,21,0.55)']
            }
            start={{ x: 0.3, y: 0.2 }}
            end={{ x: 0.5, y: 1 }}
            style={{ paddingTop: insets.top }}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 64 }}>
              <Pressable
                onPress={closeDrawer}
                style={{
                  position: 'absolute',
                  top: 16, right: 16,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: colors.border,
                }}
              >
                <X size={18} color="white" />
              </Pressable>
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                My Profile
              </Text>
            </View>
          </LinearGradient>

          {/* Avatar */}
          <View style={{ paddingHorizontal: 24, marginTop: -48 }}>
            <Pressable onPress={handleAvatarPick} disabled={uploading}>
              <View
                style={{
                  width: 96, height: 96, borderRadius: 48,
                  borderWidth: 4, borderColor: colors.card,
                  backgroundColor: colors.cardAlt,
                  overflow: 'hidden',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                {avatarPreview || user.avatar_url ? (
                  <Image
                    source={{ uri: avatarPreview || user.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                    cachePolicy="disk"
                  />
                ) : (
                  <User size={36} color={colors.textFaint} strokeWidth={1.5} />
                )}
                {uploading && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="white" />
                  </View>
                )}
              </View>
            </Pressable>

            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{user.name}</Text>
                {planTier === 'premium' && <Sparkles size={16} color="#a855f7" fill="#a855f7" />}
                {planTier === 'pro' && <Star size={16} color="#3b82f6" fill="#3b82f6" />}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>{user.university_email}</Text>
              {user.school && <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>{user.school}</Text>}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Pressable
                  disabled={user.verified}
                  onPress={() => setShowVerify(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: user.verified ? colors.successSoft : colors.errorSoft,
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                  }}
                >
                  {user.verified ? <BadgeCheck size={13} color={colors.success} /> : <ShieldAlert size={13} color={colors.error} />}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: user.verified ? colors.success : colors.error }}>
                    {user.verified ? 'Verified student' : 'Tap to verify'}
                  </Text>
                </Pressable>

                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: user.account_type === 'seller' ? colors.errorSoft : colors.successSoft,
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                }}>
                  {user.account_type === 'seller' ? <Store size={13} color={colors.error} /> : <ShoppingBag size={13} color={colors.success} />}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: user.account_type === 'seller' ? colors.error : colors.success }}>
                    {user.account_type === 'seller' ? 'Status: Seller' : 'Status: Buyer'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Body */}
          <View style={{ paddingHorizontal: 16, marginTop: 20, gap: 8, width: '100%' }}>
            {/* Personal details */}
            <View style={{ paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.borderMuted }}>
              <Pressable
                onPress={() => setPersonalOpen((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <FileText size={17} color={colors.textSecondary} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Personal details</Text>
                </View>
                {personalOpen ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
              </Pressable>

              {personalOpen && (
                <View style={{ gap: 12, paddingHorizontal: 4, marginTop: 4 }}>
                  {onCooldown && !editing && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} color={colors.warning} />
                      <Text style={{ fontSize: 12, color: colors.warning }}>
                        You can edit again in {cooldownMinutes} minute{cooldownMinutes === 1 ? '' : 's'}
                      </Text>
                    </View>
                  )}

                  {editing ? (
                    <View style={{ gap: 12 }}>
                      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                        <TextInput
                          value={form.about}
                          onChangeText={(v) => setForm({ ...form, about: v })}
                          placeholder="About — a short bio..."
                          placeholderTextColor={colors.textFaint}
                          multiline
                          style={{ paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}
                        />
                        {(['personal_email', 'whatsapp', 'sms_number'] as const).map((field) => (
                          <TextInput
                            key={field}
                            value={form[field]}
                            onChangeText={(v) => setForm({ ...form, [field]: v })}
                            placeholder={
                              field === 'personal_email' ? 'Personal email — you@gmail.com'
                              : field === 'whatsapp' ? 'WhatsApp contact — +233 ...'
                              : field === 'sms_number' ? 'SMS phone number — +233 ...'
                              : 'Location — hostel, hall, or area'
                            }
                            placeholderTextColor={colors.textFaint}
                            style={{ paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.card, borderBottomWidth: field === 'location' ? 0 : 1, borderBottomColor: colors.border }}
                          />
                        ))}
                      </View>

                      {(
                        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <MapPin size={15} color={colors.textFaint} style={{ marginTop: 2 }} />
                            <Text style={{ flex: 1, fontSize: 14, color: form.location ? colors.text : colors.textFaint }}>
                              {form.location || 'No location set'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {([
                              { key: 'map', label: 'Set on map', onPress: onSetOnMap, busy: false },
                              { key: 'gps', label: locBusy ? 'Getting…' : 'Use current', onPress: onUseCurrent, busy: locBusy },
                              ...(!isBuyer ? [{ key: 'campus', label: 'My campus', onPress: onUseCampus, busy: false }] : []),
                            ] as const).map((b) => {
                              const active = locSource === b.key;
                              const c = active ? '#059669' : colors.textSecondary;
                              return (
                                <Pressable
                                  key={b.key}
                                  onPress={b.onPress}
                                  disabled={b.busy}
                                  style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    paddingVertical: 8, borderRadius: 10, borderWidth: 1, opacity: b.busy ? 0.6 : 1,
                                    borderColor: active ? '#6ee7b7' : colors.border,
                                    backgroundColor: active ? 'rgba(16,185,129,0.1)' : 'transparent',
                                  }}
                                >
                                  {b.busy ? <ActivityIndicator size="small" color={colors.brand} /> : b.key === 'map' ? <MapIcon size={13} color={c} /> : <MapPin size={13} color={c} />}
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: c }}>{b.label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={handleSave}
                          disabled={saving}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
                        >
                          <Text style={{ color: colors.textOnGold, fontSize: 14, fontWeight: '600' }}>
                            {saving ? 'Saving…' : 'Save changes'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setEditing(false);
                            setLocCoords(null);
                            setLocSource(null);
                            setForm((f) => ({ ...f, location: user.location || '' }));
                          }}
                          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                      {[
                        { icon: <FileText size={15} color={colors.textFaint} />, value: user.about, label: 'About' },
                        { icon: <Mail size={15} color={colors.textFaint} />, value: user.personal_email, label: 'Personal email' },
                        { icon: <Phone size={15} color={colors.textFaint} />, value: user.whatsapp, label: 'WhatsApp contact' },
                        { icon: <Phone size={15} color={colors.textFaint} />, value: user.sms_number, label: 'SMS phone number' },
                        { icon: <MapPin size={15} color={colors.textFaint} />, value: user.location, label: 'Location' },
                      ].map((row, i, arr) => (
                        <View key={i} style={[infoRowStyle, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                          {row.icon}
                          <Text style={{ fontSize: 14, color: row.value ? colors.text : colors.textFaint, fontWeight: row.value ? '500' : '400' }}>
                            {row.value || row.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!editing && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Pressable onPress={() => !onCooldown && setEditing(true)} disabled={onCooldown}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: onCooldown ? colors.textFaint : colors.brand }}>
                          Edit
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            <DrawerButton
              icon={<LayoutDashboard size={17} color={colors.text} />}
              label="Dashboard"
              colors={colors}
              onPress={() => router.replace('/dashboard')}
            />

            {planTier !== 'free' && (
              <DrawerButton
                icon={<Sparkles size={17} color={planTier === 'premium' ? '#7c3aed' : '#2563eb'} />}
                label={planTier === 'premium' ? 'Premium Benefits' : 'Pro Benefits'}
                bg={planTier === 'premium' ? '#f5f3ff' : '#eff6ff'}
                textColor={planTier === 'premium' ? '#6d28d9' : '#1d4ed8'}
                colors={colors}
                onPress={() => router.replace('/benefits')}
              />
            )}

            <DrawerButton
              icon={<MessageCircle size={17} color={colors.text} />}
              label="Chat / Messaging"
              badge={chatUnreadCount > 0 ? chatUnreadCount : undefined}
              colors={colors}
              onPress={() => router.replace('/chat')}
            />

            <DrawerButton
              icon={<Settings size={17} color={colors.text} />}
              label="Settings"
              colors={colors}
              onPress={() => router.replace('/settings')}
            />

            <View style={{ borderRadius: 12, backgroundColor: colors.chipBg, overflow: 'hidden' }}>
              <Pressable
                onPress={() => setSupportOpen((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Info size={17} color={colors.text} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Support & About</Text>
                </View>
                {supportOpen ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
              </Pressable>

              {supportOpen && (
                <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 2 }}>
                  <SupportLink icon={<Mail size={15} color={colors.textFaint} />} label="Contact support" colors={colors} onPress={() => router.replace('/contact')} />
                  <SupportLink icon={<FileText size={15} color={colors.textFaint} />} label="Terms of Service" colors={colors} onPress={() => router.replace('/terms')} />
                  <SupportLink icon={<Shield size={15} color={colors.textFaint} />} label="Privacy Policy" colors={colors} onPress={() => router.replace('/privacy')} />
                </View>
              )}
            </View>

            <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}>
              <Pressable
                onPress={handleLogout}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 }}
              >
                <LogOut size={17} color={colors.error} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.error }}>Log out</Text>
              </Pressable>
            </View>

            <View style={{ flex: 1, backgroundColor: colors.card, minHeight: 24 }} />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={{ backgroundColor: colors.card, paddingBottom: 5, borderTopWidth: 1, borderTopColor: colors.borderMuted }}>
          <View style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textFaint }}>App version v{APP_VERSION}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Right — backdrop */}
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeIn,
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
      </Animated.View>

      {/* Verify modal */}
      <VerifyModal open={showVerify} onClose={() => setShowVerify(false)} />

      {showLocPicker && (
        <LocationPickerModal
          colors={colors}
          initial={locCoords}
          onCancel={() => setShowLocPicker(false)}
          onConfirm={(pos: { lat: number; lng: number }) => {
            setShowLocPicker(false);
            applyLocation(pos, 'map');
          }}
        />
      )}
    </View>
  );
}

function DrawerButton({
  icon, label, onPress, badge, bg, textColor, colors,
}: {
  icon: React.ReactNode; label: string; onPress: () => void; badge?: number;
  bg?: string; textColor?: string; colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 12, paddingVertical: 12,
        borderRadius: 12, backgroundColor: bg || colors.chipBg,
      }}
    >
      {icon}
      <Text style={{ fontSize: 14, fontWeight: '600', color: textColor || colors.text, flex: 1 }}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={{ backgroundColor: colors.brand, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textOnGold, fontSize: 11, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SupportLink({ icon, label, onPress, colors }: { icon: React.ReactNode; label: string; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}
    >
      {icon}
      <Text style={{ fontSize: 14, color: colors.textSecondary, flex: 1 }}>{label}</Text>
      <ChevronRight size={15} color={colors.textFaint} />
    </Pressable>
  );
}