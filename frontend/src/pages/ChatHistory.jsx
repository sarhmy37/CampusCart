import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, MessageCircle, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

export default function ChatHistory() {
    const navigate = useNavigate();
    const { conversations, openConversation, unreadCount } = useChat();
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Conversations are already loaded by ChatContext, but we show loading briefly
        const timer = setTimeout(() => setLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    const filteredConversations = search
        ? conversations.filter(c =>
            c.other_user_name.toLowerCase().includes(search.toLowerCase())
          )
        : conversations;

    const handleOpenChat = (convo) => {
        openConversation(convo);
        // Navigate back to home so the chat panel is visible
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-ink-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-600 dark:text-gold-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 dark:bg-ink-900/90 backdrop-blur border-b border-slate-200 dark:border-ink-600">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                    >
                        <ArrowLeft size={20} className="text-slate-700 dark:text-gold-200" />
                    </button>
                    <h1 className="text-lg font-extrabold text-slate-900 dark:text-gold-50 flex-1">
                        Messages
                    </h1>
                    {unreadCount > 0 && (
                        <span className="bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount} unread
                        </span>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gold-300/50" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search contacts..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 dark:bg-ink-800 dark:text-gold-50 placeholder:text-slate-400 dark:placeholder:text-gold-300/30 focus:border-brand-500 dark:focus:border-gold-500 focus:outline-none text-sm transition"
                    />
                </div>
            </div>

            {/* Conversations List */}
            <div className="max-w-2xl mx-auto px-4 pb-8">
                {filteredConversations.length === 0 ? (
                    <div className="text-center py-16">
                        <MessageCircle size={48} className="mx-auto text-slate-300 dark:text-gold-300/20 mb-4" />
                        <p className="text-sm text-slate-500 dark:text-gold-200/50">
                            {search ? `No results for "${search}"` : 'No conversations yet.'}
                        </p>
                        {!search && (
                            <p className="text-xs text-slate-400 dark:text-gold-200/40 mt-1">
                                Browse listings and message sellers to get started.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {filteredConversations.map((convo) => (
                            <button
                                key={convo.id}
                                onClick={() => handleOpenChat(convo)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700 border border-slate-200 dark:border-ink-600 transition text-left"
                            >
                                {/* Avatar */}
                                {convo.other_user_avatar ? (
                                    <img
                                        src={convo.other_user_avatar}
                                        alt={convo.other_user_name}
                                        className="w-12 h-12 rounded-full object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center text-lg font-bold shrink-0">
                                        {convo.other_user_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-gold-100 truncate">
                                            {convo.other_user_name}
                                        </p>
                                        {convo.last_message_at && (
                                            <span className="text-[11px] text-slate-400 dark:text-gold-300/40 shrink-0">
                                                {formatRelativeTime(convo.last_message_at)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <p className="text-xs text-slate-500 dark:text-gold-200/60 truncate">
                                            {convo.last_message || 'No messages yet'}
                                        </p>
                                        {convo.unread_count > 0 && (
                                            <span className="bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold rounded-full min-w-[18px] h-5 px-1.5 flex items-center justify-center shrink-0">
                                                {convo.unread_count > 9 ? '9+' : convo.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}