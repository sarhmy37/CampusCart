import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

const ChatContext = createContext(null);
const POLL_MS = 4000;

export function ChatProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [conversation, setConversation] = useState(null); // { id, sellerId, sellerName }
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const pollRef = useRef(null);

    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const res = await api.get(`/chat/${conversationId}/messages`);
            setMessages(res.data);
        } catch { /* ignore, keep last known messages */ }
    }, []);

    const openChat = useCallback(async ({ sellerId, sellerName, productId }) => {
        setIsOpen(true);
        setLoading(true);
        setMessages([]);
        try {
            const res = await api.post('/chat/start', { sellerId, productId });
            const convo = { id: res.data.id, sellerId, sellerName: res.data.seller_name || sellerName };
            setConversation(convo);
            await fetchMessages(convo.id);
        } catch {
            toast.error('Could not start chat');
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    }, [fetchMessages]);

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

    // Poll for new messages while the panel is open
    useEffect(() => {
        if (isOpen && conversation) {
            pollRef.current = setInterval(() => fetchMessages(conversation.id), POLL_MS);
        }
        return () => clearInterval(pollRef.current);
    }, [isOpen, conversation, fetchMessages]);

    return (
        <ChatContext.Provider value={{ isOpen, conversation, messages, loading, openChat, closeChat, sendMessage }}>
            {children}
        </ChatContext.Provider>
    );
}

export const useChat = () => useContext(ChatContext);