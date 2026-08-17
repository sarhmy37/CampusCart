import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, Trash2, PlusCircle, LayoutDashboard, Home, Bell, Menu, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import ProfileDrawer from './ProfileDrawer';
import { LOGO_LIGHT, LOGO_DARK } from '../data/media';

export default function Navbar() {
    const { user } = useAuth();
    const { count } = useCart();
    const { items: wishlistItems, count: wishlistCount, removeItem: removeWishlistItem } = useWishlist();
    const [showWishlist, setShowWishlist] = useState(false);
    const { notifications, unreadCount, markAllRead, clearAllNotifications } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const isHome = location.pathname === '/';
    const isAdmin = user?.role === 'admin';
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const { theme } = useTheme();

    const toggleNotifications = () => {
        setShowNotifications((s) => {
            const next = !s;
            if (next) markAllRead();
            return next;
        });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const q = e.target.q.value.trim();
        if (!q) return;
        if (isAdmin) {
            navigate(`/admin?search=${encodeURIComponent(q)}`);
        } else {
            navigate(q ? `/browse?search=${encodeURIComponent(q)}` : '/browse');
        }
    };

    return (
        <>
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-ink-900/90 backdrop-blur border-b border-slate-200 dark:border-ink-600">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {user && (
                        <button
                            onClick={() => setShowProfile(true)}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                            title="Profile"
                        >
                            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                        </button>
                    )}
                    
                    {/* ====== LOGO (IMAGE + TEXT COMBINED) ====== */}
                    {isAdmin ? (
                        <span className="flex items-center gap-1.5 sm:gap-2 cursor-default">
                            <img 
                                src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK} 
                                alt="TreX" 
                                className="h-7 sm:h-9 w-auto object-contain"
                            />
                            <div className="flex items-center font-serif font-black italic tracking-wider">
                                <span className="text-base sm:text-xl text-slate-900 dark:text-white">
                                    Tre
                                </span>
                                <span className="text-base sm:text-xl text-slate-900 dark:text-white mx-0.5">
                                    -
                                </span>
                                <span className="text-2xl sm:text-3xl text-brand-600 dark:text-gold-400 leading-none">
                                    X
                                </span>
                            </div>
                        </span>
                    ) : (
                        <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
                            <img 
                                src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK} 
                                alt="TreX" 
                                className="h-7 sm:h-9 w-auto object-contain"
                            />
                            <div className="flex items-center font-serif font-black italic tracking-wider">
                                <span className="text-base sm:text-2xl text-slate-900 dark:text-white font-bold">
                                    Tre
                                </span>
                                <span className="text-base sm:text-2xl text-slate-900 dark:text-white mx-0.5">
                                    -
                                </span>
                                <span className="text-2xl sm:text-5xl text-brand-600 dark:text-gold-400 leading-none">
                                    X
                                </span>
                            </div>
                        </Link>
                    )}
                    {/* ============================== */}
                </div>

                <div className="flex flex-1 min-w-0 max-w-xl">
                    <SearchBar isAdmin={isAdmin} onSubmit={handleSearch} />
                </div>

                <nav className="flex items-center gap-0.5 sm:gap-2 shrink-0">
                    {/* Mobile-only collapse toggle for notifications + wishlist */}
                    {user && (
                        <button
                            onClick={() => setMobileExpanded((e) => !e)}
                            className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                            title={mobileExpanded ? 'Hide' : 'More'}
                        >
                            {mobileExpanded ? (
                                <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-gold-200" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-slate-700 dark:text-gold-200" />
                            )}
                        </button>
                    )}

                    {!isHome && !isAdmin && (
                        <Link to="/" className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition" title="Home">
                            <Home className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                        </Link>
                    )}
                    {user && user.account_type === 'seller' && !isAdmin && (
                        <Link to="/sell/new" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-700 dark:text-gold-400 hover:bg-brand-50 dark:hover:bg-ink-700 transition">
                            <PlusCircle size={18} /> Sell
                        </Link>
                    )}

                    <div className={`relative ${mobileExpanded ? 'flex' : 'hidden'} sm:flex`}>
                        <button
                            onClick={toggleNotifications}
                            className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                            title="Notifications"
                        >
                            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                                <div className="absolute right-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto bg-white dark:bg-ink-800 rounded-2xl shadow-xl border border-slate-200 dark:border-ink-600 z-50">
                                    <div className="px-4 py-3 border-b border-slate-100 dark:border-ink-600 font-semibold text-sm text-slate-900 dark:text-gold-100">
                                        Notifications
                                    </div>
                                    {notifications.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-gold-200/50">
                                            Nothing yet. We check every minute.
                                        </p>
                                    ) : (
                                        <>
                                            {notifications.map((n) => {
                                                // Determine the navigation link: use backend 'link' if available, otherwise fallback to product page
                                                const targetLink = n.link || `/product/${n.productId || n.id}`;
                                                
                                                // Helper to pick an icon based on type
                                                let iconEmoji = '';
                                                if (n.type === 'price_drop') iconEmoji = '💰 ';
                                                else if (n.type === 'low_stock') iconEmoji = '⚡ ';
                                                else if (n.type === 'new_listing') iconEmoji = '🛍️ ';
                                                else if (n.type === 'out_of_stock') iconEmoji = '📦 ';
                                                else if (n.type === 'delivery_reminder') iconEmoji = '🚚 ';
                                                else if (n.type === 'new_order') iconEmoji = '📦 ';
                                                else if (n.type === 'delivery_marked') iconEmoji = '✅ ';

                                                return (
                                                    <Link
                                                        key={n.id}
                                                        to={targetLink}
                                                        onClick={() => setShowNotifications(false)}
                                                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-700 border-b border-slate-50 dark:border-ink-700 last:border-0 transition"
                                                    >
                                                        {n.primary_image && (
                                                            <img src={n.primary_image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-gold-100 truncate">
                                                                {iconEmoji}{n.title}
                                                            </p>
                                                            <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">
                                                                {n.message}
                                                            </p>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                            <div className="px-4 py-2 border-t border-slate-100 dark:border-ink-600">
                                                <button
                                                    onClick={clearAllNotifications}
                                                    className="text-xs text-slate-400 dark:text-gold-200/50 hover:text-red-500 dark:hover:text-red-400 transition font-semibold w-full text-center"
                                                >
                                                    Clear all
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <Link to="/cart" className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition">
                        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                        {count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
                        )}
                    </Link>
                    {user ? (
                        <>
                            <div className={`relative ${mobileExpanded ? 'block' : 'hidden'} sm:block`}>
                                <button
                                    onClick={() => setShowWishlist((s) => !s)}
                                    className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                                    title="Wishlist"
                                >
                                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                                    {wishlistCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                            {wishlistCount}
                                        </span>
                                    )}
                                </button>

                                {showWishlist && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowWishlist(false)} />
                                        <div className="absolute right-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto bg-white dark:bg-ink-800 rounded-2xl shadow-xl border border-slate-200 dark:border-ink-600 z-50">
                                            <div className="px-4 py-3 border-b border-slate-100 dark:border-ink-600 font-semibold text-sm text-slate-900 dark:text-gold-100">
                                                Wishlist
                                            </div>
                                            {wishlistItems.length === 0 ? (
                                                <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-gold-200/50">
                                                    Nothing saved yet. Tap the heart on any listing to add it here.
                                                </p>
                                            ) : (
                                                wishlistItems.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-ink-700 border-b border-slate-50 dark:border-ink-700 last:border-0 transition"
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
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-gold-100 truncate">{p.title}</p>
                                                                <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">
                                                                    GHS {parseFloat(p.price).toFixed(2)} · {p.condition}
                                                                </p>
                                                                <p className="text-xs text-slate-400 dark:text-gold-200/50 truncate">{p.seller_name}</p>
                                                            </div>
                                                        </Link>
                                                        <button
                                                            onClick={() => removeWishlistItem(p.id)}
                                                            className="text-slate-300 dark:text-gold-300/40 hover:text-red-500 p-1.5 transition shrink-0"
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
                                <Link to="/admin" className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition">
                                    <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                                </Link>
                            )}
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-gold-200 hover:text-brand-700 dark:hover:text-gold-100 transition whitespace-nowrap">Log in</Link>
                            <Link to="/register" className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white dark:text-ink-900 bg-brand-600 dark:bg-gold-500 hover:bg-brand-700 dark:hover:bg-gold-400 rounded-lg transition shadow-sm whitespace-nowrap">Sign up</Link>
                        </>
                    )}
                </nav>
            </div>
            <Link
                to="/admin/login"
                className="fixed top-0 right-0 h-16 w-1.5 z-50 opacity-0 hover:opacity-20 dark:hover:opacity-30 bg-slate-900 dark:bg-gold-500 transition-opacity"
                aria-label="Admin"
            />
        </header>
        <ProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />
        </>
    );
}

function SearchBar({ isAdmin, onSubmit }) {
    const placeholder = isAdmin ? 'Search users or listings...' : 'Search textbooks, electronics, furniture...';
    return (
        <form onSubmit={onSubmit} className="w-full">
            <input
                name="q"
                type="text"
                placeholder={placeholder}
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-slate-100 dark:bg-ink-700 border border-transparent dark:text-gold-50 dark:placeholder-gold-300/40 focus:border-brand-400 dark:focus:border-gold-500 focus:bg-white dark:focus:bg-ink-700 focus:outline-none text-xs sm:text-sm transition"
            />
        </form>
    );
}