#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  init-ssl.sh — First-time Let's Encrypt certificate setup
#
#  Usage:
#    chmod +x init-ssl.sh
#    ./init-ssl.sh yourdomain.com your@email.com
# ─────────────────────────────────────────────────────────────
set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: ./init-ssl.sh <domain> <email>"
  exit 1
fi

echo ">>> Creating directories..."
mkdir -p certbot/conf certbot/www

echo ">>> Generating temporary self-signed cert for nginx to start..."
mkdir -p certbot/conf/live/$DOMAIN
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout certbot/conf/live/$DOMAIN/privkey.pem \
  -out certbot/conf/live/$DOMAIN/fullchain.pem \
  -subj "/CN=$DOMAIN"

echo ">>> Replacing \${DOMAIN} in nginx config..."
sed -i "s/\${DOMAIN}/$DOMAIN/g" nginx/conf.d/default.conf

echo ">>> Starting nginx..."
docker compose -f docker-compose.prod.yml up -d nginx

echo ">>> Requesting real certificate from Let's Encrypt..."
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

echo ">>> Reloading nginx with real certificate..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "✅  SSL certificate installed for $DOMAIN"
echo "    Auto-renewal runs inside the certbot container."
