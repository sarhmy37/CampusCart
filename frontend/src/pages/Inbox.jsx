import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { MessageCircle } from 'lucide-react';

export default function Inbox() {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/messages/inbox').then((res) => setThreads(res.data)).finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-2xl mx-auto px-4 py-10">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Messages</h1>

            {loading ? (
                <p className="text-slate-400 text-sm">Loading...</p>
            ) : threads.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <MessageCircle className="mx-auto mb-3" size={32} />
                    <p>No conversations yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {threads.map((t) => (
                        <Link key={t.other_user} to={`/messages/${t.other_user}`} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 transition">
                            <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-800">User #{t.other_user}</p>
                                <p className="text-xs text-slate-400 truncate max-w-xs">{t.content}</p>
                            </div>
                            {!t.is_read && t.sender_id !== t.other_user && (
                                <span className="w-2 h-2 rounded-full bg-brand-500" />
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
