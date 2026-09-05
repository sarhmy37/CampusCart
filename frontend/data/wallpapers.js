// Preset chat wallpapers — solid colors, gradients, and subtle patterns.
// `value` is what gets stored in the DB and reproduced as a CSS background.
export const WALLPAPER_PRESETS = [
    { id: 'default', label: 'Default', value: null, preview: 'bg-slate-50 dark:bg-ink-900' },
    { id: 'sand', label: 'Sand', value: '#F5EFE6', preview: 'bg-[#F5EFE6]' },
    { id: 'mint', label: 'Mint', value: '#E3F5EC', preview: 'bg-[#E3F5EC]' },
    { id: 'sky', label: 'Sky', value: '#E7F0FB', preview: 'bg-[#E7F0FB]' },
    { id: 'blush', label: 'Blush', value: '#FBEAEE', preview: 'bg-[#FBEAEE]' },
    { id: 'lavender', label: 'Lavender', value: '#EFEAFB', preview: 'bg-[#EFEAFB]' },
    {
        id: 'sunset',
        label: 'Sunset',
        value: 'linear-gradient(135deg, #FDEBD3 0%, #FBC7A4 50%, #F4A896 100%)',
        preview: 'bg-gradient-to-br from-[#FDEBD3] via-[#FBC7A4] to-[#F4A896]',
    },
    {
        id: 'ocean',
        label: 'Ocean',
        value: 'linear-gradient(135deg, #D9F0FA 0%, #A9D9EE 50%, #7FB8DE 100%)',
        preview: 'bg-gradient-to-br from-[#D9F0FA] via-[#A9D9EE] to-[#7FB8DE]',
    },
    {
        id: 'campus-night',
        label: 'Campus Night',
        value: 'linear-gradient(135deg, #1E2340 0%, #2B2F5C 50%, #3A2E5E 100%)',
        preview: 'bg-gradient-to-br from-[#1E2340] via-[#2B2F5C] to-[#3A2E5E]',
    },
    {
        id: 'dark',
        label: 'Dark',
        value: '#0F1115',
        preview: 'bg-[#0F1115]',
    },
];

// Helper: turn a stored wallpaper record into an inline style object
export function wallpaperToStyle(wallpaper) {
    if (!wallpaper || wallpaper.type === 'none' || !wallpaper.value) return {};

    if (wallpaper.type === 'custom') {
        return {
            backgroundImage: `url(${wallpaper.value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        };
    }

    // preset — value may be a hex color or a CSS gradient string
    if (wallpaper.value.startsWith('linear-gradient')) {
        return { backgroundImage: wallpaper.value };
    }
    return { backgroundColor: wallpaper.value };
}