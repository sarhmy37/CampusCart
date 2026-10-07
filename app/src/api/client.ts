import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import mitt from 'mitt';
import { router } from 'expo-router';

export const emitter = mitt();
export const SESSION_REVOKED_EVENT = 'session-revoked';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://campuscart-tdfn.onrender.com/api',
});

async function getAnonId() {
  let id = await AsyncStorage.getItem('cc_anon_id');
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem('cc_anon_id', id);
  }
  return id;
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('cc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Anon-Id'] = await getAnonId();
  return config;
});

let redirectingToLogin = false;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const hadToken = !!(await AsyncStorage.getItem('cc_token'));
      const revoked = err.response?.data?.code === 'SESSION_REVOKED';

      if (revoked) {
        if (hadToken && !redirectingToLogin) {
          redirectingToLogin = true;
          emitter.emit(SESSION_REVOKED_EVENT);
        }
        return Promise.reject(err);
      }

      await AsyncStorage.removeItem('cc_token');
      await AsyncStorage.removeItem('cc_user');

      if (hadToken && !redirectingToLogin) {
        redirectingToLogin = true;
        router.replace('/');
      }
    }
    return Promise.reject(err);
  }
);

export default api;