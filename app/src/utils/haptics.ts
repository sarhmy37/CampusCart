import * as Haptics from 'expo-haptics';

export function lightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}
