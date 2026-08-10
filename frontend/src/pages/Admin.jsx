import { useEffect, useState } from 'react';
import api from '../api/client';
import { Users, Package, ShoppingBag, DollarSign } from 'lucide-react';

export default function Admin() {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        api.get('/admin/stats').then((res) => setStats(res.data));
        api.get('/admin/users').then((res) => setUsers(res.data));
    }, []);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Admin Dashboard</h1>

            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <StatCard icon={Users} label="Users" value={stats.total_users} />
                    <StatCard icon={Package} label="Listings" value={stats.total_products} />
                    <StatCard icon={ShoppingBag} label="Orders" value={stats.total_orders} />
                    <StatCard icon={DollarSign} label="Revenue" value={`GHS ${stats.total_revenue.toFixed(2)}`} />
                </div>
            )}

            <h2 className="font-bold text-slate-800 mb-3">Users</h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3.5">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                            <p className="text-xs text-slate-400">{u.university_email}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{u.role}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <Icon size={18} className="text-brand-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
        </div>
    );
}
