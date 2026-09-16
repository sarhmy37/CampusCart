import axios from 'axios';
import { SESSION_REVOKED_EVENT } from '../components/SessionRevokedModal';


const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://campuscart-tdfn.onrender.com/api',
});

function getAnonId() {
    let id = localStorage.getItem('cc_anon_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('cc_anon_id', id);
    }
    return id;
}

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('cc_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Anon-Id'] = getAnonId();
    return config;
});

let redirectingToLogin = false;

api.interceptors.response.use(
    (res) => res,
    (err) => {
        // Any 401 anywhere in the app means the session is dead — clear it
        // and bounce to the homepage instead of leaving the user stuck on
        // whatever screen they were on with a raw backend error.
        if (err.response?.status === 401) {
            const hadToken = !!localStorage.getItem('cc_token');
            const revoked = err.response?.data?.code === 'SESSION_REVOKED';
            localStorage.removeItem('cc_token');
            localStorage.removeItem('cc_user');

            if (hadToken && !redirectingToLogin) {
                redirectingToLogin = true;
                if (revoked) {
                    window.dispatchEvent(new Event(SESSION_REVOKED_EVENT));
                    return Promise.reject(err); // modal itself handles navigation — don't redirect underneath it
                }
                if (window.location.pathname !== '/') {
                    window.location.href = '/';
                }
            }
        }
        return Promise.reject(err);
    }
);
export default api;