import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cc_recently_viewed';
const MAX = 12;

export type ViewedItem = { id: number | string; title: string; price: number | string; primary_image?: string };

export async function getRecentlyViewed(): Promise<ViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(item: ViewedItem) {
  try {
    const list = await getRecentlyViewed();
    const next = [item, ...list.filter((i) => String(i.id) !== String(item.id))].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}