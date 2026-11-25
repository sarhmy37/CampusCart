import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX = 12;
const keyFor = (userId: string | number) => `cc_recently_viewed_${userId}`;

export type ViewedItem = { id: number | string; title: string; price: number | string; primary_image?: string };

export async function getRecentlyViewed(userId: string | number): Promise<ViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(userId: string | number, item: ViewedItem) {
  try {
    const list = await getRecentlyViewed(userId);
    const next = [item, ...list.filter((i) => String(i.id) !== String(item.id))].slice(0, MAX);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {}
}