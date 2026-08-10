import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Send } from 'lucide-react';

export default function Conversation() {
    const { userId } = useParams();
    const [searchParams] = useSearchParams();
    const productId = searchParams.get('product');
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const bottomRef = useRef(null);

    const load = () => {
        api.get(`/messages/${userId}`).then((res) => setMessages(res.data));
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 4000);
        return () => clearInterval(interval);
    }, [userId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        await api.post('/messages', { receiver_id: userId, product_id: productId, content: text });
        setText('');
        load();
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col h-[80vh]">
            <h1 className="text-lg font-bold text-slate-900 mb-4">Conversation</h1>

            <div className="flex-1 overflow-y-auto space-y-2 bg-white border border-slate-200 rounded-2xl p-4">
                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                            m.sender_id === user.id ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                        }`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="mt-3 flex gap-2">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:outline-none text-sm"
                />
                <button type="submit" className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition">
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}
