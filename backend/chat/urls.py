# chat/urls.py

from django.urls import path
from .views import (
    UserRegistration,
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    Logout,
    ConversationView,
    ListAllUsers,
    ConversationListView,
)

urlpatterns = [
    # Auth
    path("register/", UserRegistration.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("refresh/", CustomTokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", Logout.as_view(), name="logout"),
    path("users/", ListAllUsers.as_view(), name="Users"),
    

    # Chat
    path("conversation/<int:user_id>/", ConversationView.as_view(), name="conversation"),
    path("conversations/", ConversationListView.as_view(), name="conversation"),
]
