import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Docker-Compose target architecture (reference for production deployment)
# ---------------------------------------------------------------------------
# services:
#   backend:        Django + Gunicorn (this project)
#   frontend:       React SPA (Nginx or Node, separate repo/container)
#   db:             PostgreSQL 16
#   cache:          Redis 7 (session / cache / Celery broker)
#   worker:         Celery worker (same image as backend, different entrypoint)
#   beat:           Celery beat scheduler (optional, same image)
#   storage:        MinIO (S3-compatible object storage for media/uploads)
#   mailpit:        Dev-only SMTP catch-all (replaced by SES/Mailgun in prod)
#   reverse-proxy:  Nginx / Traefik (optional, terminates TLS)
# ---------------------------------------------------------------------------


def env(name: str, default=None):
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    raw_value = env(name, str(default))
    return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    raw_value = env(name, default)
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return default


def env_list(name: str, default: str = "") -> list[str]:
    raw_value = env(name, default)
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    "replace-this-dev-secret-with-a-strong-random-value-in-env-2026-rotation-key",
)
DEBUG = env_bool("DJANGO_DEBUG", False)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "django_filters",
    "accounts",
    "events",
    "invitations",
    "polls",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "hive.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "hive.wsgi.application"
ASGI_APPLICATION = "hive.asgi.application"

# ---------------------------------------------------------------------------
# Database
# DEV_ONLY: SQLite for zero-setup local development
# DOCKER_TARGET: db (PostgreSQL 16 service in docker-compose)
# Production: set DJANGO_DB_ENGINE=django.db.backends.postgresql and
#   DJANGO_DB_NAME/USER/PASSWORD/HOST/PORT via environment.
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": env("DJANGO_DB_ENGINE", "django.db.backends.sqlite3"),  # DEV_ONLY: sqlite3; DOCKER_TARGET: postgresql
        "NAME": env("DJANGO_DB_NAME", str(BASE_DIR / "db.sqlite3")),     # DEV_ONLY: local file; DOCKER_TARGET: db name
        "USER": env("DJANGO_DB_USER", ""),
        "PASSWORD": env("DJANGO_DB_PASSWORD", ""),
        "HOST": env("DJANGO_DB_HOST", ""),       # DOCKER_TARGET: db (service name)
        "PORT": env("DJANGO_DB_PORT", ""),        # DOCKER_TARGET: 5432
        "ATOMIC_REQUESTS": True,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ---------------------------------------------------------------------------
# Media / File uploads
# DEV_ONLY: Local filesystem under MEDIA_ROOT
# DOCKER_TARGET: storage (MinIO / S3-compatible object storage)
# Production: swap DEFAULT_FILE_STORAGE to storages.backends.s3boto3.S3Boto3Storage
#   and set AWS_STORAGE_BUCKET_NAME, AWS_S3_ENDPOINT_URL, etc.
# ---------------------------------------------------------------------------
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # DEV_ONLY: local directory; DOCKER_TARGET: S3/MinIO bucket

# Maximum upload size: 10 MB (applies to documents + images)
DATA_UPLOAD_MAX_MEMORY_SIZE = env_int("DATA_UPLOAD_MAX_MEMORY_SIZE", 10 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = env_int("FILE_UPLOAD_MAX_MEMORY_SIZE", 10 * 1024 * 1024)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": env_int("DRF_PAGE_SIZE", 20),
    "EXCEPTION_HANDLER": "hive.api.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env_int("JWT_ACCESS_MINUTES", 15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env_int("JWT_REFRESH_DAYS", 7)),
    "ROTATE_REFRESH_TOKENS": env_bool("JWT_ROTATE_REFRESH_TOKENS", False),
    "BLACKLIST_AFTER_ROTATION": env_bool("JWT_BLACKLIST_AFTER_ROTATION", True),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Hive API",
    "DESCRIPTION": "MVP backend for Hive event planning.",
    "VERSION": "1.0.0",
}

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_HTTPONLY = env_bool("CSRF_COOKIE_HTTPONLY", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"

SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", False)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")

INVITATION_TTL_HOURS = env_int("INVITATION_TTL_HOURS", 168)

# ---------------------------------------------------------------------------
# Email
# DEV_ONLY: Console backend prints emails to stdout (zero config)
# DOCKER_TARGET: mailpit (dev) / SMTP relay service (prod, e.g. SES/Mailgun)
# Production: set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
#   and EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS.
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",  # DEV_ONLY: console; DOCKER_TARGET: smtp
)
EMAIL_HOST = env("EMAIL_HOST", "localhost")       # DOCKER_TARGET: mailpit / smtp relay
EMAIL_PORT = env_int("EMAIL_PORT", 1025)          # DOCKER_TARGET: 1025 (mailpit) / 587 (prod)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)  # DOCKER_TARGET: True for production SMTP
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "noreply@hive.local")

# ---------------------------------------------------------------------------
# Cache
# DEV_ONLY: Django's in-memory LocMemCache (no external dependency)
# DOCKER_TARGET: cache (Redis 7 service in docker-compose)
# Production: set CACHE_URL=redis://cache:6379/0
# ---------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": env(
            "CACHE_BACKEND",
            "django.core.cache.backends.locmem.LocMemCache",  # DEV_ONLY: in-process; DOCKER_TARGET: redis
        ),
        "LOCATION": env("CACHE_URL", "hive-locmem"),  # DOCKER_TARGET: redis://cache:6379/0
        "TIMEOUT": env_int("CACHE_TIMEOUT", 300),
    }
}

# ---------------------------------------------------------------------------
# Celery / Background jobs
# DEV_ONLY: CELERY_TASK_ALWAYS_EAGER=True runs tasks synchronously in-process
# DOCKER_TARGET: worker + beat services; broker = cache (Redis)
# Production: set CELERY_BROKER_URL=redis://cache:6379/1
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", "memory://")  # DEV_ONLY: memory; DOCKER_TARGET: redis://cache:6379/1
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", "")   # DOCKER_TARGET: redis://cache:6379/2
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", True)  # DEV_ONLY: True; DOCKER_TARGET: False
CELERY_TASK_EAGER_PROPAGATES = True

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("DJANGO_LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "hive": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}

# ---------------------------------------------------------------------------
# Feature flags (Priority 3 features – enable when ready)
# ---------------------------------------------------------------------------
FEATURE_COMMENTS_ENABLED = env_bool("FEATURE_COMMENTS_ENABLED", True)
FEATURE_REACTIONS_ENABLED = env_bool("FEATURE_REACTIONS_ENABLED", True)
FEATURE_DOCUMENTS_ENABLED = env_bool("FEATURE_DOCUMENTS_ENABLED", True)
FEATURE_GALLERY_ENABLED = env_bool("FEATURE_GALLERY_ENABLED", True)
