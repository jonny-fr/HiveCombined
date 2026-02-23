from .base import *  # noqa: F401,F403

DEBUG = False

# ---------------------------------------------------------------------------
# Security hardening (production)
# ---------------------------------------------------------------------------
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# ---------------------------------------------------------------------------
# CORS — DOCKER_TARGET: Explicit allowed origins only, no wildcard
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False  # DOCKER_TARGET: Never wildcard in production
# CORS_ALLOWED_ORIGINS is read from env in base.py

# ---------------------------------------------------------------------------
# Database — DOCKER_TARGET: db (PostgreSQL service)
# Configured via env: DJANGO_DB_ENGINE=django.db.backends.postgresql
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Email — DOCKER_TARGET: SMTP relay (SES, Mailgun, etc.)
# Configured via env: EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Cache — DOCKER_TARGET: cache (Redis service)
# Configured via env: CACHE_BACKEND=django.core.cache.backends.redis.RedisCache
#                     CACHE_URL=redis://cache:6379/0
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Celery — DOCKER_TARGET: worker + beat services with Redis broker
# Configured via env: CELERY_BROKER_URL=redis://cache:6379/1
#                     CELERY_TASK_ALWAYS_EAGER=False
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# File storage — DOCKER_TARGET: storage (MinIO / S3)
# Configured via env: DEFAULT_FILE_STORAGE=storages.backends.s3boto3.S3Boto3Storage
#   AWS_STORAGE_BUCKET_NAME, AWS_S3_ENDPOINT_URL, AWS_ACCESS_KEY_ID, etc.
# ---------------------------------------------------------------------------
