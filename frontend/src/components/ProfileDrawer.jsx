import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    X, BadgeCheck, ShieldAlert, Camera, Mail, Phone,
    MapPin, FileText, Settings, LogOut, Loader2, LayoutDashboard, Store, ShoppingBag
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import VerifyModal from './VerifyModal';

export default function ProfileDrawer({ open, onClose }) {
    const { user, logout, updateProfile, uploadAvatar } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
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
                className={`fixed top-0 left-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl transition-transform duration-300 overflow-y-auto ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="relative bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 px-6 pt-6 pb-16">
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
                            className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 shadow-md overflow-hidden flex items-center justify-center group relative"
                        >
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[11px] font-semibold text-slate-400 text-center px-2 leading-tight">
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
                        <h2 className="text-lg font-extrabold text-slate-900">{user.name}</h2>
                        <p className="text-sm text-slate-500">{user.university_email}</p>
                        {user.school && (
                            <p className="text-xs text-slate-400 mt-0.5">{user.school}</p>
                        )}

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {user.verified ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    <BadgeCheck size={13} /> Verified student
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    <ShieldAlert size={13} /> Not yet verified
                                </span>
                            )}

                            {user.account_type === 'seller' ? (
                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    <Store size={13} /> Status: Seller
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-green-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    <ShoppingBag size={13} /> Status: Buyer
                                </span>
                            )}
                        </div>

                        {!user.verified && (
                            <button
                                onClick={() => setShowVerify(true)}
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-600 hover:text-yellow-700 underline underline-offset-2"
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-800 transition"
                    >
                        <LayoutDashboard size={17} /> Dashboard
                    </button>

                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Personal details</h3>
                        {!editing && (
                            <button
                                onClick={() => setEditing(true)}
                                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                                Edit
                            </button>
                        )}
                    </div>

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
                                    className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-60"
                                >
                                    {saving ? 'Saving…' : 'Save changes'}
                                </button>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
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

                    <div className="border-t border-slate-100 pt-5 space-y-1">
                        <button
                            onClick={() => { onClose(); navigate('/settings'); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700 transition"
                        >
                            <Settings size={17} /> Settings
                        </button>
                        <button
                            onClick={() => setConfirmLogout(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-sm font-semibold text-red-600 transition"
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
                onConfirm={() => { setConfirmLogout(false); logout(); }}
                onCancel={() => setConfirmLogout(false)}
            />

            <VerifyModal open={showVerify} onClose={() => setShowVerify(false)} />
        </>
    );
}

function Field({ icon, label, value, onChange, placeholder, as = 'input' }) {
    return (
        <div>
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                {icon} {label}
            </label>
            {as === 'textarea' ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm transition resize-none"
                />
            ) : (
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm transition"
                />
            )}
        </div>
    );
}

function InfoRow({ icon, label, value }) {
    return (
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
            <span className="text-slate-400 mt-0.5">{icon}</span>
            <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-medium text-slate-800">{value}</p>
            </div>
        </div>
    );
}