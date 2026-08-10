import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('cc_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('cc_token');
        if (token) {
            api.get('/auth/me')
                .then((res) => setUser(res.data))
                .catch(() => {
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
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
        setUser(null);
    };

    const updateProfile = async (payload) => {
        // Assumes PATCH /auth/me — adjust the endpoint if yours differs
        const res = await api.patch('/auth/me', payload);
        localStorage.setItem('cc_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    const uploadAvatar = async (file) => {
        // Assumes POST /auth/me/avatar accepting multipart/form-data with field "avatar"
        const formData = new FormData();
        formData.append('avatar', file);
        const res = await api.post('/auth/me/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        localStorage.setItem('cc_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    return (
        <AuthContext.Provider value={{ user, login, setUser, register, logout, loading, updateProfile, uploadAvatar }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);