import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading } = useAuth();

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-brand-500 dark:border-gold-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400 dark:text-gold-200/50">Loading...</p>
                </div>
            </div>
        );
    }

    // Not logged in -> redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Admin-only route but user is not admin -> redirect to home
    if (adminOnly && user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    // All good -> render children
    return children;
}