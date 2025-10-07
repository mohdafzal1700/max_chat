import { getAccessToken } from "../AxiosIntersptors/Userintersptors";

class ChatWebService {
    constructor() {
        this.socket = null;
        this.messageHandlers = new Map();
        this.Connected = false;
        this.reconnectAttempts = 0;
        this.reconnectTime = null;
        this.maxReconnectAttempt = 5;
    }

    async connect() {
        const token = getAccessToken();
        
        // Enhanced token validation
        if (!token) {
            console.error('❌ Cannot connect: token not found');
            console.error('📋 Check localStorage or your token source');
            return false;
        }

        console.log('🎫 Token retrieved:', token.substring(0, 20) + '...');
        console.log('🎫 Token length:', token.length);

        // Construct WebSocket URL with proper encoding
        const wsUrl = `wss://api.maxchat.muhammedafsal.online/ws/chat/?token=${encodeURIComponent(token)}`;
        
        console.log('🔗 Connecting to:', wsUrl.substring(0, 80) + '...');

        try {
            this.socket = new WebSocket(wsUrl);
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('❌ Chat WebSocket connection error:', error);
            throw error;
        }
    }

    setupEventListeners() {
        this.socket.onopen = () => {
            console.log('✓✓✓ Socket Connected Successfully ✓✓✓');
            this.Connected = true;
            this.reconnectAttempts = 0;
            
            if (this.reconnectTime) {
                clearTimeout(this.reconnectTime);
                this.reconnectTime = null;
            }
            
            this.triggerHandler('connection', { status: 'connected' });
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received WebSocket message:', data);
                this.handleMessage(data);
            } catch (error) {
                console.error('❌ Error parsing Chat WebSocket message:', error);
            }
        };

        this.socket.onclose = async (event) => {
            console.log('❌ Chat WebSocket disconnected');
            console.log('📋 Close code:', event.code);
            console.log('📋 Close reason:', event.reason);
            console.log('📋 Was clean:', event.wasClean);
            
            this.Connected = false;
            this.triggerHandler('connection', { status: 'disconnected' });

            // Don't reconnect on authentication failures (code 1008)
            if (event.code === 1008) {
                console.error('❌ Authentication failed - not reconnecting');
                console.error('💡 Please check your token and try refreshing the page');
                return;
            }

            // Reconnect logic for other errors
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempt) {
                this.reconnectTime = setTimeout(async () => {
                    this.reconnectAttempts++;
                    console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempt})`);
                    await this.connect();
                }, Math.min(3000 * this.reconnectAttempts, 30000));
            }
        };

        this.socket.onerror = (error) => {
            console.error('❌ Chat WebSocket error:', error);
            console.error('📋 ReadyState:', this.socket?.readyState);
            this.triggerHandler('error', { error });
        };
    }

    handleMessage(data) {
        const { type } = data;
        console.log('🔄 Handling WebSocket message:', type, data);

        switch (type) {
            case 'chat_message':
                this.triggerHandler('chat_message', {
                    message: data.message,
                    sender_id: data.sender_id,
                    sender_username: data.sender_username
                });
                break;
            
            case 'message_sent':
                this.triggerHandler('message_sent', {
                    message: data.message
                });
                break;
            
            case 'typing_indicator':
                this.triggerHandler('typing_indicator', {
                    sender_id: data.sender_id,
                    sender_username: data.sender_username,
                    is_typing: data.is_typing
                });
                break;
            
            case 'read_receipt':
                this.triggerHandler('read_receipt', {
                    message_id: data.message_id,
                    read_by_id: data.read_by_id,
                    read_by_username: data.read_by_username
                });
                break;
            
            case 'connection':
                this.triggerHandler('connection', {
                    status: data.status,
                    user_id: data.user_id
                });
                break;
            
            case 'error':
                console.error('❌ WebSocket server error:', data.error);
                this.triggerHandler('error', {
                    error: data.error,
                    type: 'server_error'
                });
                break;
            
            default:
                console.log('❓ Unknown message type from server:', type, data);
                this.triggerHandler('unknown_message', data);
        }
    }

    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    triggerHandler(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ Error in ${event} handler:`, error);
                }
            });
        }
    }

    sendChatMessage(receiverId, content, messageType = 'text') {
        if (!this.Connected) {
            console.error('❌ Cannot send message: WebSocket not connected');
            this.triggerHandler('error', {
                error: 'Connection lost. Please wait while we reconnect...',
                type: 'connection_error'
            });
            return false;
        }

        const messageData = {
            type: 'chat_message',
            receiver_id: receiverId,
            content: content,
            message_type: messageType
        };

        console.log('📤 Sending chat message:', messageData);
        return this.send(messageData);
    }

    sendTypingIndicator(receiverId, isTyping) {
        if (!this.Connected) return false;

        const typingData = {
            type: 'typing',
            receiver_id: receiverId,
            is_typing: isTyping
        };

        console.log('⌨️ Sending typing indicator:', typingData);
        return this.send(typingData);
    }

    sendReadReceipt(messageId) {
        if (!this.Connected) {
            console.error('❌ Cannot send read receipt: WebSocket not connected');
            return false;
        }

        const readReceiptData = {
            type: 'read_receipt',
            message_id: messageId
        };

        console.log('✓ Sending read receipt for message:', messageId);
        return this.send(readReceiptData);
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(data));
                return true;
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
                this.triggerHandler('error', {
                    error: 'Failed to send message',
                    type: 'send_error',
                    originalData: data
                });
                return false;
            }
        } else {
            console.error('❌ Cannot send: WebSocket is not open');
            console.error('📋 Current state:', this.getReadyStateString());
            return false;
        }
    }

    disconnect() {
        if (this.reconnectTime) {
            clearTimeout(this.reconnectTime);
            this.reconnectTime = null;
        }
        
        if (this.socket) {
            this.socket.close(1000);
            this.socket = null;
        }
        
        this.Connected = false;
        this.reconnectAttempts = 0;
    }

    getConnectionStatus() {
        return {
            isConnected: this.Connected,
            readyState: this.socket ? this.socket.readyState : WebSocket.CLOSED,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    getReadyStateString() {
        if (!this.socket) return 'CLOSED';
        
        const states = {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSING',
            3: 'CLOSED'
        };
        
        return states[this.socket.readyState] || 'UNKNOWN';
    }
}

export default new ChatWebService();