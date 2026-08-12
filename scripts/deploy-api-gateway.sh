#!/usr/bin/env bash
# Deploy / update API Gateway in front of Cloud Run sop-pt-api (Firebase JWT on /v1).
# Prerequisites: Cloud Run service deployed; api-gateway@ PROJECT SA has roles/run.invoker.
# Order: ./scripts/deploy-api.sh  then  ./scripts/deploy-api-gateway.sh

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${GOOGLE_CLOUD_PROJECT:-sop-pt-2}"
REGION="${API_GATEWAY_REGION:-us-central1}"
RUN_REGION="${CLOUD_RUN_REGION:-us-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-sop-pt-api}"
API_ID="${API_GATEWAY_API_ID:-sop-pt-api}"
CFG_ID_PREFIX="${API_GATEWAY_CONFIG_PREFIX:-sop-pt-api}"
GATEWAY_ID="${API_GATEWAY_ID:-sop-pt-gateway}"
GW_SA="${API_GATEWAY_SA:-api-gateway@${PROJECT}.iam.gserviceaccount.com}"
OPENAPI_SRC="$repo_root/services/api/openapi-gateway.yaml"

BACKEND_URL="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT" \
  --region="$RUN_REGION" \
  --format='value(status.url)')"
BACKEND_URL="${BACKEND_URL%/}"

if [[ -z "$BACKEND_URL" ]]; then
  echo "Cloud Run service $SERVICE not found in $PROJECT/$RUN_REGION" >&2
  exit 1
fi

GATEWAY_HOST_KNOWN=""
if gcloud api-gateway gateways describe "$GATEWAY_ID" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  GATEWAY_HOST_KNOWN="$(gcloud api-gateway gateways describe "$GATEWAY_ID" \
    --location="$REGION" \
    --project="$PROJECT" \
    --format='value(defaultHostname)')"
fi
# host / allowCors need the public gateway hostname; fall back for first create.
GATEWAY_HOST="${GATEWAY_HOST_KNOWN:-${API_GATEWAY_HOST_FALLBACK:-sop-pt-gateway-bl0d02si.uc.gateway.dev}}"

tmp=$(mktemp "${TMPDIR:-/tmp}/openapi-XXXXXX.yaml")
trap 'rm -f "$tmp"' EXIT
# Replace backend address + gateway host placeholders (not comments).
sed \
  -e "s|address: \"BACKEND_URL\"|address: \"${BACKEND_URL}\"|" \
  -e "s|GATEWAY_HOST|${GATEWAY_HOST}|g" \
  "$OPENAPI_SRC" >"$tmp"

CFG_ID="${CFG_ID_PREFIX}-$(date +%Y%m%d%H%M%S)"

echo "Creating API config $CFG_ID (backend $BACKEND_URL)"
if ! gcloud api-gateway apis describe "$API_ID" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud api-gateway apis create "$API_ID" --project="$PROJECT"
fi

gcloud api-gateway api-configs create "$CFG_ID" \
  --api="$API_ID" \
  --openapi-spec="$tmp" \
  --project="$PROJECT" \
  --backend-auth-service-account="$GW_SA"

if gcloud api-gateway gateways describe "$GATEWAY_ID" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Updating gateway $GATEWAY_ID"
  gcloud api-gateway gateways update "$GATEWAY_ID" \
    --api="$API_ID" \
    --api-config="$CFG_ID" \
    --location="$REGION" \
    --project="$PROJECT"
else
  echo "Creating gateway $GATEWAY_ID"
  gcloud api-gateway gateways create "$GATEWAY_ID" \
    --api="$API_ID" \
    --api-config="$CFG_ID" \
    --location="$REGION" \
    --project="$PROJECT"
fi

HOST="$(gcloud api-gateway gateways describe "$GATEWAY_ID" \
  --location="$REGION" \
  --project="$PROJECT" \
  --format='value(defaultHostname)')"

echo
echo "Gateway hostname: https://$HOST"
echo "Set GitHub secret VITE_API_BASE_URL=https://$HOST and redeploy Hosting."
echo "Local prod-like: put the same URL in .env.firebase"
