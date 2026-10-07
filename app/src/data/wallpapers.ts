// Preset chat wallpapers — solid colors and gradients.
// `value` is what gets stored in the DB.
// `preview` is just a hex/gradient for the picker UI.

export const WALLPAPER_PRESETS = [
  { id: 'default', label: 'Default', value: null, preview: null },
  { id: 'sand', label: 'Sand', value: '#F5EFE6', preview: ['#F5EFE6', '#F5EFE6'] },
  { id: 'mint', label: 'Mint', value: '#E3F5EC', preview: ['#E3F5EC', '#E3F5EC'] },
  { id: 'sky', label: 'Sky', value: '#E7F0FB', preview: ['#E7F0FB', '#E7F0FB'] },
  { id: 'blush', label: 'Blush', value: '#FBEAEE', preview: ['#FBEAEE', '#FBEAEE'] },
  { id: 'lavender', label: 'Lavender', value: '#EFEAFB', preview: ['#EFEAFB', '#EFEAFB'] },
  {
    id: 'sunset',
    label: 'Sunset',
    value: 'gradient:#FDEBD3,#FBC7A4,#F4A896',
    preview: ['#FDEBD3', '#FBC7A4', '#F4A896'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    value: 'gradient:#D9F0FA,#A9D9EE,#7FB8DE',
    preview: ['#D9F0FA', '#A9D9EE', '#7FB8DE'],
  },
  {
    id: 'campus-night',
    label: 'Campus Night',
    value: 'gradient:#1E2340,#2B2F5C,#3A2E5E',
    preview: ['#1E2340', '#2B2F5C', '#3A2E5E'],
  },
  {
    id: 'dark',
    label: 'Dark',
    value: '#0F1115',
    preview: ['#0F1115', '#0F1115'],
  },
];

// Returns:
//   { kind: 'none' }
//   { kind: 'color', color: '#...' }
//   { kind: 'gradient', colors: ['#..','#..','#..'] }
//   { kind: 'image', uri: 'https://...' }
export function parseWallpaper(wallpaper: any) {
  if (!wallpaper || wallpaper.type === 'none' || !wallpaper.value) {
    return { kind: 'none' } as const;
  }

  if (wallpaper.type === 'custom') {
    return { kind: 'image', uri: wallpaper.value } as const;
  }

  const value = wallpaper.value;

  if (typeof value === 'string' && value.startsWith('gradient:')) {
    const colors = value.replace('gradient:', '').split(',').map((s) => s.trim());
    return { kind: 'gradient', colors } as const;
  }

  return { kind: 'color', color: value } as const;
}