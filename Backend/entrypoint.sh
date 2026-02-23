#!/bin/bash
set -e

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

# Execute the CMD passed to the container
exec "$@"
