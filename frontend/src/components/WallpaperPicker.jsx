import { useRef, useState } from 'react';
import { X, Check, Upload, Loader2 } from 'lucide-react';
import { WALLPAPER_PRESETS } from '../data/wallpapers';
import { useChat } from '../context/ChatContext';

export default function WallpaperPicker({ open, onClose }) {
    const { wallpaper, setWallpaperPreset, uploadWallpaper, uploadingWallpaper } = useChat();
    const fileInputRef = useRef(null);
    const [selecting, setSelecting] = useState(null);

    if (!open) return null;

    const handlePresetClick = async (preset) => {
        setSelecting(preset.id);
        try {
            if (preset.id === 'default') {
                await setWallpaperPreset('none', null);
            } else {
                await setWallpaperPreset('preset', preset.value);
            }
        } finally {
            setSelecting(null);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadWallpaper(file);
        e.target.value = '';
    };

    const isActive = (preset) => {
        if (preset.id === 'default') return !wallpaper || wallpaper.type === 'none';
        return wallpaper?.type === 'preset' && wallpaper?.value === preset.value;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[85vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-300/50 transition"
                >
                    <X size={18} />
                </button>

                <h3 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">Chat wallpaper</h3>
                <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1">
                    This only changes how this chat looks for you.
                </p>

                <div className="grid grid-cols-4 gap-3 mt-5">
                    {WALLPAPER_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => handlePresetClick(preset)}
                            className="flex flex-col items-center gap-1.5"
                        >
                            <div
                                className={`relative w-full aspect-square rounded-xl border-2 transition ${preset.preview} ${
                                    isActive(preset)
                                        ? 'border-brand-600 dark:border-gold-500'
                                        : 'border-slate-200 dark:border-ink-600'
                                }`}
                            >
                                {selecting === preset.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                        <Loader2 size={16} className="animate-spin text-white" />
                                    </div>
                                )}
                                {isActive(preset) && selecting !== preset.id && (
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-600 dark:bg-gold-500 flex items-center justify-center">
                                        <Check size={12} className="text-white dark:text-ink-900" />
                                    </div>
                                )}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-gold-200/60">{preset.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-ink-600">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingWallpaper}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-ink-600 text-sm font-semibold text-slate-600 dark:text-gold-200/70 hover:bg-slate-50 dark:hover:bg-ink-700 transition disabled:opacity-60"
                    >
                        {uploadingWallpaper ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Uploading…
                            </>
                        ) : (
                            <>
                                <Upload size={16} /> Upload custom image
                            </>
                        )}
                    </button>
                    {wallpaper?.type === 'custom' && (
                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-2 text-center">
                            Custom image currently applied
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}