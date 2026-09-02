import { useState, useEffect, useRef } from 'react';
import { X, Send, ChevronDown, Loader2, Paperclip, Mic, Square, Check, CheckCheck, MoreVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { wallpaperToStyle } from '../data/wallpapers';
import ChatSettingsMenu from './ChatSettingsMenu';
import WallpaperPicker from './WallpaperPicker';

const MOBILE_BREAKPOINT = 640;
const SWIPE_DISMISS_THRESHOLD = 80;
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function formatMessageTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatPresence(lastActiveAt) {
    if (!lastActiveAt) return '';
    const diffMs = Date.now() - new Date(lastActiveAt).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2) return 'Active now';
    if (diffMin < 60) return `Last active ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Last active ${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `Last active ${diffDay}d ago`;
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export default function ChatPanel() {
    // ✅ FIXED: Added useAuth to get the current user
    const { user } = useAuth();
    const { isOpen, conversation, messages, loading, uploading, otherUserLastActive, closeChat, sendMessage, sendMedia, wallpaper, deleteForMe, deleteForEveryone, deleteMessageForMe, deleteMessageForEveryone } = useChat();
    const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
    const [draft, setDraft] = useState('');
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [messageMenu, setMessageMenu] = useState(null);
    const longPressTimerRef = useRef(null);

    const handleBubblePressStart = (m, isMine, e) => {
        const point = e.touches ? e.touches[0] : e;
        const x = point.clientX;
        const y = point.clientY;
        longPressTimerRef.current = setTimeout(() => {
            setMessageMenu({ id: m.id, isMine, x, y });
        }, 500);
    };

    const handleBubblePressEnd = () => {
        clearTimeout(longPressTimerRef.current);
    };

    const startY = useRef(null);
    const dragging = useRef(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) setDragY(0);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setShowSettingsMenu(false);
            setShowWallpaperPicker(false);
        }
    }, [isOpen]);

    useEffect(() => {
        setShowSettingsMenu(false);
        setShowWallpaperPicker(false);
    }, [conversation?.id]);

    const handleComingSoon = (key) => {
        if (key === 'clear' || key === 'delete') {
            setShowDeleteModal(true);
            return;
        }
        const labels = {
            mute: 'Muting conversations',
            report: 'Reporting a user from chat',
            block: 'Blocking a user',
        };
        console.info(`[chat settings] "${labels[key] || key}" is not wired up yet.`);
    };

    const handleDeleteForMe = async () => {
        setDeleting(true);
        try {
            await deleteForMe();
            setShowDeleteModal(false);
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteForEveryone = async () => {
        setDeleting(true);
        try {
            await deleteForEveryone();
            setShowDeleteModal(false);
        } finally {
            setDeleting(false);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        sendMessage(draft);
        setDraft('');
    };

    const handleAttachClick = () => fileInputRef.current?.click();

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        sendMedia(file);
        e.target.value = '';
    };

    const MIME_CANDIDATES = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
    ];

    const pickSupportedMimeType = () => {
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
        return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const preferredType = pickSupportedMimeType();
            const recorder = preferredType
                ? new MediaRecorder(stream, { mimeType: preferredType })
                : new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            recorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                const actualType = recorder.mimeType || 'audio/webm';
                const extension = actualType.includes('mp4') ? 'm4a'
                    : actualType.includes('ogg') ? 'ogg'
                    : 'webm';
                const blob = new Blob(audioChunksRef.current, { type: actualType });
                const file = new File([blob], `voice-note.${extension}`, { type: actualType });
                sendMedia(file);
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingSeconds(0);
            recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
        } catch {
            alert('Microphone access is needed to record a voice note.');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
    };

    const handleTouchStart = (e) => {
        if (!isMobile) return;
        startY.current = e.touches[0].clientY;
        dragging.current = true;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isMobile || !dragging.current) return;
        const diff = e.touches[0].clientY - startY.current;
        if (diff < 0) setDragY(diff);
    };

    const handleTouchEnd = () => {
        if (!isMobile || !dragging.current) return;
        dragging.current = false;
        setIsDragging(false);

        if (dragY <= -SWIPE_DISMISS_THRESHOLD) {
            closeChat();
        } else {
            setDragY(0);
        }
    };

    if (!isOpen) return null;

    const panelStyle = isMobile
        ? {
              top: 0,
              left: 0,
              right: 0,
              height: '87.5vh',
              transform: `translateY(${dragY}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
              borderRadius: '0 0 1.5rem 1.5rem',
          }
        : {
              top: 0,
              right: 0,
              bottom: 0,
              width: '50%',
              transform: 'translateX(0)',
              transition: 'transform 0.3s ease-out',
              borderRadius: '1.5rem 0 0 1.5rem',
          };

    return (
        <div className="fixed inset-0 z-[100]">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeChat} />

            <div
                className="fixed bg-white dark:bg-ink-800 shadow-2xl flex flex-col"
                style={panelStyle}
                onClick={(e) => e.stopPropagation()}
            >
                {isMobile && (
                    <div
                        className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-ink-600" />
                        <ChevronDown size={14} className="text-slate-300 dark:text-ink-500 mt-1" />
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-ink-600 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setShowSettingsMenu((v) => !v)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition"
                                title="Chat settings"
                            >
                                <MoreVertical size={18} />
                            </button>
                            <ChatSettingsMenu
                                open={showSettingsMenu}
                                onClose={() => setShowSettingsMenu(false)}
                                onChangeWallpaper={() => setShowWallpaperPicker(true)}
                                onComingSoon={handleComingSoon}
                            />
                        </div>

                        {conversation?.otherUserAvatar ? (
                            <img
                                src={conversation.otherUserAvatar}
                                alt={conversation.otherUserName}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center text-sm font-bold shrink-0">
                                {conversation?.otherUserName?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div>
                            <p className="font-bold text-slate-900 dark:text-gold-50 text-sm">
                                {conversation?.otherUserName || 'Chat'}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-gold-200/50">
                                {loading ? 'Connecting…' : formatPresence(otherUserLastActive)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeChat}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
                    style={wallpaperToStyle(wallpaper)}
                >
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-300 dark:text-gold-200/30">
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : messages.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 dark:text-gold-200/50 mt-10">
                            Say hello — ask about condition, price, or when to meet up.
                        </p>
                    ) : (
                        messages.map((m) => {
                            const isMine = m.sender_id === user?.id;
                            const otherUserOnline = otherUserLastActive
                                && (Date.now() - new Date(otherUserLastActive).getTime() < ONLINE_THRESHOLD_MS);

                            const isImage = m.media_type === 'image';

                            const meta = (
                                <span
                                    className={`inline-flex items-center gap-1 shrink-0 select-none ${
                                        isImage
                                            ? 'text-white'
                                            : isMine
                                                ? 'text-white/75 dark:text-ink-900/60'
                                                : 'text-slate-400 dark:text-gold-300/50'
                                    }`}
                                >
                                    <span className="text-[11px]">{formatMessageTime(m.created_at)}</span>
                                    {isMine && (
                                        m.read ? (
                                            <CheckCheck size={13} className={isImage ? 'text-blue-300' : 'text-current'} />
                                        ) : otherUserOnline ? (
                                            <CheckCheck size={13} className="text-current" />
                                        ) : (
                                            <Check size={13} className="text-current" />
                                        )
                                    )}
                                </span>
                            );

                            if (m.deleted_for_everyone) {
                                return (
                                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                            <div className="px-3.5 py-2 rounded-2xl text-sm italic text-slate-400 dark:text-gold-200/40 bg-slate-50 dark:bg-ink-700/50 border border-dashed border-slate-200 dark:border-ink-600">
                                                This message was deleted
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                        <div
                                            onTouchStart={(e) => handleBubblePressStart(m, isMine, e)}
                                            onTouchEnd={handleBubblePressEnd}
                                            onMouseDown={(e) => handleBubblePressStart(m, isMine, e)}
                                            onMouseUp={handleBubblePressEnd}
                                            onMouseLeave={handleBubblePressEnd}
                                            className={`relative rounded-2xl text-sm leading-relaxed overflow-hidden select-none ${
                                                isImage ? 'pb-1' : 'px-3.5 pt-2.5 pb-1.5'
                                            } ${
                                                isMine
                                                    ? 'bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 rounded-br-sm'
                                                    : 'bg-slate-100 dark:bg-ink-700 text-slate-800 dark:text-gold-100 rounded-bl-sm'
                                            }`}
                                        >
                                            {isImage && (
                                                <div className="relative">
                                                    <img src={m.media_url} alt="" className="max-w-full rounded-t-2xl block" />
                                                    <span className="absolute bottom-1.5 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
                                                        {meta}
                                                    </span>
                                                </div>
                                            )}
                                            {m.media_type === 'audio' && (
                                                <div className="px-3.5 pt-2.5 pb-1">
                                                    <audio controls src={m.media_url} className="max-w-full" />
                                                </div>
                                            )}
                                            {m.content && (
                                                <p className={isImage ? 'px-3.5 pt-2' : ''}>{m.content}</p>
                                            )}

                                            {!isImage && (
                                                <div className={`flex items-center justify-end mt-1 ${m.media_type === 'audio' ? 'px-3.5' : ''}`}>
                                                    {meta}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />

                    {messageMenu && (
                        <>
                            <div className="fixed inset-0 z-[120]" onClick={() => setMessageMenu(null)} />
                            <div
                                className="fixed z-[121] bg-white dark:bg-ink-800 rounded-xl shadow-2xl border border-slate-200 dark:border-ink-600 overflow-hidden min-w-[160px]"
                                style={{ left: Math.min(messageMenu.x, window.innerWidth - 180), top: messageMenu.y }}
                            >
                                <button
                                    onClick={() => { deleteMessageForMe(messageMenu.id); setMessageMenu(null); }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gold-100 hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                                >
                                    Delete for me
                                </button>
                                {messageMenu.isMine && (
                                    <button
                                        onClick={() => { deleteMessageForEveryone(messageMenu.id); setMessageMenu(null); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition border-t border-slate-100 dark:border-ink-600"
                                    >
                                        Delete for everyone
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Composer */}
                <div className="border-t border-slate-100 dark:border-ink-600 shrink-0">
                    {isRecording ? (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span className="text-sm font-medium text-slate-600 dark:text-gold-200 flex-1">
                                Recording… {formatDuration(recordingSeconds)}
                            </span>
                            <button
                                onClick={stopRecording}
                                className="p-2.5 rounded-full bg-red-500 text-white transition shrink-0"
                                title="Stop and send"
                            >
                                <Square size={16} />
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <button
                                type="button"
                                onClick={handleAttachClick}
                                disabled={uploading}
                                className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition shrink-0 disabled:opacity-40"
                                title="Attach a photo"
                            >
                                <Paperclip size={18} />
                            </button>

                            <input
                                type="text"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder={uploading ? 'Uploading…' : 'Type a message…'}
                                disabled={uploading}
                                className="flex-1 px-3.5 py-2.5 rounded-full bg-slate-100 dark:bg-ink-700 border border-transparent dark:text-gold-50 dark:placeholder-gold-300/40 focus:border-brand-400 dark:focus:border-gold-500 focus:bg-white dark:focus:bg-ink-700 focus:outline-none text-sm transition disabled:opacity-60"
                            />

                            {draft.trim() ? (
                                <button
                                    type="submit"
                                    className="p-2.5 rounded-full bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 transition shrink-0"
                                >
                                    <Send size={16} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    disabled={uploading}
                                    className="p-2.5 rounded-full bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 transition shrink-0 disabled:opacity-40"
                                    title="Record a voice note"
                                >
                                    <Mic size={16} />
                                </button>
                            )}
                        </form>
                    )}
                </div>
            </div>

            <WallpaperPicker open={showWallpaperPicker} onClose={() => setShowWallpaperPicker(false)} currentUserId={user?.id} />

            {showDeleteModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteModal(false)} />
                    <div className="relative bg-white dark:bg-ink-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-ink-600">
                        <h3 className="font-extrabold text-slate-900 dark:text-gold-50 text-lg">Delete chat</h3>
                        <p className="text-sm text-slate-500 dark:text-gold-200/50 mt-1.5">
                            Choose how you'd like to delete this conversation with {conversation?.otherUserName}.
                        </p>

                        <div className="flex flex-col gap-2 mt-5">
                            <button
                                onClick={handleDeleteForMe}
                                disabled={deleting}
                                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-700 dark:text-gold-100 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition disabled:opacity-60"
                            >
                                Delete for me
                            </button>
                            <button
                                onClick={handleDeleteForEveryone}
                                disabled={deleting}
                                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
                            >
                                Delete for everyone
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deleting}
                                className="w-full py-2 text-sm font-semibold text-slate-400 dark:text-gold-200/50 hover:text-slate-600 dark:hover:text-gold-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}