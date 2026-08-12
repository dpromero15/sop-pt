#!/usr/bin/env bash
# Deploy sop-pt-api to Cloud Run (us-west1, next to Firestore).
# Requires: gcloud auth, Blaze billing, Firestore User on the runtime SA.
#
# Security: do not pass --allow-unauthenticated or --no-invoker-iam-check.
# Org policy also blocks allUsers. Only API Gateway SA should have roles/run.invoker.
# Ingress is "all" so managed API Gateway can reach the service; IAM still blocks
# anonymous callers on *.run.app. /v1 still requires Firebase identity (gateway
# JWT + app requireAuth).

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${GOOGLE_CLOUD_PROJECT:-sop-pt-2}"
REGION="${CLOUD_RUN_REGION:-us-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-sop-pt-api}"
CORS_ORIGIN="${CORS_ORIGIN:-https://sop-pt-2.web.app,https://sop-pt-2.firebaseapp.com}"
ADMIN_EMAIL_ALLOWLIST="${ADMIN_EMAIL_ALLOWLIST:-dromero@sop-network.com}"
MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-3}"

echo "Deploying $SERVICE to $PROJECT ($REGION) from $repo_root/services/api"

# Use ';' as the env-var delimiter so CORS origin lists (commas) stay intact.
ENV_VARS="^;^GOOGLE_CLOUD_PROJECT=$PROJECT;CORS_ORIGIN=$CORS_ORIGIN"
if [[ -n "$ADMIN_EMAIL_ALLOWLIST" ]]; then
  ENV_VARS="$ENV_VARS;ADMIN_EMAIL_ALLOWLIST=$ADMIN_EMAIL_ALLOWLIST"
fi

gcloud run deploy "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --source="$repo_root/services/api" \
  --invoker-iam-check \
  --ingress=all \
  --max-instances="$MAX_INSTANCES" \
  --set-env-vars="$ENV_VARS" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
echo
echo "Cloud Run URL: $URL (private — IAM invoker required; do not put in VITE_API_BASE_URL)"
echo "Next: bash scripts/deploy-api-gateway.sh  then set VITE_API_BASE_URL to the gateway hostname."
