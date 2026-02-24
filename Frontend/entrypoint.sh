#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Install Hive CA certificate into system trust store (if available)
# ---------------------------------------------------------------------------
CA_CERT="/certs/ca.crt"
if [ -f "$CA_CERT" ]; then
  echo "[frontend] Installing CA certificate into system trust store..."
  cp "$CA_CERT" /usr/local/share/ca-certificates/hive-ca.crt
  update-ca-certificates 2>/dev/null || true
  export NODE_EXTRA_CA_CERTS="/certs/ca.crt"
  echo "[frontend] CA certificate installed."
else
  echo "[frontend] No CA certificate found at $CA_CERT – skipping."
fi

# When the source directory is bind-mounted, node_modules from the
# image build layer may be hidden or contain incompatible (host OS) binaries.
# Always verify vite is actually runnable; reinstall if not.
if ! node -e "require('vite')" 2>/dev/null; then
  echo "Installing dependencies..."
  npm install
fi

exec "$@"
