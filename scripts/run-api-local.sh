#!/usr/bin/env bash
# Runs the local Cloud Run-compatible API (services/api).
# Invoked by the VS Code/Cursor task "run api (local)".

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
api_dir="$repo_root/services/api"
cd "$api_dir"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH. Install Node.js and try again." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing API dependencies..."
  npm install
fi

export PORT="${PORT:-8080}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"

echo "Starting API from $api_dir on :$PORT ..."
npm run dev
