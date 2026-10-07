import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import api from '../api/client';
import { useAuth } from './AuthContext';

const ChatContext = createContext<any>(null);
const MESSAGE_POLL_MS = 4000;
const MUTED_KEY = 'cc_muted_conversations';
const INBOX_POLL_MS = 15000;
const PRESENCE_POLL_MS = 15000;
const INBOX_PAGE_SIZE = 10;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [otherUserLastActive, setOtherUserLastActive] = useState<string | null>(null);

  const [conversations, setConversations] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(INBOX_PAGE_SIZE);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);

  const [wallpaper, setWallpaper] = useState<any>(null);
  const [mutedIds, setMutedIds] = useState<Set<number>>(new Set());
  const [pendingStoryReply, setPendingStoryReply] = useState<any>(null);

  // hydrate muted ids from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(MUTED_KEY);
        setMutedIds(new Set(stored ? JSON.parse(stored) : []));
      } catch {
        setMutedIds(new Set());
      }
    })();
  }, []);

  const isMuted = useCallback((conversationId: number) => mutedIds.has(conversationId), [mutedIds]);

  const toggleMute = useCallback((conversationId: number) => {
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      AsyncStorage.setItem(MUTED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

  const messagePollRef = useRef<any>(null);
  const inboxPollRef = useRef<any>(null);
  const presencePollRef = useRef<any>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch (err: any) {
      console.log('convos failed:', err?.response?.status, err?.response?.data || err.message);
    }
  }, [user]);

  const fetchMessages = useCallback(async (conversationId: number) => {
    try {
      const res = await api.get(`/chat/${conversationId}/messages`);
      setMessages(res.data);
      fetchConversations();
    } catch {}
  }, [fetchConversations]);

  const fetchPresence = useCallback(async (otherUserId: number) => {
    try {
      const res = await api.get(`/chat/presence/${otherUserId}`);
      setOtherUserLastActive(res.data.last_active_at);
    } catch {}
  }, []);

  const fetchWallpaper = useCallback(async (conversationId: number) => {
    try {
      const res = await api.get(`/chat/${conversationId}/wallpaper`);
      setWallpaper(res.data || { type: 'none', value: null });
    } catch {
      setWallpaper({ type: 'none', value: null });
    }
  }, []);

  const setWallpaperPreset = useCallback(async (type: string, value: string) => {
    if (!conversation) return;
    const previous = wallpaper;
    setWallpaper({ type, value });
    try {
      const res = await api.put(`/chat/${conversation.id}/wallpaper`, { type, value });
      setWallpaper(res.data || { type, value });
    } catch (err: any) {
      setWallpaper(previous);
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not update wallpaper' });
    }
  }, [conversation, wallpaper]);

  const hideWallpaperForMe = useCallback(async (hidden: boolean) => {
    if (!conversation) return;
    try {
      await api.put(`/chat/${conversation.id}/wallpaper/hide`, { hidden });
      await fetchWallpaper(conversation.id);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not update wallpaper visibility' });
    }
  }, [conversation, fetchWallpaper]);

  // NOTE: `file` here will come from expo-image-picker later ({ uri, name, type }),
  // not a browser File — this still works with FormData.append as-is on RN.
  const uploadWallpaper = useCallback(async (file: any) => {
    if (!conversation) return;
    setUploadingWallpaper(true);
    try {
      const formData = new FormData();
      formData.append('wallpaper', file);
      const res = await api.post(`/chat/${conversation.id}/wallpaper/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setWallpaper(res.data || { type: 'custom', value: null });
      Toast.show({ type: 'success', text1: 'Wallpaper updated' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Upload failed' });
    } finally {
      setUploadingWallpaper(false);
    }
  }, [conversation]);

  const openChat = useCallback(async ({ sellerId, sellerName, productId, draftMessage, storyId, storyMediaUrl, storyMediaType, storyCaption }: any) => {
    setIsOpen(true);
    setLoading(true);
    setMessages([]);
    setWallpaper(null);
    setPendingDraft(draftMessage || null);
    setPendingStoryReply(storyId ? { id: storyId, mediaUrl: storyMediaUrl, mediaType: storyMediaType, caption: storyCaption } : null);
    try {
      const res = await api.post('/chat/start', { sellerId, productId });
      const convo = {
        id: res.data.id,
        otherUserId: sellerId,
        otherUserName: res.data.seller_name || sellerName,
        otherUserAvatar: res.data.seller_avatar || null,
        otherUserAccountType: res.data.seller_account_type || null,
        otherUserPlan: res.data.seller_plan || null,
        otherUserPlanExpiresAt: res.data.seller_plan_expires_at || null,
      };
      setConversation(convo);
      await Promise.all([fetchMessages(convo.id), fetchWallpaper(convo.id)]);
    } catch (err: any) {
      if (err.response?.data?.banned) {
        Toast.show({ type: 'error', text1: err.response?.data?.error || 'Cannot start chat — account is banned.' });
      } else {
        Toast.show({ type: 'error', text1: err.response?.data?.error || 'Could not start chat' });
      }
      setIsOpen(false);
      setPendingDraft(null);
    } finally {
      setLoading(false);
    }
  }, [fetchMessages, fetchWallpaper]);

  const openConversation = useCallback(async (convo: any) => {
    setIsOpen(true);
    setLoading(true);
    setMessages([]);
    setWallpaper(null);
    setPendingDraft(null);
    setConversation({
      id: convo.id,
      otherUserId: convo.other_user_id,
      otherUserName: convo.other_user_name,
      otherUserAvatar: convo.other_user_avatar || null,
      otherUserAccountType: convo.other_user_account_type || null,
      otherUserPlan: convo.other_user_plan || null,
      otherUserPlanExpiresAt: convo.other_user_plan_expires_at || null,
    });
    await Promise.all([fetchMessages(convo.id), fetchWallpaper(convo.id)]);
    setLoading(false);
  }, [fetchMessages, fetchWallpaper]);

  const openConversationDirect = useCallback(async (convo: any) => {
    setIsOpen(true);
    setLoading(true);
    setMessages([]);
    setWallpaper(null);
    setPendingDraft(null);
    setConversation({
      id: convo.id,
      otherUserId: convo.other_user_id,
      otherUserName: convo.other_user_name,
      otherUserAvatar: convo.other_user_avatar || null,
      otherUserAccountType: convo.other_user_account_type || null,
      otherUserPlan: convo.other_user_plan || null,
      otherUserPlanExpiresAt: convo.other_user_plan_expires_at || null,
    });
    await Promise.all([fetchMessages(convo.id), fetchWallpaper(convo.id)]);
    setLoading(false);
  }, [fetchMessages, fetchWallpaper]);

  const closeChat = useCallback(() => setIsOpen(false), []);
  const clearPendingDraft = useCallback(() => setPendingDraft(null), []);
  const clearPendingStoryReply = useCallback(() => setPendingStoryReply(null), []);

  const deleteForMe = useCallback(async () => {
    if (!conversation) return;
    try {
      await api.post(`/chat/${conversation.id}/delete-for-me`);
      Toast.show({ type: 'success', text1: 'Chat deleted' });
      setIsOpen(false);
      fetchConversations();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to delete chat' });
    }
  }, [conversation, fetchConversations]);

  const deleteMessageForMe = useCallback(async (messageId: number) => {
    if (!conversation) return;
    try {
      await api.post(`/chat/messages/${messageId}/delete-for-me`);
      await fetchMessages(conversation.id);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to delete message' });
    }
  }, [conversation, fetchMessages]);

  const deleteMessageForEveryone = useCallback(async (messageId: number) => {
    if (!conversation) return;
    try {
      await api.post(`/chat/messages/${messageId}/delete-for-everyone`);
      await fetchMessages(conversation.id);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to delete message' });
    }
  }, [conversation, fetchMessages]);

  const deleteForEveryone = useCallback(async () => {
    if (!conversation) return;
    try {
      await api.post(`/chat/${conversation.id}/delete-for-everyone`);
      Toast.show({ type: 'success', text1: 'Chat deleted for everyone' });
      setMessages([]);
      fetchConversations();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Failed to delete chat for everyone' });
    }
  }, [conversation, fetchConversations]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversation || !content.trim()) return;
    try {
      const body: any = { content: content.trim() };
      if (pendingStoryReply) body.reply_story_id = pendingStoryReply.id;
      await api.post(`/chat/${conversation.id}/messages`, body);
      setPendingStoryReply(null);
      await fetchMessages(conversation.id);
    } catch {
      Toast.show({ type: 'error', text1: 'Message failed to send' });
    }
  }, [conversation, fetchMessages, pendingStoryReply]);

  const sendMedia = useCallback(async (file: any) => {
    if (!conversation) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('media', file);
      await api.post(`/chat/${conversation.id}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchMessages(conversation.id);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }, [conversation, fetchMessages]);

  const broadcastToSellers = useCallback(async (sellers: any[], content: string) => {
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
      } catch (err: any) {
        Toast.show({ type: 'error', text1: err.response?.data?.error || `Could not message ${s.sellerName || 'a seller'}` });
      }
    }

    fetchConversations();
    return results;
  }, [fetchConversations]);

  const sendQuickMessage = useCallback(async (sellerId: any, content: string, storyId?: string) => {
    try {
      const startRes = await api.post('/chat/start', { sellerId });
      const body: any = { content };
      if (storyId) body.reply_story_id = storyId;
      await api.post(`/chat/${startRes.data.id}/messages`, body);
      fetchConversations();
      return true;
    } catch (err: any) {
      console.log('quick send failed', err?.response?.status, err?.response?.data);
      return false;
    }
  }, [fetchConversations]);

  const showMoreConversations = useCallback(() => {
    setVisibleCount((c) => c + INBOX_PAGE_SIZE);
  }, []);

  useEffect(() => {
    if (!(isOpen && conversation)) return;

    messagePollRef.current = setInterval(() => fetchMessages(conversation.id), MESSAGE_POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearInterval(messagePollRef.current);
        fetchMessages(conversation.id);
        messagePollRef.current = setInterval(() => fetchMessages(conversation.id), MESSAGE_POLL_MS);
      } else {
        clearInterval(messagePollRef.current);
      }
    });

    return () => {
      clearInterval(messagePollRef.current);
      sub.remove();
    };
  }, [isOpen, conversation, fetchMessages]);

  useEffect(() => {
    if (!(isOpen && conversation)) {
      setOtherUserLastActive(null);
      return;
    }

    fetchPresence(conversation.otherUserId);
    presencePollRef.current = setInterval(() => fetchPresence(conversation.otherUserId), PRESENCE_POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearInterval(presencePollRef.current);
        fetchPresence(conversation.otherUserId);
        presencePollRef.current = setInterval(() => fetchPresence(conversation.otherUserId), PRESENCE_POLL_MS);
      } else {
        clearInterval(presencePollRef.current);
      }
    });

    return () => {
      clearInterval(presencePollRef.current);
      sub.remove();
    };
  }, [isOpen, conversation, fetchPresence]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    fetchConversations();
    inboxPollRef.current = setInterval(fetchConversations, INBOX_POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearInterval(inboxPollRef.current);
        fetchConversations();
        inboxPollRef.current = setInterval(fetchConversations, INBOX_POLL_MS);
      } else {
        clearInterval(inboxPollRef.current);
      }
    });

    return () => {
      clearInterval(inboxPollRef.current);
      sub.remove();
    };
  }, [user, fetchConversations]);

  useEffect(() => {
    if (!isOpen) setVisibleCount(INBOX_PAGE_SIZE);
  }, [isOpen]);

  const unreadCount = conversations.reduce(
    (sum, c) => sum + (mutedIds.has(c.id) ? 0 : (Number(c.unread_count) || 0)),
    0
  );

  return (
    <ChatContext.Provider
      value={{
        isOpen, conversation, messages, loading, uploading, otherUserLastActive,
        openChat, openConversation, openConversationDirect, pendingDraft, clearPendingDraft,
        pendingStoryReply, clearPendingStoryReply,
        broadcastToSellers, closeChat, deleteForMe, deleteForEveryone, deleteMessageForMe,
        deleteMessageForEveryone, sendMessage, sendMedia, conversations, visibleCount,
        showMoreConversations, unreadCount, wallpaper, isMuted, toggleMute, uploadingWallpaper,
        setWallpaperPreset, uploadWallpaper, hideWallpaperForMe, sendQuickMessage,
        fetchConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);