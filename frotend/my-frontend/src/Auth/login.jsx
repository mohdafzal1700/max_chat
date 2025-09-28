import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login,logout  } from '../endpoints/chat';
import { setTokens } from '../AxiosIntersptors/Userintersptors'; // Import setTokens

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Show loading toast
            const loadingToast = toast.loading('Signing in...');
            
            console.log('🔐 Attempting login with:', formData);
            
            const response = await login(formData);
            
            console.log('📥 Login response:', response.data);

            // Dismiss loading toast
            toast.dismiss(loadingToast);

            if (response.data.success) {
                // SUCCESS CASE
                console.log('✅ Login successful');
                
                // Extract tokens - check both possible response formats
                const access = response.data.access_token || response.data.token?.access;
                const refresh = response.data.refresh_token || response.data.token?.refresh;
                const userDetails = response.data.userDetails;
                
                console.log('🎟️ Tokens received:');
                console.log('Access:', access ? access.substring(0, 20) + '...' : 'MISSING');
                console.log('Refresh:', refresh ? refresh.substring(0, 20) + '...' : 'MISSING');

                if (access && refresh) {
                    // Store tokens using the correct function
                    setTokens(access, refresh);
                    localStorage.setItem('user', JSON.stringify(userDetails))  
                    console.log('💾 Tokens stored successfully');
                    
                    // Success toast
                    toast.success('Login successful! Welcome back!');
                    
                    // Navigate to user list
                    navigate('/userList');
                } else {
                    console.error('❌ Missing tokens in response');
                    console.log('Full response data:', response.data);
                    toast.error('Login failed: Invalid response format');
                }
            } else {
                console.error('❌ Login failed:', response.data.message);
                toast.error(response.data.message || 'Login failed');
            }

        } catch (error) {
            console.error('❌ Login error:', error);
            
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
                
                // Server responded with error status
                const errorMessage = error.response.data.detail || 
                                   error.response.data.message || 
                                   error.response.data.error || 
                                   'Invalid email or password';
                toast.error(errorMessage);
            } else if (error.request) {
                // Request was made but no response received
                toast.error('Network error. Please check your connection.');
            } else {
                // Something else happened
                toast.error('An unexpected error occurred');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUpClick = () => {
        navigate('/register');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to your account
                    </h2>
                </div>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                disabled={isLoading}
                                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="Email address"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                disabled={isLoading}
                                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Signing in...
                                </div>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <span className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <button
                                type="button"
                                onClick={handleSignUpClick}
                                className="font-medium text-indigo-600 hover:text-indigo-500 underline"
                            >
                                Sign up
                            </button>
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login; 