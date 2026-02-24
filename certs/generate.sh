#!/bin/sh
# =============================================================================
# Self-Signed CA + Server Certificate Generator
# =============================================================================
# Generates a private CA and a server certificate signed by that CA.
# Runs inside a lightweight Alpine/OpenSSL container; works identically
# on Linux + Windows Docker Desktop (no host tooling required).
#
# Output (written to /certs volume):
#   ca.key / ca.crt         – Certificate Authority (install on clients)
#   server.key / server.crt – Server certificate (used by Nginx proxy)
# =============================================================================
set -e

CERT_DIR="/certs"
CA_KEY="$CERT_DIR/ca.key"
CA_CRT="$CERT_DIR/ca.crt"
SERVER_KEY="$CERT_DIR/server.key"
SERVER_CSR="$CERT_DIR/server.csr"
SERVER_CRT="$CERT_DIR/server.crt"
SERVER_EXT="$CERT_DIR/server.ext"

# Domain / SAN settings – covers localhost, Docker service names, and IPs
DOMAIN="${CERT_DOMAIN:-localhost}"
DAYS="${CERT_DAYS:-825}"

# Skip generation if valid certs already exist (idempotent)
if [ -f "$SERVER_CRT" ] && [ -f "$CA_CRT" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$SERVER_CRT" 2>/dev/null | cut -d= -f2)
  if openssl x509 -checkend 86400 -noout -in "$SERVER_CRT" 2>/dev/null; then
    echo "[cert-init] Certificates exist and are valid (expires: $EXPIRY). Skipping generation."
    exit 0
  fi
  echo "[cert-init] Existing certificate expires within 24h or is invalid. Regenerating..."
fi

echo "[cert-init] Generating self-signed CA + server certificate..."

# ---- 1. Create CA private key + self-signed CA certificate ----
openssl genrsa -out "$CA_KEY" 4096
openssl req -x509 -new -nodes \
  -key "$CA_KEY" \
  -sha256 \
  -days 1825 \
  -out "$CA_CRT" \
  -subj "/C=DE/ST=Hive/L=Docker/O=Hive Dev CA/OU=Engineering/CN=Hive Development CA"

echo "[cert-init] CA certificate created."

# ---- 2. Create server private key + CSR ----
openssl genrsa -out "$SERVER_KEY" 2048
openssl req -new \
  -key "$SERVER_KEY" \
  -out "$SERVER_CSR" \
  -subj "/C=DE/ST=Hive/L=Docker/O=Hive/OU=Backend/CN=$DOMAIN"

# ---- 3. Create SAN extension file ----
cat > "$SERVER_EXT" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = backend
DNS.3 = frontend
DNS.4 = proxy
DNS.5 = db
DNS.6 = *.localhost
DNS.7 = $DOMAIN
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = 0.0.0.0
EOF

# ---- 4. Sign server cert with CA ----
openssl x509 -req \
  -in "$SERVER_CSR" \
  -CA "$CA_CRT" \
  -CAkey "$CA_KEY" \
  -CAcreateserial \
  -out "$SERVER_CRT" \
  -days "$DAYS" \
  -sha256 \
  -extfile "$SERVER_EXT"

# ---- 5. Set permissions (readable by all containers) ----
chmod 644 "$CA_CRT" "$SERVER_CRT"
chmod 600 "$CA_KEY" "$SERVER_KEY"

# ---- 6. Verify ----
echo "[cert-init] Server certificate details:"
openssl x509 -in "$SERVER_CRT" -noout -subject -issuer -dates
echo "[cert-init] SAN entries:"
openssl x509 -in "$SERVER_CRT" -noout -ext subjectAltName
echo "[cert-init] Certificate generation complete."
