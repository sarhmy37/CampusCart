import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LOGO_LIGHT, LOGO_DARK } from '../data/media';

export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading } = useAuth();

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <style>{`
                    @keyframes protectedRouteLogoPulse {
                        0%, 100% { transform: scale(1); opacity: 0.55; }
                        50% { transform: scale(1.15); opacity: 1; }
                    }
                    .protected-route-logo-pulse { animation: protectedRouteLogoPulse 1.6s ease-in-out infinite; }
                `}</style>
                <img src={LOGO_DARK} alt="" className="h-12 w-auto dark:hidden protected-route-logo-pulse" />
                <img src={LOGO_LIGHT} alt="" className="h-12 w-auto hidden dark:block protected-route-logo-pulse" />
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