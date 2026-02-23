#!/bin/sh
set -e

# When the source directory is bind-mounted, node_modules from the
# image build layer may be hidden or contain incompatible (host OS) binaries.
# Always verify vite is actually runnable; reinstall if not.
if ! node -e "require('vite')" 2>/dev/null; then
  echo "Installing dependencies..."
  npm install
fi

exec "$@"
