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

            if (revoked) {
                // Don't clear the token yet — the SessionRevokedModal still needs
                // it to let the user submit an "it wasn't me" report before the
                // session is fully torn down. The modal clears it once dismissed.
                if (hadToken && !redirectingToLogin) {
                    redirectingToLogin = true;
                    window.dispatchEvent(new Event(SESSION_REVOKED_EVENT));
                }
                return Promise.reject(err);
            }

            localStorage.removeItem('cc_token');
            localStorage.removeItem('cc_user');

            if (hadToken && !redirectingToLogin) {
                redirectingToLogin = true;
                if (window.location.pathname !== '/') {
                    window.location.href = '/';
                }
            }
        }
        return Promise.reject(err);
    }
);
export default api;