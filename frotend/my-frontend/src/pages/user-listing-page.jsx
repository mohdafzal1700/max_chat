"use client";
import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, Filter, User, LogOut } from 'lucide-react';
import { users as usersAPI, logout } from "../endpoints/chat";
import { useNavigate } from 'react-router-dom';

export default function UserListingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onlineCount = usersList.filter(user => user.status?.is_online).length;
  const totalCount = usersList.length;

  useEffect(() => {
    loadUsers();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      console.log('Logging out...');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await usersAPI();
      setUsersList(response.data.data);
      setError('');
    } catch (err) {
      setError('Failed to load users. Please try again.');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = usersList.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-400';
    if (status.is_online) {
      return 'bg-green-400';
    } else {
      return 'bg-gray-400';
    }
  };

  const getLastSeenText = (status) => {
    if (!status) return 'Last seen unknown';
    if (status.is_online) {
      return 'Active now';
    } else {
      const lastSeen = new Date(status.last_seen);
      const now = new Date();
      const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }
  };

  const getUserInitials = (name) => {
    return name
      ?.split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const handleStartConversation = (user) => {
    setSelectedUser(user);
    console.log('Starting conversation with:', user.username);
    
    // Navigate to chat page with user info
    navigate('/chat', { 
      state: { 
        selectedUserId: user.id,
        selectedUserInfo: {
          id: user.id,
          name: user.username,
          email: user.email,
          avatar: user.avatar || null,
          isOnline: user.status?.is_online || false,
          subtitle: getLastSeenText(user.status)
        }
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Start Conversation
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <User className="w-4 h-4" />
                Choose a user to begin chatting with • {onlineCount} online of {totalCount} users
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <MessageCircle className="w-4 h-4" />
                Go to Chats
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* User List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{usersList.length === 0 ? 'No users available.' : 'No users found matching your search.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300 cursor-pointer group"
                  onClick={() => handleStartConversation(user)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {getUserInitials(user.username)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-white ${getStatusColor(user.status)} shadow-md`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                          {user.username}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`}></div>
                          {getLastSeenText(user.status)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartConversation(user);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Chat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected User Notification */}
        {selectedUser && (
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl shadow-2xl animate-bounce">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              Starting conversation with {selectedUser.username}...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}