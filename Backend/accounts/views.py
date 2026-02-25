from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView

from accounts.serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class TokenRefreshView(BaseTokenRefreshView):
    """Wraps simplejwt's TokenRefreshView to handle User.DoesNotExist
    as a proper 401 instead of an unhandled 500.
    With ROTATE_REFRESH_TOKENS=True simplejwt looks up the user in the DB;
    if the user no longer exists the token is effectively invalid.
    """

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except get_user_model().DoesNotExist:
            raise InvalidToken("Token contained no recognisable user identification")