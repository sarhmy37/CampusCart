import { useState, useEffect, useRef } from 'react';
import { X, Send, ChevronDown, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

const MOBILE_BREAKPOINT = 640;
const SWIPE_DISMISS_THRESHOLD = 80; // px dragged up before it counts as a dismiss

export default function ChatPanel() {
    const { isOpen, conversation, messages, loading, closeChat, sendMessage } = useChat();
    const { user } = useAuth();
    const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
    const [draft, setDraft] = useState('');
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(null);
    const dragging = useRef(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset drag offset every time the panel opens
    useEffect(() => {
        if (isOpen) setDragY(0);
    }, [isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        sendMessage(draft);
        setDraft('');
    };

    // Swipe-up-to-dismiss, mobile only, via the drag handle at the top of the panel
    const handleTouchStart = (e) => {
        if (!isMobile) return;
        startY.current = e.touches[0].clientY;
        dragging.current = true;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isMobile || !dragging.current) return;
        const diff = e.touches[0].clientY - startY.current;
        if (diff < 0) setDragY(diff); // only allow dragging upward
    };

    const handleTouchEnd = () => {
        if (!isMobile || !dragging.current) return;
        dragging.current = false;
        setIsDragging(false);

        if (dragY <= -SWIPE_DISMISS_THRESHOLD) {
            closeChat();
        } else {
            setDragY(0); // snap back
        }
    };

    if (!isOpen) return null;

    // Desktop: fixed to the right, half width, full height, slides in horizontally.
    // Mobile: fixed to the top, full width, ~87.5% height, slides in vertically,
    // leaving a strip of blurred backdrop at the bottom that's tappable to dismiss.
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
            {/* Blurred backdrop — tapping it dismisses the chat */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={closeChat}
            />

            {/* Sliding panel */}
            <div
                className="fixed bg-white dark:bg-ink-800 shadow-2xl flex flex-col"
                style={panelStyle}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile drag handle — swipe up on this to dismiss */}
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
                    <div>
                        <p className="font-bold text-slate-900 dark:text-gold-50 text-sm">
                             {conversation?.otherUserName || 'Chat'}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-gold-200/50">
                            {loading ? 'Connecting…' : 'Usually replies within a few hours'}
                        </p>
                    </div>
                    <button
                        onClick={closeChat}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 text-slate-400 dark:text-gold-200/50 transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
                            return (
                                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                            isMine
                                                ? 'bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 rounded-br-sm'
                                                : 'bg-slate-100 dark:bg-ink-700 text-slate-800 dark:text-gold-100 rounded-bl-sm'
                                        }`}
                                    >
                                        {m.content}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-ink-600 shrink-0">
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type a message…"
                        className="flex-1 px-3.5 py-2.5 rounded-full bg-slate-100 dark:bg-ink-700 border border-transparent dark:text-gold-50 dark:placeholder-gold-300/40 focus:border-brand-400 dark:focus:border-gold-500 focus:bg-white dark:focus:bg-ink-700 focus:outline-none text-sm transition"
                    />
                    <button
                        type="submit"
                        disabled={!draft.trim()}
                        className="p-2.5 rounded-full bg-brand-600 dark:bg-gold-500 text-white dark:text-ink-900 disabled:opacity-40 transition shrink-0"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
}