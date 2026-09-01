import { useRef, useState } from 'react';
import { X, Check, Upload, Loader2 } from 'lucide-react';
import { WALLPAPER_PRESETS } from '../data/wallpapers';
import { useChat } from '../context/ChatContext';

export default function WallpaperPicker({ open, onClose, currentUserId }) {
    const { wallpaper, setWallpaperPreset, uploadWallpaper, uploadingWallpaper, hideWallpaperForMe } = useChat();
    const fileInputRef = useRef(null);

    // wallpaper now carries: type, value, set_by, hidden_for_me, effective_type, effective_value
    const hasSharedWallpaper = wallpaper && wallpaper.type && wallpaper.type !== 'none';
    const iSetIt = hasSharedWallpaper && wallpaper.set_by === currentUserId;
    const someoneElseSetIt = hasSharedWallpaper && !iSetIt;
    const [togglingHide, setTogglingHide] = useState(false);

    const handleToggleHideForMe = async () => {
        setTogglingHide(true);
        try {
            await hideWallpaperForMe(!wallpaper?.hidden_for_me);
        } finally {
            setTogglingHide(false);
        }
    };

    // Staged choice — nothing is sent to the server until "Set" is pressed.
    // { kind: 'preset', preset } | { kind: 'custom', file, previewUrl } | null
    const [staged, setStaged] = useState(null);
    const [applying, setApplying] = useState(false);

    if (!open) return null;

    const handlePresetClick = (preset) => {
        setStaged({ kind: 'preset', preset });
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStaged({ kind: 'custom', file, previewUrl: URL.createObjectURL(file) });
        e.target.value = '';
    };

    const isCurrentlyActive = (preset) => {
        if (preset.id === 'default') return !wallpaper || wallpaper.type === 'none';
        return wallpaper?.type === 'preset' && wallpaper?.value === preset.value;
    };

    // A preset tile is highlighted if it's staged, or (when nothing is
    // staged) if it's the currently-applied wallpaper.
    const isHighlighted = (preset) => {
        if (staged?.kind === 'preset') return staged.preset.id === preset.id;
        if (staged?.kind === 'custom') return false;
        return isCurrentlyActive(preset);
    };

    const handleSet = async () => {
        if (!staged) return;
        setApplying(true);
        try {
            if (staged.kind === 'preset') {
                if (staged.preset.id === 'default') {
                    await setWallpaperPreset('none', null);
                } else {
                    await setWallpaperPreset('preset', staged.preset.value);
                }
            } else if (staged.kind === 'custom') {
                await uploadWallpaper(staged.file);
            }
            setStaged(null);
        } finally {
            setApplying(false);
        }
    };

    const busy = applying || uploadingWallpaper;

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
                    This changes how this chat looks for both of you.
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
                                    isHighlighted(preset)
                                        ? 'border-brand-600 dark:border-gold-500'
                                        : 'border-slate-200 dark:border-ink-600'
                                }`}
                            >
                                {isHighlighted(preset) && (
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
                        disabled={busy}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition disabled:opacity-60 ${
                            staged?.kind === 'custom'
                                ? 'border-brand-600 dark:border-gold-500 text-brand-700 dark:text-gold-400 bg-brand-50 dark:bg-gold-900/20'
                                : 'border-dashed border-slate-300 dark:border-ink-600 text-slate-600 dark:text-gold-200/70 hover:bg-slate-50 dark:hover:bg-ink-700'
                        }`}
                    >
                        <Upload size={16} />
                        {staged?.kind === 'custom' ? 'Image selected — tap Set to apply' : 'Upload custom image'}
                    </button>

                    {staged?.kind === 'custom' && (
                        <img
                            src={staged.previewUrl}
                            alt="Selected wallpaper preview"
                            className="w-full h-28 object-cover rounded-xl mt-3 border border-slate-200 dark:border-ink-600"
                        />
                    )}

                    {wallpaper?.type === 'custom' && !staged && (
                        <p className="text-xs text-slate-400 dark:text-gold-200/50 mt-2 text-center">
                            Custom image currently applied
                        </p>
                    )}
                </div>

                <button
                    onClick={handleSet}
                    disabled={!staged || busy}
                    className="w-full mt-5 py-2.5 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {busy ? (
                        <>
                            <Loader2 size={16} className="animate-spin" /> Setting…
                        </>
                    ) : (
                        'Set wallpaper'
                    )}
                </button>

                {/* Person who set the current wallpaper can remove it for both */}
                {iSetIt && !staged && (
                    <button
                        onClick={async () => {
                            setTogglingHide(true);
                            try {
                                await setWallpaperPreset('none', null);
                            } finally {
                                setTogglingHide(false);
                            }
                        }}
                        disabled={togglingHide}
                        className="w-full mt-2 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition disabled:opacity-60"
                    >
                        {togglingHide ? 'Removing…' : 'Remove wallpaper'}
                    </button>
                )}

                {/* The other person only gets a personal, non-destructive toggle */}
                {someoneElseSetIt && !staged && (
                    <button
                        onClick={handleToggleHideForMe}
                        disabled={togglingHide}
                        className="w-full mt-2 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200/70 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-ink-700 transition disabled:opacity-60"
                    >
                        {togglingHide
                            ? 'Updating…'
                            : wallpaper?.hidden_for_me
                                ? 'Show wallpaper for me'
                                : 'Disable wallpaper for me'}
                    </button>
                )}
            </div>
        </div>
    );
}