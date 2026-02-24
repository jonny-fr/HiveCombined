#!/bin/sh
# =============================================================================
# Install the Hive CA certificate into the Nginx container's trust store
# This runs as part of Nginx's docker-entrypoint.d pipeline
# =============================================================================
set -e

CA_CERT="/etc/nginx/certs/ca.crt"

if [ -f "$CA_CERT" ]; then
  echo "[proxy] Installing CA certificate into system trust store..."
  cp "$CA_CERT" /usr/local/share/ca-certificates/hive-ca.crt
  update-ca-certificates 2>/dev/null || true
  echo "[proxy] CA certificate installed."
else
  echo "[proxy] WARNING: CA certificate not found at $CA_CERT"
fi
