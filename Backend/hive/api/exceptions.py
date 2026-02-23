from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {"error": {"code": "server_error", "detail": "An unexpected error occurred."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    code = "validation_error" if response.status_code == status.HTTP_400_BAD_REQUEST else "api_error"
    response.data = {"error": {"code": code, "detail": detail}}
    return response
