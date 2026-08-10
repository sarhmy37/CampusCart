import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading } = useAuth();

    if (loading) return <div className="flex justify-center py-20 text-slate-400">Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;

    return children;
}
