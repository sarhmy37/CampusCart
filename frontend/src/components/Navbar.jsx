import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, Trash2, PlusCircle, LayoutDashboard, Home, Bell, Menu, Search, ChevronRight, ChevronLeft, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import ProfileDrawer from './ProfileDrawer';
import { LOGO_LIGHT, LOGO_DARK } from '../data/media';

const NOTIF_META = {
    price_drop: { emoji: '💰', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
    low_stock: { emoji: '⚡', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
    new_listing: { emoji: '🛍️', color: 'bg-brand-50 text-brand-600 dark:bg-gold-900/40 dark:text-gold-400' },
    out_of_stock: { emoji: '📦', color: 'bg-slate-100 text-slate-500 dark:bg-ink-700 dark:text-gold-300' },
    delivery_reminder: { emoji: '🚚', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
    new_order: { emoji: '📦', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
    delivery_marked: { emoji: '✅', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
    default: { emoji: '🔔', color: 'bg-slate-100 text-slate-500 dark:bg-ink-700 dark:text-gold-300' },
};

function formatBadgeCount(n) {
    return n > 9 ? '9+' : n;
}

function formatRelativeTime(dateString) {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

const badgeClass = "absolute -top-1 -right-1 bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center";

export default function Navbar() {
    const { user } = useAuth();
    const { count } = useCart();
    const { items: wishlistItems, count: wishlistCount, removeItem: removeWishlistItem } = useWishlist();
    const [showWishlist, setShowWishlist] = useState(false);
    const { notifications, unreadCount, markAllRead, clearAllNotifications, removeNotification } = useNotifications();
    const {
        conversations,
        visibleCount,
        showMoreConversations,
        unreadCount: chatUnreadCount,
        openConversation,
    } = useChat();
    const [showMessages, setShowMessages] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isHome = location.pathname === '/';
    const isAdmin = user?.role === 'admin';
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const { theme } = useTheme();

    const notificationsRef = useRef(null);
    const wishlistRef = useRef(null);
    const messagesRef = useRef(null);

    // 👇 Listen for state from navigation to reopen profile drawer
    useEffect(() => {
        if (location.state?.openProfile) {
            setShowProfile(true);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
            if (wishlistRef.current && !wishlistRef.current.contains(e.target)) {
                setShowWishlist(false);
            }
            if (messagesRef.current && !messagesRef.current.contains(e.target)) {
                setShowMessages(false);
            }
        };

        if (showNotifications || showWishlist || showMessages) {
            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('touchstart', handleOutsideClick);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [showNotifications, showWishlist, showMessages]);

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
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
                
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
                    
                    {isAdmin ? (
                        <span className="flex items-center gap-1.5 sm:gap-2 cursor-default shrink-0">
                            <img 
                                src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK} 
                                alt="TreX" 
                                className="h-7 sm:h-9 w-auto object-contain"
                            />
                           <div className={`items-center font-serif font-black italic tracking-tight whitespace-nowrap ${mobileExpanded ? 'hidden sm:flex' : 'flex'}`}>
                                <span className="text-base sm:text-lg text-slate-900 dark:text-gold-200">
                                    Tre
                                </span>
                                <span className="text-base sm:text-lg text-slate-900 dark:text-gold-200 mx-0.5">
                                    -
                                </span>
                                <span className="text-2xl sm:text-3xl text-brand-600 dark:text-gold-400 leading-none">
                                    X
                                </span>
                            </div>
                        </span>
                    ) : (
                        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0">
                            <img 
                                src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK} 
                                alt="TreX" 
                                className="h-7 sm:h-9 w-auto object-contain"
                            />
                            <div className={`items-center font-serif font-black tracking-wider whitespace-nowrap gap-x-0 ${mobileExpanded ? 'hidden sm:flex' : 'flex'}`}>
                                <span className="text-base sm:text-lg text-slate-900 dark:text-gold-200">
                                    Tre
                                </span>
                                <span className="text-base  sm:text-lg text-slate-900 dark:text-gold-200 mx-0.5">
                                    -
                                </span>
                                <span className="text-2xl sm:text-3xl italic text-brand-600 dark:text-gold-400 leading-none">
                                    X
                                </span>
                            </div>
                        </Link>
                    )}
                </div>

                <div className="flex-1 min-w-0 mx-2 sm:mx-4">
                    <SearchBar isAdmin={isAdmin} onSubmit={handleSearch} />
                </div>

                <nav className="flex items-center gap-0.5 sm:gap-2 shrink-0">
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

                    {user && (
                        <div ref={messagesRef} className={`relative ${mobileExpanded ? 'flex' : 'hidden'} sm:flex`}>
                            <button
                                onClick={() => setShowMessages((s) => !s)}
                                className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                                title="Messages"
                            >
                                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                                {chatUnreadCount > 0 && (
                                    <span className={badgeClass}>{formatBadgeCount(chatUnreadCount)}</span>
                                )}
                            </button>

                            {showMessages && (
                                <div className="absolute right-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto bg-white dark:bg-ink-800 rounded-2xl shadow-xl border border-slate-200 dark:border-ink-600 z-50">
                                    <div className="px-4 py-3 border-b border-slate-100 dark:border-ink-600 font-semibold text-sm text-slate-900 dark:text-gold-100">
                                        Messages
                                    </div>
                                    {conversations.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-gold-200/50">
                                            No conversations yet.
                                        </p>
                                    ) : (
                                        <>
                                            {conversations.slice(0, visibleCount).map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        openConversation(c);
                                                        setShowMessages(false);
                                                    }}
                                                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-ink-700 border-b border-slate-50 dark:border-ink-700 last:border-0 transition text-left"
                                                >
                                                    {c.other_user_avatar ? (
                                                        <img
                                                            src={c.other_user_avatar}
                                                            alt={c.other_user_name}
                                                            className="w-10 h-10 rounded-full object-cover shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-gold-900 text-brand-600 dark:text-gold-400 flex items-center justify-center text-sm font-bold shrink-0">
                                                            {c.other_user_name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-gold-100 truncate">
                                                                {c.other_user_name}
                                                            </p>
                                                            {c.unread_count > 0 && (
                                                                <span className="bg-accent-500 dark:bg-gold-500 text-white dark:text-ink-900 text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shrink-0">
                                                                    {formatBadgeCount(c.unread_count)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-gold-200/60 truncate mt-0.5">
                                                            {c.last_message || 'No messages yet'}
                                                        </p>
                                                        {c.last_message_at && (
                                                            <p className="text-[11px] text-slate-400 dark:text-gold-300/40 mt-0.5">
                                                                {formatRelativeTime(c.last_message_at)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                            {conversations.length > visibleCount && (
                                                <div className="px-4 py-2 border-t border-slate-100 dark:border-ink-600">
                                                    <button
                                                        onClick={showMoreConversations}
                                                        className="text-xs text-brand-600 dark:text-gold-400 hover:text-brand-700 dark:hover:text-gold-300 transition font-semibold w-full text-center"
                                                    >
                                                        Show more
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div ref={notificationsRef} className={`relative ${mobileExpanded ? 'flex' : 'hidden'} sm:flex`}>
                        <button
                            onClick={toggleNotifications}
                            className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                            title="Notifications"
                        >
                            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                            {unreadCount > 0 && (
                                <span className={badgeClass}>{formatBadgeCount(unreadCount)}</span>
                            )}
                        </button>

                        {showNotifications && (
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
                                        {notifications.map((n) => (
                                            <SwipeableNotification
                                                key={n.id}
                                                notification={n}
                                                onDelete={() => removeNotification(n.id)}
                                                onNavigate={() => setShowNotifications(false)}
                                            />
                                        ))}
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
                        )}
                    </div>

                    <Link to="/cart" className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition">
                        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                        {count > 0 && (
                            <span className={badgeClass}>{formatBadgeCount(count)}</span>
                        )}
                    </Link>
                    {user ? (
                        <>
                            <div ref={wishlistRef} className={`relative ${mobileExpanded ? 'block' : 'hidden'} sm:block`}>
                                <button
                                    onClick={() => setShowWishlist((s) => !s)}
                                    className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                                    title="Wishlist"
                                >
                                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-gold-200" />
                                    {wishlistCount > 0 && (
                                        <span className={badgeClass}>{formatBadgeCount(wishlistCount)}</span>
                                    )}
                                </button>

                                {showWishlist && (
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

const SWIPE_DELETE_THRESHOLD = 80;

function SwipeableNotification({ notification: n, onDelete, onNavigate }) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const startX = useRef(null);
    const dragging = useRef(false);

    const targetLink = n.link || `/product/${n.productId || n.id}`;
    const meta = NOTIF_META[n.type] || NOTIF_META.default;

    const handleTouchStart = (e) => {
        startX.current = e.touches[0].clientX;
        dragging.current = true;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!dragging.current) return;
        const diff = e.touches[0].clientX - startX.current;
        if (diff < 0) {
            setDragX(Math.max(diff, -120));
        }
    };

    const handleTouchEnd = () => {
        dragging.current = false;
        setIsDragging(false);

        if (dragX <= -SWIPE_DELETE_THRESHOLD) {
            setIsDeleting(true);
            setDragX(-400);
            setTimeout(onDelete, 200);
        } else {
            setDragX(0);
        }
    };

    return (
        <div className="relative overflow-hidden border-b border-slate-50 dark:border-ink-700 last:border-0">
            <div className="absolute inset-0 bg-red-500 flex items-center justify-end px-5">
                <Trash2 size={18} className="text-white" />
            </div>

            <Link
                to={targetLink}
                onClick={(e) => {
                    if (isDeleting || Math.abs(dragX) > 5) {
                        e.preventDefault();
                        return;
                    }
                    onNavigate();
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative flex items-start gap-3 px-4 py-3.5 bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700"
                style={{
                    transform: `translateX(${dragX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                }}
            >
                {n.primary_image ? (
                    <img src={n.primary_image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                ) : (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 ${meta.color}`}>
                        {meta.emoji}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-gold-100 leading-snug">
                        {n.title}
                    </p>
                    {n.message && (
                        <p className="text-xs text-slate-500 dark:text-gold-200/60 mt-0.5 leading-relaxed">
                            {n.message}
                        </p>
                    )}
                    {n.created_at && (
                        <p className="text-[11px] text-slate-400 dark:text-gold-300/40 mt-1">
                            {formatRelativeTime(n.created_at)}
                        </p>
                    )}
                </div>
            </Link>
        </div>
    );
}