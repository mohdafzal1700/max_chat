import chatAxios, { clearTokens, getRefreshToken } from "../AxiosIntersptors/Userintersptors";


export const login = (data) => chatAxios.post("login/", data);
export const register = (data) => chatAxios.post("register/", data);

export const refreshToken = () => chatAxios.post("refresh/");
export const getConversation = (userId) => {
    return chatAxios.get(`conversation/${userId}/`);
};
export const users=()=>chatAxios.get('users/')

export const conversation=()=>chatAxios.get("conversations/")

export const getConversationMessages = (userId) => 
  chatAxios.get(`conversation/${userId}/`)

export const logout = async () => {
    try {
        const refreshToken = getRefreshToken();
        
        // Send logout request to backend with refresh token
        const response = await chatAxios.post('logout/', {
            refresh_token: refreshToken
        });
        
        // Clear tokens from localStorage regardless of backend response
        clearTokens();
        
        // Clear the default authorization header
        delete chatAxios.defaults.headers.common['Authorization'];
        
        console.log('✅ Logout successful');
        return response;
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        
        // Even if logout request fails, clear local tokens
        clearTokens();
        delete chatAxios.defaults.headers.common['Authorization'];
        
        throw error;
    }
};