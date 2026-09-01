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

        const hideWallpaperForMe = useCallback(async (hidden) => {
        if (!conversation) return;
        try {
            await api.put(`/chat/${conversation.id}/wallpaper/hide`, { hidden });
            await fetchWallpaper(conversation.id);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not update wallpaper visibility');
        }
    }, [conversation, fetchWallpaper]);

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

    // Like openConversation, but takes an already-normalized { id, otherUserId, otherUserName,
    // otherUserAvatar } object (rather than the snake_case shape the Navbar inbox returns).
    // Used after broadcastToSellers, since we already have that exact shape at hand and don't
    // want to re-key it just to reuse openConversation.
    const openConversationDirect = useCallback(async (convo) => {
        setIsOpen(true);
        setLoading(true);
        setMessages([]);
        setWallpaper(null);
        setConversation(convo);
        await Promise.all([fetchMessages(convo.id), fetchWallpaper(convo.id)]);
        setLoading(false);
    }, [fetchMessages, fetchWallpaper]);

    const closeChat = useCallback(() => {
        setIsOpen(false);
    }, []);

        const deleteForMe = useCallback(async () => {
        if (!conversation) return;
        try {
            await api.post(`/chat/${conversation.id}/delete-for-me`);
            toast.success('Chat deleted');
            setIsOpen(false);
            fetchConversations();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete chat');
        }
    }, [conversation, fetchConversations]);

    const deleteForEveryone = useCallback(async () => {
        if (!conversation) return;
        try {
            await api.post(`/chat/${conversation.id}/delete-for-everyone`);
            toast.success('Chat deleted for everyone');
            setMessages([]);
            fetchConversations();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete chat for everyone');
        }
    }, [conversation, fetchConversations]);

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

    // Used from Cart.jsx checkout — sends the SAME message to a list of sellers, creating
    // (or finding) a conversation with each one first. Used when a cart has items from
    // multiple sellers, so the buyer only has to type the message once.
    // `sellers` is an array of { sellerId, sellerName, productId }.
    // Returns the list of resulting conversations (normalized, ready for openConversationDirect).
    const broadcastToSellers = useCallback(async (sellers, content) => {
        const trimmed = content.trim();
        if (!sellers?.length || !trimmed) return [];

        const results = [];
        for (const s of sellers) {
            try {
                const startRes = await api.post('/chat/start', { sellerId: s.sellerId, productId: s.productId });
                await api.post(`/chat/${startRes.data.id}/messages`, { content: trimmed });
                results.push({
                    id: startRes.data.id,
                    otherUserId: s.sellerId,
                    otherUserName: startRes.data.seller_name || s.sellerName,
                    otherUserAvatar: startRes.data.seller_avatar || null,
                });
            } catch (err) {
                toast.error(
                    err.response?.data?.error || `Could not message ${s.sellerName || 'a seller'}`
                );
            }
        }

        fetchConversations();
        return results;
    }, [fetchConversations]);

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
                openConversationDirect,
                broadcastToSellers,
                closeChat,
                deleteForMe,
                deleteForEveryone,
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
                hideWallpaperForMe,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export const useChat = () => useContext(ChatContext);