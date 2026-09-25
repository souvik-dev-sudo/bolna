#!/usr/bin/env bash
# Runs on the VM as root, after the workflow unpacks the repo files into /opt/bolna.
# Called by .github/workflows/deploy-gcp.yml with PROJECT_ID, REGISTRY and IMAGE_TAG set.
set -euo pipefail
: "${PROJECT_ID:?}" "${REGISTRY:?}" "${IMAGE_TAG:?}"
export PATH="$PATH:/snap/bin" REGISTRY IMAGE_TAG

APP_DIR=/opt/bolna/local_setup
SERVICES="redis bolna-app plivo-app proxy ngrok"
cd "$APP_DIR"

secret() {
  gcloud secrets versions access latest --secret="bolna-$1" --project="$PROJECT_ID"
}

echo "==> Writing .env and ngrok config from Secret Manager"
umask 077
GEMINI_API_KEY=$(secret gemini-api-key)
cat > .env <<EOF
OPENAI_API_KEY=$(secret openai-api-key)
GEMINI_API_KEY=${GEMINI_API_KEY}
GOOGLE_API_KEY=${GEMINI_API_KEY}
CARTESIA_API_KEY=$(secret cartesia-api-key)
REDIS_URL=redis://redis:6379
PLIVO_AUTH_ID=$(secret plivo-auth-id)
PLIVO_AUTH_TOKEN=$(secret plivo-auth-token)
PLIVO_PHONE_NUMBER=$(secret plivo-phone-number)
EOF
sed "s|^authtoken:.*|authtoken: \"$(secret ngrok-authtoken)\"|" ngrok-config.yml > ngrok-config.cloud.yml
umask 022

# Paths docker-compose.yml mounts into bolna-app
mkdir -p /opt/bolna/agent_data "$HOME/.aws"
touch "$HOME/.aws/credentials" "$HOME/.aws/config"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.cloud.yml"

echo "==> Pulling images ${IMAGE_TAG}"
$COMPOSE pull bolna-app plivo-app

echo "==> Starting ${SERVICES}"
# shellcheck disable=SC2086
$COMPOSE up -d --no-build $SERVICES
# nginx keeps the old container IPs after a recreate
$COMPOSE restart proxy

echo "==> Waiting for bolna-app and plivo-app"
for port in 5001 8002; do
  for _ in $(seq 1 30); do
    curl -s -o /dev/null "http://localhost:${port}/" && break
    sleep 2
  done
done

$COMPOSE ps
echo "==> ngrok URL:"
curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1

# Drop old images so the boot disk does not fill up
docker image prune -af --filter "until=168h" >/dev/null || true
