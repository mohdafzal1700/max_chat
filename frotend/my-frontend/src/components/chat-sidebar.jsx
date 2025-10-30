"use client"
import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/ui"
import { Button } from "./ui/ui"
import { Input } from "./ui/ui"
import { Search, Plus, Edit, Menu } from "lucide-react"
import { conversation } from "../endpoints/chat"
import ChatWebService from '../services/websocket'
import { useNavigate } from 'react-router-dom'

export function ChatSidebar({ selectedUserId, onUserSelect }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations()
  }, [])

  // Setup WebSocket listeners for real-time updates
  useEffect(() => {
    const handleChatMessage = (data) => {
      // Update conversation list when new message arrives
      setConversations(prev => prev.map(conv => {
        const otherUsers = conv.other_user || []
        const isRelatedConversation = otherUsers.some(user => 
          user.id == data.sender_id || user.id == data.message?.receiver_id
        )
        
        if (isRelatedConversation && data.message) {
          return {
            ...conv,
            last_message: {
              message: data.message.content,
              content: data.message.content,
              sender_id: data.message.sender_id
            },
            last_message_time: data.message.sent_at || new Date().toISOString(),
            unread_count: data.message.sender_id != getCurrentUserId() ? 
              (conv.unread_count || 0) + 1 : conv.unread_count || 0
          }
        }
        return conv
      }))
    }

    const handleReadReceipt = (data) => {
    console.log('✓ READ RECEIPT in sidebar:', data)
    // Update unread count when messages are read
    setConversations(prev => prev.map(conv => {
        // Reset unread count for the conversation where current user read messages
        if (data.read_by_id == getCurrentUserId()) {
            return { ...conv, unread_count: 0 }
        }
        return conv
    }))
}

    ChatWebService.on('chat_message', handleChatMessage)
    ChatWebService.on('read_receipt', handleReadReceipt)

    return () => {
      ChatWebService.off('chat_message', handleChatMessage)
      ChatWebService.off('read_receipt', handleReadReceipt)
    }
  }, [])

  const getCurrentUserId = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        return user.id
    } catch (error) {
        console.error('Error getting user ID:', error)
        return null
    }
}

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const response = await conversation()
      setConversations(response.data)
      setError(null)
    } catch (err) {
      console.error("Error fetching conversations:", err)
      setError("Failed to load conversations")
    } finally {
      setLoading(false)
    }
  }

  // Transform API data to match the expected format
  const transformConversation = (conv) => {
    const otherUsers = conv.other_user || []
    const isGroup = otherUsers.length > 1

    const name = isGroup 
      ? `Group (${otherUsers.length} members)` 
      : otherUsers[0]?.username || otherUsers[0]?.first_name || "Unknown User"

    const lastMessage = conv.last_message 
      ? conv.last_message.message || conv.last_message.content || "No messages yet"
      : "No messages yet"

    const formatTimestamp = (timestamp) => {
      if (!timestamp) return ""
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffHours = diffMs / (1000 * 60 * 60)
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      if (diffHours < 24) {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric'
        })
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric'
        })
      }
    }

    return {
      id: conv.id,
      userId: otherUsers[0]?.id,
      name: name,
      lastMessage: lastMessage,
      timestamp: formatTimestamp(conv.last_message_time),
      isGroup: isGroup,
      avatar: otherUsers[0]?.profile_picture || otherUsers[0]?.avatar,
      isOnline: otherUsers[0]?.is_online || false,
      unreadCount: conv.unread_count || 0,
      userInfo: {
        id: otherUsers[0]?.id,
        name: name,
        email: otherUsers[0]?.email,
        avatar: otherUsers[0]?.profile_picture || otherUsers[0]?.avatar,
        isOnline: otherUsers[0]?.is_online || false,
        subtitle: otherUsers[0]?.is_online ? 'Active now' : 'Last seen recently'
      }
    }
  }

  const transformedConversations = conversations.map(transformConversation)

  // Filter conversations based on search query
  const filteredUsers = transformedConversations.filter(
    (user) => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUserClick = (user) => {
    onUserSelect(user.userId, user.userInfo)
  }

  const handleNewChat = () => {
    navigate('/users')
  }

  if (loading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-black">Chats</h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Search or start a new chat" 
              className="pl-10 bg-gray-50 border-gray-200 text-black" 
              disabled 
            />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading conversations...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-black">Chats</h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-red-500 mb-2">{error}</div>
          <Button 
            onClick={fetchConversations} 
            variant="outline" 
            className="text-black border-gray-300"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-black">Chats</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-black hover:bg-gray-100"
              onClick={handleNewChat}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-50 border-gray-200 text-black"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              onClick={() => handleUserClick(user)}
              className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedUserId === user.userId ? "bg-gray-100" : ""
              }`}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage 
  src={user.avatar || "/OIP.webp"}
  onError={(e) => {
    e.target.src = "https://via.placeholder.com/150/000000/FFFFFF/?text=" + user.name.charAt(0)
  }}
/>
                  <AvatarFallback className="bg-black text-white">
                    {user.isGroup ? "👥" : user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {user.isOnline && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-black truncate">{user.name}</h3>
                  <span className="text-xs text-gray-500">{user.timestamp}</span>
                </div>
                <p className="text-sm text-gray-600 truncate mt-1">{user.lastMessage}</p>
              </div>
              {user.unreadCount && user.unreadCount > 0 && (
                <div className="bg-black text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {user.unreadCount}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add User Button */}
      <div className="p-4 border-t border-gray-200">
        <Button 
          className="w-full bg-white border border-gray-300 text-black hover:bg-gray-50" 
          variant="outline"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Chat
        </Button>
      </div>
    </div>
  )
}