import { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import {
    X, BadgeCheck, ShieldAlert, Camera, Mail, Phone,
    MapPin, FileText, Settings, LogOut, Loader2, LayoutDashboard, Store, ShoppingBag, Clock,
    ChevronDown, ChevronRight, MessageCircle, Info, Shield, Search
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import VerifyModal from './VerifyModal';

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes
const APP_VERSION = '1.0.0';

function WhatsAppIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.86.505 3.678 1.462 5.272L2 22l4.83-1.44a10.001 10.001 0 0 0 5.174 1.44h.004c5.518 0 10.004-4.486 10.004-10.004C22.008 6.486 17.522 2 12.004 2zm0 18.09h-.003a8.077 8.077 0 0 1-4.116-1.128l-.295-.176-3.056.912.918-2.98-.192-.306a8.062 8.062 0 0 1-1.246-4.408c0-4.463 3.632-8.095 8.098-8.095 2.163 0 4.195.843 5.724 2.373a8.037 8.037 0 0 1 2.372 5.727c0 4.463-3.633 8.095-8.204 8.081z"/>
        </svg>
    );
}

export default function ProfileDrawer({ open, onClose }) {
    const { user, logout, updateProfile, uploadAvatar } = useAuth();
    const { conversations, openConversation } = useChat();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const drawerRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    const [personalOpen, setPersonalOpen] = useState(false);
    const [supportOpen, setSupportOpen] = useState(false);
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

useEffect(() => {
    if (open) {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.documentElement.style.overscrollBehavior = 'none';

        // 👇 Block touchmove on background
        const preventTouchMove = (e) => {
            if (!drawerRef.current?.contains(e.target)) {
                e.preventDefault();
            }
        };
        document.addEventListener('touchmove', preventTouchMove, { passive: false });
        window.__preventTouchMove = preventTouchMove;

        if (drawerRef.current) {
            drawerRef.current.scrollTop = 0;
        }
    } else {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overscrollBehavior = '';

        if (window.__preventTouchMove) {
            document.removeEventListener('touchmove', window.__preventTouchMove);
            delete window.__preventTouchMove;
        }

        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
}, [open]);

    // 👇 Reset dropdowns when drawer closes
    useEffect(() => {
        if (!open) {
            setPersonalOpen(false);
            setSupportOpen(false);
        }
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
                className={`fixed top-0 left-0 h-full w-3/4 max-w-sm bg-white dark:bg-ink-800 z-50 shadow-2xl transition-transform duration-300 overflow-y-auto no-scrollbar ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
                style={{ overscrollBehavior: 'contain' }}
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
                <div className="px-6 mt-6 pb-8 space-y-2">

                    {/* PERSONAL DETAILS - DROPDOWN */}
                    <div className="pb-4 border-b border-slate-100 dark:border-ink-600">
                        <button
                            onClick={() => setPersonalOpen(!personalOpen)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-gold-100 transition"
                        >
                            <div className="flex items-center gap-3">
                                <FileText size={17} />
                                <span>Personal details</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${personalOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {personalOpen && (
                            <div className="space-y-3">
                                {onCooldown && !editing && (
                                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-gold-400">
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
                                <div className="flex items-center justify-between ml-3">
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
                            </div>
                        )}
                    </div>

                    {/* DASHBOARD */}
                    <button
                        onClick={() => { onClose(); navigate('/dashboard'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-700 hover:bg-slate-100 dark:hover:bg-ink-600 text-sm font-semibold text-slate-800 dark:text-gold-100 transition"
                    >
                        <LayoutDashboard size={17} /> Dashboard
                    </button>

                    {/* CHAT / MESSAGING */}
                    <button
                        onClick={() => { onClose(); navigate('/chat'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-700 hover:bg-slate-100 dark:hover:bg-ink-600 text-sm font-semibold text-slate-800 dark:text-gold-100 transition"
                    >
                        <MessageCircle size={17} /> Chat / Messaging
                        {conversations.length > 0 && (
                            <span className="ml-auto text-xs bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 px-1.5 py-0.5 rounded-full">
                                {conversations.length}
                            </span>
                        )}
                    </button>

                    {/* SUPPORT & ABOUT - DROPDOWN */}
                    <div className="rounded-xl bg-slate-50 dark:bg-ink-700 overflow-hidden">
                        <button
                            onClick={() => setSupportOpen(!supportOpen)}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-gold-100 transition hover:bg-slate-100 dark:hover:bg-ink-600"
                        >
                            <div className="flex items-center gap-3">
                                <Info size={17} />
                                <span>Support & About</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${supportOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {supportOpen && (
                            <div className="px-3 pb-3 space-y-1">
                                {/* Contact Support */}
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/50 dark:bg-ink-800/50">
                                    <Mail size={15} className="text-slate-400 dark:text-gold-300/50 shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-gold-100">Contact support</p>
                                        <div className="text-xs text-slate-500 dark:text-gold-200/60 space-y-1 mt-1">
                                            <a
                                                href="tel:+233241234567"
                                                className="flex items-center gap-1.5 hover:text-brand-700 dark:hover:text-gold-300 transition w-fit"
                                            >
                                                📞 <span>+233 24 123 4567</span>
                                            </a>
                                            <a   
                                                href="https://wa.me/Trex_Support1"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 hover:text-brand-700 dark:hover:text-gold-300 transition w-fit"
                                            >
                                                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                <span className="text-brand-600 dark:text-gold-400 font-semibold">@Trex_Support1</span>
                                            </a>
                                            <a 
                                                href="mailto:support@campuscart.app"
                                                className="flex items-center gap-1.5 hover:text-brand-700 dark:hover:text-gold-300 transition w-fit"
                                            >
                                                ✉️ <span>support@trex.app</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Terms of Service - navigates to /terms */}
                                <Link
                                    to="/terms"
                                    onClick={onClose}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/50 dark:hover:bg-ink-800/50 transition text-left"
                                >
                                    <FileText size={15} className="text-slate-400 dark:text-gold-300/50 shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-gold-100">Terms of Service</span>
                                    <ChevronRight size={15} className="ml-auto text-slate-300 dark:text-gold-300/30" />
                                </Link>

                                {/* Privacy Policy - navigates to /privacy */}
                                <Link
                                    to="/privacy"
                                    onClick={onClose}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/50 dark:hover:bg-ink-800/50 transition text-left"
                                >
                                    <Shield size={15} className="text-slate-400 dark:text-gold-300/50 shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-gold-100">Privacy Policy</span>
                                    <ChevronRight size={15} className="ml-auto text-slate-300 dark:text-gold-300/30" />
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* SETTINGS */}
                    <button
                        onClick={() => { onClose(); navigate('/settings'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-ink-700 hover:bg-slate-100 dark:hover:bg-ink-600 text-sm font-semibold text-slate-800 dark:text-gold-100 transition"
                    >
                        <Settings size={17} /> Settings
                    </button>

                    {/* LOGOUT */}
                    <div className="pt-4 border-t border-slate-100 dark:border-ink-600">
                        <button
                            onClick={() => setConfirmLogout(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-semibold text-red-600 dark:text-red-400 transition"
                        >
                            <LogOut size={17} /> Log out
                        </button>
                    </div>

                    {/* APP VERSION - at the very bottom */}
                    <div className="pt-20 pb-2 text-center">
                        <span className="text-xs text-slate-400 dark:text-gold-300/40">App version v{APP_VERSION}</span>
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