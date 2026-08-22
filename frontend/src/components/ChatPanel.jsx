import { useState, useEffect, useRef } from 'react';
import { X, Send, ChevronDown, Loader2, Paperclip, Mic, Square, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MOBILE_BREAKPOINT = 640;
const SWIPE_DISMISS_THRESHOLD = 80;
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // treat as "logged in" if active within the last 2 minutes

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
    const { isOpen, conversation, messages, loading, uploading, otherUserLastActive, closeChat, sendMessage, sendMedia } = useChat();
    const { user } = useAuth();
    const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
    const [draft, setDraft] = useState('');
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);

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

        // Ask for the most widely-compatible format the browser can actually record,
    // rather than assuming webm — Safari and some other browsers default to
    // a different codec, and mislabeling the file breaks playback.
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
                // recorder.mimeType reflects what the browser ACTUALLY used,
                // regardless of what we asked for — always trust this over
                // any assumption.
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
                    <div className="flex items-center gap-3">
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
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
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

    return (
        <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                    className={`rounded-2xl text-sm leading-relaxed overflow-hidden ${
                        m.media_type === 'image' ? '' : 'px-3.5 py-2.5'
                    } ${
                        isMine
                            ? 'bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 rounded-br-sm'
                            : 'bg-slate-100 dark:bg-ink-700 text-slate-800 dark:text-gold-100 rounded-bl-sm'
                    }`}
                >
                    {m.media_type === 'image' && (
                        <img src={m.media_url} alt="" className="max-w-full rounded-2xl" />
                    )}
                    {m.media_type === 'audio' && (
                        <audio controls src={m.media_url} className="max-w-full" />
                    )}
                    {m.content && <p className={m.media_type ? 'px-3.5 py-2.5' : ''}>{m.content}</p>}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[11px] text-slate-400 dark:text-gold-300/40">
                        {formatMessageTime(m.created_at)}
                    </span>
                    {isMine && (
                        m.read ? (
                            <CheckCheck size={14} className="text-brand-500 dark:text-gold-400" />
                        ) : otherUserOnline ? (
                            <CheckCheck size={14} className="text-slate-300 dark:text-gold-300/30" />
                        ) : (
                            <Check size={14} className="text-slate-300 dark:text-gold-300/30" />
                        )
                    )}
                </div>
            </div>
        </div>
    );
})
                    )}
                    <div ref={messagesEndRef} />
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
        </div>
    );
}