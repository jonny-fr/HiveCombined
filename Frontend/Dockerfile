FROM node:22-alpine

# Install CA certificate support
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy package files first for Docker layer caching
COPY package.json package-lock.json* ./

RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 5173

# Entrypoint ensures node_modules exist even when source is bind-mounted
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
