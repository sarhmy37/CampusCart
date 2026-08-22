import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    X, BadgeCheck, ShieldAlert, Camera, Mail, Phone,
    MapPin, FileText, Settings, LogOut, Loader2, LayoutDashboard, Store, ShoppingBag, Clock
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import VerifyModal from './VerifyModal';

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

export default function ProfileDrawer({ open, onClose }) {
    const { user, logout, updateProfile, uploadAvatar } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const drawerRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    const [form, setForm] = useState({
        about: user?.about || '',
        personal_email: user?.personal_email || '',
        whatsapp: user?.whatsapp || '',
        location: user?.location || '',
    });

    const cooldownRemaining = useMemo(() => {
        if (!user?.profile_updated_at) return 0;
        const elapsed = Date.now() - new Date(user.profile_updated_at).getTime();
        return Math.max(0, COOLDOWN_MS - elapsed);
    }, [user?.profile_updated_at]);

    const onCooldown = cooldownRemaining > 0;
    const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);

    // 👇 Prevent background scroll + scroll to top when drawer opens
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            if (drawerRef.current) {
                drawerRef.current.scrollTop = 0;
            }
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [open]);

    if (!user) return null;

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await uploadAvatar(file);
            toast.success('Profile picture updated');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile(form);
            toast.success('Profile updated');
            setEditing(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully. See you soon! 👋');
        setConfirmLogout(false);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity ${
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                ref={drawerRef}
                className={`fixed top-0 left-0 h-full w-3/4 max-w-sm bg-white dark:bg-ink-800 z-50 shadow-2xl transition-transform duration-300 overflow-y-auto ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="relative bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 dark:from-ink-900 dark:via-ink-800 dark:to-gold-900 px-6 pt-6 pb-16">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-lg bg-white/15 hover:bg-white/25 transition text-white"
                    >
                        <X size={18} />
                    </button>
                    <span className="text-white/80 text-xs font-semibold uppercase tracking-wide">My Profile</span>
                </div>

                {/* Avatar overlapping header */}
                <div className="px-6 -mt-12">
                    <div className="relative w-24 h-24">
                        <button
                            onClick={handleAvatarClick}
                            className="w-24 h-24 rounded-full border-4 border-white dark:border-ink-800 bg-slate-100 dark:bg-ink-700 shadow-md overflow-hidden flex items-center justify-center group relative"
                        >
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[11px] font-semibold text-slate-400 dark:text-gold-300/50 text-center px-2 leading-tight">
                                    Upload photo
                                </span>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                {uploading ? (
                                    <Loader2 size={18} className="text-white animate-spin" />
                                ) : (
                                    <Camera size={18} className="text-white" />
                                )}
                            </div>
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                    </div>

                    {/* Name + status */}
                    <div className="mt-3">
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-gold-50">{user.name}</h2>
                        <p className="text-sm text-slate-500 dark:text-gold-200/60">{user.university_email}</p>
                        {user.school && (
                            <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-0.5">{user.school}</p>
                        )}

                        <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                            {user.verified ? (
                                <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                                    <BadgeCheck className="w-[11px] h-[11px] sm:hidden" />
                                    <BadgeCheck className="hidden sm:inline w-[13px] h-[13px]" />
                                    Verified student
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-amber-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                                    <ShieldAlert className="w-[11px] h-[11px] sm:hidden" />
                                    <ShieldAlert className="hidden sm:inline w-[13px] h-[13px]" />
                                    Not yet verified
                                </span>
                            )}

                            {user.account_type === 'seller' ? (
                                <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                                    <Store className="w-[11px] h-[11px] sm:hidden" />
                                    <Store className="hidden sm:inline w-[13px] h-[13px]" />
                                    Status: Seller
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-blue-50 dark:bg-emerald-950/40 text-green-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                                    <ShoppingBag className="w-[11px] h-[11px] sm:hidden" />
                                    <ShoppingBag className="hidden sm:inline w-[13px] h-[13px]" />
                                    Status: Buyer
                                </span>
                            )}
                        </div>

                        {!user.verified && (
                            <button
                                onClick={() => setShowVerify(true)}
                                className="mt-3 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-yellow-600 dark:text-gold-400 hover:text-yellow-700 dark:hover:text-gold-300 underline underline-offset-2"
                            >
                                Verify your account →
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 mt-6 pb-8 space-y-5">
                    {/* DASHBOARD — sits right before personal details */}
                    <button
                        onClick={() => { onClose(); navigate('/dashboard'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-700 hover:bg-slate-100 dark:hover:bg-ink-600 text-sm font-semibold text-slate-800 dark:text-gold-100 transition"
                    >
                        <LayoutDashboard size={17} /> Dashboard
                    </button>

                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-gold-50">Personal details</h3>
                        {!editing && (
                            <button
                                onClick={() => !onCooldown && setEditing(true)}
                                disabled={onCooldown}
                                className={`text-xs font-semibold ${
                                    onCooldown
                                        ? 'text-slate-300 dark:text-gold-300/30 cursor-not-allowed'
                                        : 'text-brand-600 dark:text-gold-400 hover:text-brand-700 dark:hover:text-gold-300'
                                }`}
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {onCooldown && !editing && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-gold-400 -mt-3">
                            <Clock size={12} /> You can edit again in {cooldownMinutes} minute{cooldownMinutes === 1 ? '' : 's'}
                        </p>
                    )}

                    {editing ? (
                        <div className="space-y-3">
                            <Field
                                icon={<FileText size={15} />}
                                label="About"
                                as="textarea"
                                value={form.about}
                                onChange={(v) => setForm({ ...form, about: v })}
                                placeholder="A short bio — what you're studying, what you usually sell..."
                            />
                            <Field
                                icon={<Mail size={15} />}
                                label="Personal email"
                                value={form.personal_email}
                                onChange={(v) => setForm({ ...form, personal_email: v })}
                                placeholder="you@gmail.com"
                            />
                            <Field
                                icon={<Phone size={15} />}
                                label="WhatsApp contact"
                                value={form.whatsapp}
                                onChange={(v) => setForm({ ...form, whatsapp: v })}
                                placeholder="+233 ..."
                            />
                            <Field
                                icon={<MapPin size={15} />}
                                label="Location"
                                value={form.location}
                                onChange={(v) => setForm({ ...form, location: v })}
                                placeholder="Hostel, hall, or area"
                            />

                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-2 rounded-xl bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 text-white dark:text-ink-900 text-sm font-semibold transition disabled:opacity-60"
                                >
                                    {saving ? 'Saving…' : 'Save changes'}
                                </button>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <InfoRow icon={<FileText size={15} />} label="About" value={user.about || 'Not added yet'} />
                            <InfoRow icon={<Mail size={15} />} label="Personal email" value={user.personal_email || 'Not added yet'} />
                            <InfoRow icon={<Phone size={15} />} label="WhatsApp" value={user.whatsapp || 'Not added yet'} />
                            <InfoRow icon={<MapPin size={15} />} label="Location" value={user.location || 'Not added yet'} />
                        </div>
                    )}

                    <div className="border-t border-slate-100 dark:border-ink-600 pt-5 space-y-1">
                        <button
                            onClick={() => { onClose(); navigate('/settings'); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-700 text-sm font-semibold text-slate-700 dark:text-gold-200 transition"
                        >
                            <Settings size={17} /> Settings
                        </button>
                        <button
                            onClick={() => setConfirmLogout(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-semibold text-red-600 dark:text-red-400 transition"
                        >
                            <LogOut size={17} /> Log out
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmModal
                open={confirmLogout}
                title="Log out?"
                message="You'll need to log back in with your university email to continue."
                confirmLabel="Log out"
                onConfirm={handleLogout}
                onCancel={() => setConfirmLogout(false)}
            />

            <VerifyModal open={showVerify} onClose={() => setShowVerify(false)} />
        </>
    );
}

function Field({ icon, label, value, onChange, placeholder, as = 'input' }) {
    return (
        <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-gold-300/60 flex items-center gap-1.5 mb-1">
                {icon} {label}
            </label>
            {as === 'textarea' ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition resize-none"
                />
            ) : (
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-600 dark:bg-ink-700 dark:text-gold-50 dark:placeholder-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-gold-900 focus:outline-none text-sm transition"
                />
            )}
        </div>
    );
}

function InfoRow({ icon, label, value }) {
    return (
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-700">
            <span className="text-slate-400 dark:text-gold-300/50 mt-0.5">{icon}</span>
            <div>
                <p className="text-xs text-slate-400 dark:text-gold-200/40">{label}</p>
                <p className="text-sm font-medium text-slate-800 dark:text-gold-100">{value}</p>
            </div>
        </div>
    );
}