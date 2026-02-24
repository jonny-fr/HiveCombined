#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Install Hive CA certificate into system trust store (if available)
# This allows Python/requests/urllib to trust the self-signed proxy cert.
# ---------------------------------------------------------------------------
CA_CERT="/certs/ca.crt"
if [ -f "$CA_CERT" ]; then
  echo "[backend] Installing CA certificate into system trust store..."
  cp "$CA_CERT" /usr/local/share/ca-certificates/hive-ca.crt
  update-ca-certificates 2>/dev/null || true
  # Also set for Python requests/httpx
  export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
  export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
  echo "[backend] CA certificate installed."
else
  echo "[backend] No CA certificate found at $CA_CERT – skipping."
fi

# Wait for the database to be ready (belt-and-suspenders alongside depends_on healthcheck)
if [ -n "$DJANGO_DB_HOST" ]; then
  echo "Waiting for database at $DJANGO_DB_HOST:${DJANGO_DB_PORT:-5432}..."
  while ! python -c "
import socket, sys, os
host = os.environ.get('DJANGO_DB_HOST', 'db')
port = int(os.environ.get('DJANGO_DB_PORT', '5432'))
try:
    s = socket.create_connection((host, port), timeout=2)
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    echo "  DB not ready yet – retrying in 2s..."
    sleep 2
  done
  echo "Database is reachable."
fi

# Apply database migrations automatically on every container start.
# This is idempotent – Django skips already-applied migrations.
echo "Running database migrations..."
python manage.py migrate --noinput
echo "Migrations complete."

# Execute the CMD passed to the container
exec "$@"
