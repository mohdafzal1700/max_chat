"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/ui"
import { Button } from "./ui/ui"
import { Input } from "./ui/ui"
import { Phone, Video, Search, Paperclip, Mic, Send } from "lucide-react"
import { getConversationMessages } from "../endpoints/chat"
import ChatWebService from '../services/websocket'

export function ChatArea({ selectedUserId, selectedUserInfo = null }) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Force re-render key
  const [updateKey, setUpdateKey] = useState(0)
  const forceUpdate = useCallback(() => {
    setUpdateKey(prev => prev + 1)
  }, [])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  // Get current user ID from localStorage/context
  const getCurrentUserId = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return parseInt(user.id)
  }

  // Transform message with proper type conversion
  const transformMessage = useCallback((msg) => {
    return {
      id: parseInt(msg.id), // Always convert to number
      content: msg.content,
      timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      isSent: parseInt(msg.sender_id) === getCurrentUserId(),
      type: "text",
      is_read: msg.is_read,
      sender_id: parseInt(msg.sender_id),
      sender_username: msg.sender_username
    }
  }, [])

  // Fetch messages when user is selected
  useEffect(() => {
    if (selectedUserId) {
      fetchMessages()
    } else {
      setMessages([])
      setSelectedUser(null)
    }
  }, [selectedUserId])

  // Setup WebSocket listeners
  useEffect(() => {
    if (!selectedUserId) return

    console.log('🔌 Setting up WebSocket listeners for user:', selectedUserId)

    const handleChatMessage = (data) => {
      console.log('💬 CHAT MESSAGE RECEIVED:', data)
      if (data.message && (
        parseInt(data.message.sender_id) === parseInt(selectedUserId) ||
        parseInt(data.message.receiver_id) === parseInt(selectedUserId)
      )) {
        console.log('✅ Message is for current conversation')
        const newMessage = transformMessage(data.message)
        console.log('📝 Transformed message:', newMessage)

        setMessages(prev => {
          // Use parseInt for proper comparison
          const exists = prev.some(msg => parseInt(msg.id) === parseInt(data.message.id))
          if (exists) {
            console.log('❌ Message already exists:', data.message.id)
            return prev
          }
          const updated = [...prev, newMessage]
          console.log('✅ Added message, total:', updated.length)

          // Send read receipt for incoming messages (not sent by current user)
          if (parseInt(data.message.sender_id) === parseInt(selectedUserId)) {
            console.log('📧 Sending read receipt for message:', data.message.id)
            ChatWebService.sendReadReceipt(data.message.id)
          }

          // Force component update and scroll
          setTimeout(() => {
            forceUpdate()
            scrollToBottom()
          }, 0)
          return updated
        })
      }
    }

    const handleMessageSent = (data) => {
      console.log('📤 MESSAGE SENT CONFIRMATION:', data)
      if (data.message && parseInt(data.message.receiver_id) === parseInt(selectedUserId)) {
        console.log('✅ Sent message confirmed')
        const newMessage = transformMessage(data.message)
        console.log('📝 Transformed sent message:', newMessage)

        setMessages(prev => {
          const exists = prev.some(msg => parseInt(msg.id) === parseInt(data.message.id))
          if (exists) {
            console.log('❌ Sent message already exists:', data.message.id)
            return prev
          }
          const updated = [...prev, newMessage]
          console.log('✅ Added sent message, total:', updated.length)

          // Force component update and scroll
          setTimeout(() => {
            forceUpdate()
            scrollToBottom()
          }, 0)
          return updated
        })
      }
    }

    const handleTypingIndicator = (data) => {
      console.log('⌨️ TYPING INDICATOR:', data)
      if (parseInt(data.sender_id) === parseInt(selectedUserId)) {
        setIsTyping(data.is_typing)
        setTypingUser(data.sender_username)
        if (data.is_typing) {
          setTimeout(() => {
            setIsTyping(false)
            setTypingUser(null)
          }, 4000)
        }
      }
    }

    const handleReadReceipt = (data) => {
      console.log('✓ READ RECEIPT:', data)
      setMessages(prev => prev.map(msg =>
        parseInt(msg.id) === parseInt(data.message_id)
          ? { ...msg, is_read: true }
          : msg
      ))
      forceUpdate()
    }

    // Clean up existing listeners
    ChatWebService.off('chat_message', handleChatMessage)
    ChatWebService.off('message_sent', handleMessageSent)
    ChatWebService.off('typing_indicator', handleTypingIndicator)
    ChatWebService.off('read_receipt', handleReadReceipt)

    // Add new listeners
    ChatWebService.on('chat_message', handleChatMessage)
    ChatWebService.on('message_sent', handleMessageSent)
    ChatWebService.on('typing_indicator', handleTypingIndicator)
    ChatWebService.on('read_receipt', handleReadReceipt)

    return () => {
      console.log('🧹 Cleaning up WebSocket listeners')
      ChatWebService.off('chat_message', handleChatMessage)
      ChatWebService.off('message_sent', handleMessageSent)
      ChatWebService.off('typing_indicator', handleTypingIndicator)
      ChatWebService.off('read_receipt', handleReadReceipt)
    }
  }, [selectedUserId, transformMessage, forceUpdate])

  // Auto-send read receipts when window becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedUserId && messages.length > 0) {
        // Send read receipts for any unread messages from the selected user
        const unreadMessages = messages.filter(msg =>
          !msg.is_read &&
          !msg.isSent && // Only for received messages
          parseInt(msg.sender_id) === parseInt(selectedUserId)
        )

        if (unreadMessages.length > 0) {
          console.log(`📧 Sending read receipts for ${unreadMessages.length} unread messages`)
          unreadMessages.forEach(msg => {
            ChatWebService.sendReadReceipt(msg.id)
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [selectedUserId, messages])

  // Auto-scroll on messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, updateKey])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      console.log('📥 Fetching messages for user:', selectedUserId)
      const response = await getConversationMessages(selectedUserId)

      if (response.data && response.data.messages) {
        const transformedMessages = response.data.messages.map(transformMessage)
        setMessages(transformedMessages)
        console.log('📥 Loaded messages:', transformedMessages.length)

        // Send read receipts for unread messages
        const unreadMessages = response.data.messages.filter(msg =>
          !msg.is_read && parseInt(msg.sender_id) === parseInt(selectedUserId)
        )

        unreadMessages.forEach(msg => {
          ChatWebService.sendReadReceipt(msg.id)
        })
      }

      setSelectedUser(selectedUserInfo || {
        name: "User",
        subtitle: "select for contact info",
        avatar: null,
        isOnline: false
      })
    } catch (error) {
      console.error("❌ Error fetching messages:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedUserId) return

    console.log('📤 SENDING MESSAGE:', message.trim())
    const success = ChatWebService.sendChatMessage(
      selectedUserId,
      message.trim()
    )

    if (success) {
      setMessage("")
      ChatWebService.stopTyping(selectedUserId)
      console.log('✅ Message send request successful')
    } else {
      console.error('❌ Failed to send message')
    }
  }

  const handleTyping = (e) => {
    setMessage(e.target.value)

    if (!selectedUserId) return

    if (e.target.value.trim()) {
      ChatWebService.startTyping(selectedUserId)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        ChatWebService.stopTyping(selectedUserId)
      }, 2000)
    } else {
      ChatWebService.stopTyping(selectedUserId)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!selectedUserId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-black mb-2">Select a chat to start messaging</h2>
          <p className="text-gray-600">Choose from your existing conversations or start a new one</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <div className="text-gray-600">Loading messages...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white" key={`chat-${selectedUserId}-${updateKey}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
           <AvatarImage 
              src={selectedUser?.avatar || "/doremon.png"} 
              onError={(e) => {
                e.target.src = "https://via.placeholder.com/150/000000/FFFFFF/?text=" + (selectedUser?.name?.charAt(0) || "U")
              }}
            />
            <AvatarFallback className="bg-black text-white">
              {selectedUser?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-black">{selectedUser?.name || "User"}</h2>
            <p className="text-sm text-gray-600">
              {isTyping ? `${typingUser} is typing...` : selectedUser?.subtitle || ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={`msg-${msg.id}-${updateKey}`}
              className={`flex ${msg.isSent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.isSent
                    ? "bg-black text-white"
                    : "bg-gray-100 text-black"
                }`}
              >
                <div>
                  <p className="text-sm">{msg.content}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs ${msg.isSent ? "text-gray-300" : "text-gray-500"}`}>
                      {msg.timestamp}
                    </p>
                    {msg.isSent && (
                      <span className={`text-xs ml-2 ${
                        msg.is_read ? "text-blue-300" : "text-gray-400"
                      }`}>
                        {msg.is_read ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="flex-1 relative">
            <Input
              placeholder="Type a message"
              value={message}
              onChange={handleTyping}
              onKeyPress={handleKeyPress}
              className="pr-10 border-gray-200 text-black"
            />
          </div>
          {message.trim() ? (
            <Button
              onClick={handleSendMessage}
              size="icon"
              className="h-8 w-8 bg-black text-white hover:bg-gray-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-gray-100">
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Debug info */}
      <div className="text-xs text-gray-400 p-2 bg-gray-100">
        Messages: {messages.length} | Selected: {selectedUserId} | Update: {updateKey}
      </div>
    </div>
  )
}