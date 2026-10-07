import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedUser = await AsyncStorage.getItem('cc_user');
      if (storedUser) setUser(JSON.parse(storedUser));

      const token = await AsyncStorage.getItem('cc_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          await AsyncStorage.setItem('cc_user', JSON.stringify(res.data));
          registerForPushNotificationsAsync();
        } catch {
          if (!storedUser) {
            await AsyncStorage.removeItem('cc_token');
            await AsyncStorage.removeItem('cc_user');
            setUser(null);
          }
          // if we had a cached user, keep them logged in like the web version does
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    await AsyncStorage.setItem('cc_token', res.data.token);
    await AsyncStorage.setItem('cc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    registerForPushNotificationsAsync();
    return res.data.user;
  };

  const register = async (payload: any) => {
    const res = await api.post('/auth/register', payload);
    await AsyncStorage.setItem('cc_token', res.data.token);
    await AsyncStorage.setItem('cc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    registerForPushNotificationsAsync();
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await AsyncStorage.removeItem('cc_token');
    await AsyncStorage.removeItem('cc_user');
    setUser(null);
  };

  const updateProfile = async (payload: any) => {
    const res = await api.patch('/auth/me', payload);
    await AsyncStorage.setItem('cc_user', JSON.stringify(res.data));
    setUser(res.data);
    return res.data;
  };

  const removeAvatar = async () => {
    const res = await api.delete('/auth/me/avatar');
    await AsyncStorage.setItem('cc_user', JSON.stringify(res.data));
    setUser(res.data);
    return res.data;
  };

  // NOTE: file upload changes on native — RN doesn't have a browser File object.
  // We'll wire this up properly when we build the avatar-picker screen (uses
  // expo-image-picker, which returns a { uri, name, type } object instead).
  const uploadAvatar = async (file: any) => {
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    const avatarUrl = uploadRes.data.url;
    const res = await api.patch('/auth/me', { avatar_url: avatarUrl });
    await AsyncStorage.setItem('cc_user', JSON.stringify(res.data));
    setUser(res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, register, logout, loading, updateProfile, uploadAvatar, removeAvatar }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);