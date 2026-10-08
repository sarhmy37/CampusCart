import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, AppState, Platform, Animated, Easing } from 'react-native';
// ── DEV BUILD STEP 1/3: add PermissionsAndroid to the import above:
// import { View, Text, Pressable, Modal, AppState, PermissionsAndroid, Platform, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';

// ── DEV BUILD STEP 2/3: uncomment this import AND delete the `type IRtcEngine = any;` line below
// import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine } from 'react-native-agora';
type IRtcEngine = any;

const CallContext = createContext<any>(null);
const RING_TIMEOUT_MS = 40000;

type Call = {
  id: number;
  role: 'caller' | 'callee';
  otherUserId: any;
  name: string;
  avatar: string | null;
  connected: boolean;
  ringing: boolean; // caller side: the other phone has actually received the call
};

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function PulseRing({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
      }}
    />
  );
}

function CallButton({ onPress, bg, label, children, size = 68 }: { onPress: () => void; bg: string; label: string; children: React.ReactNode; size?: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        {children}
      </Pressable>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
    </View>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { openChat } = useChat();
  const [call, setCall] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const callRef = useRef<Call | null>(null);
  callRef.current = call;
  const engineRef = useRef<IRtcEngine | null>(null);
  const joiningRef = useRef(false);
  const endingRef = useRef(false);

  const cleanup = useCallback(() => {
    try { engineRef.current?.leaveChannel(); engineRef.current?.release(); } catch {}
    engineRef.current = null;
    joiningRef.current = false;
    setCall(null);
    setMuted(false);
    setSpeakerOn(false);
    setSeconds(0);
  }, []);

  // Nobody picked up: show a banner over the call screen, close the call,
  // then open the chat with that person and auto-start a voice note.
const handleNoAnswer = useCallback((c: Call) => {
  endingRef.current = true;
  api.post(`/calls/${c.id}/end`).catch(() => {});
  Toast.show({
    type: 'info',
    text1: `${c.name} didn't pick up`,
    text2: 'Send them a voice note instead',
    visibilityTime: 2500,
  });
  setTimeout(() => {
    cleanup();
    endingRef.current = false;
    // let the call modal finish closing before the chat modal opens
    setTimeout(() => {
      openChat({ sellerId: c.otherUserId, sellerName: c.name, autoRecord: true });
    }, 400);
  }, 2500);
}, [cleanup, openChat]);

  const joinAudio = useCallback(async (otherUserId: any) => {
    // Without a dev build this does nothing, so the call screen and timer
    // still work for testing the UI (signalling only, no audio).

    // ── DEV BUILD STEP 3/3: uncomment everything between these markers ──
    /*
    if (Platform.OS === 'android') {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (g !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('mic');
    }
    const { data } = await api.post('/calls/token', { otherUserId });
    const engine = createAgoraRtcEngine();
    engineRef.current = engine;
    engine.initialize({ appId: data.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
    engine.enableAudio();
    engine.setEnableSpeakerphone(false); // start on the earpiece
    engine.joinChannel(data.token, data.channel, 0, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
    });
    */
    // ── end of dev build block ──
  }, []);

  const startCall = useCallback(async (otherUserId: any, name: string, avatar: string | null) => {
    if (callRef.current) return;
    try {
      const { data } = await api.post('/calls/start', { otherUserId });
      setCall({ id: data.id, role: 'caller', otherUserId, name, avatar, connected: false, ringing: false });
      setTimeout(() => {
        const c = callRef.current;
        if (c && c.id === data.id && !c.connected && !endingRef.current) {
          handleNoAnswer(c);
        }
      }, RING_TIMEOUT_MS);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not start the call' });
    }
  }, [cleanup, handleNoAnswer]);

  const answerCall = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    try {
      const { data } = await api.post(`/calls/${c.id}/answer`);
      if (data.status !== 'answered') { cleanup(); return; }
      await joinAudio(c.otherUserId);
      setCall((prev) => (prev && prev.id === c.id ? { ...prev, connected: true } : prev));
    } catch {
      Toast.show({ type: 'error', text1: 'Could not join the call' });
      cleanup();
    }
  }, [cleanup, joinAudio]);

  const endCall = useCallback(() => {
    if (endingRef.current) return;
    const c = callRef.current;
    if (!c) return;
    const action = c.role === 'callee' && !c.connected ? 'decline' : 'end';
    api.post(`/calls/${c.id}/${action}`).catch(() => {});
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    engineRef.current?.muteLocalAudioStream(next);
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    engineRef.current?.setEnableSpeakerphone(next);
    setSpeakerOn(next);
  }, [speakerOn]);

  // poll the call's status (caller waits for ringing/answer; both sides detect hang-up)
  useEffect(() => {
    if (!call) return;
    const t = setInterval(async () => {
      const c = callRef.current;
      if (!c) return;
      if (endingRef.current) return;
      try {
        const { data } = await api.get(`/calls/${c.id}`);
        if (['declined', 'ended', 'missed'].includes(data.status)) {
          if (c.role === 'caller' && !c.connected && data.status === 'declined') {
            Toast.show({ type: 'info', text1: 'Call declined' });
          }
          cleanup();
        } else if (data.status === 'answered' && c.role === 'caller' && !c.connected) {
          if (joiningRef.current) return;
          joiningRef.current = true;
          await joinAudio(c.otherUserId);
          setCall((prev) => (prev && prev.id === c.id ? { ...prev, connected: true, ringing: true } : prev));
        } else if (data.status === 'delivered' && c.role === 'caller' && !c.ringing && !c.connected) {
          setCall((prev) => (prev && prev.id === c.id ? { ...prev, ringing: true } : prev));
        }
      } catch {
        joiningRef.current = false;
      }
    }, 2000);
    return () => clearInterval(t);
  }, [call?.id]);

  // poll for an incoming call while the app is open
  useEffect(() => {
    if (!user) return;
    const t = setInterval(async () => {
      if (callRef.current || AppState.currentState !== 'active') return;
      try {
        const { data } = await api.get('/calls/incoming');
        if (data && !callRef.current) {
          setCall({
            id: data.id, role: 'callee', otherUserId: data.caller_id,
            name: data.caller_name, avatar: data.caller_avatar, connected: false, ringing: true,
          });
          // tell the server this phone received the call so the caller sees "Ringing…"
          api.post(`/calls/${data.id}/ringing`).catch(() => {});
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [user]);

  // call timer: starts at 00:00:00 the moment the call connects
  useEffect(() => {
    if (!call?.connected) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.connected]);

  const waiting = !!call && !call.connected;
  const isIncoming = waiting && call?.role === 'callee';
  const pulsing = waiting && (call?.role === 'callee' || !!call?.ringing);

  const statusText = call?.connected
    ? fmt(seconds)
    : call?.role === 'callee'
    ? 'Incoming call'
    : call?.ringing
    ? 'Ringing…'
    : 'Calling…';

  return (
    <CallContext.Provider value={{ startCall, call }}>
      {children}
      <Modal visible={!!call} animationType="slide" onRequestClose={endCall}>
        <View style={{ flex: 1, backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'space-between', paddingTop: 100, paddingBottom: 70 }}>
          {/* No-answer banner (sits above everything inside the call screen) */}

          {/* Name + status */}
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>{call?.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {call?.connected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />}
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{statusText}</Text>
            </View>
          </View>

          {/* Avatar with pulse rings */}
          <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
            {pulsing && (
              <>
                <PulseRing delay={0} />
                <PulseRing delay={1100} />
              </>
            )}
            <View style={{ width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)' }}>
              {call?.avatar ? (
                <Image source={{ uri: call.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 52, fontWeight: '800', color: '#fff' }}>
                  {call?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 28 }}>
            {call?.connected && (
              <CallButton onPress={toggleMute} bg={muted ? '#fff' : 'rgba(255,255,255,0.15)'} label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MicOff size={26} color="#0b1220" /> : <Mic size={26} color="#fff" />}
              </CallButton>
            )}
            {call?.connected && (
              <CallButton onPress={toggleSpeaker} bg={speakerOn ? '#fff' : 'rgba(255,255,255,0.15)'} label={speakerOn ? 'Speaker on' : 'Speaker'}>
                <Volume2 size={26} color={speakerOn ? '#0b1220' : '#fff'} />
              </CallButton>
            )}
            <CallButton onPress={endCall} bg="#ef4444" size={76} label={isIncoming ? 'Decline' : call?.connected ? 'End' : 'Cancel'}>
              <PhoneOff size={30} color="#fff" />
            </CallButton>
            {isIncoming && (
              <CallButton onPress={answerCall} bg="#22c55e" size={76} label="Accept">
                <Phone size={30} color="#fff" />
              </CallButton>
            )}
          </View>
        </View>

      <Toast />
    </Modal>
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);