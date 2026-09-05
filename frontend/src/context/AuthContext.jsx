import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // Initialize user from localStorage immediately
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('cc_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('cc_token');
        if (token && user) {
            // User is already set from localStorage, just verify with backend
            api.get('/auth/me')
                .then((res) => {
                    // Update user with fresh data if needed
                    setUser(res.data);
                    localStorage.setItem('cc_user', JSON.stringify(res.data));
                })
                .catch(() => {
                    // Only clear if API explicitly rejects the token
                    // But don't clear on network errors or cold starts
                    console.error('Auth verification failed, but keeping user from localStorage');
                    // We keep the user from localStorage rather than logging out
                })
                .finally(() => setLoading(false));
        } else if (token) {
            // We have a token but no user in state - fetch user
            api.get('/auth/me')
                .then((res) => {
                    setUser(res.data);
                    localStorage.setItem('cc_user', JSON.stringify(res.data));
                })
                .catch(() => {
                    // Only clear if API explicitly rejects
                    localStorage.removeItem('cc_token');
                    localStorage.removeItem('cc_user');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (university_email, password) => {
        const res = await api.post('/auth/login', { university_email, password });
        localStorage.setItem('cc_token', res.data.token);
        localStorage.setItem('cc_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data.user;
    };

    const register = async (payload) => {
        const res = await api.post('/auth/register', payload);
        localStorage.setItem('cc_token', res.data.token);
        localStorage.setItem('cc_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data.user;
    };

    const logout = () => {
        api.post('/auth/logout').catch(() => {});
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
        setUser(null);
    };

    const updateProfile = async (payload) => {
        const res = await api.patch('/auth/me', payload);
        localStorage.setItem('cc_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    const removeAvatar = async () => {
        const res = await api.delete('/auth/me/avatar');
        localStorage.setItem('cc_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    const uploadAvatar = async (file) => {
        const CLOUD_NAME = 'b7fch4rp';
        const UPLOAD_PRESET = 'campuscart_preset';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!cloudRes.ok) {
            const error = await cloudRes.json();
            throw new Error(error.error?.message || 'Avatar upload failed');
        }

        const cloudData = await cloudRes.json();
        const avatarUrl = cloudData.secure_url;

        const res = await api.patch('/auth/me', { avatar_url: avatarUrl });
        localStorage.setItem('cc_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            setUser, 
            login, 
            register, 
            logout, 
            loading, 
            updateProfile, 
            uploadAvatar,
            removeAvatar
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);