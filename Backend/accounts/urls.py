from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.views import RegisterView, TokenRefreshView

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("token", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
]
