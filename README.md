# MaxChat - Real-Time Chat Application

A modern, real-time chat application built with Django (Backend), React (Frontend), WebSockets, and Docker.

## 🚀 Features

- ✅ Real-time messaging with WebSocket support
- ✅ User authentication (JWT)
- ✅ Online/Offline status tracking
- ✅ Read receipts (✓ and ✓✓)
- ✅ Typing indicators
- ✅ One-on-one chat rooms
- ✅ Conversation history
- ✅ Responsive UI with Tailwind CSS
- ✅ Docker deployment with Nginx reverse proxy
- ✅ Redis for WebSocket message broker

## 🛠️ Tech Stack

### Backend
- **Django 5.2.6** - Web framework
- **Django Channels 4.3.1** - WebSocket support
- **Django REST Framework 3.16.1** - API endpoints
- **Daphne 4.2.1** - ASGI server
- **Redis 6.4.0** - Channel layer backend
- **PostgreSQL** - Database (via Docker)
- **JWT Authentication** - djangorestframework-simplejwt

### Frontend
- **React 18+** - UI library
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **WebSocket API** - Real-time communication
- **Vercel** - Deployment platform

### DevOps
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy & SSL
- **Let's Encrypt** - SSL certificates

## 📁 Project Structure

```
maxchat/
├── backend/                    # Django backend
│   ├── backend/               # Django project settings
│   │   ├── settings.py       # Django configuration
│   │   ├── urls.py           # URL routing
│   │   ├── asgi.py           # ASGI configuration
│   │   └── wsgi.py           # WSGI configuration
│   ├── chat/                  # Chat application
│   │   ├── models.py         # Database models
│   │   ├── views.py          # API views
│   │   ├── consumers.py      # WebSocket consumers
│   │   ├── routing.py        # WebSocket routing
│   │   └── serializers.py    # API serializers
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile            # Backend Docker image
│   └── manage.py             # Django management
│
├── frontend/my-frontend/      # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── chat-area.jsx       # Main chat interface
│   │   │   ├── chat-sidebar.jsx    # Conversation list
│   │   │   └── ui/ui.jsx           # UI components
│   │   ├── endpoints/        # API endpoints
│   │   ├── services/         # WebSocket service
│   │   │   └── websocket.js
│   │   ├── Auth/             # Authentication pages
│   │   └── App.jsx           # Main app component
│   ├── public/               # Static assets
│   │   └── doremon.png      # Default avatar
│   └── package.json          # npm dependencies
│
├── nginx/                     # Nginx configuration
│   └── conf.d/
│       └── default.conf      # Nginx routes & SSL
│
├── docker-compose.yml         # Docker orchestration
├── .env                       # Environment variables
└── README.md                 # This file
```

## 🗄️ Database Models

### ChatRoom
```python
- participants (ManyToMany to User)
- created_at (DateTime)
- updated_at (DateTime)
```

### Chat (Message)
```python
- sender (ForeignKey to User)
- receiver (ForeignKey to User)
- chatroom (ForeignKey to ChatRoom)
- content (CharField, max 1000)
- timestamp (DateTime)
- is_read (Boolean)
```

### UserStatus
```python
- user (OneToOne to User)
- is_online (Boolean)
- last_seen (DateTime)
```

## 🔧 Installation & Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/mohdafzal1700/max_chat.git
cd max_chat
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=maxchat.muhammedafsal.online,localhost,127.0.0.1

# Database
POSTGRES_DB=maxchat_db
POSTGRES_USER=maxchat_user
POSTGRES_PASSWORD=your-secure-password
DB_HOST=db
DB_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Frontend
REACT_APP_API_URL=https://maxchat.muhammedafsal.online
REACT_APP_WS_URL=wss://maxchat.muhammedafsal.online
```

### 3. Backend Setup

#### Using Docker (Recommended)
```bash
# Build and start all services
docker-compose up -d --build

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

#### Manual Setup (Development)
```bash
cd backend

# Create virtual environment
python -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# In another terminal, run Daphne for WebSockets
daphne -b 0.0.0.0 -p 8001 backend.asgi:application
```

### 4. Frontend Setup

#### Using Vercel (Production)
```bash
# Already deployed at: https://maxchat.muhammedafsal.online
# Push changes to GitHub, Vercel auto-deploys
```

#### Manual Setup (Development)
```bash
cd frontend/my-frontend

# Install dependencies
npm install

# Start development server
npm start
```

## 🚀 Deployment

### Docker Deployment (Current)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

### Services Running:
- **Backend (Django + Daphne)**: Port 8000
- **Frontend**: Deployed on Vercel
- **Nginx**: Port 80 (HTTP) & 443 (HTTPS)
- **PostgreSQL**: Port 5432
- **Redis**: Port 6379

## 🔐 API Endpoints

### Authentication
```
POST /api/auth/register/     - Register new user
POST /api/auth/login/        - Login (returns JWT)
POST /api/auth/token/refresh/ - Refresh JWT token
```

### Chat
```
GET  /api/chat/conversations/      - Get all conversations
GET  /api/chat/messages/<user_id>/ - Get messages with user
POST /api/chat/send/                - Send message (via WebSocket preferred)
```

### WebSocket
```
ws://your-domain/ws/chat/   - WebSocket connection
```

#### WebSocket Events:
```javascript
// Send message
{
  "type": "chat_message",
  "receiver_id": 123,
  "message": "Hello!"
}

// Typing indicator
{
  "type": "typing_indicator",
  "receiver_id": 123,
  "is_typing": true
}

// Read receipt
{
  "type": "read_receipt",
  "message_id": 456
}
```

## 🧪 Testing

```bash
# Backend tests
docker-compose exec backend python manage.py test

# Frontend tests
cd frontend/my-frontend
npm test
```

## 📦 Dependencies

### Backend (requirements.txt)
```
Django==5.2.6
djangorestframework==3.16.1
djangorestframework-simplejwt==5.5.1
channels==4.3.1
channels-redis==4.3.0
daphne==4.2.1
redis==6.4.0
django-cors-headers==4.9.0
```

### Frontend (package.json)
```
react
react-dom
react-router-dom
lucide-react
tailwindcss
```

## 🔒 Security Features

- JWT token authentication
- CORS configuration
- HTTPS/SSL encryption (Let's Encrypt)
- Environment variable protection
- SQL injection prevention (Django ORM)
- XSS protection

## 🐛 Troubleshooting

### WebSocket Connection Issues
```bash
# Check Redis is running
docker-compose ps redis

# View Daphne logs
docker-compose logs backend
```

### Database Issues
```bash
# Reset database
docker-compose down -v
docker-compose up -d
docker-compose exec backend python manage.py migrate
```

### Frontend Not Loading
```bash
# Clear browser cache (Ctrl + Shift + R)
# Check Vercel deployment logs
```

## 📝 Development Guide

### Adding New Features

1. **Backend**:
   - Add models in `chat/models.py`
   - Create views in `chat/views.py`
   - Add URLs in `chat/urls.py`
   - Update WebSocket consumers if needed

2. **Frontend**:
   - Create components in `src/components/`
   - Update WebSocket service if needed
   - Add API endpoints in `src/endpoints/`

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "Add your feature"

# Push to GitHub
git push origin feature/your-feature

# Create Pull Request
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Mohammed Afzal**
- GitHub: [@mohdafzal1700](https://github.com/mohdafzal1700)
- Email: muhammedafsal1203@gmail.com

## 🌐 Live Demo

**Production URL**: [https://maxchat.muhammedafsal.online](https://maxchat.muhammedafsal.online)

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Email: muhammedafsal1203@gmail.com

---

**Built with ❤️ using Django, React, and Docker******
