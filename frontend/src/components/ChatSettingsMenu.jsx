import { useEffect, useRef } from 'react';
import { Image, VolumeX, Volume2, Trash2, Flag } from 'lucide-react';
// Each entry: { key, icon, label, danger?, onClick }
// Only `onChangeWallpaper` is wired to real functionality right now.
// The rest call `onComingSoon` so the menu is fully built out and ready
// to wire up as soon as the matching backend routes exist.
export default function ChatSettingsMenu({ open, onClose, onChangeWallpaper, onComingSoon, onReportUser, muted, onToggleMute }) {
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open, onClose]);

    if (!open) return null;

    const items = [
        {
            key: 'wallpaper',
            icon: Image,
            label: 'Change wallpaper',
            onClick: onChangeWallpaper,
        },
        {
            key: 'mute',
            icon: muted ? Volume2 : VolumeX,
            label: muted ? 'Unmute notifications' : 'Mute notifications',
            onClick: onToggleMute,
        },
        {
            key: 'clear',
            icon: Trash2,
            label: 'Clear chat',
            onClick: () => onComingSoon('clear'),
        },
        {
            key: 'report',
            icon: Flag,
            label: 'Report user',
            danger: true,
            onClick: onReportUser,
        },
    ];

    return (
        <div
            ref={menuRef}
            className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl shadow-xl overflow-hidden z-20"
        >
            {items.map((item) => (
                <button
                    key={item.key}
                    onClick={() => {
                        item.onClick();
                        onClose();
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition ${
                        item.danger
                            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                            : 'text-slate-700 dark:text-gold-100 hover:bg-slate-50 dark:hover:bg-ink-700'
                    }`}
                >
                    <item.icon size={16} className="shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}