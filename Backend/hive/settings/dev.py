from .base import *  # noqa: F401,F403

DEBUG = True

# ---------------------------------------------------------------------------
# CORS — DEV_ONLY: Allow all origins for local React dev server
# DOCKER_TARGET: Use explicit CORS_ALLOWED_ORIGINS in production
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True  # DEV_ONLY: True; DOCKER_TARGET: False (use CORS_ALLOWED_ORIGINS)

# ---------------------------------------------------------------------------
# Email — DEV_ONLY: Print emails to console
# DOCKER_TARGET: mailpit (dev) or SMTP relay (prod)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"  # DEV_ONLY

# ---------------------------------------------------------------------------
# Celery — DEV_ONLY: Run tasks synchronously in-process
# DOCKER_TARGET: worker service with Redis broker
# ---------------------------------------------------------------------------
CELERY_TASK_ALWAYS_EAGER = True  # DEV_ONLY: synchronous; DOCKER_TARGET: False
