import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, AppState, PermissionsAndroid, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react-native';
/*to enable call
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine } from 'react-native-agora';*/
// disable block 
import type { IRtcEngine } from 'react-native-agora';
//
import Toast from 'react-native-toast-message';
import api from '../api/client';
import { useAuth } from './AuthContext';

const CallContext = createContext<any>(null);
const RING_TIMEOUT_MS = 40000;

type Call = {
  id: number; role: 'caller' | 'callee'; otherUserId: any;
  name: string; avatar: string | null; connected: boolean;
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [call, setCall] = useState<Call | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const callRef = useRef<Call | null>(null);
  callRef.current = call;
  const engineRef = useRef<IRtcEngine | null>(null);

  const cleanup = useCallback(() => {
    try { engineRef.current?.leaveChannel(); engineRef.current?.release(); } catch {}
    engineRef.current = null;
    setCall(null);
    setMuted(false);
    setSeconds(0);
  }, []);

  const joinAudio = useCallback(async (otherUserId: any) => {
    if (Platform.OS === 'android') {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (g !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('mic');
    }
    const { data } = await api.post('/calls/token', { otherUserId });
    /*to enable call
    const engine = createAgoraRtcEngine();*/
    // to diable block 
    const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = require('react-native-agora');
    const engine = createAgoraRtcEngine();
    //
    engineRef.current = engine;
    engine.initialize({ appId: data.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
    engine.enableAudio();
    engine.joinChannel(data.token, data.channel, 0, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
    });
  }, []);

  const startCall = useCallback(async (otherUserId: any, name: string, avatar: string | null) => {
    if (callRef.current) return;
    try {
      const { data } = await api.post('/calls/start', { otherUserId });
      setCall({ id: data.id, role: 'caller', otherUserId, name, avatar, connected: false });
      setTimeout(() => {
        const c = callRef.current;
        if (c && c.id === data.id && !c.connected) {
          api.post(`/calls/${c.id}/end`).catch(() => {});
          cleanup();
          Toast.show({ type: 'info', text1: 'No answer' });
        }
      }, RING_TIMEOUT_MS);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not start the call' });
    }
  }, [cleanup]);

  const answerCall = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    try {
      const { data } = await api.post(`/calls/${c.id}/answer`);
      if (data.status !== 'answered') { cleanup(); return; }
      await joinAudio(c.otherUserId);
      setCall({ ...c, connected: true });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not join the call' });
      cleanup();
    }
  }, [cleanup, joinAudio]);

  const endCall = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const action = c.role === 'callee' && !c.connected ? 'decline' : 'end';
    api.post(`/calls/${c.id}/${action}`).catch(() => {});
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      engineRef.current?.muteLocalAudioStream(!m);
      return !m;
    });
  }, []);

  // poll the call's status (caller waits for answer; both sides detect hang-up)
  useEffect(() => {
    if (!call) return;
    const t = setInterval(async () => {
      const c = callRef.current;
      if (!c) return;
      try {
        const { data } = await api.get(`/calls/${c.id}`);
        if (['declined', 'ended', 'missed'].includes(data.status)) {
          if (c.role === 'caller' && !c.connected && data.status === 'declined') {
            Toast.show({ type: 'info', text1: 'Call declined' });
          }
          cleanup();
        } else if (data.status === 'answered' && c.role === 'caller' && !c.connected) {
          await joinAudio(c.otherUserId);
          setCall({ ...c, connected: true });
        }
      } catch {}
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
            name: data.caller_name, avatar: data.caller_avatar, connected: false,
          });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [user]);

  // call timer
  useEffect(() => {
    if (!call?.connected) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.connected]);

  const ringing = !!call && !call.connected;

  return (
    <CallContext.Provider value={{ startCall, call }}>
      {children}
      <Modal visible={!!call} animationType="slide" onRequestClose={endCall}>
        <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 90 }}>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
              {call?.avatar ? (
                <Image source={{ uri: call.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 44, fontWeight: '800', color: '#fff' }}>
                  {call?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>{call?.name}</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
              {call?.connected ? fmt(seconds) : call?.role === 'caller' ? 'Calling…' : 'Incoming call'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 36 }}>
            {call?.connected && (
              <Pressable
                onPress={toggleMute}
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: muted ? '#fff' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
              >
                {muted ? <MicOff size={26} color="#0f172a" /> : <Mic size={26} color="#fff" />}
              </Pressable>
            )}
            <Pressable
              onPress={endCall}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
            >
              <PhoneOff size={30} color="#fff" />
            </Pressable>
            {ringing && call?.role === 'callee' && (
              <Pressable
                onPress={answerCall}
                style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}
              >
                <Phone size={30} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);