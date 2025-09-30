import axios from "axios";

// Use production API URL
const Base_url = 'https://api.maxchat.muhammedafsal.online/chat/';

const chatAxios = axios.create({
    baseURL: Base_url,
})

// Token management functions
const getAccessToken = () => {
    return localStorage.getItem('access_token');
};

const getRefreshToken = () => {
    return localStorage.getItem('refresh_token');
};

const setTokens = (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
    }
};

const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
};

// Set initial authorization header if token exists
const initializeAuth = () => {
    const token = getAccessToken();
    if (token) {
        chatAxios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
};

// Initialize auth on import
initializeAuth();

export const refreshChatToken = async () => {
    const refreshToken = getRefreshToken();
    
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }
    
    console.log('🔄 Refreshing token with:', refreshToken);
    
    // Don't use chatAxios for refresh to avoid infinite loop
    return axios.post("https://api.maxchat.muhammedafsal.online/chat/refresh/", {
        refresh: refreshToken
    });
};

// Request interceptor to ensure token is always attached
chatAxios.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        console.log('📤 Request to:', config.url);
        console.log('📤 Auth header:', config.headers['Authorization'] ? 'Present' : 'Missing');
        
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for token refresh
chatAxios.interceptors.response.use(
    (response) => {
        console.log('✅ Response:', response.status, response.config.url);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        console.log('❌ Error:', error.response?.status, error.response?.data);

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                console.log("🔑 Token expired, attempting refresh...");
                
                const refreshResponse = await refreshChatToken();
                
                if (refreshResponse.status === 200) {
                    const newAccessToken = refreshResponse.data.access;
                    const newRefreshToken = refreshResponse.data.refresh; // If your backend rotates refresh tokens
                    
                    console.log("✅ Token refresh successful!");
                    
                    // Update stored tokens
                    setTokens(newAccessToken, newRefreshToken);
                    
                    // Update default header for all future requests
                    chatAxios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    
                    // Update the failed request's header
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    
                    console.log("🔄 Retrying original request with new token");
                    return chatAxios(originalRequest);
                }
            } catch (refreshError) {
                console.error("❌ Token refresh failed:", refreshError);
                
                // Clear tokens and redirect to login
                clearTokens();
                delete chatAxios.defaults.headers.common['Authorization'];
                
                window.location.href = "/login";
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export { setTokens, clearTokens, getAccessToken, getRefreshToken };

export default chatAxios;