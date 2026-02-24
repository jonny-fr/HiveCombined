FROM nginx:1.27-alpine

# Install CA certificate support
RUN apk add --no-cache ca-certificates openssl

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Entrypoint installs CA cert + starts Nginx
COPY entrypoint.sh /docker-entrypoint.d/40-install-ca.sh
RUN chmod +x /docker-entrypoint.d/40-install-ca.sh

EXPOSE 443 80
