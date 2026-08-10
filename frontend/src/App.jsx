import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Register from './pages/Register';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import CreateListing from './pages/CreateListing';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Inbox from './pages/Inbox';
import Conversation from './pages/Conversation';
import Admin from './pages/Admin';


export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-slate-50">
              <Navbar />
              <Toaster position="top-center" />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/sell/new" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/messages/:userId" element={<ProtectedRoute><Conversation /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
              </Routes>
            </div>
          </BrowserRouter>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}