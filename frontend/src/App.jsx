import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppToaster from './components/AppToaster';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider } from './context/ChatContext';
import { ReviewPromptProvider } from './context/ReviewPromptContext';
import PostPurchaseReviewModal from './components/PostPurchaseReviewModal';
import AdminLogin from './pages/AdminLogin';
import Navbar from './components/Navbar';
import AwayTimeoutModal from './components/AwayTimeoutModal';
import ProtectedRoute from './components/ProtectedRoute';
import InstallButton from './components/InstallButton';
import ChatPanel from './components/ChatPanel';
import PullToRefresh from './components/PullToRefresh';
import ChatHistory from './pages/ChatHistory';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import CreateListing from './pages/CreateListing';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import OrderConfirmation from './pages/OrderConfirmation';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Store from './pages/Store';


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <NotificationProvider>
              <ChatProvider>
                <ReviewPromptProvider>
                <BrowserRouter>
                  <div className="min-h-screen bg-slate-50 dark:bg-ink-900 transition-colors">
                    <Navbar />
                    <AppToaster />
                    <AwayTimeoutModal />
                    <PostPurchaseReviewModal />
                    <PullToRefresh>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/browse" element={<Browse />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/product/:id" element={<ProductDetail />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/sell/new" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
                        <Route path="/orders/:id" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
                        <Route path="/chat" element={<ProtectedRoute><ChatHistory /></ProtectedRoute>} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/store/:id" element={<Store />} />
                      </Routes>
                    </PullToRefresh>
                    <InstallButton />
                    <ChatPanel />
                  </div>
                </BrowserRouter>
                </ReviewPromptProvider>
              </ChatProvider>
            </NotificationProvider>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}