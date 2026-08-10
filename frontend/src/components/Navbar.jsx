import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, Trash2, PlusCircle, LayoutDashboard, Home, Bell, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import ProfileDrawer from './ProfileDrawer';

export default function Navbar() {
    const { user } = useAuth();
    const { count } = useCart();
    const { items: wishlistItems, count: wishlistCount, removeItem: removeWishlistItem } = useWishlist();
const [showWishlist, setShowWishlist] = useState(false);
    const { notifications, unreadCount, markAllRead } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const isHome = location.pathname === '/';
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    const toggleNotifications = () => {
        setShowNotifications((s) => {
            const next = !s;
            if (next) markAllRead();
            return next;
        });
    };

   return (
        <>
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 shrink-0">
                    {user && (
                        <button
                            onClick={() => setShowProfile(true)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition"
                            title="Profile"
                        >
                            <Menu size={20} className="text-slate-700" />
                        </button>
                    )}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center text-white font-extrabold text-lg">C</div>
                        <span className="font-extrabold text-xl tracking-tight text-slate-900">Campus<span className="text-brand-600">Cart</span></span>
                    </Link>
                </div>

                <div className="hidden md:flex flex-1 max-w-xl">
                    <SearchBar />
                </div>

                <nav className="flex items-center gap-1 sm:gap-2">
                    {!isHome && (
                        <Link to="/" className="p-2 rounded-lg hover:bg-slate-100 transition" title="Home">
                            <Home size={20} className="text-slate-700" />
                        </Link>
                    )}
                    {user && user.account_type === 'seller' && (
                        <Link to="/sell/new" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-700 hover:bg-brand-50 transition">
                            <PlusCircle size={18} /> Sell
                        </Link>
                    )}

                    <div className="relative">
                        <button
                            onClick={toggleNotifications}
                            className="relative p-2 rounded-lg hover:bg-slate-100 transition"
                            title="Notifications"
                        >
                            <Bell size={20} className="text-slate-700" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
                                    <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-900">
                                        New listings
                                    </div>
                                    {notifications.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-sm text-slate-400">
                                            No new listings yet. We check every 5 minutes.
                                        </p>
                                    ) : (
                                        notifications.map((n) => (
                                            <Link
                                                key={n.id}
                                                to={`/product/${n.id}`}
                                                onClick={() => setShowNotifications(false)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition"
                                            >
                                                {n.primary_image && (
                                                    <img src={n.primary_image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
                                                    <p className="text-xs text-slate-400 truncate">
                                                        {n.seller_name ? `${n.seller_name} · ` : ''}{n.category}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <Link to="/cart" className="relative p-2 rounded-lg hover:bg-slate-100 transition">
                        <ShoppingCart size={20} className="text-slate-700" />
                        {count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
                        )}
                    </Link>
                    {user ? (
                        <>
                            <div className="relative">
    <button
        onClick={() => setShowWishlist((s) => !s)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition"
        title="Wishlist"
    >
        <Heart size={20} className="text-slate-700" />
        {wishlistCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {wishlistCount}
            </span>
        )}
    </button>

    {showWishlist && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setShowWishlist(false)} />
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
                <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-900">
                    Wishlist
                </div>
                {wishlistItems.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">
                        Nothing saved yet. Tap the heart on any listing to add it here.
                    </p>
                ) : (
                    wishlistItems.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition"
                        >
                            <Link
                                to={`/product/${p.id}`}
                                onClick={() => setShowWishlist(false)}
                                className="flex items-center gap-3 flex-1 min-w-0"
                            >
                                {p.primary_image && (
                                    <img src={p.primary_image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{p.title}</p>
                                    <p className="text-xs text-slate-400 truncate">
                                        GHS {parseFloat(p.price).toFixed(2)} · {p.condition}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">{p.seller_name}</p>
                                </div>
                            </Link>
                            <button
                                onClick={() => removeWishlistItem(p.id)}
                                className="text-slate-300 hover:text-red-500 p-1.5 transition shrink-0"
                                title="Remove from wishlist"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </>
    )}
</div>
                            {user.role === 'admin' && (
                                <Link to="/admin" className="p-2 rounded-lg hover:bg-slate-100 transition">
                                    <LayoutDashboard size={20} className="text-slate-700" />
                                </Link>
                            )}
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-brand-700 transition">Log in</Link>
                            <Link to="/register" className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-sm">Sign up</Link>
                        </>
                    )}
                </nav>
            </div>
           <div className="md:hidden px-4 pb-3">
                <SearchBar />
            </div>
        </header>
<ProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />
        </>
    );
}        

function SearchBar() {
    const navigate = useNavigate();
    const onSubmit = (e) => {
        e.preventDefault();
        const q = e.target.q.value.trim();
        navigate(q ? `/browse?search=${encodeURIComponent(q)}` : '/browse');
    };
    return (
        <form onSubmit={onSubmit} className="w-full">
            <input
                name="q"
                type="text"
                placeholder="Search textbooks, electronics, furniture..."
                className="w-full px-4 py-2.5 rounded-full bg-slate-100 border border-transparent focus:border-brand-400 focus:bg-white focus:outline-none text-sm transition"
            />
        </form>
    );
}