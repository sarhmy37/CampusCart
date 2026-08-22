import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);
const MESSAGE_POLL_MS = 4000;
const INBOX_POLL_MS = 15000;
const PRESENCE_POLL_MS = 15000;
const INBOX_PAGE_SIZE = 10;

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [conversation, setConversation] = useState(null); // { id, otherUserId, otherUserName, otherUserAvatar }
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [otherUserLastActive, setOtherUserLastActive] = useState(null);

    const [conversations, setConversations] = useState([]);
    const [visibleCount, setVisibleCount] = useState(INBOX_PAGE_SIZE);

    // Wallpaper — per conversation, per user (stored server-side so it follows the user across devices)
    const [wallpaper, setWallpaper] = useState(null); // { type: 'none' | 'preset' | 'custom', value: string | null }
    const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

    const messagePollRef = useRef(null);
    const inboxPollRef = useRef(null);
    const presencePollRef = useRef(null);

    const fetchConversations = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/chat/conversations');
            setConversations(res.data);
        } catch { /* ignore */ }
    }, [user]);

    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const res = await api.get(`/chat/${conversationId}/messages`);
            setMessages(res.data);
            fetchConversations();
        } catch { /* ignore, keep last known messages */ }
    }, [fetchConversations]);

    const fetchPresence = useCallback(async (otherUserId) => {
        try {
            const res = await api.get(`/chat/presence/${otherUserId}`);
            setOtherUserLastActive(res.data.last_active_at);
        } catch { /* ignore */ }
    }, []);

    const fetchWallpaper = useCallback(async (conversationId) => {
        try {
            const res = await api.get(`/chat/${conversationId}/wallpaper`);
            // Expected shape: { type: 'none' | 'preset' | 'custom', value: string | null }
            setWallpaper(res.data || { type: 'none', value: null });
        } catch {
            setWallpaper({ type: 'none', value: null });
        }
    }, []);

    const setWallpaperPreset = useCallback(async (type, value) => {
        if (!conversation) return;
        // optimistic update
        const previous = wallpaper;
        setWallpaper({ type, value });
        try {
            const res = await api.put(`/chat/${conversation.id}/wallpaper`, { type, value });
            setWallpaper(res.data || { type, value });
        } catch (err) {
            setWallpaper(previous);
            toast.error(err.response?.data?.error || 'Could not update wallpaper');
        }
    }, [conversation, wallpaper]);

    const uploadWallpaper = useCallback(async (file) => {
        if (!conversation) return;
        setUploadingWallpaper(true);
        try {
            const formData = new FormData();
            formData.append('wallpaper', file);
            const res = await api.post(`/chat/${conversation.id}/wallpaper/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setWallpaper(res.data || { type: 'custom', value: null });
            toast.success('Wallpaper updated');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploadingWallpaper(false);
        }
    }, [conversation]);

    // Used from Cart.jsx — finds or creates a conversation with a seller about a product
    const openChat = useCallback(async ({ sellerId, sellerName, productId }) => {
    setIsOpen(true);
    setLoading(true);
    setMessages([]);
    setWallpaper(null);
    try {
        const res = await api.post('/chat/start', { sellerId, productId });
        const convo = {
            id: res.data.id,
            otherUserId: sellerId,
            otherUserName: res.data.seller_name || sellerName,
            otherUserAvatar: res.data.seller_avatar || null,
        };
        setConversation(convo);
        await Promise.all([fetchMessages(convo.id), fetchWallpaper(convo.id)]);
    } catch (err) {
        if (err.response?.data?.banned) {
            toast.error(err.response?.data?.error || 'Cannot start chat — account is banned.');
        } else {
            toast.error(err.response?.data?.error || 'Could not start chat');
        }
        setIsOpen(false);
    } finally {
        setLoading(false);
    }
}, [fetchMessages, fetchWallpaper]);

    // Used from the Navbar inbox — opens an existing conversation directly
    const openConversation = useCallback(async (convo) => {
        setIsOpen(true);
        setLoading(true);
        setMessages([]);
        setWallpaper(null);
        setConversation({
            id: convo.id,
            otherUserId: convo.other_user_id,
            otherUserName: convo.other_user_name,
            otherUserAvatar: convo.other_user_avatar || null,
        });
        await Promise.all([fetchMessages(convo.id), fetchWallpaper(convo.id)]);
        setLoading(false);
    }, [fetchMessages, fetchWallpaper]);

    const closeChat = useCallback(() => {
        setIsOpen(false);
    }, []);

    const sendMessage = useCallback(async (content) => {
        if (!conversation || !content.trim()) return;
        try {
            await api.post(`/chat/${conversation.id}/messages`, { content: content.trim() });
            await fetchMessages(conversation.id);
        } catch {
            toast.error('Message failed to send');
        }
    }, [conversation, fetchMessages]);

     // file: a File or Blob. mediaType is inferred server-side from the file's mimetype.
    const sendMedia = useCallback(async (file) => {
        if (!conversation) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('media', file);
            await api.post(`/chat/${conversation.id}/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await fetchMessages(conversation.id);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
        }
    }, [conversation, fetchMessages]);

    const showMoreConversations = useCallback(() => {
        setVisibleCount((c) => c + INBOX_PAGE_SIZE);
    }, []);

    // Poll for new messages while the panel is open
    useEffect(() => {
        if (isOpen && conversation) {
            messagePollRef.current = setInterval(() => fetchMessages(conversation.id), MESSAGE_POLL_MS);
        }
        return () => clearInterval(messagePollRef.current);
    }, [isOpen, conversation, fetchMessages]);

    // Poll the other person's presence while the panel is open
    useEffect(() => {
        if (isOpen && conversation) {
            fetchPresence(conversation.otherUserId);
            presencePollRef.current = setInterval(() => fetchPresence(conversation.otherUserId), PRESENCE_POLL_MS);
        } else {
            setOtherUserLastActive(null);
        }
        return () => clearInterval(presencePollRef.current);
    }, [isOpen, conversation, fetchPresence]);

    // Poll the inbox in the background (so the navbar badge stays current
    // even when the chat panel itself isn't open)
    useEffect(() => {
        if (!user) {
            setConversations([]);
            return;
        }
        fetchConversations();
        inboxPollRef.current = setInterval(fetchConversations, INBOX_POLL_MS);
        return () => clearInterval(inboxPollRef.current);
    }, [user, fetchConversations]);

    // Collapse back to the first page of conversations each time the panel closes
    useEffect(() => {
        if (!isOpen) setVisibleCount(INBOX_PAGE_SIZE);
    }, [isOpen]);

    const unreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    return (
        <ChatContext.Provider
            value={{
                isOpen,
                conversation,
                messages,
                loading,
                uploading,
                otherUserLastActive,
                openChat,
                openConversation,
                closeChat,
                sendMessage,
                sendMedia,
                conversations,
                visibleCount,
                showMoreConversations,
                unreadCount,
                wallpaper,
                uploadingWallpaper,
                setWallpaperPreset,
                uploadWallpaper,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export const useChat = () => useContext(ChatContext);