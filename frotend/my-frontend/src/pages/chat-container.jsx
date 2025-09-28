"use client"
import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { ChatSidebar } from "../components/chat-sidebar"
import { ChatArea } from "../components/chat-area"
import ChatWebService from '../services/websocket'

export function ChatContainer() {
  const [selectedUserId, setSelectedUserId] = useState()
  const [selectedUserInfo, setSelectedUserInfo] = useState(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionError, setConnectionError] = useState(null)
  const location = useLocation()

  // Check if user came from user listing page
  useEffect(() => {
    if (location.state?.selectedUserId) {
      setSelectedUserId(location.state.selectedUserId)
      setSelectedUserInfo(location.state.selectedUserInfo)
    }
  }, [location.state])

  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        setIsConnecting(true)
        setConnectionError(null)
        
        const connected = await ChatWebService.connect()
        
        if (connected) {
          console.log('WebSocket connected successfully')
          
          // Setup connection event handlers
          ChatWebService.on('connection', (data) => {
            if (data.status === 'connected') {
              setIsConnecting(false)
              setConnectionError(null)
            } else if (data.status === 'disconnected') {
              setConnectionError('Connection lost. Attempting to reconnect...')
            }
          })

          ChatWebService.on('error', (data) => {
            console.error('WebSocket error:', data.error)
            setConnectionError(data.error)
          })
          
        } else {
          setConnectionError('Failed to connect to chat service')
        }
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error)
        setConnectionError('Failed to connect to chat service')
      } finally {
        setIsConnecting(false)
      }
    }

    initializeWebSocket()

    // Cleanup on unmount
    return () => {
      ChatWebService.disconnect()
    }
  }, [])

  const handleUserSelect = (userId, userInfo = null) => {
    setSelectedUserId(userId)
    setSelectedUserInfo(userInfo)
  }

  if (isConnecting) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to chat service...</p>
        </div>
      </div>
    )
  }

  if (connectionError && !ChatWebService.getConnectionStatus().isConnected) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-black mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{connectionError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-white">
      <ChatSidebar 
        selectedUserId={selectedUserId} 
        onUserSelect={handleUserSelect}
      />
      <ChatArea 
        selectedUserId={selectedUserId} 
        selectedUserInfo={selectedUserInfo}
      />
      
      {/* Connection status indicator */}
      {connectionError && (
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded">
          {connectionError}
        </div>
      )}
    </div>
  )
}