import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'browse_scrollbar_enabled';

export async function getScrollbarEnabled() {
  try { return (await AsyncStorage.getItem(KEY)) !== 'off'; } catch { return true; }
}

export async function setScrollbarEnabled(v: boolean) {
  try { await AsyncStorage.setItem(KEY, v ? 'on' : 'off'); } catch {}
}